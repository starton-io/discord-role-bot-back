import "reflect-metadata"
import { Client } from "discordx"
import {Intents} from "discord.js"
import { importx } from "@discordx/importer"

export class Discord {
    private static _client: Client

    static get Client(): Client {
        return this._client
    }

    static async start(): Promise<void> {
        this._client = new Client({
            intents: [
                Intents.FLAGS.GUILDS,
                Intents.FLAGS.GUILD_MESSAGES,
                Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
                Intents.FLAGS.GUILD_VOICE_STATES,
                Intents.FLAGS.GUILD_MEMBERS,
            ],
            // classes: [
            //     path.join(__dirname, "commands", "**/*.{ts,js}"),
            //     path.join(__dirname, "events", "**/*.{ts,js}"),
            // ],
            botGuilds: [(client) => client.guilds.cache.map((guild) => guild.id)],
            // botGuilds: [
            //     process.env.GUILD_ID as string
            // ],
            silent: true,
        })

        this._client.once("ready", async () => {
            await this._client.initApplicationCommands()
            await this._client.initApplicationPermissions()

            console.log("Bot started")
        })

        this._client.on("interactionCreate", (interaction) => {
            this._client.executeInteraction(interaction)
        })

        await importx(__dirname + "/commands/**/*.{js,ts}")
        await this._client.login(process.env.BOT_TOKEN ?? "")
    }
}
