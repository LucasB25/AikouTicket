import {
    ActionRowBuilder,
    ButtonBuilder,
    type ButtonInteraction,
    ButtonStyle,
    ChannelType,
    type CommandInteraction,
    EmbedBuilder,
    type MessageComponentInteraction,
    type SelectMenuInteraction,
    StringSelectMenuBuilder,
    type TextChannel,
    type GuildChannel,
} from "discord.js";

import { type Bot, Context, Event } from "../../structures/index.js";
import { LogsManager } from "../../utils/LogsManager.js";
import { TicketManager } from "../../utils/TicketManager.js";

export default class InteractionCreate extends Event {
    private config: any;

    constructor(client: Bot, file: string) {
        super(client, file, { name: "interactionCreate" });
    }

    public async run(interaction: CommandInteraction | SelectMenuInteraction | ButtonInteraction): Promise<void> {
        try {
            this.config = await TicketManager.readConfigFile();

            if (interaction.isCommand()) {
                await this.handleCommandInteraction(interaction);
            } else if (interaction.isStringSelectMenu() && interaction.customId === "categoryMenu") {
                await this.handleSelectMenuInteraction(interaction);
            } else if (interaction.isButton()) {
                await this.handleButtonInteraction(interaction);
            } else if (interaction.isStringSelectMenu() && interaction.customId.startsWith("ratingMenu-")) {
                await this.handleRatingSelectMenu(interaction);
            }
        } catch (error) {
            this.client.logger.error(`Failed to handle interaction: ${error.message}`);
            await interaction.reply({
                content: `An error occurred: \`${error.message}\``,
                ephemeral: true,
            });
        }
    }

    private async handleCommandInteraction(interaction: any): Promise<void> {
        const command = this.client.commands.get(interaction.commandName);
        if (!command) return;

        const ctx = new Context(interaction, interaction.options.data);
        ctx.setArgs(interaction.options.data);

        try {
            await command.run(this.client, ctx, ctx.args);
        } catch (error) {
            this.client.logger.error(error);
            await interaction.reply({
                content: `An error occurred: \`${error.message}\``,
                ephemeral: true,
            });
        }
    }

    private async handleSelectMenuInteraction(interaction: any): Promise<void> {
        await interaction.deferReply({ ephemeral: true });

        try {
            const selectMenuOptions = await this.client.db.get(interaction.guild.id);

            if (!selectMenuOptions?.selectMenuOptions) {
                throw new Error("No select menu options found.");
            }

            const parsedOptions = JSON.parse(selectMenuOptions.selectMenuOptions);
            await this.updateSelectMenu(interaction, this.config.menuPlaceholder, parsedOptions);

            const selectedOption = interaction.values[0];
            const category = parsedOptions.find((opt: any) => opt.value === selectedOption);

            if (!category) {
                throw new Error("Selected category is not valid.");
            }

            const userTickets = interaction.guild.channels.cache.filter(
                (channel) => channel.type === ChannelType.GuildText && channel.name.startsWith(`ticket-${interaction.user.username}`),
            );

            if (userTickets.size >= this.config.maxActiveTicketsPerUser) {
                await interaction.editReply({
                    content: `You have reached the maximum limit of active tickets (${this.config.maxActiveTicketsPerUser}).`,
                });
                return;
            }

            const channel = await TicketManager.createTicket(interaction, category.value, this.client);
            await this.replyWithTicketCreationResult(interaction, channel);
        } catch (error) {
            this.client.logger.error(error);
        }
    }

    private async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
        const isSupport = await TicketManager.isUserSupport(interaction);

        switch (interaction.customId) {
            case "close-ticket":
                await this.handleCloseTicketButton(interaction, isSupport);
                break;
            case "confirm-close-ticket":
                await this.handleConfirmCloseTicketButton(interaction);
                break;
            case "claim-ticket":
                await this.handleClaimTicketButton(interaction, isSupport);
                break;
            case "unclaim-ticket":
                await this.handleUnclaimTicketButton(interaction, isSupport);
                break;
            case "transcripts-ticket":
                await this.handleTranscriptTicketButton(interaction);
                break;
        }
    }

    private async handleClaimTicketButton(interaction: ButtonInteraction, isSupport: boolean): Promise<void> {
        if (!isSupport) {
            await interaction.reply({
                content: "You do not have permission to claim this ticket.",
                ephemeral: true,
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor("#00FF00")
            .setTitle("Ticket Claimed")
            .setDescription(`🎟️ **Ticket claimed by ${interaction.user.username}.**\nI will start assisting you right away.`)
            .setFooter({
                text: `Ticket claimed by ${interaction.user.username}`,
                iconURL: interaction.user.displayAvatarURL({ extension: "png", size: 1024 }),
            })
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            ephemeral: false,
        });

        await this.updateClaimButton(interaction, interaction.user.username, "claimed");
    }

    private async handleUnclaimTicketButton(interaction: ButtonInteraction, isSupport: boolean): Promise<void> {
        if (!isSupport) {
            await interaction.reply({
                content: "You do not have permission to unclaim this ticket.",
                ephemeral: true,
            });
            return;
        }

        await this.updateClaimButton(interaction, interaction.user.username, "unclaimed");
    }

    private async handleCloseTicketButton(interaction: ButtonInteraction, isSupport: boolean): Promise<void> {
        if (this.config.closeTicketStaffOnly && !isSupport) {
            await interaction.reply({
                content: "You do not have permission to close this ticket.",
                ephemeral: true,
            });
            return;
        }

        const confirmationButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId("confirm-close-ticket").setLabel("Confirm").setStyle(ButtonStyle.Danger).setEmoji("⛔"),
            new ButtonBuilder()
                .setCustomId("transcripts-ticket")
                .setLabel("Transcripts")
                .setStyle(ButtonStyle.Primary)
                .setEmoji("📝")
                .setDisabled(!isSupport),
        );

        const embed = new EmbedBuilder()
            .setColor("#FF2400")
            .setTitle("Confirm Ticket Closure")
            .setDescription("Are you sure you want to close the ticket?")
            .setFooter({ text: "You have 60 seconds to respond." });

        await interaction.reply({
            embeds: [embed],
            components: [confirmationButtons],
            ephemeral: true,
        });

        const filter = (i: MessageComponentInteraction): boolean => i.customId === "confirm-close-ticket";
        const collector = interaction.channel.createMessageComponentCollector({
            filter,
            time: 60000,
        });

        collector.on("collect", async (i) => {
            if (i.customId === "confirm-close-ticket") {
                collector.stop();
                // await message.delete().catch((error) => this.client.logger.error("Failed to delete message:", error));
            }
        });

        const transcriptsFilter = (i: MessageComponentInteraction): boolean => i.customId === "transcripts-ticket";
        const transcriptsCollector = interaction.channel.createMessageComponentCollector({
            filter: transcriptsFilter,
            time: 60000,
        });

        transcriptsCollector.on("collect", async (i) => {
            if (i.customId === "transcripts-ticket") {
                transcriptsCollector.stop();
                // await message.delete().catch((error) => this.client.logger.error("Failed to delete message:", error));
            }
        });

        setTimeout(async () => {
            collector.stop();
            transcriptsCollector.stop();
            // await message.delete().catch((error) => this.client.logger.error("Failed to delete message:", error));
        }, 60000);
    }

    private async handleConfirmCloseTicketButton(interaction: ButtonInteraction): Promise<void> {
        const channel = interaction.channel as TextChannel;
        const categoryLabel = channel.topic?.match(/Ticket Type: (.+)/)?.[1] || "unknown";
        const ticketChannel = interaction.channel as TextChannel;

        if (this.config.enableTicketReason) {
            await interaction.reply({
                content: "Please provide a reason for closing the ticket within 1 minute.",
                ephemeral: true,
            });

            let shouldCloseTicket = false;
            let reason = "";

            const collector = channel.createMessageCollector({
                filter: (msg) => msg.author.id === interaction.user.id,
                time: 60000,
                max: 1,
            });

            collector.on("collect", async (message) => {
                shouldCloseTicket = true;
                reason = message.content;
                await LogsManager.logTicketDeletion(interaction, this.client, interaction.user.username, categoryLabel, channel, reason);

                const ticket = await this.client.db.getTicketInfo(ticketChannel.id);
                if (ticket) {
                    const creator = interaction.guild.members.cache.find((member) => member.user.username === ticket.creator);
                    if (this.config.enableNotifyTicketCreator && creator) {
                        await this.notifyTicketCreator(interaction, creator, reason, ticketChannel);
                        await this.sendRatingMenu(creator, ticketChannel);
                    } else if (!creator) {
                        this.client.logger.error(`Failed to find creator of ticket ${ticketChannel.id}.`);
                    }
                } else {
                    this.client.logger.error(`Failed to find ticket information for ${ticketChannel.id}.`);
                }
            });

            collector.on("end", async () => {
                if (!shouldCloseTicket) {
                    await interaction.followUp({
                        content: "Failed to close the ticket. Reason not provided within 1 minute.",
                        ephemeral: true,
                    });
                    return;
                }

                const announcementEmbed = new EmbedBuilder().setDescription("This ticket will be closed in 10 seconds.");

                await interaction.followUp({ embeds: [announcementEmbed], ephemeral: true });

                setTimeout(async () => {
                    try {
                        await channel.delete(`Ticket closed by user with reason: ${reason}`);

                        await this.client.db.deleteTicketInfo(channel.id);
                    } catch (error) {
                        this.client.logger.error("Failed to delete channel:", error);
                    }
                }, 10000);
            });
        } else {
            const reason = "No reason provided";
            await LogsManager.logTicketDeletion(interaction, this.client, interaction.user.username, categoryLabel, channel, reason);
            const ticket = await this.client.db.getTicketInfo(ticketChannel.id);
            if (ticket) {
                const creator = interaction.guild.members.cache.find((member) => member.user.username === ticket.creator);
                if (this.config.enableNotifyTicketCreator && creator) {
                    await this.notifyTicketCreator(interaction, creator, reason, ticketChannel);
                    await this.sendRatingMenu(creator, ticketChannel);
                } else if (!creator) {
                    this.client.logger.error(`Failed to find creator of ticket ${ticketChannel.id}.`);
                }
            } else {
                this.client.logger.error(`Failed to find ticket information for ${ticketChannel.id}.`);
            }

            const announcementEmbed = new EmbedBuilder().setDescription("This ticket will be closed in 10 seconds.");

            await interaction.reply({
                embeds: [announcementEmbed],
                ephemeral: true,
            });

            setTimeout(async () => {
                try {
                    await channel.delete(`Ticket closed by user with reason: ${reason}`);

                    await this.client.db.deleteTicketInfo(channel.id);
                } catch (error) {
                    this.client.logger.error("Failed to delete channel:", error);
                }
            }, 10000);
        }
    }

    private async notifyTicketCreator(interaction: any, user: any, reason: string | null, ticketChannel: TextChannel): Promise<void> {
        try {
            const ticket = await this.client.db.getTicketInfo(ticketChannel.id);
            if (!ticket) throw new Error("Ticket information not found.");

            const reasonText = reason ? `\n\n**Reason:** ${reason}` : "";
            const { guild } = ticketChannel;
            const creator = interaction.guild.members.cache.find((member) => member.user.username === ticket.creator);
            const creatorName = creator ? creator.user.username : ticket.creator;

            const embed = new EmbedBuilder()
                .setColor("#FF2400")
                .setTitle("Ticket Closed")
                .setDescription(`Your ticket has been closed.${reasonText}`)
                .addFields(
                    { name: "Server", value: `> ${guild.name}`, inline: true },
                    { name: "Ticket", value: `> #${ticketChannel.name}`, inline: true },
                    { name: "Category", value: `> ${ticketChannel.topic?.match(/Ticket Type: (.+)/)?.[1] || "Unknown"}`, inline: true },
                    { name: "Ticket Author", value: `> ${creatorName}`, inline: true },
                    { name: "Closed By", value: `> ${interaction.user.username}`, inline: true },
                    { name: "Ticket Creation Time", value: `> ${new Date(Number(ticket.createdAt)).toLocaleString()}`, inline: true },
                )
                .setThumbnail(interaction.guild.iconURL({ format: "png", size: 1024 }))
                .setFooter({ text: "Ticket System", iconURL: interaction.user.displayAvatarURL({ extension: "png", size: 1024 }) })
                .setTimestamp();

            await user.send({ embeds: [embed] });
        } catch (error) {
            this.client.logger.error(`Failed to notify ticket creator: ${error.message}`);
        }
    }

    private async sendRatingMenu(user: any, ticketChannel: TextChannel): Promise<void> {
        const ratingMenu = new StringSelectMenuBuilder()
            .setCustomId(`ratingMenu-${ticketChannel.id}`)
            .setPlaceholder("Rate your support ticket experience")
            .addOptions(
                { label: "⭐ 1 Star", value: "1" },
                { label: "⭐⭐ 2 Stars", value: "2" },
                { label: "⭐⭐⭐ 3 Stars", value: "3" },
                { label: "⭐⭐⭐⭐ 4 Stars", value: "4" },
                { label: "⭐⭐⭐⭐⭐ 5 Stars", value: "5" },
            );

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(ratingMenu);

        const embed = new EmbedBuilder()
            .setColor("#FFD700")
            .setTitle("Rate Your Ticket Experience")
            .setDescription("Please rate your experience with our support team by selecting a rating below.");

        try {
            await user.send({ embeds: [embed], components: [row] });
        } catch (error) {
            this.client.logger.error("Failed to send rating menu:", error);
        }
    }

    private async handleRatingSelectMenu(interaction: SelectMenuInteraction): Promise<void> {
        const rating = parseInt(interaction.values[0], 10);

        if (isNaN(rating) || rating < 1 || rating > 5) {
            await interaction.reply({
                content: "Invalid rating. Please select a rating between 1 and 5 stars.",
                ephemeral: true,
            });
            return;
        }

        try {
            const channelId = interaction.customId.split("-")[1];

            await this.client.db.updateTicketStats(channelId, rating);

            await LogsManager.logTicketRating(
                interaction,
                this.client,
                interaction.channel as GuildChannel,
                rating,
                this.config.ratingLogChannelId,
            );

            await interaction.reply({
                content: "Thank you for rating your support ticket experience!",
                ephemeral: true,
            });
        } catch (error) {
            this.client.logger.error("Failed to save ticket rating:", error);
            await interaction.reply({
                content: `An error occurred: ${error.message}`,
                ephemeral: true,
            });
        }
    }

    private async handleTranscriptTicketButton(interaction: any): Promise<void> {
        const ticketChannel = interaction.channel;
        await LogsManager.logTicketTranscript(interaction, this.client, ticketChannel);

        const embed = new EmbedBuilder().setDescription("The transcript of the ticket has been generated and logged.");

        await interaction.reply({
            embeds: [embed],
            ephemeral: true,
        });
    }

    private async updateSelectMenu(interaction: SelectMenuInteraction, placeholder: string, options: any): Promise<void> {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId("categoryMenu")
            .setPlaceholder(placeholder)
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(options);

        const updatedActionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
        await interaction.message.edit({ components: [updatedActionRow] });
    }

    private async replyWithTicketCreationResult(interaction: any, channel: TextChannel | null): Promise<void> {
        const embed = new EmbedBuilder().setColor("#00FF00");

        if (channel) {
            embed.setDescription(`Your new ticket ${channel.toString()} has been created, ${interaction.user.username}!`);
        } else {
            embed
                .setTitle("Ticket Creation Failed")
                .setDescription("Failed to create the ticket. Please try again later.")
                .setColor("#FF0000");
        }

        await interaction.editReply({ embeds: [embed] });
    }

    private async updateClaimButton(interaction: any, userName: string, action: string): Promise<void> {
        const components = interaction.message.components[0].components;
        const claimButtonIndex = components.findIndex((component) => component.customId === "claim-ticket");
        const isClaimed = action === "claimed";

        if (claimButtonIndex !== -1) {
            components[claimButtonIndex] = new ButtonBuilder()
                .setCustomId("claim-ticket")
                .setLabel(isClaimed ? "Claimed" : "Claim")
                .setStyle(isClaimed ? ButtonStyle.Secondary : ButtonStyle.Primary)
                .setDisabled(isClaimed)
                .setEmoji("🎫");

            if (isClaimed) {
                const unclaimButton = new ButtonBuilder()
                    .setCustomId("unclaim-ticket")
                    .setLabel("Unclaim")
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji("⚠️");

                components.push(unclaimButton);
            } else {
                const unclaimButtonIndex = components.findIndex((component) => component.customId === "unclaim-ticket");
                if (unclaimButtonIndex !== -1) {
                    components.splice(unclaimButtonIndex, 1);
                }
            }
        }

        const embeds = interaction.message.embeds;
        if (embeds.length > 0) {
            const existingEmbed = embeds[0];
            const updatedDescription = isClaimed
                ? `${existingEmbed.description}\n\n> **Claimed by**: ${userName}`
                : existingEmbed.description.replace(`\n\n> **Claimed by**: ${userName}`, "");
            const updatedEmbed = new EmbedBuilder(existingEmbed).setDescription(updatedDescription);
            await interaction.message.edit({
                components: [new ActionRowBuilder<ButtonBuilder>().addComponents(components)],
                embeds: [updatedEmbed],
            });
        } else {
            await interaction.message.edit({
                components: [new ActionRowBuilder<ButtonBuilder>().addComponents(components)],
            });
        }
    }
}
