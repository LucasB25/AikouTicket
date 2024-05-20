import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

import { Bot, Command, Context } from '../../structures/index.js';

export default class About extends Command {
    constructor(client: Bot) {
        super(client, {
            name: 'about',
            nameLocalizations: {
                fr: 'à-propos',
            },
            description: {
                content: '📨 | Shows information about the bot',
                usage: 'about',
                examples: ['about'],
            },
            descriptionLocalizations: {
                fr: '📨 | Affiche des informations sur le bot',
            },
            category: 'general',
            permissions: {
                dev: false,
                client: ['SendMessages', 'ViewChannel', 'EmbedLinks'],
                user: [],
            },
            cooldown: 3,
            options: [],
        });
    }

    async run(client: Bot, ctx: Context): Promise<void> {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setLabel('Invite AikouTicket')
                .setURL(
                    `https://discord.com/oauth2/authorize?client_id=${this.client.user?.id}&scope=bot%20applications.commands&permissions=8`
                )
                .setStyle(ButtonStyle.Link),
            new ButtonBuilder()
                .setLabel('Support Server')
                .setURL('https://discord.gg/JeaQTqzsJw')
                .setStyle(ButtonStyle.Link)
        );

        const embed = client
            .embed()
            .setColor(this.client.color)
            .setAuthor({ name: 'AikouTicket' })
            .addFields(
                { name: 'Creator', value: '[LucasB25](https://github.com/lucasb25)', inline: true },
                {
                    name: 'Repository',
                    value: '[Here](https://github.com/lucasb25/AikouTicket)',
                    inline: true,
                },
                { name: 'Support', value: '[Here](https://discord.gg/AhUJa2kdAr)', inline: true }
            );

        await ctx.sendMessage({ embeds: [embed], components: [row] });
    }
}
