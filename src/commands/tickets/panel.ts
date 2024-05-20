import {
    ActionRowBuilder,
    EmbedBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} from 'discord.js';
import fs from 'node:fs';
import YAML from 'yaml';

import { Bot, Command, Context } from '../../structures/index.js';

export default class PanelCommand extends Command {
    constructor(client: Bot) {
        super(client, {
            name: 'panel',
            nameLocalizations: {
                fr: 'pannel',
            },
            description: {
                content: 'Send the ticket panel in the channel.',
                usage: 'panel',
                examples: ['panel'],
            },
            descriptionLocalizations: {
                fr: 'Envoyez le panneau de ticket dans la chaîne.',
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

    async run(client: Bot, ctx: Context): Promise<void> {
        await ctx.sendDeferMessage({ ephemeral: true });
        let config;
        try {
            const configFile = fs.readFileSync('./config.yml', 'utf8');
            config = YAML.parse(configFile);
        } catch (error) {
            console.error('Error reading or parsing config file:', error);
            await ctx.editMessage({
                content:
                    'There was an error loading the configuration. Please contact the administrator.',
            });
            return;
        }

        const panelEmbed = this.createPanelEmbed(client);
        const selectMenu = this.createSelectMenu(config.ticketCategories, config.menuPlaceholder);

        const actionRowsMenus = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            selectMenu
        );

        try {
            await ctx.editMessage({ content: 'Sending the panel in this channel...' });

            await ctx.channel.send({ embeds: [panelEmbed], components: [actionRowsMenus] });

            await this.saveTicketData(ctx.guild.id, selectMenu.options);
        } catch (error) {
            console.error('Error sending the panel or saving ticket data:', error);
            await ctx.editMessage({
                content: 'There was an error sending the panel. Please contact the administrator.',
            });
        }
    }

    createPanelEmbed(client: Bot): EmbedBuilder {
        return client
            .embed()
            .setColor(this.client.color)
            .setTitle('AikouTicket')
            .setDescription(
                'To create a support ticket, please select one of the options below based on the assistance you require.'
            )
            .setImage(
                'https://cdn.discordapp.com/attachments/1109764526552915988/1136666715078533303/image.png?ex=6647695f&is=664617df&hm=ec6a3e7de621daf0813e7a70c6ec7b2c9741bad8450172d356f85f28273610b2&'
            )
            .setTimestamp();
    }

    createSelectMenu(ticketCategories: any, placeholder: string): StringSelectMenuBuilder {
        const options = Object.keys(ticketCategories).map(customId => {
            const category = ticketCategories[customId];
            const option = new StringSelectMenuOptionBuilder()
                .setLabel(category.menuLabel)
                .setDescription(category.menuDescription)
                .setValue(customId);

            if (category.menuEmoji !== '') {
                option.setEmoji(category.menuEmoji);
            }

            return option;
        });

        return new StringSelectMenuBuilder()
            .setCustomId('categoryMenu')
            .setPlaceholder(placeholder)
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(options);
    }

    async saveTicketData(guildId: string, options: any): Promise<void> {
        await this.client.prisma.tickets.create({
            data: {
                guildId,
                selectMenuOptions: JSON.stringify(options),
            },
        });
    }
}
