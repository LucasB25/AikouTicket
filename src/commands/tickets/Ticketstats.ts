import { type Bot, Command, type Context } from "../../structures/index.js";
import { EmbedBuilder } from "discord.js";

export default class TicketStats extends Command {
    constructor(client: Bot) {
        super(client, {
            name: "ticketstats",
            nameLocalizations: {
                fr: "statistiquestickets",
            },
            description: {
                content: "Get the current ticket statistics",
                usage: "ticketstats",
                examples: ["ticketstats"],
            },
            descriptionLocalizations: {
                fr: "Obtenez les statistiques actuelles des tickets.",
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

            if (allTicketStats.length === 0) {
                await ctx.sendMessage({ content: "No ticket statistics available." });
                return;
            }

            const totalRatings = allTicketStats.reduce((sum, stat) => sum + stat.rating, 0);
            const averageRating = totalRatings / allTicketStats.length;

            const embed = new EmbedBuilder()
                .setTitle("Ticket Statistics")
                .setColor("#FFD700")
                .addFields(
                    { name: "Total Tickets", value: `${allTicketStats.length}`, inline: true },
                    { name: "Total Ratings", value: `${totalRatings}`, inline: true },
                    { name: "Average Rating", value: `${averageRating.toFixed(2)}`, inline: true },
                )
                .setTimestamp();

            await ctx.sendMessage({ embeds: [embed] });
        } catch (error) {
            this.client.logger.error(`Failed to retrieve ticket statistics: ${error.message}`);
            await ctx.sendMessage({ content: "There was an error retrieving the ticket statistics." });
        }
    }
}
