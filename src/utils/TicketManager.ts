import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ChannelType,
    CommandInteraction,
    EmbedBuilder,
    GuildChannelCreateOptions,
    PermissionFlagsBits,
    Snowflake,
    TextChannel,
} from 'discord.js';
import { promises as fs } from 'node:fs';
import YAML from 'yaml';

import { LogsManager } from './LogsManager.js';
import { Bot } from '../structures/index.js';

interface Config {
    supportRoles: Snowflake[];
    ticketCategoryId: Snowflake;
    maxActiveTicketsPerUser: number;
    menuPlaceholder: string;
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
        client: Bot
    ): Promise<TextChannel | null> {
        try {
            if (!categoryLabel) {
                throw new Error('Category label is undefined.');
            }

            const config = await this.readConfigFile();
            const { supportRoles, ticketCategoryId, ticketCategories } = config;
            const userName = interaction.user.username;

            if (!(categoryLabel.toLowerCase() in ticketCategories)) {
                throw new Error(`Category "${categoryLabel}" not found in config.`);
            }

            const categoryConfig = ticketCategories[categoryLabel.toLowerCase()];
            const channel = await this.createChannel(
                interaction,
                userName,
                categoryLabel,
                supportRoles,
                ticketCategoryId
            );
            const embed = this.createTicketEmbed(
                client,
                interaction,
                userName,
                categoryLabel,
                categoryConfig.embedDescription
            );
            const closeButton = this.createCloseButton();
            const claimButton = this.createClaimButton();

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                closeButton,
                claimButton
            );
            const roleMentions = supportRoles.map(roleId => `<@&${roleId}>`).join(', ');
            const messageContent = `${roleMentions}`;

            const message = await channel.send({
                content: messageContent,
                embeds: [embed],
                components: [row],
            });

            await message.pin().then(() => {
                message.channel.bulkDelete(1);
            });

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
        ticketCategoryId: Snowflake
    ): Promise<TextChannel> {
        const channelOptions: GuildChannelCreateOptions = {
            name: `ticket-${userName}`,
            type: ChannelType.GuildText,
            topic: `Ticket Creator: ${userName} | Ticket Type: ${categoryLabel}`,
            parent: ticketCategoryId,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: ['ViewChannel', 'SendMessages'] },
                {
                    id: interaction.user.id,
                    allow: [
                        'ViewChannel',
                        'SendMessages',
                        'ReadMessageHistory',
                        'AttachFiles',
                        'EmbedLinks',
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
        };

        const channel = await interaction.guild.channels.create(channelOptions);

        if (!(channel instanceof TextChannel)) {
            throw new Error(`Failed to create a text channel: Unexpected channel type`);
        }

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

    public static createTicketEmbed(
        client: Bot,
        interaction: CommandInteraction | ButtonInteraction,
        userName: string,
        categoryLabel: string,
        embedDescription: string
    ): EmbedBuilder {
        return client
            .embed()
            .setThumbnail(interaction.user.displayAvatarURL({ extension: 'png', size: 1024 }))
            .setAuthor({
                name: categoryLabel,
                iconURL: interaction.user.displayAvatarURL({ extension: 'png', size: 1024 }),
            })
            .setDescription(embedDescription)
            .setColor('#00ff00')
            .setFooter({
                text: userName,
                iconURL: interaction.user.displayAvatarURL({ extension: 'png', size: 1024 }),
            })
            .setTimestamp();
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
