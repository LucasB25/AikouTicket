import { type Message, TextChannel } from 'discord.js';
import { type Bot, Event } from '../../structures/index';
import { TicketManager } from '../../utils/TicketManager';

export default class MessageCreate extends Event {
	private intervalId?: NodeJS.Timeout;

	constructor(client: Bot, file: string) {
		super(client, file, { name: 'messageCreate' });
		this.startTicketActivityCheck();
	}

	private startTicketActivityCheck(): void {
		this.intervalId = setInterval(async () => {
			try {
				await this.checkTicketActivity();
			} catch (error) {
				this.client.logger.error('Error checking ticket activity:', error);
			}
		}, 60000);
	}

	public async run(message: Message): Promise<void> {
		if (!(message.channel instanceof TextChannel)) return;

		const ticketInfo = await this.client.db.getTicketInfo(message.channel.id);
		if (ticketInfo) await this.client.db.updateActivity(message.channel.id);
	}

	private async checkTicketActivity(): Promise<void> {
		const { enableTicketActivityCheck, ticketActivityCheckInterval, supportRoles } =
			await TicketManager.readConfigFile();
		if (!enableTicketActivityCheck) return;

		const now = BigInt(Date.now());
		const intervalMs = BigInt(ticketActivityCheckInterval * 60000);

		for (const ticket of await this.client.db.getAllTickets()) {
			const lastActivity = BigInt(ticket.activityAt);
			const lastCheckTime = BigInt(ticket.lastCheckTime ?? 0);

			if (now - lastActivity <= intervalMs || now - lastCheckTime <= intervalMs) continue;

			const channel = this.client.channels.cache.get(ticket.channelId) as TextChannel;
			if (!channel || !(await this.client.db.getTicketInfo(channel.id))) continue;

			await channel.send({
				content: `There has been no activity in this ticket for ${ticketActivityCheckInterval} minutes.\n<@${ticket.creatorId}>, ${supportRoles.map(r => `<@&${r}>`).join(', ')}`,
			});

			await Promise.all([
				this.client.db.updateActivity(channel.id),
				this.client.db.updateLastCheckTime(channel.id, now),
			]);
		}
	}

	public stopTicketActivityCheck(): void {
		if (this.intervalId) clearInterval(this.intervalId);
	}
}
