import { type Bot, Command, type Context } from '../../structures/index.js';

export default class Invite extends Command {
	constructor(client: Bot) {
		super(client, {
			name: 'invite',
			description: {
				content: 'Get the bot invite link',
				usage: 'invite',
				examples: ['invite'],
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
			embeds: [
				this.client
					.embed()
					.setDescription(
						`Invite me to your server with this link: [Invite](https://discord.com/oauth2/authorize?client_id=${client.user?.id}&scope=bot%20applications.commands&permissions=8)`,
					),
			],
		});
	}
}
