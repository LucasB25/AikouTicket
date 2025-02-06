import type { Bot } from '../structures/index.js';
import {
	ActionRowBuilder,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	ChannelType,
	type CommandInteraction,
	EmbedBuilder,
	PermissionFlagsBits,
	type Snowflake,
	TextChannel,
} from 'discord.js';
import { promises as fs } from 'node:fs';
import YAML from 'yaml';
import { LogsManager } from './LogsManager.js';

interface Config {
	supportRoles: Snowflake[];
	ticketCategoryId: Snowflake;
	ticketLogChannelId: Snowflake;
	maxActiveTicketsPerUser: number;
	menuPlaceholder: string;
	enableClaimButton: boolean;
	closeTicketStaffOnly: boolean;
	enableTicketReason: boolean;
	enableNotifyTicketCreator: boolean;
	ticketActivityCheckInterval: number;
	logChannelId: Snowflake;
	enableTranscripts: boolean;
	transcriptLogsChannelId: Snowflake;
	enableTicketActivityCheck: boolean;
	ticketCategories: Record<
		string,
		{
			menuLabel: string;
			menuDescription: string;
			menuEmoji: string;
			embedDescription: string;
		}
	>;
	embeds: Record<
		string,
		{
			color: number;
			title: string;
			description: string;
			timestamp: boolean;
			URL: string;
			image: string;
			thumbnail: string;
			footer: { text: string; iconURL: string };
			author: { name: string; iconURL: string; url: string };
		}
	>;
}

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class TicketManager {
	public static async createTicket(
		interaction: CommandInteraction | ButtonInteraction,
		categoryLabel: string,
		client: Bot,
	): Promise<TextChannel | null> {
		try {
			const { supportRoles, ticketCategoryId, ticketCategories, enableClaimButton } =
				await TicketManager.readConfigFile();
			const userId = interaction.user.id;
			const userName = interaction.user.username.toLowerCase();
			const categoryConfig = ticketCategories[categoryLabel.toLowerCase()];
			if (!categoryConfig) throw new Error(`Category "${categoryLabel}" not found in config.`);

			const channel = await TicketManager.createChannel(
				interaction,
				userName,
				categoryConfig.menuLabel,
				supportRoles,
				ticketCategoryId,
			);
			const embed = TicketManager.createTicketEmbed(
				interaction,
				userName,
				categoryConfig.menuLabel,
				categoryConfig.embedDescription,
			);
			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
				TicketManager.createCloseButton(),
				...(enableClaimButton ? [TicketManager.createClaimButton()] : []),
			);

			await channel
				.send({
					content: [...supportRoles.map(roleId => `<@&${roleId}>`), `<@${userId}>`].join(', '),
					embeds: [embed],
					components: [row],
				})
				.then(msg => msg.pin());

			await LogsManager.logTicketCreation(interaction, categoryLabel, client, channel);
			await Promise.all([
				client.db.saveTicketInfo(channel.id, userName, userId),
				client.db.saveTicketStats(channel.id),
			]);

			return channel;
		} catch (error) {
			client.logger.error(`Failed to create ticket: ${error.message}`);
			return null;
		}
	}

	private static async createChannel(
		interaction: CommandInteraction | ButtonInteraction,
		userName: string,
		menuLabel: string,
		supportRoles: Snowflake[],
		ticketCategoryId: Snowflake,
	): Promise<TextChannel> {
		const channel = await interaction.guild.channels.create({
			name: `${menuLabel}-${userName}`,
			type: ChannelType.GuildText,
			topic: `Ticket Creator: ${userName} | Ticket Type: ${menuLabel}`,
			parent: ticketCategoryId,
			permissionOverwrites: [
				{ id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
				{
					id: interaction.user.id,
					allow: [
						PermissionFlagsBits.ViewChannel,
						PermissionFlagsBits.SendMessages,
						PermissionFlagsBits.ReadMessageHistory,
						PermissionFlagsBits.AttachFiles,
						PermissionFlagsBits.EmbedLinks,
					],
				},
				...supportRoles.map(roleId => ({
					id: roleId,
					allow: [
						PermissionFlagsBits.ViewChannel,
						PermissionFlagsBits.SendMessages,
						PermissionFlagsBits.ReadMessageHistory,
						PermissionFlagsBits.AttachFiles,
						PermissionFlagsBits.EmbedLinks,
					],
				})),
			],
		});

		if (!(channel instanceof TextChannel)) throw new Error('Failed to create a text channel: Unexpected channel type');
		return channel;
	}

	private static createCloseButton(): ButtonBuilder {
		return new ButtonBuilder()
			.setCustomId('close-ticket')
			.setLabel('Close')
			.setStyle(ButtonStyle.Danger)
			.setEmoji('🔒');
	}

	private static createClaimButton(): ButtonBuilder {
		return new ButtonBuilder()
			.setCustomId('claim-ticket')
			.setLabel('Claim')
			.setStyle(ButtonStyle.Primary)
			.setEmoji('🎫');
	}

	private static createTicketEmbed(
		interaction: CommandInteraction | ButtonInteraction,
		userName: string,
		menuLabel: string,
		embedDescription: string,
	): EmbedBuilder {
		return new EmbedBuilder()
			.setThumbnail(interaction.user.displayAvatarURL({ extension: 'png', size: 1024 }))
			.setTitle(menuLabel)
			.setDescription(embedDescription)
			.setColor('#00ff00')
			.setFooter({
				text: `Ticket created by ${userName}`,
				iconURL: interaction.user.displayAvatarURL({ extension: 'png', size: 1024 }),
			})
			.setTimestamp();
	}

	public static buildEmbed(embedConfig: any): EmbedBuilder {
		const embed = new EmbedBuilder();
		if (embedConfig.color) embed.setColor(embedConfig.color);
		if (embedConfig.title) embed.setTitle(embedConfig.title);
		if (embedConfig.description) embed.setDescription(embedConfig.description);
		if (embedConfig.timestamp) embed.setTimestamp();
		if (embedConfig.URL) embed.setURL(embedConfig.URL);
		if (embedConfig.image) embed.setImage(embedConfig.image);
		if (embedConfig.thumbnail) embed.setThumbnail(embedConfig.thumbnail);
		if (embedConfig.footer?.text)
			embed.setFooter({ text: embedConfig.footer.text, iconURL: embedConfig.footer.iconURL || undefined });
		if (embedConfig.author?.name)
			embed.setAuthor({
				name: embedConfig.author.name,
				iconURL: embedConfig.author.iconURL || undefined,
				url: embedConfig.author.url || undefined,
			});
		return embed;
	}

	public static async isUserSupport(interaction: any): Promise<boolean> {
		const { supportRoles } = await TicketManager.readConfigFile();
		return interaction.member.roles.cache.some((role: { id: Snowflake }) => supportRoles.includes(role.id));
	}

	public static async readConfigFile(): Promise<Config> {
		try {
			return YAML.parse(await fs.readFile('./config.yml', 'utf8')) as Config;
		} catch (error) {
			throw new Error(`Failed to read config file: ${error.message}`);
		}
	}
}
