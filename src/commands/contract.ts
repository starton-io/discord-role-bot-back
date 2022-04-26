import { ApplicationCommandPermissions, CommandInteraction, Role } from "discord.js"
import { Discord, Permission, Slash, SlashChoice, SlashGroup, SlashOption } from "discordx"
import { getConnection } from "typeorm"
import { Network, Type } from "../interface/global"
import { Starton } from "../starton"
import { Contract } from "../entity/contract.entity"
import { Guild } from "../entity/guild.entity"

@Discord()
@Permission(false)
@Permission(async (guild, cmd): Promise<ApplicationCommandPermissions[]> => {
	const guildRepo = getConnection().getRepository(Guild)
	const guildEntity = await guildRepo.findOne({ where: { guildId: guild.id } })

	if (guildEntity && guildEntity.administratorRole) {
		return [{ id: guildEntity.administratorRole, permission: true, type: "ROLE" }]
	}
	return []
})
@SlashGroup("contract", "Manage your triggers")
abstract class ContractCommand {
	@Slash("create")
	private async createContract(
		@SlashChoice("Ethereum Mainnet", Network.ETHEREUM_MAINNET)
		@SlashChoice("Ethereum Ropsten", Network.ETHEREUM_ROPSTEN)
		@SlashChoice("Ethereum Goerli", Network.ETHEREUM_GOERLI)
		@SlashChoice("Avalanche Mainnet", Network.AVALANCHE_MAINNET)
		@SlashChoice("Avalanche Fuji", Network.AVALANCHE_FUJI)
		@SlashChoice("Polygon Mainnet", Network.POLYGON_MAINNET)
		@SlashChoice("Polygon Mumbai", Network.POLYGON_MUMBAI)
		@SlashChoice("Binance Mainnet", Network.BINANCE_MAINNET)
		@SlashChoice("Binance Testnet", Network.BINANCE_TESTNET)
		@SlashOption("network", { description: "Choose the network", required: true })
		network: Network,

		@SlashChoice(Type.ERC20, Type.ERC20)
		@SlashChoice(Type.ERC721, Type.ERC721)
		@SlashChoice(Type.ERC1155, Type.ERC1155)
		@SlashOption("type", { description: "Choose the type", required: true })
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
				"You must include a valid address :white_check_mark:",
			)
		}

		try {
			const contract = await Starton.registerContract(
				interaction?.guildId as string,
				type,
				network,
				address,
				name,
			)
			await interaction.editReply(
				`${name} : An ${type} contract hosted on ${network} with address ${address} and id ${contract.id} registered!`,
			)
		} catch (e) {
			await interaction.editReply(`Could not register this contract, please try again later`)
		}
	}

	@Slash("list")
	private async listContracts(interaction: CommandInteraction) {
		await interaction.deferReply({ ephemeral: true })

		const contractRepo = getConnection().getRepository(Contract)
		const contracts = await contractRepo
			.find({ where: { guildId: interaction?.guildId as string } })
			.catch((e) => {
				console.error(e)
			})
		if (!contracts) {
			return await interaction.editReply(
				`Could not register this contract, please try again later`,
			)
		}

		const replies: String[] = []
		contracts.forEach((contract) => {
			replies.push(
				`${contract.name} (${contract.id}) : An ${contract.type} contract hosted on ${contract.network} with address ${contract.address}.`,
			)
		})
		if (!contracts.length) {
			return await interaction.editReply("You don't have any contracts yet")
		}
		await interaction.editReply(replies.join("\n"))
	}

	@Slash("delete")
	private async deleteContract(
		@SlashOption("id", { required: true, description: "ID of the contract you want to delete" })
		id: string,

		interaction: CommandInteraction,
	) {
		await interaction.deferReply({ ephemeral: true })

		try {
			const contractRepo = getConnection().getRepository(Contract)
			const contract = await contractRepo.findOneOrFail({ where: { id } })
			await contractRepo.delete(contract)

			await interaction.editReply(`Contract ${contract.name} deleted.`)
		} catch (e) {
			await interaction.editReply(`Could not delete this contract, please try again later`)
		}
	}
}
