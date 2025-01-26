import { type Bot, Command, type Context } from '../../structures/index.js';

export default class Ping extends Command {
	constructor(client: Bot) {
		super(client, {
			name: 'ping',
			description: {
				content: 'Get the bot latency',
				usage: 'ping',
				examples: ['ping'],
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
		await ctx.sendMessage({
			embeds: [this.client.embed().setDescription(`**Pong:** \`${Math.round(client.ws.ping)}ms\``)],
		});
	}
}
