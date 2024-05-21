import { ActionRowBuilder, ChannelType, StringSelectMenuBuilder } from 'discord.js';

import { Bot, Context, Event } from '../../structures/index.js';

export default class InteractionCreate extends Event {
    constructor(client: Bot, file: string) {
        super(client, file, {
            name: 'interactionCreate',
        });
    }

    public async run(interaction: any): Promise<void> {
        try {
            if (interaction.isCommand()) {
                const command = this.client.commands.get(interaction.commandName);
                if (!command) return;
                const ctx = new Context(interaction, interaction.options.data);
                ctx.setArgs(interaction.options.data);
                try {
                    await command.run(this.client, ctx, ctx.args);
                } catch (error) {
                    this.client.logger.error(error);
                    await interaction.reply({
                        content: `An error occurred: \`${error}\``,
                        ephemeral: true,
                    });
                }
            }
        } catch (error) {
            this.client.logger.error(error);
            await interaction.reply({
                content: 'There was an error while executing this command!',
                ephemeral: true,
            });
        }

        if (interaction.isStringSelectMenu() && interaction.customId === 'categoryMenu') {
            await interaction.deferReply({ ephemeral: true }).catch(() => {});
            try {
                const config = await this.client.ticketmanager.readConfigFile();
                const maxActiveTicketsPerUser = config.maxActiveTicketsPerUser;

                const selectMenuOptions = await this.client.prisma.tickets.findUnique({
                    where: { guildId: interaction.guild.id },
                });

                if (selectMenuOptions?.selectMenuOptions) {
                    const parsedOptions = JSON.parse(selectMenuOptions.selectMenuOptions);
                    await this.updateSelectMenu(interaction, config.menuPlaceholder, parsedOptions);

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

                        const channel = await this.client.ticketmanager.createTicket(
                            interaction,
                            category.value,
                            this.client
                        );
                        await this.replyWithTicketCreationResult(interaction, channel);
                    } else {
                        await interaction.editReply({
                            content: `Selected category is not valid.`,
                        });
                    }
                } else {
                    throw new Error('No select menu options found.');
                }
            } catch (error) {
                this.client.logger.error(error);
                await interaction.editReply({
                    content: 'Failed to update the select menu.',
                });
            }
        }
    }

    private async updateSelectMenu(
        interaction: any,
        placeholder: string,
        options: any
    ): Promise<void> {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('categoryMenu')
            .setPlaceholder(placeholder)
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(options);

        const updatedActionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            selectMenu
        );
        await interaction.message.edit({ components: [updatedActionRow] });
    }

    private async replyWithTicketCreationResult(interaction: any, channel: any): Promise<void> {
        if (channel) {
            await interaction.editReply({
                content: `Your new ticket ${channel.toString()} has been created, ${interaction.user.username}!`,
            });
        } else {
            await interaction.editReply({
                content: `Failed to create ticket channel.`,
            });
        }
    }
}
