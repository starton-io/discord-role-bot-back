import { ApplicationCommandPermissions, CommandInteraction, Role } from "discord.js"
import { Discord as Discordx, Permission, Slash, SlashGroup, SlashOption } from "discordx"
import { getConnection } from "typeorm"
import { Starton } from "../starton"
import { Guild } from "../entity/guild.entity"
import { Discord } from "../discord"

@Discordx()
abstract class InitStartonBotCommand {
	@Slash("init")
	private async init(
		@SlashOption("key", { description: "Your starton api-key", required: true })
		apiKey: string,

		@SlashOption("administrator", {
			type: "ROLE",
			required: true,
			description: "Role who can config this bot, add other smart contract etc.?",
		})
		administratorRole: Role,
		interaction: CommandInteraction,
	) {
		await interaction.deferReply({
			ephemeral: true,
		})
		const guildRepo = getConnection().getRepository(Guild)
		const existingGuild = await guildRepo.findOne({
			where: {
				guildId: interaction.guildId,
			},
		})
		if (existingGuild) {
			return interaction.editReply(`This bot is already configured`)
		}

		try {
			const signingKey = await Starton.getSigningKey(apiKey)
			if (!signingKey) {
				throw "Coudl't retrieve signing key"
			}
			await guildRepo.save({
				guildId: interaction?.guildId as string,
				administratorRole: administratorRole.id,
				apiKey: apiKey,
				signingKey: signingKey,
			})
		} catch (err) {
			console.log(err)
			return interaction.editReply(
				`Could not register your discord serve, please try again later`,
			)
		}
		await Discord.Client.initApplicationPermissions()
		await interaction.editReply(`Discord server registered!`)
	}
}

@Discordx()
@Permission(false)
@Permission(async (guild, cmd): Promise<ApplicationCommandPermissions[]> => {
	const guildRepo = getConnection().getRepository(Guild)
	const guildEntity = await guildRepo.findOne({
		where: {
			guildId: guild.id,
		},
	})
	if (guildEntity && guildEntity.administratorRole) {
		return [{ id: guildEntity.administratorRole, permission: true, type: "ROLE" }]
	}
	return []
})
abstract class ManageStartonBotCommand {
	@Slash("update-api-key")
	private async updateApiKey(
		@SlashOption("key", { required: true, description: "New api-key" })
		key: string,

		interaction: CommandInteraction,
	) {
		await interaction.deferReply({
			ephemeral: true,
		})

		try {
			const guildRepo = getConnection().getRepository(Guild)
			const guild = await guildRepo.findOneOrFail({
				where: {
					guildId: interaction.guildId,
				},
			})

			if (!(await Starton.getSigningKey(key))) {
				throw "Could not get signing key"
			}

			guild.apiKey = key
			guildRepo.save(guild)

			return interaction.editReply(`api-key updated`)
		} catch (err) {
			console.log(err)
			return interaction.editReply(`Could not update api-key`)
		}
	}

	@Slash("update-signing-key")
	private async updateSigningKey(interaction: CommandInteraction) {
		await interaction.deferReply({
			ephemeral: true,
		})

		try {
			const guildRepo = getConnection().getRepository(Guild)
			const guild = await guildRepo.findOneOrFail({
				where: {
					guildId: interaction.guildId,
				},
			})

			const signingKey = await Starton.regenerateSigningKey(guild.apiKey)
			if (!signingKey) {
				throw "Could not create signing key"
			}

			guild.signingKey = signingKey
			await guildRepo.save(guild)

			return interaction.editReply(`signing-key updated`)
		} catch (err) {
			console.log(err)
			return interaction.editReply(`Could not update signing-key`)
		}
	}
}