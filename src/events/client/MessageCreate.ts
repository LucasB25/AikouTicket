import { type Message, TextChannel } from "discord.js";
import { type Bot, Event } from "../../structures/index.js";
import { TicketManager } from "../../utils/TicketManager.js";

export default class MessageCreate extends Event {
    private intervalId: NodeJS.Timeout | null = null;

    constructor(client: Bot, file: string) {
        super(client, file, {
            name: "messageCreate",
        });

        this.startTicketActivityCheck();
    }

    private startTicketActivityCheck(): void {
        this.intervalId = setInterval(async () => {
            try {
                await this.checkTicketActivity();
            } catch (error) {
                this.client.logger.error("Error checking ticket activity:", error);
            }
        }, 60000); // 1 minute interval
    }

    public async run(message: Message): Promise<void> {
        if (message.channel instanceof TextChannel) {
            const { id: channelId } = message.channel;
            try {
                if (await this.client.db.getTicketInfo(channelId)) {
                    await this.client.db.updateActivity(channelId);
                }
            } catch (error) {
                this.client.logger.error(`Error updating activity for channel ${channelId}:`, error);
            }
        }
    }

    private async checkTicketActivity(): Promise<void> {
        const { enableTicketActivityCheck, ticketActivityCheckInterval, supportRoles } = await TicketManager.readConfigFile();
        if (!enableTicketActivityCheck) return;

        const tickets = await this.client.db.getAllTickets();
        const now = BigInt(Date.now());
        const intervalMilliseconds = BigInt(ticketActivityCheckInterval * 60 * 1000);

        for (const { activityAt, lastCheckTime = 0n, channelId } of tickets) {
            if (activityAt === null || lastCheckTime === null) {
                this.client.logger.error(`Ticket ${channelId} has null activityAt or lastCheckTime.`);
                continue;
            }

            const lastActivity = BigInt(activityAt);

            if (now - lastActivity > intervalMilliseconds && now - BigInt(lastCheckTime) > intervalMilliseconds) {
                const channel = this.client.channels.cache.get(channelId) as TextChannel | undefined;
                if (!channel) continue;

                try {
                    const ticketInfo = await this.client.db.getTicketInfo(channel.id);
                    if (!ticketInfo) continue;

                    const { creator } = ticketInfo;
                    const supportMentions = supportRoles.map((roleId) => `<@&${roleId}>`).join(", ");

                    await channel.send({
                        content: `There has been no activity in this ticket for ${ticketActivityCheckInterval} minutes.\n<@${creator}>, ${supportMentions}`,
                    });
                    await this.client.db.updateActivity(channel.id);
                    await this.client.db.updateLastCheckTime(channel.id, now);
                } catch (error) {
                    this.client.logger.error(`Error sending message in channel ${channel.id}:`, error);
                }
            }
        }
    }

    public stopTicketActivityCheck(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}
