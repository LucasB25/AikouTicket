import type { ApplicationCommandOption, PermissionResolvable } from 'discord.js';
import type { Bot } from './index';

interface CommandDescription {
	content: string;
	usage: string;
	examples: string[];
}

interface CommandPermissions {
	dev: boolean;
	client: string[] | PermissionResolvable;
	user: string[] | PermissionResolvable;
}

interface CommandOptions {
	name: string;
	nameLocalizations?: Record<string, string>;
	description?: CommandDescription;
	descriptionLocalizations?: Record<string, string>;
	aliases?: string[];
	cooldown?: number;
	permissions?: Partial<CommandPermissions>;
	options?: ApplicationCommandOption[];
	category?: string;
}

const defaultDescription: CommandDescription = {
	content: 'No description provided',
	usage: 'No usage provided',
	examples: ['No examples provided'],
};

const defaultPermissions: CommandPermissions = {
	dev: false,
	client: ['SendMessages', 'ViewChannel', 'EmbedLinks'],
	user: [],
};

export default class Command {
	public client: Bot;
	public name: string;
	public nameLocalizations: Record<string, string>;
	public description: CommandDescription;
	public descriptionLocalizations: Record<string, string> | null;
	public cooldown: number;
	public permissions: CommandPermissions;
	public options: ApplicationCommandOption[];
	public category: string;

	constructor(client: Bot, options: CommandOptions) {
		this.client = client;
		this.name = options.name;
		this.nameLocalizations = options.nameLocalizations ?? {};
		this.description = options.description ?? defaultDescription;
		this.descriptionLocalizations = options.descriptionLocalizations ?? null;
		this.cooldown = options.cooldown ?? 3;
		this.permissions = {
			dev: options.permissions?.dev ?? defaultPermissions.dev,
			client: options.permissions?.client ?? defaultPermissions.client,
			user: options.permissions?.user ?? defaultPermissions.user,
		};
		this.options = options.options ?? [];
		this.category = options.category ?? 'general';
	}

	public async run(_client: Bot, _message: any, _args: string[]): Promise<void> {
		return await Promise.resolve();
	}
}
