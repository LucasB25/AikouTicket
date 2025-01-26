import { type ClientOptions, Partials, type TextChannel } from 'discord.js';

import config from './config.js';
import Bot from './structures/Client.js';

const createClientOptions = (): ClientOptions => ({
	intents: 131059,
	allowedMentions: {
		parse: ['users', 'roles', 'everyone'],
		repliedUser: false,
	},
	partials: [
		Partials.GuildMember,
		Partials.Message,
		Partials.User,
		Partials.ThreadMember,
		Partials.Channel,
		Partials.GuildScheduledEvent,
	],
});

function setupEventListeners(client: Bot): void {
	const sendErrorLog = async (error: Error, type: string): Promise<void> => {
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

	process.on('unhandledRejection', (reason: unknown) => {
		const error = reason instanceof Error ? reason : new Error(String(reason));
		client.logger.error(error);
		sendErrorLog(error, 'Unhandled Rejection').then(() => undefined);
	});

	process.on('uncaughtException', (error: Error) => {
		client.logger.error(error);
		sendErrorLog(error, 'Uncaught Exception').then(() => undefined);
	});

	process.on('warning', (warning: Error) => {
		client.logger.warn(warning);
		sendErrorLog(warning, 'Warning').then(() => undefined);
	});

	process.once('exit', () => client.logger.warn('Process exited!'));
}

const clientOptions = createClientOptions();
const client = new Bot(clientOptions);

client.start(config.token);
setupEventListeners(client);
