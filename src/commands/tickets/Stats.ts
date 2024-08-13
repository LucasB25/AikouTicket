import { type Bot, Command, type Context } from "../../structures/index.js";
import { EmbedBuilder } from "discord.js";

export default class Stats extends Command {
    constructor(client: Bot) {
        super(client, {
            name: "stats",
            description: {
                content: "Get the current ticket statistics",
                usage: "stats",
                examples: ["stats"],
            },
            category: "general",
            permissions: {
                dev: false,
                client: ["SendMessages", "ViewChannel", "EmbedLinks"],
                user: ["ManageGuild"],
            },
            cooldown: 3,
            options: [],
        });
    }

    async run(_client: Bot, ctx: Context): Promise<void> {
        try {
            const allTicketStats = await this.client.db.getAllTicketStats();

            if (!allTicketStats?.length) {
                await ctx.sendMessage({ content: "No ticket statistics available." });
                return;
            }

            const validRatings = allTicketStats.filter(({ rating }) => rating > 0);

            const totalRatings = validRatings.reduce((sum, { rating }) => sum + rating, 0);
            const averageRating = validRatings.length > 0 ? (totalRatings / validRatings.length).toFixed(2) : "N/A";

            const embed = new EmbedBuilder()
                .setTitle("Ticket Statistics")
                .setColor("#FFD700")
                .addFields(
                    { name: "Total Tickets", value: `${allTicketStats.length}`, inline: true },
                    { name: "Total Stars", value: `${totalRatings}`, inline: true },
                    { name: "Average Rating", value: `${averageRating}`, inline: true },
                )
                .setTimestamp();

            await ctx.sendMessage({ embeds: [embed] });
        } catch (error) {
            this.client.logger.error(`Failed to retrieve ticket statistics: ${error.message}`);
            await ctx.sendMessage({ content: "There was an error retrieving the ticket statistics." });
        }
    }
}
