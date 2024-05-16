import {
    ActionRowBuilder,
    CommandInteraction,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} from 'discord.js';

import { Bot, Command } from '../../structures/index.js';

export default class Ping extends Command {
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
            category: 'general',
            permissions: {
                dev: false,
                client: ['SendMessages', 'ViewChannel', 'EmbedLinks', 'ManageServer'],
                user: [],
            },
            cooldown: 3,
            options: [],
        });
    }
    async run(client: Bot, interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });

        const panelEmbed = client
            .embed()
            .setColor(this.client.color)
            .setTitle('AikouTicket')
            .setDescription(
                'To create a support ticket, please select one of the options below based on the assistance you require.'
            )
            .setImage('https://cdn.discordapp.com/attachments/1109764526552915988/1136666715078533303/image.png?ex=6647695f&is=664617df&hm=ec6a3e7de621daf0813e7a70c6ec7b2c9741bad8450172d356f85f28273610b2&')
            .setTimestamp();

        const ticketCategories = {
            'category1': {
                menuLabel: 'Category 1',
                menuDescription: 'Description for Category 1',
                menuEmoji: '',
            },
            'category2': {
                menuLabel: 'Category 2',
                menuDescription: 'Description for Category 2',
                menuEmoji: '',
            },
        };

        const options = [];

        const customIds = Object.keys(ticketCategories);

        for (const customId of customIds) {
            const category = ticketCategories[customId];
            const option = new StringSelectMenuOptionBuilder()
                .setLabel(category.menuLabel)
                .setDescription(category.menuDescription)
                .setValue(customId);

            if (category.menuEmoji !== '') {
                option.setEmoji(category.menuEmoji);
            }

            options.push(option);
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('categoryMenu')
            .setPlaceholder('Select a category to open a ticket.')
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(options);

        const actionRowsMenus = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

        await interaction.editReply({
            content: 'Sending the panel in this channel...',
        });

        await interaction.channel.send({ embeds: [panelEmbed], components: [actionRowsMenus], });
    }
}
