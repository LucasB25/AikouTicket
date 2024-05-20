import {
    ChannelType,
    CommandInteraction,
    GuildChannelCreateOptions,
    PermissionFlagsBits,
    TextChannel,
} from 'discord.js';
import fs from 'node:fs/promises';
import YAML from 'yaml';

import { Bot } from '../structures/index.js';

export class TicketManager {
    public static async createTicket(
        interaction: CommandInteraction,
        categoryLabel: string,
        client: Bot
    ): Promise<TextChannel | null> {
        try {
            const config = await this.readConfigFile();
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
            client.logger.error(error);
            return null;
        }
    }

    public static async readConfigFile(): Promise<any> {
        const configFile = await fs.readFile('./config.yml', 'utf8');
        return YAML.parse(configFile);
    }
}
