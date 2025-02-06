import { Partials, type TextChannel } from 'discord.js';
import config from './config.js';
import Bot from './structures/Client.js';

const client = new Bot({
	intents: 131059,
	allowedMentions: { parse: ['users', 'roles', 'everyone'], repliedUser: false },
	partials: [
		Partials.GuildMember,
		Partials.Message,
		Partials.User,
		Partials.ThreadMember,
		Partials.Channel,
		Partials.GuildScheduledEvent,
	],
});

const sendErrorLog = async (client: Bot, error: Error, type: string): Promise<void> => {
	try {
		const logChannel = client.channels.cache.get(config.logsbot) as TextChannel;
		if (logChannel) {
			await logChannel.send(`**[${type}]** ${error.name}: ${error.message}\n\`\`\`${error.stack}\`\`\``);
		} else {
			client.logger.error(`Log channel not found: ${config.logsbot}`);
		}
	} catch (err) {
		client.logger.error('Failed to send log message:', err);
	}
};

process.on('unhandledRejection', reason => {
	const error = reason instanceof Error ? reason : new Error(String(reason));
	client.logger.error(error);
	sendErrorLog(client, error, 'Unhandled Rejection');
});

process.on('uncaughtException', error => {
	client.logger.error(error);
	sendErrorLog(client, error, 'Uncaught Exception');
});

process.on('warning', warning => {
	client.logger.warn(warning);
	sendErrorLog(client, warning, 'Warning');
});

process.once('exit', () => client.logger.warn('Process exited!'));

client.start(config.token);
