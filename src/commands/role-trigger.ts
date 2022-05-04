import { ApplicationCommandPermissions, CommandInteraction, Role } from "discord.js"
import { Discord, Permission, Slash, SlashGroup, SlashOption } from "discordx"
import { getConnection } from "typeorm"
import { Contract } from "../entity/contract.entity"
import { Type } from "../interface/global"
import { Starton } from "../starton"
import { Guild } from "../entity/guild.entity"
import { RoleTrigger } from "../entity/role-trigger.entity"
import watchers from "../interface/watcher"
import validate from "uuid-validate"
import { Logger } from "../logger"

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
@SlashGroup({ name: "trigger", description: "Manage your triggers" })
@SlashGroup("trigger")
abstract class RoleTriggerCommand {
	@Slash("create")
	private async createTrigger(
		@SlashOption("contract", {
			required: true,
			description: "ID of the contract you want to link the trigger to",
		})
		contractId: string,

		@SlashOption("role", {
			type: "ROLE",
			required: true,
			description: "Role you want to be given",
		})
		role: Role,

		@SlashOption("min", {
			required: false,
			description: "Minimum amount of token required. (Default 1)",
		})
		min: number,

		@SlashOption("max", {
			required: false,
			description: "Maximum amount of token required. (Default none)",
		})
		max: number,

		@SlashOption("token", { required: false, description: "Token ID (for ERC-1155)" })
		tokenId: string,

		interaction: CommandInteraction,
	) {
		await interaction.deferReply({ ephemeral: true })

		if (!validate(contractId)) {
			return await interaction.editReply(`You must provide a valid ID.`)
		}

		const contractRepo = getConnection().getRepository(Contract)
		const contract = await contractRepo.findOne({ where: { id: contractId } })
		if (!contract) {
			return await interaction.editReply(`Could find this trigger.`)
		}
		if (contract.type === Type.ERC1155 && !tokenId) {
			return await interaction.editReply(`You must fill the token field for an ERC-1155.`)
		}

		const triggerRepo = getConnection().getRepository(RoleTrigger)
		const trigger = await triggerRepo.save({
			contractId: contract.id,
			roleId: role.id,
			min,
			max,
			tokenId,
		})

		for (const watcherType of watchers[contract.type]) {
			try {
				await Starton.createWatcher(contract as Contract, trigger.id, watcherType)
			} catch (e: any) {
				await Logger.logDiscord(
					interaction?.guildId as string,
					":red_circle: An error occured during the creation of a watcher." +
						"```json\n" +
						JSON.stringify({
							contractId,
							tokenId,
							watcherType,
							status: e.response.data.statusCode,
							error: e.response.data.errorCode,
							message: e.response.data.message,
							date: e.response.headers.date,
						}) +
						"\n```",
				)
				console.log(e)
				triggerRepo.delete(trigger)
				return await interaction.editReply(
					`A problem occured during the creation of the watcher. Please try again later.`,
				)
			}
		}

		await Starton.assignRoleToAllMembers(contract, trigger)

		await Logger.logDiscord(
			contract.guildId as string,
			`:green_circle: Trigger created on contract ${contract.name} by <@${interaction.user.id}>.`,
		)

		await interaction.editReply(
			`Trigger created on ${contract.name} ! The role ${role.name} will be given to every users respecting the conditions !`,
		)
	}

	@Slash("list")
	private async listTriggers(
		@SlashOption("contract", {
			required: true,
			description: "ID of the contract you want to see the triggers",
		})
		contractId: string,

		interaction: CommandInteraction,
	) {
		await interaction.deferReply({ ephemeral: true })

		if (!validate(contractId)) {
			return await interaction.editReply(`You must provide a valid ID.`)
		}

		const triggerRepo = getConnection().getRepository(RoleTrigger)
		const triggers = await triggerRepo.find({ where: { contractId } })

		const replies: String[] = []
		triggers.forEach((trigger) => {
			replies.push(
				`This trigger (${trigger.id}) gives the role ${trigger.roleId} to the users that have > ${trigger.min}` +
					(trigger.max ? `and < ${trigger.max}` : "") +
					" tokens" +
					(trigger.tokenId ? ` with id ${trigger.tokenId}` : "") +
					".",
			)
		})

		await interaction.editReply(
			replies.length
				? replies.join("\n")
				: "You don't have any triggers yet on this contract.",
		)
	}

	@Slash("delete")
	private async deleteTrigger(
		@SlashOption("trigger", {
			required: true,
			description: "ID of the trigger you want to delete",
		})
		triggerId: string,

		interaction: CommandInteraction,
	) {
		await interaction.deferReply({ ephemeral: true })

		if (!validate(triggerId)) {
			return await interaction.editReply(`You must provide a valid ID.`)
		}

		const triggerRepo = getConnection().getRepository(RoleTrigger)
		const trigger = await triggerRepo.findOne({ where: { id: triggerId } })
		if (!trigger) {
			return await interaction.editReply(`Could find this trigger.`)
		}

		await triggerRepo.delete(trigger)

		const contractRepo = getConnection().getRepository(Contract)
		const contract = await contractRepo.findOne({ where: { id: trigger.contractId } })
		if (contract) {
			await Logger.logDiscord(
				contract.guildId as string,
				`:green_circle: Trigger on contract ${contract.name} deleted by <@${interaction.user.id}>.`,
			)
		}
		await interaction.editReply(`This trigger has been deleted.`)
	}
}
