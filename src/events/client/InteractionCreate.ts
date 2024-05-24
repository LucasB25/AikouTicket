import { ActionRowBuilder, ChannelType, StringSelectMenuBuilder, TextChannel } from 'discord.js';

import { Bot, Context, Event } from '../../structures/index.js';
import { LogsManager } from '../../utils/LogsManager.js';
import { TicketManager } from '../../utils/TicketManager.js';

export default class InteractionCreate extends Event {
    constructor(client: Bot, file: string) {
        super(client, file, { name: 'interactionCreate' });
    }

    public async run(interaction: any): Promise<void> {
        if (interaction.isCommand()) {
            await this.handleCommandInteraction(interaction);
        } else if (interaction.isStringSelectMenu() && interaction.customId === 'categoryMenu') {
            await this.handleSelectMenuInteraction(interaction);
        } else if (interaction.isButton() && interaction.customId === 'close-ticket') {
            await this.handleButtonInteraction(interaction);
        }
    }

    private async handleCommandInteraction(interaction: any): Promise<void> {
        try {
            const command = this.client.commands.get(interaction.commandName);
            if (!command) return;
            const ctx = new Context(interaction, interaction.options.data);
            ctx.setArgs(interaction.options.data);
            await command.run(this.client, ctx, ctx.args);
        } catch (error) {
            this.client.logger.error(error);
            await interaction.reply({
                content: `An error occurred: \`${error}\``,
                ephemeral: true,
            });
        }
    }

    private async handleSelectMenuInteraction(interaction: any): Promise<void> {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        try {
            const config = await TicketManager.readConfigFile();
            const selectMenuOptions = await this.client.db.get(interaction.guild.id);

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

    private async handleButtonInteraction(interaction: any): Promise<void> {
        const channel = interaction.channel as TextChannel;

        const categoryLabelMatch = channel.topic?.match(/Ticket Type: (.+)/);
        const categoryLabel = categoryLabelMatch ? categoryLabelMatch[1] : 'unknown';

        await interaction.reply({
            content: 'Ticket will be closed in 10 seconds.',
            ephemeral: false,
        });
        setTimeout(async () => {
            await LogsManager.logTicketDeletion(
                interaction,
                this.client,
                interaction.user.username,
                categoryLabel,
                channel
            );
            await channel.delete('Ticket closed by user.');
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
