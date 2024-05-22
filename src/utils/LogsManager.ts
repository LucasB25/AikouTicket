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
}

export class LogsManager {
    public static async logTicketCreation(
        interaction: CommandInteraction | ButtonInteraction,
        categoryLabel: string,
        client: Bot,
        ticketChannel: GuildChannel
    ): Promise<void> {
        const config = await this.readConfigFile();
        const logChannelId = config.logChannelId;
        const logChannel = (await client.channels.fetch(logChannelId)) as TextChannel;

        if (!logChannel) {
            throw new Error('Log channel not found');
        }

        const embedColor = '#2FF200';
        const embedAuthor = `Ticket Logs | Ticket Created`;
        const embedDescription = `- **Ticket Creator:** \n> ${interaction.user.username}\n\n- **Ticket:** \n> ${ticketChannel.toString()} \n\n- **Category:** \n> ${categoryLabel}`;
        const embed = this.createLogEmbed(
            interaction,
            interaction.user.username,
            embedColor,
            embedAuthor,
            embedDescription
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
        const logChannelId = config.logChannelId;
        const logChannel = (await client.channels.fetch(logChannelId)) as TextChannel;

        if (!logChannel) {
            throw new Error('Log channel not found');
        }

        const embedColor = '#FF2400';
        const embedAuthor = `Ticket Logs | Ticket Closed`;
        const embedDescription = `- **Closed By:** \n> ${interaction.user.username}\n\n- **Ticket Creator:** \n> ${interaction.user.username}\n\n- **Ticket:** \n> ${ticketChannel.toString()} \n\n- **Category:** \n> ${categoryLabel}`;
        const embed = this.createLogEmbed(
            interaction,
            userName,
            embedColor,
            embedAuthor,
            embedDescription
        );
        await logChannel.send({ embeds: [embed] });
    }

    private static createLogEmbed(
        interaction: CommandInteraction | ButtonInteraction,
        userName: string,
        color: string,
        author: string,
        description: string
    ): EmbedBuilder {
        return new EmbedBuilder()
            .setThumbnail(interaction.user.avatarURL({ extension: 'png', size: 1024 }) ?? '')
            .setAuthor({
                name: author,
                iconURL: interaction.user.avatarURL({ extension: 'png', size: 1024 }) ?? '',
            })
            .setDescription(description)
            .setColor(color as any)
            .setFooter({
                text: userName,
                iconURL: interaction.user.avatarURL({ extension: 'png', size: 1024 }) ?? '',
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
