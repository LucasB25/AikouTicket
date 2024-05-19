import {
    ActionRowBuilder,
    ChannelType,
    CommandInteraction,
    GuildChannelCreateOptions,
    PermissionFlagsBits,
    StringSelectMenuBuilder,
    TextChannel,
} from 'discord.js';
import fs from 'node:fs/promises';
import YAML from 'yaml';

import { Bot, Event } from '../../structures/index.js';

export default class InteractionCreate extends Event {
    constructor(client: Bot, file: string) {
        super(client, file, {
            name: 'interactionCreate',
        });
    }

    public async run(interaction: any): Promise<void> {
        try {
            if (interaction.isCommand()) {
                const commandName = interaction.commandName;
                const command = this.client.commands.get(commandName);
                if (!command) {
                    return;
                }

                await command.run(this.client, interaction);
            }
        } catch (error) {
            this.client.logger.error(error);
            await this.replyWithError(
                interaction,
                'There was an error while executing this command!'
            );
        }

        if (interaction.isStringSelectMenu() && interaction.customId === 'categoryMenu') {
            await interaction.deferReply({ ephemeral: true }).catch(() => {});
            try {
                const configFile = await fs.readFile('./config.yml', 'utf8');
                const config = YAML.parse(configFile);

                const maxActiveTicketsPerUser = config.maxActiveTicketsPerUser;

                const selectMenuOptions = await this.client.prisma.tickets.findUnique({
                    where: {
                        guildId: interaction.guild.id,
                    },
                });

                if (selectMenuOptions && selectMenuOptions.selectMenuOptions) {
                    const parsedOptions = JSON.parse(selectMenuOptions.selectMenuOptions);

                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId('categoryMenu')
                        .setPlaceholder(config.menuPlaceholder)
                        .setMinValues(1)
                        .setMaxValues(1)
                        .addOptions(parsedOptions);

                    const updatedActionRow =
                        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

                    await interaction.message.edit({ components: [updatedActionRow] });

                    const selectedOption = interaction.values[0];
                    const category = parsedOptions.find((opt: any) => opt.value === selectedOption);

                    if (category) {
                        const userTickets = interaction.guild.channels.cache.filter(
                            channel =>
                                channel.type === ChannelType.GuildText &&
                                channel.name.startsWith(`ticket-${interaction.user.username}`)
                        );

                        if (userTickets.size >= maxActiveTicketsPerUser) {
                            await interaction.editReply({
                                content: `You have reached the maximum limit of active tickets (${maxActiveTicketsPerUser}).`,
                            });
                            return;
                        }

                        const channel = await this.createTicket(interaction, category.label);
                        if (channel) {
                            await interaction.editReply({
                                content: `Ticket created: ${channel.toString()}`,
                            });
                        } else {
                            await this.replyWithError(
                                interaction,
                                `Failed to create ticket channel.`
                            );
                        }
                    } else {
                        await this.replyWithError(interaction, `Selected category is not valid.`);
                    }
                } else {
                    throw new Error('No select menu options found.');
                }
            } catch (error) {
                this.client.logger.error(error);
                if (interaction instanceof CommandInteraction) {
                    await this.replyWithError(
                        interaction,
                        'There was an error while executing this command!'
                    );
                } else if (interaction.isStringSelectMenu()) {
                    await this.replyWithError(interaction, `Failed to update the select menu.`);
                }
            }
        }
    }
    private async createTicket(
        interaction: CommandInteraction,
        categoryLabel: string
    ): Promise<TextChannel | null> {
        try {
            const configFile = await fs.readFile('./config.yml', 'utf8');
            const config = YAML.parse(configFile);

            const supportRoles: string[] = config.supportRoles;
            const userName = interaction.user.username;

            const channelOptions: GuildChannelCreateOptions = {
                name: `ticket-${userName}`,
                type: ChannelType.GuildText,
                topic: `Ticket for ${categoryLabel}`,
                parent: config.ticketCategoryId,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: ['ViewChannel'],
                    },
                    {
                        id: interaction.user.id,
                        allow: [
                            'ViewChannel',
                            'SendMessages',
                            'ReadMessageHistory',
                            'AttachFiles',
                            'AddReactions',
                        ],
                    },
                    ...supportRoles.map(roleId => ({
                        id: roleId,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.AddReactions,
                        ],
                    })),
                ],
            };

            const channel = await interaction.guild.channels.create(channelOptions);

            if (channel instanceof TextChannel) {
                channel.client.once('channelDelete', async deletedChannel => {
                    if (deletedChannel.id === channel.id) {
                        //
                    }
                });
                return channel;
            } else {
                throw new Error('Failed to create a text channel');
            }
        } catch (error) {
            this.client.logger.error(error);
            return null;
        }
    }

    private async replyWithError(interaction: CommandInteraction, message: string): Promise<void> {
        await interaction[interaction.replied ? 'editReply' : 'reply']({
            content: message,
            ephemeral: true,
        });
    }
}
