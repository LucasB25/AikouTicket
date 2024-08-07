import {
    ApplicationCommandType,
    Client,
    Collection,
    EmbedBuilder,
    PermissionsBitField,
    REST,
    type RESTPostAPIChatInputApplicationCommandsJSONBody,
    Routes,
} from "discord.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Logger from "./Logger.js";
import config from "../config.js";
import ServerData from "../database/server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default class Bot extends Client {
    public config = config;
    public logger = new Logger();
    public db = new ServerData();
    public readonly color = config.color;
    public commands = new Collection<string, any>();
    private data: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];

    public async start(token: string): Promise<void> {
        try {
            this.logger.start("Starting bot...");
            await this.loadCommands();
            await this.loadEvents();
            await this.login(token);
        } catch (error) {
            this.logger.error(error);
        }
    }

    public embed(): EmbedBuilder {
        return new EmbedBuilder().setColor(this.config.color);
    }

    private async loadEvents(): Promise<void> {
        const eventsPath = path.join(__dirname, "../events");
        const events = fs.readdirSync(eventsPath);
        for (const event of events) {
            const eventFilesPath = path.join(eventsPath, event);
            const eventFiles = fs.readdirSync(eventFilesPath).filter((file) => file.endsWith(".js"));
            for (const file of eventFiles) {
                const eventFile = (await import(`../events/${event}/${file}`)).default;
                const eventClass = new eventFile(this, file);
                this.on(eventClass.name, (...args: unknown[]) => eventClass.run(...args));
            }
        }
    }

    private async loadCommands(): Promise<void> {
        const commandsPath = path.join(__dirname, "../commands");
        const commandCategories = fs.readdirSync(commandsPath);
        for (const category of commandCategories) {
            const commandFilesPath = path.join(commandsPath, category);
            const commandFiles = fs.readdirSync(commandFilesPath).filter((file) => file.endsWith(".js"));
            for (const file of commandFiles) {
                const commandFile = (await import(`../commands/${category}/${file}`)).default;
                const command = new commandFile(this, file);
                this.commands.set(command.name, command);
                const data: RESTPostAPIChatInputApplicationCommandsJSONBody = {
                    name: command.name,
                    description: command.description.content,
                    type: ApplicationCommandType.ChatInput,
                    options: command.options || [],
                    name_localizations: command.nameLocalizations || {},
                    description_localizations: command.descriptionLocalizations || {},
                    default_member_permissions: command.permissions.user.length > 0 ? command.permissions.user : null,
                };
                if (command.permissions.user.length > 0) {
                    const permissionValue = PermissionsBitField.resolve(command.permissions.user);
                    data.default_member_permissions = typeof permissionValue === "bigint" ? permissionValue.toString() : permissionValue;
                }
                this.data.push(data);
            }
        }

        this.once("ready", async () => {
            const applicationCommands = Routes.applicationCommands(this.config.clientId ?? "");
            try {
                const rest = new REST({ version: "10" }).setToken(this.config.token ?? "");
                await rest.put(applicationCommands, { body: this.data });
                this.logger.info("Successfully loaded slash commands!");
            } catch (error) {
                this.logger.error(error);
            }
        });
    }
}
