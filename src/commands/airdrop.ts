import { ApplicationCommandPermissions, CommandInteraction, GuildChannel } from "discord.js"
import { Discord, Permission, Slash, SlashGroup, SlashOption } from "discordx"
import { getConnection } from "typeorm"
import { Airdrop } from "../entity/airdrop.entity"
import { Contract } from "../entity/contract.entity"
import { Guild as GuildEntity } from "../entity/guild.entity"
import { Participation } from "../entity/participation.entity"

@Discord()
@Permission(false)
@Permission(async (guild, cmd): Promise<ApplicationCommandPermissions[]> => {
	const guildRepo = getConnection().getRepository(GuildEntity)
	const guildEntity = await guildRepo.findOne({ where: { guildId: guild.id } })

	if (guildEntity && guildEntity.administratorRole) {
		return [{ id: guildEntity.administratorRole, permission: true, type: "ROLE" }]
	}
	return []
})
@SlashGroup("airdrop", "Manage your airdrops")
abstract class AirdropCommand {
	@Slash("create")
	private async createAirdrop(
		@SlashOption("name", { required: true, description: "Name of the airdrop" })
		name: string,

		@SlashOption("contract-id", {
			required: true,
			description: "Id of the contract you want to link to this airdrop",
		})
		contractId: string,

		@SlashOption("amount", {
			required: false,
			description: "Amount of tokens you want to aidrop. Default 1",
		})
		amount: number,

		@SlashOption("channel", {
			type: "CHANNEL",
			required: false,
			description: "Do the used need to be in a specific channel to participate ?",
		})
		channel: GuildChannel,

		@SlashOption("token-id", { required: false, description: "Token ID (ERC1155)" })
		tokenId: string,

		@SlashOption("password", {
			required: false,
			description: "Password needed to participate to the airdrop. Default none",
		})
		password: string,

		@SlashOption("interval", {
			required: false,
			description:
				"How many seconds before the user can participate again. Default -1 for only one participation",
		})
		interval: number,

		@SlashOption("chance", {
			required: false,
			description: "Percentage of chance that the user will receive the airdrop. Default 100",
		})
		chance: number,

		interaction: CommandInteraction,
	) {
		await interaction.deferReply({ ephemeral: true })

		try {
			const contractRepo = getConnection().getRepository(Contract)
			const contract = await contractRepo.findOne({ where: { id: contractId } })
			if (!contract) {
				return await interaction.editReply(`Couldn't find this contract`)
			}

			const airdropRepo = getConnection().getRepository(Airdrop)
			await airdropRepo.save({
				name,
				guildId: interaction.guild?.id,
				contractId: contract.id,
				amount,
				password,
				tokenId,
				channelId: channel?.id,
				interval,
				chance,
			})
			await interaction.editReply(`Airdrop created`)
		} catch (e) {
			console.log(e)
			await interaction.editReply(`Could not register this airdrop, please try again later`)
		}
	}

	@Slash("list")
	private async listAirdrops(interaction: CommandInteraction) {
		await interaction.deferReply({ ephemeral: true })

		const airdropRepo = getConnection().getRepository(Airdrop)
		const airdrops = await airdropRepo.find({ where: { guildId: interaction.guild?.id } })

		const replies: String[] = []
		airdrops.forEach((airdrop) => {
			replies.push(`${airdrop.name} : ${airdrop.id}`) //TODO add info
		})
		if (!replies.length) {
			return await interaction.editReply("You don't have any airdrops yet")
		}
		await interaction.editReply(replies.join("\n"))
	}

	@Slash("delete")
	private async deleteAirdrop(
		@SlashOption("id", { required: true, description: "ID of the airdrop you want to delete" })
		id: string,

		interaction: CommandInteraction,
	) {
		await interaction.deferReply({ ephemeral: true })

		try {
			const airdropRepo = getConnection().getRepository(Airdrop)
			const airdrop = await airdropRepo.findOneOrFail({ where: { id } })

			const participationRepo = getConnection().getRepository(Participation)
			const participations = await participationRepo.find({
				where: { airdropId: airdrop.id },
			})
			for (const participation of participations) {
				await participationRepo.delete(participation)
			}

			await airdropRepo.delete(airdrop)

			await interaction.editReply(`Airdrop ${airdrop.name} deleted.`)
		} catch (err) {
			await interaction.editReply(`Could not delete this airdrop, please try again later`)
		}
	}
}

// @Discord()
// abstract class ParticipateCommand {
// 	@Slash("airdrop")
// 	private async participate(
// 		@SlashOption("address", { required: true, description: "Your wallet address" })
// 		address: string,

// 		interaction: CommandInteraction,
// 	) {
// 		await interaction.deferReply({ ephemeral: true })

// 		if (!address.match(/0x[a-fA-F0-9]{40}/)) {
// 			return await interaction.editReply(
// 				"You must include a valid address :white_check_mark:",
// 			)
// 		}

// 		await interaction.editReply(`Airdroped`)
// 	}
// }
