import {
    ChannelType,
    CommandInteraction,
    GuildChannelCreateOptions,
    PermissionFlagsBits,
    Snowflake,
    TextChannel,
} from 'discord.js';
import { promises as fs } from 'node:fs';
import YAML from 'yaml';

import { Bot } from '../structures/index.js';

interface Config {
    supportRoles: Snowflake[];
    ticketCategoryId: Snowflake;
    maxActiveTicketsPerUser: Snowflake;
    menuPlaceholder: Snowflake;
}

export class TicketManager {
    public static async createTicket(
        interaction: CommandInteraction,
        categoryLabel: string,
        client: Bot
    ): Promise<TextChannel | null> {
        try {
            const config = await this.readConfigFile();
            const { supportRoles, ticketCategoryId } = config;
            const userName = interaction.user.username;

            const channelOptions: GuildChannelCreateOptions = {
                name: `ticket-${userName}`,
                type: ChannelType.GuildText,
                topic: `Ticket for ${categoryLabel}`,
                parent: ticketCategoryId,
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

            if (!(channel instanceof TextChannel)) {
                throw new Error('Failed to create a text channel');
            }

            channel.client.once('channelDelete', async deletedChannel => {
                if (deletedChannel.id === channel.id) {
                    //
                }
            });

            return channel;
        } catch (error) {
            client.logger.error(`Failed to create ticket: ${error.message}`);
            return null;
        }
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
