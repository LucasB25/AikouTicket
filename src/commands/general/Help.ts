import { type Bot, Command, type Context } from '../../structures/index';

export default class Help extends Command {
	constructor(client: Bot) {
		super(client, {
			name: 'help',
			description: {
				content: 'Lists all available commands',
				usage: 'help',
				examples: ['help'],
			},
			category: 'general',
			permissions: {
				dev: false,
				client: ['SendMessages', 'ViewChannel', 'EmbedLinks'],
				user: [],
			},
			cooldown: 3,
			options: [],
		});
	}

	async run(client: Bot, ctx: Context): Promise<void> {
		const categories = new Map<string, { name: string; description: string }[]>();

		client.commands.forEach(cmd => {
			if (!categories.has(cmd.category)) {
				categories.set(cmd.category, []);
			}
			categories.get(cmd.category)!.push({ name: cmd.name, description: cmd.description.content });
		});

		const commandList = Array.from(
			categories,
			([category, commands]) =>
				`**${category.charAt(0).toUpperCase() + category.slice(1)}**\n${commands
					.map(cmd => `\`${cmd.name}\`: ${cmd.description}`)
					.join('\n')}\n`,
		).join('\n');

		await ctx.sendMessage({
			embeds: [
				this.client
					.embed()
					.setAuthor({ name: this.client.user?.username! })
					.setTitle('Help - List of Commands')
					.setDescription(commandList)
					.setTimestamp(),
			],
		});
	}
}
