import { type Message, TextChannel } from 'discord.js';

import { type Bot, Event } from '../../structures/index.js';
import { TicketManager } from '../../utils/TicketManager.js';

export default class MessageCreate extends Event {
    constructor(client: Bot, file: string) {
        super(client, file, {
            name: 'messageCreate',
        });

        this.initializeInterval();
    }

    private async initializeInterval(): Promise<void> {
        setInterval(async () => {
            await this.checkTicketActivity();
        }, 60000); // 1 minute interval
    }

    public async run(message: Message): Promise<void> {
        if (!(message.channel instanceof TextChannel)) {
            return;
        }

        const channelId = message.channel.id;
        const ticketInfo = await this.client.db.getTicketInfo(channelId);

        if (ticketInfo) {
            await this.client.db.updateActivity(channelId);
        }
    }

    private async checkTicketActivity(): Promise<void> {
        const config = await TicketManager.readConfigFile();

        if (!config.enableTicketActivityCheck) {
            return;
        }

        const tickets = await this.client.db.getAllTickets();
        const now = BigInt(Date.now());
        const intervalMinutes = config.ticketActivityCheckInterval
        const intervalMilliseconds = BigInt(intervalMinutes * 60 * 1000);

        for (const ticket of tickets) {
            const lastActivity = BigInt(ticket.activityAt);
            const lastCheckTime = ticket.lastCheckTime ? BigInt(ticket.lastCheckTime) : 0n;

            if (now - lastActivity > intervalMilliseconds && now - lastCheckTime > intervalMilliseconds) {
                const channel = this.client.channels.cache.get(ticket.channelid) as TextChannel;
                if (channel) {
                    try {
                        await channel.send(`There has been no activity in this ticket for ${intervalMinutes} minutes.`);
                        await this.client.db.updateActivity(channel.id);
                        await this.client.db.updateLastCheckTime(channel.id, now);
                    } catch (error) {
                        console.error(`Error sending message in channel ${channel.id}:`, error);
                    }
                }
            }
        }
    }
}
