import { ApplicationCommandPermissions, CommandInteraction, Role } from "discord.js"
import { Discord, Permission, Slash, SlashChoice, SlashGroup, SlashOption } from "discordx"
import { getConnection } from "typeorm"
import { Contract } from "../entity/contract.entity"
import { Type } from "../interface/global"
import { Starton } from "../starton"
import { Guild } from "../entity/guild.entity"
import { RoleTrigger } from "../entity/role-trigger.entity"
import watchers from "../interface/watcher"

@Discord()
@SlashGroup("trigger", "Manage your triggers")
@Permission(false)
@Permission(async (guild, cmd): Promise<ApplicationCommandPermissions[]> => {
	const guildRepo = getConnection().getRepository(Guild)
	const guildEntity = await guildRepo.findOne({ where: { guildId: guild.id } })

	if (guildEntity && guildEntity.administratorRole) {
		return [{ id: guildEntity.administratorRole, permission: true, type: "ROLE" }]
	}
	return []
})
abstract class TriggerCommand {
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

		@SlashOption("min", { description: "Minimum amount of token required. (Default 1)" })
		min: number,

		@SlashOption("max", { description: "Maximum amount of token required. (Default none)" })
		max: number,

		@SlashOption("token", { description: "Token ID (for ERC-1155)" })
		tokenId: string,

		interaction: CommandInteraction,
	) {
		await interaction.deferReply({ ephemeral: true })

		try {
			const contractRepo = getConnection().getRepository(Contract)
			const contract = await contractRepo.findOneOrFail({ where: { id: contractId } })

			if (contract.type === Type.ERC1155 && !tokenId) {
				return await interaction.editReply(`You must fill the token field for an ERC-1155`)
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
				const watcher = await Starton.createWatcher(
					contract as Contract,
					trigger.id,
					watcherType,
				)
				if (!watcher) {
					contractRepo.delete(contract)
					throw "Couldn't create watcher"
				}
			}

			await Starton.assignRoleToAllMembers(contract, trigger)

			await interaction.editReply(
				`Trigger created on ${contract.name} ! The role ${role.name} will be given to every users respecting the conditions`,
			)
		} catch (e) {
			console.log(e)
			await interaction.editReply(`Could not create this trigger, please try again later`)
		}
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

		const triggerRepo = getConnection().getRepository(RoleTrigger)
		const triggers = await triggerRepo.find({ where: { contractId } }).catch((e) => {
			console.log(e)
			return []
		})

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
		if (!replies.length) {
			return await interaction.editReply("You don't have any triggers yet")
		}
		return await interaction.editReply(replies.join("\n"))
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

		try {
			const triggerRepo = getConnection().getRepository(RoleTrigger)

			const trigger = await triggerRepo.findOne({ where: { id: triggerId } })
			if (!trigger) {
				return await interaction.editReply(`Could not find this trigger`)
			}

			await triggerRepo.delete(trigger)

			await interaction.editReply(`This trigger has been deleted.`)
		} catch (e) {
			await interaction.editReply(`Could not delete this trigger, please try again later`)
		}
	}
}
