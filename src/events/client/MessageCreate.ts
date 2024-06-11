import { type Message, TextChannel } from 'discord.js';

import { type Bot, Event } from '../../structures/index.js';
import { TicketManager } from '../../utils/TicketManager.js';

export default class MessageCreate extends Event {
    private intervalId: NodeJS.Timeout;

    constructor(client: Bot, file: string) {
        super(client, file, {
            name: 'messageCreate',
        });

        this.startTicketActivityCheck();
    }

    private startTicketActivityCheck(): void {
        this.intervalId = setInterval(() => {
            this.checkTicketActivity().catch((error) => {
                this.client.logger.error('Error checking ticket activity:', error);
            });
        }, 60000); // 1 minute interval
    }

    public async run(message: Message): Promise<void> {
        if (message.channel instanceof TextChannel) {
            const ticketInfo = await this.client.db.getTicketInfo(message.channel.id);
            if (ticketInfo) {
                await this.client.db.updateActivity(message.channel.id);
            }
        }
    }

    private async checkTicketActivity(): Promise<void> {
        const { enableTicketActivityCheck, ticketActivityCheckInterval } = await TicketManager.readConfigFile();
        if (!enableTicketActivityCheck) return;

        const tickets = await this.client.db.getAllTickets();
        const now = BigInt(Date.now());
        const intervalMilliseconds = BigInt((ticketActivityCheckInterval || 60) * 60 * 1000);

        for (const ticket of tickets) {
            const lastActivity = BigInt(ticket.activityAt);
            const lastCheckTime = BigInt(ticket.lastCheckTime ?? 0);

            if (now - lastActivity > intervalMilliseconds && now - lastCheckTime > intervalMilliseconds) {
                const channel = this.client.channels.cache.get(ticket.channelId) as TextChannel;
                if (channel) {
                    try {
                        await channel.send(`There has been no activity in this ticket for ${ticketActivityCheckInterval} minutes.`);
                        await this.client.db.updateActivity(channel.id);
                        await this.client.db.updateLastCheckTime(channel.id, now);
                    } catch (error) {
                        this.client.logger.error(`Error sending message in channel ${channel.id}:`, error);
                    }
                }
            }
        }
    }

    public stopTicketActivityCheck(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
    }
}
