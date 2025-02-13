import { ActivityType } from 'discord.js';
import { type Bot, Event } from '../../structures/index';

export default class ClientReady extends Event {
	constructor(client: Bot, file: string) {
		super(client, file, { name: 'ready' });
	}

	public async run(): Promise<void> {
		this.client.logger.info(`Connected to Discord as ${this.client.user?.tag}!`);

		const activities = ['/help - by LucasB25', 'Managing tickets'];

		const updateStatus = () => {
			const activity = activities[Math.floor(Math.random() * activities.length)];
			this.client.user?.setActivity(activity, { type: ActivityType.Playing });
		};

		updateStatus();
		setInterval(updateStatus, 3600000);
	}
}
