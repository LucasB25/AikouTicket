import { PrismaClient, type ticketsGuild, type ticketsInfo } from '@prisma/client';

export default class ServerData {
    private prisma: PrismaClient;

    constructor() {
        this.prisma = new PrismaClient();
    }

    public async get(guildId: string): Promise<ticketsGuild> {
        let data = await this.prisma.ticketsGuild.findUnique({
            where: {
                guildId,
            },
        });
        if (!data) {
            data = await this.prisma.ticketsGuild.create({
                data: {
                    guildId,
                    selectMenuOptions: '',
                },
            });
            return data;
        }
        return data;
    }

    public async saveTicketData(guildId: string, options: any): Promise<void> {
        try {
            await this.prisma.ticketsGuild.upsert({
                where: {
                    guildId,
                },
                update: {
                    selectMenuOptions: JSON.stringify(options),
                },
                create: {
                    guildId,
                    selectMenuOptions: JSON.stringify(options),
                },
            });
        } catch (error) {
            console.error('Error saving ticket data:', error);
        }
    }

    public async getTicketInfo(channelId: string): Promise<ticketsInfo | null> {
        const data = await this.prisma.ticketsInfo.findUnique({
            where: {
                channelid: channelId,
            },
        });
        return data;
    }

    public async saveTicketInfo(channelId: string, creator: string): Promise<void> {
        try {
            await this.prisma.ticketsInfo.upsert({
                where: {
                    channelid: channelId,
                },
                update: {
                    creator,
                    createdAt: BigInt(Date.now()),
                    activityAt: BigInt(Date.now()),
                },
                create: {
                    channelid: channelId,
                    creator,
                    createdAt: BigInt(Date.now()),
                    activityAt: BigInt(Date.now()),
                },
            });
        } catch (error) {
            console.error('Error saving ticket info:', error);
        }
    }

    public async deleteTicketInfo(channelId: string): Promise<void> {
        try {
            await this.prisma.ticketsInfo.delete({
                where: {
                    channelid: channelId,
                },
            });
        } catch (error) {
            console.error('Error deleting ticket info:', error);
        }
    }

    public async updateActivity(channelId: string): Promise<void> {
        try {
            await this.prisma.ticketsInfo.update({
                where: {
                    channelid: channelId,
                },
                data: {
                    activityAt: BigInt(Date.now()),
                },
            });
        } catch (error) {
            console.error(`Error updating activity for channel ${channelId}:`, error);
        }
    }

    public async updateLastCheckTime(channelId: string, lastCheckTime: bigint): Promise<void> {
        try {
            await this.prisma.ticketsInfo.update({
                where: {
                    channelid: channelId,
                },
                data: {
                    lastCheckTime: lastCheckTime,
                },
            });
        } catch (error) {
            console.error(`Error updating last check time for channel ${channelId}:`, error);
        }
    }

    public async getAllTickets(): Promise<ticketsInfo[]> {
        try {
            return await this.prisma.ticketsInfo.findMany();
        } catch (error) {
            console.error('Error retrieving all tickets:', error);
            return [];
        }
    }
}
