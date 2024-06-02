import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    EmbedBuilder,
    MessageComponentInteraction,
    StringSelectMenuBuilder,
    TextChannel,
} from 'discord.js';

import { Bot, Context, Event } from '../../structures/index.js';
import { LogsManager } from '../../utils/LogsManager.js';
import { TicketManager } from '../../utils/TicketManager.js';

export default class InteractionCreate extends Event {
    constructor(client: Bot, file: string) {
        super(client, file, { name: 'interactionCreate' });
    }

    public async run(interaction: any): Promise<void> {
        try {
            if (interaction.isCommand()) {
                await this.handleCommandInteraction(interaction);
            } else if (
                interaction.isStringSelectMenu() &&
                interaction.customId === 'categoryMenu'
            ) {
                await this.handleSelectMenuInteraction(interaction);
            } else if (interaction.isButton()) {
                await this.handleButtonInteraction(interaction);
            }
        } catch (error) {
            this.client.logger.error(`Failed to handle interaction: ${error.message}`);
            await interaction.reply({
                content: `An error occurred: \`${error.message}\``,
                ephemeral: true,
            });
        }
    }

    private async handleCommandInteraction(interaction: any): Promise<void> {
        const command = this.client.commands.get(interaction.commandName);
        if (!command) return;

        const ctx = new Context(interaction, interaction.options.data);
        ctx.setArgs(interaction.options.data);

        try {
            await command.run(this.client, ctx, ctx.args);
        } catch (error) {
            this.client.logger.error(error);
            await interaction.reply({
                content: `An error occurred: \`${error.message}\``,
                ephemeral: true,
            });
        }
    }

    private async handleSelectMenuInteraction(interaction: any): Promise<void> {
        await interaction.deferReply({ ephemeral: true });

        try {
            const config = await TicketManager.readConfigFile();
            const selectMenuOptions = await this.client.db.get(interaction.guild.id);

            if (!selectMenuOptions?.selectMenuOptions) {
                throw new Error('No select menu options found.');
            }

            const parsedOptions = JSON.parse(selectMenuOptions.selectMenuOptions);
            await this.updateSelectMenu(interaction, config.menuPlaceholder, parsedOptions);

            const selectedOption = interaction.values[0];
            const category = parsedOptions.find((opt: any) => opt.value === selectedOption);

            if (!category) {
                throw new Error('Selected category is not valid.');
            }

            const userTickets = interaction.guild.channels.cache.filter(
                channel =>
                    channel.type === ChannelType.GuildText &&
                    channel.name.startsWith(`ticket-${interaction.user.username}`)
            );

            if (userTickets.size >= config.maxActiveTicketsPerUser) {
                await interaction.editReply({
                    content: `You have reached the maximum limit of active tickets (${config.maxActiveTicketsPerUser}).`,
                });
                return;
            }

            const channel = await TicketManager.createTicket(
                interaction,
                category.value,
                this.client
            );
            await this.replyWithTicketCreationResult(interaction, channel);
        } catch (error) {
            this.client.logger.error(error);
            await interaction.editReply({
                content: 'Failed to update the select menu.',
            });
        }
    }

    private async handleButtonInteraction(interaction: any): Promise<void> {
        switch (interaction.customId) {
            case 'close-ticket':
                await this.handleCloseTicketButton(interaction);
                break;
            case 'confirm-close-ticket':
                await this.handleConfirmCloseTicketButton(interaction);
                break;
            case 'claim-ticket':
                await this.handleClaimTicketButton(interaction);
                break;
            case 'unclaim-ticket':
                await this.handleUnclaimTicketButton(interaction);
                break;
        }
    }

    private async handleClaimTicketButton(interaction: any): Promise<void> {
        const config = await TicketManager.readConfigFile();
        const supportRoles = config.supportRoles;

        const memberRoles = interaction.member.roles.cache.map((role: any) => role.id);
        const isSupport = memberRoles.some(role => supportRoles.includes(role));

        if (!isSupport) {
            await interaction.reply({
                content: 'You do not have permission to claim this ticket.',
                ephemeral: true,
            });
            return;
        }

        const userName = interaction.user.username;

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setDescription(`Ticket claimed by ${userName}.`);

        await interaction.reply({
            embeds: [embed],
            ephemeral: false,
        });

        const components = interaction.message.components[0].components;
        const claimButtonIndex = components.findIndex(
            component => component.customId === 'claim-ticket'
        );

        if (claimButtonIndex !== -1) {
            components[claimButtonIndex] = new ButtonBuilder()
                .setCustomId('claim-ticket')
                .setLabel('Claimed')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
                .setEmoji('🎫');

            const unclaimButton = new ButtonBuilder()
                .setCustomId('unclaim-ticket')
                .setLabel('Unclaim')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⚠️');

            components.push(unclaimButton);
        }

        const embeds = interaction.message.embeds;
        if (embeds.length > 0) {
            const existingEmbed = embeds[0];
            const updatedEmbed = new EmbedBuilder(existingEmbed).setDescription(
                existingEmbed.description + `\n\n> **Claimed by**: ${userName}`
            );
            interaction.message.edit({
                components: [new ActionRowBuilder<ButtonBuilder>().addComponents(components)],
                embeds: [updatedEmbed],
            });
        } else {
            await interaction.message.edit({
                components: [new ActionRowBuilder<ButtonBuilder>().addComponents(components)],
            });
        }
    }

    private async handleUnclaimTicketButton(interaction: any): Promise<void> {
        const config = await TicketManager.readConfigFile();
        const supportRoles = config.supportRoles;

        const memberRoles = interaction.member.roles.cache.map((role: any) => role.id);
        const isSupport = memberRoles.some(role => supportRoles.includes(role));

        if (!isSupport) {
            await interaction.reply({
                content: 'You do not have permission to unclaim this ticket.',
                ephemeral: true,
            });
            return;
        }

        const components = interaction.message.components[0].components;
        const claimButtonIndex = components.findIndex(
            component => component.customId === 'claim-ticket'
        );

        if (claimButtonIndex !== -1) {
            components[claimButtonIndex] = new ButtonBuilder()
                .setCustomId('claim-ticket')
                .setLabel('Claim')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎫');
        }

        const unclaimButtonIndex = components.findIndex(
            component => component.customId === 'unclaim-ticket'
        );

        if (unclaimButtonIndex !== -1) {
            components.splice(unclaimButtonIndex, 1);
        }
        const userName = interaction.user.username;
        const embeds = interaction.message.embeds;
        if (embeds.length > 0) {
            const existingEmbed = embeds[0];
            const updatedDescription = existingEmbed.description.replace(`\n\n> **Claimed by**: ${userName}`, '');
            const updatedEmbed = new EmbedBuilder(existingEmbed).setDescription(updatedDescription);
            interaction.message.edit({
                components: [new ActionRowBuilder<ButtonBuilder>().addComponents(components)],
                embeds: [updatedEmbed],
            });
        } else {
            await interaction.message.edit({
                components: [new ActionRowBuilder<ButtonBuilder>().addComponents(components)],
            });
        }
    }

    private async handleCloseTicketButton(interaction: any): Promise<void> {
        const config = await TicketManager.readConfigFile();
        const supportRoles = config.supportRoles;
        const closeTicketStaffOnly = config.closeTicketStaffOnly;

        const memberRoles = interaction.member.roles.cache.map((role: any) => role.id);
        const isSupport = memberRoles.some(role => supportRoles.includes(role));

        if (closeTicketStaffOnly) {
            if (!isSupport) {
                await interaction.reply({
                    content: 'You do not have permission to close this ticket.',
                    ephemeral: true,
                });
                return;
            }
        } else {
            if (interaction.channel.topic?.includes(interaction.user.id)) {
                await this.handleConfirmCloseTicketButton(interaction);
                return;
            }
        }

        const confirmationButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('confirm-close-ticket')
                .setLabel('Confirm')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⛔')
        );

        const embed = new EmbedBuilder()
            .setColor('#FF2400')
            .setTitle('Confirm Ticket Closure')
            .setDescription('Are you sure you want to close the ticket?')
            .setFooter({ text: 'You have 60 seconds to respond.' });

        const message = await interaction.reply({
            embeds: [embed],
            components: [confirmationButtons],
            ephemeral: true,
        });

        let shouldDeleteMessage = true;

        setTimeout(async () => {
            if (shouldDeleteMessage) {
                await message
                    .delete()
                    .catch(error => this.client.logger.error('Failed to delete message:', error));
            }
        }, 60000);

        const filter = (i: MessageComponentInteraction): boolean =>
            i.customId === 'confirm-close-ticket';
        const collector = interaction.channel.createMessageComponentCollector({
            filter,
            time: 60000,
        });

        collector.on('collect', async () => {
            shouldDeleteMessage = false;
            collector.stop();
        });
    }

    private async handleConfirmCloseTicketButton(interaction: any): Promise<void> {
        const channel = interaction.channel as TextChannel;

        const categoryLabelMatch = channel.topic?.match(/Ticket Type: (.+)/);
        const categoryLabel = categoryLabelMatch ? categoryLabelMatch[1] : 'unknown';

        const embed = new EmbedBuilder()
            .setColor(this.client.color)
            .setDescription('Ticket will be closed in 10 seconds.');

        await interaction.reply({
            embeds: [embed],
            ephemeral: false,
        });

        setTimeout(async () => {
            try {
                await LogsManager.logTicketDeletion(
                    interaction,
                    this.client,
                    interaction.user.username,
                    categoryLabel,
                    channel
                );

                await channel.delete('Ticket closed by user.');
            } catch (error) {
                this.client.logger.error('Failed to delete channel:', error);
            }
        }, 10000);
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

    private async replyWithTicketCreationResult(
        interaction: any,
        channel: TextChannel | null
    ): Promise<void> {
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
