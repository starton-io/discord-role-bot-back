import { ApplicationCommandPermissions, CommandInteraction, GuildMember, Role } from "discord.js"
import { Discord, Permission, Slash, SlashGroup, SlashOption } from "discordx"
import { getConnection } from "typeorm"
import { Starton } from "../starton"
import { Guild } from "../entity/guild.entity"
import { Discord as DiscordIntance } from "../discord"
import { Logger } from "../logger"
import { Permissions } from "../permissions"

@Discord()
abstract class InitStartonBotCommand {
	@Slash("init")
	private async init(
		@SlashOption("key", { description: "Your starton api-key", required: true })
		apiKey: string,

		@SlashOption("administrator", {
			type: "ROLE",
			required: true,
			description: "The role that can manage the bot",
		})
		administratorRole: Role,

		@SlashOption("logging", {
			type: "CHANNEL",
			required: false,
			description: "The channel used for the logs",
		})
		logChannel: Role,

		interaction: CommandInteraction,
	) {
		await interaction.deferReply({ ephemeral: true })

		const guildRepo = getConnection().getRepository(Guild)
		const existingGuild = await guildRepo.findOne({ where: { guildId: interaction.guildId } })
		if (existingGuild) {
			return await interaction.editReply(`This bot is already configured.`)
		}

		const signingKey = await Starton.getSigningKey(apiKey)
		if (!signingKey) {
			return await interaction.editReply(`Api key verification failed, is this key valid ?`)
		}
		await guildRepo.save({
			guildId: interaction?.guildId as string,
			administratorRole: administratorRole.id,
			apiKey: apiKey,
			logChannel: logChannel.id,
			signingKey: signingKey,
		})

		try {
			await DiscordIntance.Client.initApplicationPermissions()
		} catch (e) {
			console.log("Could not init application permissions", e)
		}

		await Logger.logDiscord(interaction?.guildId as string, ":green_circle: Starton bot initialized.")
		await interaction.editReply(`Discord server registered!`)
	}
}

@Discord()
// @Permission(false)
// @Permission(async (guild, cmd): Promise<ApplicationCommandPermissions[]> => {
// 	const guildRepo = getConnection().getRepository(Guild)
// 	const guildEntity = await guildRepo.findOne({ where: { guildId: guild.id } })
//
// 	if (guildEntity && guildEntity.administratorRole) {
// 		return [{ id: guildEntity.administratorRole, permission: true, type: "ROLE" }]
// 	}
// 	return []
// })
abstract class ManageStartonBotCommand {
	@Slash("update-api-key")
	private async updateApiKey(
		@SlashOption("key", { required: true, description: "New api-key" })
		key: string,

		interaction: CommandInteraction,
	) {
		await interaction.deferReply({ ephemeral: true })

		if (! await Permissions.isAdmin(interaction.guild?.id as string, interaction.member as GuildMember)) {
			return await interaction.editReply(`You are not allowed to use this command.`)
		}

		const guildRepo = getConnection().getRepository(Guild)
		const guild = await guildRepo.findOneOrFail({ where: { guildId: interaction.guildId } })

		// Check if the new api key is valid
		if (!(await Starton.getSigningKey(key))) {
			return await interaction.editReply(`Api key verification failed, is this key valid ?`)
		}

		guild.apiKey = key
		await guildRepo.save(guild)

		await interaction.editReply(`Api-key updated`)
	}

	@Slash("update-signing-key")
	private async updateSigningKey(interaction: CommandInteraction) {
		await interaction.deferReply({ ephemeral: true })

		if (! await Permissions.isAdmin(interaction.guild?.id as string, interaction.member as GuildMember)) {
			return await interaction.editReply(`You are not allowed to use this command.`)
		}

		const guildRepo = getConnection().getRepository(Guild)
		const guild = await guildRepo.findOneOrFail({ where: { guildId: interaction.guildId } })

		const signingKey = await Starton.regenerateSigningKey(guild.apiKey)
		if (!signingKey) {
			return await interaction.editReply(
				`Could not retreive signing-key, please try again later.`,
			)
		}

		guild.signingKey = signingKey
		await guildRepo.save(guild)

		await interaction.editReply(`Signing-key updated`)
	}
}
