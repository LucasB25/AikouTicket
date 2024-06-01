import * as discordTranscripts from 'discord-html-transcripts';
import {
    ButtonInteraction,
    CommandInteraction,
    EmbedBuilder,
    GuildChannel,
    Snowflake,
    TextChannel,
} from 'discord.js';
import { promises as fs } from 'node:fs';
import YAML from 'yaml';

import { Bot } from '../structures/index.js';

interface Config {
    logChannelId: Snowflake;
    enableTranscripts: boolean;
}

export class LogsManager {
    public static async logTicketCreation(
        interaction: CommandInteraction | ButtonInteraction,
        categoryLabel: string,
        client: Bot,
        ticketChannel: GuildChannel
    ): Promise<void> {
        const logChannel = await this.getLogChannel(client);
        const embed = this.createLogEmbed(
            interaction,
            interaction.user.username,
            '#2FF200',
            `Ticket Logs | Ticket Created`,
            `- **Ticket Creator:** \n> ${interaction.user.username}\n\n- **Ticket:** \n> ${ticketChannel.toString()} \n> (${ticketChannel.name} - ID: ${ticketChannel.id}) \n\n- **Category:** \n> ${categoryLabel}`
        );
        await logChannel.send({ embeds: [embed] });
    }

    public static async logTicketDeletion(
        interaction: CommandInteraction | ButtonInteraction,
        client: Bot,
        userName: string,
        categoryLabel: string,
        ticketChannel: GuildChannel
    ): Promise<void> {
        const config = await this.readConfigFile();
        const logChannel = await this.getLogChannel(client);

        const embed = this.createLogEmbed(
            interaction,
            userName,
            '#FF2400',
            `Ticket Logs | Ticket Closed`,
            `- **Closed By:** \n> ${interaction.user.username}\n\n- **Ticket Creator:** \n> ${interaction.user.username}\n\n- **Ticket:** \n> ${ticketChannel.toString()} \n> (${ticketChannel.name} - ID: ${ticketChannel.id}) \n\n- **Category:** \n> ${categoryLabel}`
        );

        if (config.enableTranscripts) {
            try {
                const transcript = await discordTranscripts.createTranscript(
                    ticketChannel as TextChannel
                );
                await logChannel.send({
                    embeds: [embed],
                    files: [transcript],
                });
            } catch (error) {
                client.logger.error('Failed to create transcript:', error);
                await logChannel.send({
                    embeds: [embed],
                    content: 'Failed to create transcript.',
                });
            }
        } else {
            await logChannel.send({ embeds: [embed] });
        }
    }

    private static createLogEmbed(
        interaction: CommandInteraction | ButtonInteraction,
        userName: string,
        color: string,
        author: string,
        description: string
    ): EmbedBuilder {
        const userAvatarURL = interaction.user.displayAvatarURL({ extension: 'png', size: 1024 });

        return new EmbedBuilder()
            .setThumbnail(userAvatarURL)
            .setAuthor({
                name: author,
                iconURL: userAvatarURL,
            })
            .setDescription(description)
            .setColor(color as any)
            .setFooter({
                text: userName,
                iconURL: userAvatarURL,
            })
            .setTimestamp();
    }

    private static async getLogChannel(client: Bot): Promise<TextChannel> {
        const { logChannelId } = await this.readConfigFile();
        const logChannel = (await client.channels.fetch(logChannelId)) as TextChannel;

        if (!logChannel) {
            throw new Error('Log channel not found');
        }

        return logChannel;
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
