import { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from "discord.js";
import { type Bot, Command, type Context } from "../../structures/index.js";
import { TicketManager } from "../../utils/TicketManager.js";

interface TicketCategory {
    menuLabel: string;
    menuDescription: string;
    menuEmoji: string;
}

export default class PanelCommand extends Command {
    constructor(client: Bot) {
        super(client, {
            name: "panel",
            description: {
                content: "Send the ticket panel in the channel.",
                usage: "panel",
                examples: ["panel"],
            },
            category: "ticket",
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
            const config = await TicketManager.readConfigFile();
            const panelEmbed = TicketManager.buildEmbed(config.embeds.panelEmbed);
            const selectMenu = this.createSelectMenu(config.ticketCategories, config.menuPlaceholder);

            await ctx.sendMessage({ content: "Sending the panel in this channel...", ephemeral: true });
            await ctx.channel.send({
                embeds: [panelEmbed],
                components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)],
            });
            await this.client.db.saveTicketData(ctx.guild.id, selectMenu.options);
        } catch (error) {
            this.client.logger.error("Error sending the panel or saving ticket data:", error);
        }
    }

    createSelectMenu(ticketCategories: Record<string, TicketCategory>, placeholder: string): StringSelectMenuBuilder {
        const options = Object.entries(ticketCategories).map(([customId, category]) =>
            new StringSelectMenuOptionBuilder()
                .setLabel(category.menuLabel)
                .setDescription(category.menuDescription)
                .setValue(customId)
                .setEmoji(category.menuEmoji || undefined),
        );

        return new StringSelectMenuBuilder()
            .setCustomId("categoryMenu")
            .setPlaceholder(placeholder)
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(options);
    }
}
