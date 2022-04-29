import { ApplicationCommandPermissions, CommandInteraction, Role } from "discord.js"
import { Discord, Permission, Slash, SlashChoice, SlashGroup, SlashOption } from "discordx"
import { getConnection } from "typeorm"
import { Network, Type } from "../interface/global"
import { Starton } from "../starton"
import { Contract } from "../entity/contract.entity"
import { Guild } from "../entity/guild.entity"
import validate from "uuid-validate"

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
@SlashGroup({ name: "contract", description: "Manage your contracts" })
@SlashGroup("contract")
abstract class ContractCommand {
	@Slash("import")
	private async createContract(
		@SlashChoice({ name: "Ethereum Mainnet", value: Network.ETHEREUM_MAINNET })
		@SlashChoice({ name: "Ethereum Ropsten", value: Network.ETHEREUM_ROPSTEN })
		@SlashChoice({ name: "Ethereum Goerli", value: Network.ETHEREUM_GOERLI })
		@SlashChoice({ name: "Avalanche Mainnet", value: Network.AVALANCHE_MAINNET })
		@SlashChoice({ name: "Avalanche Fuji", value: Network.AVALANCHE_FUJI })
		@SlashChoice({ name: "Polygon Mainnet", value: Network.POLYGON_MAINNET })
		@SlashChoice({ name: "Polygon Mumbai", value: Network.POLYGON_MUMBAI })
		@SlashChoice({ name: "Binance Mainnet", value: Network.BINANCE_MAINNET })
		@SlashChoice({ name: "Binance Testnet", value: Network.BINANCE_TESTNET })
		@SlashOption("network", { description: "Network of the contract", required: true })
		network: Network,

		@SlashChoice({ name: Type.ERC20, value: Type.ERC20 })
		@SlashChoice({ name: Type.ERC721, value: Type.ERC721 })
		@SlashChoice({ name: Type.ERC1155, value: Type.ERC1155 })
		@SlashOption("type", { description: "Type of the contract", required: true })
		type: Type,

		@SlashOption("name", { required: true, description: "Name of the contract" })
		name: string,

		@SlashOption("address", { required: true, description: "Address of the contract" })
		address: string,

		interaction: CommandInteraction,
	) {
		await interaction.deferReply({ ephemeral: true })

		if (!address.match(/0x[a-fA-F0-9]{40}/)) {
			return await interaction.editReply(
				"You must provide a valid address :white_check_mark:",
			)
		}

		try {
			await Starton.registerContract(
				interaction?.guildId as string,
				type,
				network,
				address,
				name,
			)
		} catch (e) {
			return await interaction.editReply(
				`A problem occured during the importation of the contract. Please check the params.`,
			)
		}

		const contractRepo = getConnection().getRepository(Contract)
		const contract = await contractRepo.save({
			guildId: interaction?.guildId as string,
			address,
			type,
			network,
			name,
		})

		await interaction.editReply(
			`${name} : An ${type} contract hosted on ${network} with address ${address} and id ${contract.id} registered!`,
		)
	}

	@Slash("list")
	private async listContracts(interaction: CommandInteraction) {
		await interaction.deferReply({ ephemeral: true })

		const contractRepo = getConnection().getRepository(Contract)
		const contracts = await contractRepo.find({
			where: { guildId: interaction?.guildId as string },
		})

		const replies: String[] = []
		contracts.forEach((contract) => {
			replies.push(
				`${contract.name} (${contract.id}) : An ${contract.type} contract hosted on ${contract.network} with address ${contract.address}.`,
			)
		})
		await interaction.editReply(
			replies.length ? replies.join("\n") : "You don't have any contracts yet.",
		)
	}

	@Slash("delete")
	private async deleteContract(
		@SlashOption("contract", {
			required: true,
			description: "ID of the contract you want to delete",
		})
		contractId: string,

		interaction: CommandInteraction,
	) {
		await interaction.deferReply({ ephemeral: true })

		if (!validate(contractId)) {
			return await interaction.editReply(`You must provide a valid ID.`)
		}

		const contractRepo = getConnection().getRepository(Contract)
		const contract = await contractRepo.findOne({ where: { id: contractId } })
		if (!contract) {
			return await interaction.editReply(`Couldn't find this contract.`)
		}

		await contractRepo.delete(contract)

		await interaction.editReply(`Contract ${contract.name} deleted.`)
	}
}
