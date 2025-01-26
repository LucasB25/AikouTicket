import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { type Bot, Command, type Context } from '../../structures/index.js';
import { TicketManager } from '../../utils/TicketManager.js';

export default class ConfigStatus extends Command {
	constructor(client: Bot) {
		super(client, {
			name: 'configstatus',
			description: {
				content: 'Get the current configuration status',
				usage: 'configstatus',
				examples: ['configstatus'],
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
			const embeds = [
				this.createEmbed('General Status', [
					{ name: '🛠️ Support Roles', value: config.supportRoles.map(role => `\`${role}\``).join(', '), inline: true },
					{ name: '🏷️ Ticket Category ID', value: `\`${config.ticketCategoryId}\``, inline: true },
					{ name: '👤 Max Active Tickets Per User', value: `\`${config.maxActiveTicketsPerUser}\``, inline: true },
					{
						name: '⏲️ Ticket Activity Check Interval',
						value: `\`${config.ticketActivityCheckInterval} minutes\``,
						inline: true,
					},
				]),
				this.createEmbed('Logs Configuration', [
					{ name: '📜 Log Channel ID', value: `\`${config.logChannelId}\``, inline: true },
					{ name: '📄 Transcript Logs Channel ID', value: `\`${config.transcriptLogsChannelId}\``, inline: true },
				]),
				this.createEmbed('Active Configuration', [
					{ name: '📂 Enable Transcripts', value: config.enableTranscripts ? '`Yes`' : '`No`', inline: true },
					{
						name: '🕵️ Enable Ticket Activity Check',
						value: config.enableTicketActivityCheck ? '`Yes`' : '`No`',
						inline: true,
					},
					{ name: '📝 Enable Ticket Reason', value: config.enableTicketReason ? '`Yes`' : '`No`', inline: true },
					{
						name: '🔔 Enable Notify Ticket Creator',
						value: config.enableNotifyTicketCreator ? '`Yes`' : '`No`',
						inline: true,
					},
					{ name: '🔒 Close Ticket Staff Only', value: config.closeTicketStaffOnly ? '`Yes`' : '`No`', inline: true },
					{ name: '✅ Enable Claim Button', value: config.enableClaimButton ? '`Yes`' : '`No`', inline: true },
				]),
			];

			const rows = ['main', 'logs', 'active'].map(id => this.createRow(id));
			const message = await ctx.sendMessage({ embeds: [embeds[0]], components: [rows[0]] });

			const collector = message.createMessageComponentCollector({ time: 60000 });
			collector.on('collect', async interaction => {
				const index = ['main', 'logs', 'active'].indexOf(interaction.customId);
				if (index !== -1) await interaction.update({ embeds: [embeds[index]], components: [rows[index]] });
			});

			collector.on('end', () => message.edit({ components: [] }));
		} catch {
			await ctx.sendMessage({ content: 'There was an error retrieving the configuration.' });
		}
	}

	createEmbed(title: string, fields: { name: string; value: string; inline?: boolean }[]): any {
		return this.client.embed().setTitle(title).addFields(fields).setTimestamp();
	}

	createRow(current: string): ActionRowBuilder<ButtonBuilder> {
		return new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId('main')
				.setLabel('Main Configuration')
				.setStyle(ButtonStyle.Primary)
				.setDisabled(current === 'main'),
			new ButtonBuilder()
				.setCustomId('logs')
				.setLabel('Logs Configuration')
				.setStyle(ButtonStyle.Primary)
				.setDisabled(current === 'logs'),
			new ButtonBuilder()
				.setCustomId('active')
				.setLabel('Active Configuration')
				.setStyle(ButtonStyle.Primary)
				.setDisabled(current === 'active'),
		);
	}
}
