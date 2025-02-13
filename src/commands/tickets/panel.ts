import {
	ActionRowBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	MessageFlags,
	TextChannel,
	NewsChannel,
} from 'discord.js';
import { type Bot, Command, type Context } from '../../structures/index';
import { TicketManager } from '../../utils/TicketManager';

interface TicketCategory {
	menuLabel: string;
	menuDescription: string;
	menuEmoji: string;
}

export default class PanelCommand extends Command {
	constructor(client: Bot) {
		super(client, {
			name: 'panel',
			description: {
				content: 'Send the ticket panel in the channel.',
				usage: 'panel',
				examples: ['panel'],
			},
			category: 'ticket',
			permissions: {
				dev: false,
				client: ['SendMessages', 'ViewChannel', 'EmbedLinks'],
				user: ['ManageGuild'],
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

			await ctx.sendMessage({ content: 'Sending the panel in this channel...', flags: MessageFlags.Ephemeral });

			if (ctx.channel instanceof TextChannel || ctx.channel instanceof NewsChannel) {
				await ctx.channel.send({
					embeds: [panelEmbed],
					components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)],
				});
				await this.client.db.saveTicketData(
					ctx.guild.id,
					selectMenu.options.map(opt => opt.data),
				);
			} else {
				await ctx.sendErrorMessage('This command can only be used in text-based channels.');
			}
		} catch (error) {
			this.client.logger.error(`Error sending the panel or saving ticket data: ${error}`);
		}
	}

	createSelectMenu(ticketCategories: Record<string, TicketCategory>, placeholder: string): StringSelectMenuBuilder {
		return new StringSelectMenuBuilder()
			.setCustomId('categoryMenu')
			.setPlaceholder(placeholder)
			.setMinValues(1)
			.setMaxValues(1)
			.addOptions(
				Object.entries(ticketCategories).map(([customId, category]) => {
					const option = new StringSelectMenuOptionBuilder()
						.setLabel(category.menuLabel)
						.setDescription(category.menuDescription)
						.setValue(customId);

					if (category.menuEmoji) option.setEmoji(category.menuEmoji);

					return option;
				}),
			);
	}
}
