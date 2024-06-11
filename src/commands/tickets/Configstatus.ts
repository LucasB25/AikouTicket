import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

import { type Bot, Command, type Context } from '../../structures/index.js';
import { TicketManager } from '../../utils/TicketManager.js';

export default class ConfigStatus extends Command {
    constructor(client: Bot) {
        super(client, {
            name: 'configstatus',
            nameLocalizations: {
                fr: 'statutdelaconfig',
            },
            description: {
                content: 'Get the current configuration status',
                usage: 'configstatus',
                examples: ['configstatus'],
            },
            descriptionLocalizations: {
                fr: 'Obtenez le statut actuel de la configuration.',
            },
            category: 'general',
            permissions: {
                dev: false,
                client: ['SendMessages', 'ViewChannel', 'EmbedLinks'],
                user: ['ManageGuild'],
            },
            cooldown: 3,
            options: [],
        });
    }

    async run(_client: Bot, ctx: Context): Promise<void> {
        try {
            const config = await TicketManager.readConfigFile();
            const mainEmbed = this.createEmbed('General Status', [
                { name: '🛠️ Support Roles', value: config.supportRoles.map((role) => `\`${role}\``).join(', '), inline: true },
                { name: '🏷️ Ticket Category ID', value: `\`${config.ticketCategoryId}\``, inline: true },
                { name: '👤 Max Active Tickets Per User', value: `\`${config.maxActiveTicketsPerUser.toString()}\``, inline: true },
                { name: '⏲️ Ticket Activity Check Interval', value: `\`${config.ticketActivityCheckInterval} minutes\``, inline: true },
            ]);
            const logsEmbed = this.createEmbed('Logs Configuration', [
                { name: '📜 Log Channel ID', value: `\`${config.logChannelId}\``, inline: true },
                { name: '📄 Transcript Logs Channel ID', value: `\`${config.transcriptLogsChannelId}\``, inline: true },
            ]);
            const activeEmbed = this.createEmbed('Active Configuration', [
                { name: '📂 Enable Transcripts', value: config.enableTranscripts ? '`Yes`' : '`No`', inline: true },
                { name: '🕵️ Enable Ticket Activity Check', value: config.enableTicketActivityCheck ? '`Yes`' : '`No`', inline: true },
                { name: '📝 Enable Ticket Reason', value: config.enableTicketReason ? '`Yes`' : '`No`', inline: true },
                { name: '🔔 Enable Notify Ticket Creator', value: config.enableNotifyTicketCreator ? '`Yes`' : '`No`', inline: true },
                { name: '🔒 Close Ticket Staff Only', value: config.closeTicketStaffOnly ? '`Yes`' : '`No`', inline: true },
                { name: '✅ Enable Claim Button', value: config.enableClaimButton ? '`Yes`' : '`No`', inline: true },
            ]);

            const mainRow = this.createRow('Main Configuration');
            const logsRow = this.createRow('Logs Configuration');
            const activeRow = this.createRow('Active Configuration');

            const message = await ctx.sendMessage({ embeds: [mainEmbed], components: [mainRow] });
            const collector = message.createMessageComponentCollector({ time: 60000 });

            let currentEmbed = 'main';

            collector.on('collect', async (interaction) => {
                if (interaction.customId === currentEmbed) return;

                switch (interaction.customId) {
                    case 'main':
                        await interaction.update({ embeds: [mainEmbed], components: [mainRow] });
                        currentEmbed = 'main';
                        break;
                    case 'logs':
                        await interaction.update({ embeds: [logsEmbed], components: [logsRow] });
                        currentEmbed = 'logs';
                        break;
                    case 'active':
                        await interaction.update({ embeds: [activeEmbed], components: [activeRow] });
                        currentEmbed = 'active';
                        break;
                }
            });

            collector.on('end', async (_collected) => {
                await message.edit({ components: [] });
            });
        } catch (_error) {
            await ctx.sendMessage({ content: 'There was an error retrieving the configuration.' });
        }
    }

    createEmbed(title: string, fields: { name: string; value: string; inline?: boolean }[]): any {
        return this.client.embed().setColor(this.client.color).setTitle(title).addFields(fields).setTimestamp();
    }

    createRow(label: string): ActionRowBuilder<ButtonBuilder> {
        return new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('main')
                .setLabel('Main Configuration')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(label === 'Main Configuration'),
            new ButtonBuilder()
                .setCustomId('logs')
                .setLabel('Logs Configuration')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(label === 'Logs Configuration'),
            new ButtonBuilder()
                .setCustomId('active')
                .setLabel('Active Configuration')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(label === 'Active Configuration'),
        );
    }
}
