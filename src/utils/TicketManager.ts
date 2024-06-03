import type { Bot } from '../structures/index.js';
import {
    ActionRowBuilder,
    ButtonBuilder,
    type ButtonInteraction,
    ButtonStyle,
    ChannelType,
    type CommandInteraction,
    EmbedBuilder,
    type GuildChannelCreateOptions,
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
    maxActiveTicketsPerUser: number;
    menuPlaceholder: string;
    enableClaimButton: boolean;
    closeTicketStaffOnly: boolean;
    ticketCategories: {
        [key: string]: {
            menuLabel: string;
            menuDescription: string;
            menuEmoji: string;
            embedDescription: string;
        };
    };
}

export class TicketManager {
    public static async createTicket(
        interaction: CommandInteraction | ButtonInteraction,
        categoryLabel: string,
        client: Bot,
    ): Promise<TextChannel | null> {
        try {
            if (!categoryLabel) {
                throw new Error('Category label is undefined.');
            }

            const config = await TicketManager.readConfigFile();
            const { supportRoles, ticketCategoryId, ticketCategories, enableClaimButton } = config;
            const userName = interaction.user.username;

            const normalizedCategoryLabel = categoryLabel.toLowerCase();
            if (!(normalizedCategoryLabel in ticketCategories)) {
                throw new Error(`Category "${categoryLabel}" not found in config.`);
            }

            const categoryConfig = ticketCategories[normalizedCategoryLabel];
            const channel = await TicketManager.createChannel(interaction, userName, categoryLabel, supportRoles, ticketCategoryId);
            const embed = TicketManager.createTicketEmbed(client, interaction, userName, categoryLabel, categoryConfig.embedDescription);
            const closeButton = TicketManager.createCloseButton();
            const claimButton = TicketManager.createClaimButton(enableClaimButton);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(closeButton);
            if (claimButton) {
                row.addComponents(claimButton);
            }
            const roleMentions = supportRoles.map((roleId) => `<@&${roleId}>`).join(', ');
            const messageContent = roleMentions;

            const message = await channel.send({
                content: messageContent,
                embeds: [embed],
                components: [row],
            });

            await message.pin();
            await message.channel.bulkDelete(1);

            await LogsManager.logTicketCreation(interaction, categoryLabel, client, channel);

            return channel;
        } catch (error) {
            client.logger.error(`Failed to create ticket: ${error.message}`);
            return null;
        }
    }

    private static async createChannel(
        interaction: CommandInteraction | ButtonInteraction,
        userName: string,
        categoryLabel: string,
        supportRoles: Snowflake[],
        ticketCategoryId: Snowflake,
    ): Promise<TextChannel> {
        const channelOptions: GuildChannelCreateOptions = {
            name: `ticket-${userName}`,
            type: ChannelType.GuildText,
            topic: `Ticket Creator: ${userName} | Ticket Type: ${categoryLabel}`,
            parent: ticketCategoryId,
            permissionOverwrites: [
                {
                    id: interaction.guild.id,
                    deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                },
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
                ...supportRoles.map((roleId) => ({
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
        };

        const channel = await interaction.guild.channels.create(channelOptions);

        if (!(channel instanceof TextChannel)) {
            throw new Error('Failed to create a text channel: Unexpected channel type');
        }

        return channel;
    }

    private static createCloseButton(): ButtonBuilder {
        return new ButtonBuilder().setCustomId('close-ticket').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🔒');
    }

    private static createClaimButton(enableClaimButton: boolean): ButtonBuilder | null {
        if (!enableClaimButton) {
            return null;
        }
        return new ButtonBuilder().setCustomId('claim-ticket').setLabel('Claim').setStyle(ButtonStyle.Primary).setEmoji('🎫');
    }

    public static createTicketEmbed(
        _client: Bot,
        interaction: CommandInteraction | ButtonInteraction,
        userName: string,
        categoryLabel: string,
        embedDescription: string,
    ): EmbedBuilder {
        const userAvatarURL = interaction.user.displayAvatarURL({ extension: 'png', size: 1024 });

        const embed = new EmbedBuilder()
            .setThumbnail(userAvatarURL)
            .setTitle(categoryLabel)
            .setDescription(embedDescription)
            .setColor('#00ff00')
            .setFooter({
                text: `Ticket created by ${userName}`,
                iconURL: userAvatarURL,
            })
            .setTimestamp();

        return embed;
    }

    public static async readConfigFile(): Promise<Config> {
        try {
            const configFile = await fs.readFile('./config.yml', 'utf8');
            return YAML.parse(configFile) as Config;
        } catch (error) {
            throw new Error(`Failed to read config file: ${error.message}`);
        }
    }
}
