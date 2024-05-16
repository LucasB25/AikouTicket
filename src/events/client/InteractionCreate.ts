import { CommandInteraction } from 'discord.js';

import { Bot, Event, EventsTypes } from '../../structures/index.js';

export default class InteractionCreate extends Event {
    constructor(client: Bot, file: string) {
        super(client, file, {
            name: EventsTypes.InteractionCreate,
        });
    }

    public async run(interaction: CommandInteraction): Promise<void> {
        try {
            if (interaction.isCommand()) {
                const commandName = interaction.commandName;
                const command = this.client.commands.get(commandName);
                if (!command) return;

                await command.run(this.client, interaction);
            }
        } catch (error) {
            this.client.logger.error(error);
            await this.replyWithError(
                interaction,
                'There was an error while executing this command!'
            );
        }
    }

    private async replyWithError(interaction: CommandInteraction, message: string): Promise<void> {
        await interaction[interaction.replied ? 'editReply' : 'reply']({
            content: message,
            ephemeral: true,
        });
    }
}
