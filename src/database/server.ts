import { PrismaClient, type ticketsGuild, type ticketsInfo, type ticketStats } from '@prisma/client';

export default class ServerData {
	private prisma: PrismaClient;

	constructor() {
		this.prisma = new PrismaClient();
	}

	public async get(guildId: string): Promise<ticketsGuild | null> {
		let data = await this.prisma.ticketsGuild.findUnique({ where: { guildId } });
		if (!data) {
			data = await this.prisma.ticketsGuild.create({ data: { guildId, selectMenuOptions: '' } });
		}
		return data;
	}

	public async saveTicketData(guildId: string, options: any): Promise<void> {
		await this.prisma.ticketsGuild
			.upsert({
				where: { guildId },
				update: { selectMenuOptions: JSON.stringify(options) },
				create: { guildId, selectMenuOptions: JSON.stringify(options) },
			})
			.catch(error => console.error('Error saving ticket data:', error));
	}

	public async getTicketInfo(channelId: string): Promise<ticketsInfo | null> {
		return await this.prisma.ticketsInfo.findUnique({ where: { channelId } });
	}

	public async saveTicketInfo(channelId: string, creator: string, creatorId: string): Promise<void> {
		const currentTime = BigInt(Date.now());
		await this.prisma.ticketsInfo
			.upsert({
				where: { channelId },
				update: { creator, creatorId, createdAt: currentTime, activityAt: currentTime, lastCheckTime: currentTime },
				create: {
					channelId,
					creator,
					creatorId,
					createdAt: currentTime,
					activityAt: currentTime,
					lastCheckTime: currentTime,
				},
			})
			.catch(error => console.error('Error saving ticket info:', error));
	}

	public async deleteTicketInfo(channelId: string): Promise<void> {
		await this.prisma.ticketsInfo
			.delete({ where: { channelId } })
			.catch(error => console.error('Error deleting ticket info:', error));
	}

	public async updateActivity(channelId: string): Promise<void> {
		await this.prisma.ticketsInfo
			.update({
				where: { channelId },
				data: { activityAt: BigInt(Date.now()) },
			})
			.catch(error => console.error(`Error updating activity for channel ${channelId}:`, error));
	}

	public async updateLastCheckTime(channelId: string, lastCheckTime: bigint): Promise<void> {
		console.log(`Updating lastCheckTime for channel ${channelId} to ${lastCheckTime}`);
		await this.prisma.ticketsInfo
			.update({
				where: { channelId },
				data: { lastCheckTime },
			})
			.then(() => {
				console.log(`Successfully updated lastCheckTime for channel ${channelId}`);
			})
			.catch(error => console.error(`Error updating last check time for channel ${channelId}:`, error));
	}

	public async getAllTickets(): Promise<ticketsInfo[]> {
		return this.prisma.ticketsInfo.findMany().catch(error => {
			console.error('Error retrieving all tickets:', error);
			return [];
		});
	}

	public async getTicketStats(channelId: string): Promise<ticketStats | null> {
		return await this.prisma.ticketStats.findUnique({ where: { channelId } });
	}

	public async saveTicketStats(channelId: string, rating = 0): Promise<void> {
		await this.prisma.ticketStats
			.upsert({
				where: { channelId },
				update: { rating },
				create: { channelId, rating },
			})
			.catch(error => console.error('Error saving ticket stats:', error));
	}

	public async updateTicketStats(channelId: string, rating: number): Promise<void> {
		await this.prisma.ticketStats
			.update({
				where: { channelId },
				data: { rating },
			})
			.catch(error => console.error(`Error updating ticket stats for channel ${channelId}:`, error));
	}

	public async deleteTicketStats(channelId: string): Promise<void> {
		await this.prisma.ticketStats
			.delete({ where: { channelId } })
			.catch(error => console.error('Error deleting ticket stats:', error));
	}

	public async getAllTicketStats(): Promise<ticketStats[]> {
		return this.prisma.ticketStats.findMany().catch(error => {
			console.error('Error retrieving all ticket stats:', error);
			return [];
		});
	}
}
