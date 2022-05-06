import "reflect-metadata"
import { Client } from "discordx"
import { CommandInteraction, GuildMember, Intents, Interaction } from "discord.js"
import { importx } from "@discordx/importer"
import { Logger } from "./logger"
import { JoinEvent } from "./commands/event"
import { ClaimAirdrop } from "./commands/airdrop"
import discordModals from "discord-modals"

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
				Intents.FLAGS.GUILD_MEMBERS,
			],
			// classes: [
			//     path.join(__dirname, "commands", "**/*.{ts,js}"),
			//     path.join(__dirname, "events", "**/*.{ts,js}"),
			// ],
			botGuilds: [(client) => client.guilds.cache.map((guild) => guild.id)],
			// botGuilds: [
			//     process.env.GUILD_ID as string
			// ]
			silent: false,
		})

		discordModals(this._client)

		this._client.once("ready", async () => {
			await this._client.initApplicationCommands()
			try {
				await this._client.initApplicationPermissions()
			} catch (e) {
				console.log("Could not init application permissions", e)
			}

			console.log("Bot started")
		})

		this._client.on("guildCreate", async (guild) => {
			await this._client.initApplicationCommands()
			try {
				await this._client.initApplicationPermissions()
			} catch (e) {
				console.log("Could not init application permissions", e)
			}
		})

		this._client.on("interactionCreate", async (interaction) => {
			try {
				await this._client.executeInteraction(interaction)
			} catch (e) {
				if (interaction.isCommand()) {
					console.log(e)
					Logger.logInteraction(interaction as CommandInteraction)
					await (interaction as CommandInteraction).editReply(
						`Could not execute this command, please try again later.`,
					)
				}
			}
		})

		this._client.on("modalSubmit", async (modal) => {
			await modal.deferReply({ ephemeral: true })
			let response = "Could not execute this command, please try again later."

			if (modal.customId === "join-event-modal") {
				const password = modal.getTextInputValue("join-event-passord")
				const member = (await modal.guild?.members.fetch(modal.user.id)) as GuildMember
				response = await JoinEvent.join(member, password)
			} else if (modal.customId === "claim-airdrop-modal") {
				const address = modal.getTextInputValue("claim-airdrop-address")
				const password = modal.getTextInputValue("claim-airdrop-passord")
				response = await ClaimAirdrop.claim(
					modal.guild?.id as string,
					modal.channel?.id as string,
					modal.user.id,
					address,
					password,
				)
			}

			modal.followUp({ content: response, ephemeral: true })
		})

		await importx(__dirname + "/commands/**/*.{js,ts}")
		await this._client.login(process.env.BOT_TOKEN ?? "")
	}
}
