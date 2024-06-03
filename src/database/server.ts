import { PrismaClient, type tickets } from '@prisma/client';

export default class ServerData {
    private prisma: PrismaClient;

    constructor() {
        this.prisma = new PrismaClient();
    }

    public async get(guildId: string): Promise<tickets | null> {
        let data = await this.prisma.tickets.findUnique({
            where: {
                guildId,
            },
        });
        if (!data) {
            data = await this.prisma.tickets.create({
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
            await this.prisma.tickets.upsert({
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
}
