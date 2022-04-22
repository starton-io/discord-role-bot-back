import { ApplicationCommandPermissions, CommandInteraction, Role } from "discord.js"
import { Discord, Permission, Slash, SlashChoice, SlashGroup, SlashOption } from "discordx"
import { getConnection } from "typeorm"
import { Contract } from "../entity/contract.entity"
import { Type } from "../interface/global"
import { Starton } from "../starton"
import { Guild } from "../entity/guild.entity"
import { Trigger } from "../entity/trigger.entity"
import watchers from "../interface/watchers"

@Discord()
@SlashGroup("trigger", "Manage your triggers")
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
abstract class TriggerCommand {
	@Slash("create")
	private async createTrigger(
		@SlashOption("contract-id", {
			required: true,
			description: "The id of the contract you want to link the trigger to",
		})
		contractId: string,

		@SlashOption("role", {
			type: "ROLE",
			required: true,
			description: "Role you want to give",
		})
		role: Role,

		@SlashOption("min", { description: "Minimum amount of token required" })
		min: number,

		@SlashOption("max", { description: "Maximum amount of token required" })
		max: number,

		@SlashOption("token-id", { description: "The ERC1155 token id" })
		tokenId: string,

		interaction: CommandInteraction,
	) {
		await interaction.deferReply({
			ephemeral: true,
		})

		try {
			const contractRepo = getConnection().getRepository(Contract)
			const contract = await contractRepo.findOneOrFail({
				where: {
					id: contractId,
				},
			})

			if (
				(contract.type === Type.ERC1155 && !tokenId) ||
				(contract.type !== Type.ERC1155 && tokenId)
			) {
				return interaction.editReply(`You must fill the tokenId field for an ERC1155`)
			}

			const triggerRepo = getConnection().getRepository(Trigger)
			const trigger = await triggerRepo.save({
				contractId: contract.id,
				role: role.id,
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
		} catch (err) {
			console.log(err)
			return interaction.editReply(`Could not create this trigger, please try again later`)
		}
	}

	@Slash("list")
	private async listTriggers(
		@SlashOption("contract-id", {
			required: true,
			description: "The id of the contract you want to see the triggers",
		})
		contractId: string,

		interaction: CommandInteraction,
	) {
		await interaction.deferReply({
			ephemeral: true,
		})

		const triggerRepo = getConnection().getRepository(Trigger)
		const triggers = await triggerRepo.find({
			where: {
				contractId,
			},
		})

		const replies: String[] = []
		triggers.forEach((trigger) => {
			replies.push(
				`This trigger (${trigger.id}) gives the role ${trigger.role} to the users that have > ${trigger.min}` +
					(trigger.max ? `and < ${trigger.max}` : "") +
					" tokens" +
					(trigger.tokenId ? ` with id ${trigger.tokenId}` : "") +
					".",
			)
		})

		if (replies.length) {
			await interaction.editReply(replies.join("\n"))
		} else {
			await interaction.editReply("You don't have no triggers on this contract")
		}
	}

	@Slash("delete")
	private async deleteTrigger(
		@SlashOption("id", { required: true, description: "ID of the trigger you want to delete" })
		id: string,

		interaction: CommandInteraction,
	) {
		await interaction.deferReply({
			ephemeral: true,
		})

		try {
			const triggerRepo = getConnection().getRepository(Trigger)

			const trigger = await triggerRepo.findOneOrFail({
				where: {
					id,
				},
			})
			await triggerRepo.delete(trigger)

			await interaction.editReply(`Trigger deleted.`)
		} catch (err) {
			return interaction.editReply(`Could not delete this trigger, please try again later`)
		}
	}
}
