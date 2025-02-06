import {
	ApplicationCommandType,
	Client,
	Collection,
	EmbedBuilder,
	PermissionsBitField,
	REST,
	type RESTPostAPIChatInputApplicationCommandsJSONBody,
	Routes,
} from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Logger from './Logger.js';
import config from '../config.js';
import ServerData from '../database/server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default class Bot extends Client {
	public config = config;
	public logger = new Logger();
	public db = new ServerData();
	public readonly color = config.color;
	public commands = new Collection<string, any>();
	private data: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];

	public async start(token: string): Promise<void> {
		try {
			this.logger.start('Starting bot...');
			await Promise.all([this.loadCommands(), this.loadEvents()]);
			await this.login(token);
		} catch (error) {
			this.logger.error(error);
		}
	}

	public embed(): EmbedBuilder {
		return new EmbedBuilder().setColor(this.color);
	}

	private async loadEvents(): Promise<void> {
		const eventsPath = path.join(__dirname, '../events');
		for (const event of fs.readdirSync(eventsPath)) {
			for (const file of fs.readdirSync(path.join(eventsPath, event)).filter(f => f.endsWith('.js'))) {
				const EventClass = (await import(`../events/${event}/${file}`)).default;
				const eventInstance = new EventClass(this, file);
				this.on(eventInstance.name, (...args: unknown[]) => eventInstance.run(...args));
			}
		}
	}

	private async loadCommands(): Promise<void> {
		const commandsPath = path.join(__dirname, '../commands');
		for (const category of fs.readdirSync(commandsPath)) {
			for (const file of fs.readdirSync(path.join(commandsPath, category)).filter(f => f.endsWith('.js'))) {
				const CommandClass = (await import(`../commands/${category}/${file}`)).default;
				const command = new CommandClass(this, file);
				this.commands.set(command.name, command);
				const permissionValue = command.permissions.user.length
					? PermissionsBitField.resolve(command.permissions.user)
					: null;
				this.data.push({
					name: command.name,
					description: command.description.content,
					type: ApplicationCommandType.ChatInput,
					options: command.options || [],
					name_localizations: command.nameLocalizations || {},
					description_localizations: command.descriptionLocalizations || {},
					default_member_permissions: permissionValue ? permissionValue.toString() : null,
				});
			}
		}

		this.once('ready', async () => {
			try {
				await new REST({ version: '10' })
					.setToken(this.config.token ?? '')
					.put(Routes.applicationCommands(this.config.clientId ?? ''), { body: this.data });
				this.logger.info('Successfully loaded slash commands!');
			} catch (error) {
				this.logger.error(error);
			}
		});
	}
}
