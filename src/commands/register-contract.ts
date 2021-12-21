import {ApplicationCommandPermissions, CommandInteraction, Role} from "discord.js"
import {Discord, Permission, Slash, SlashChoice, SlashGroup, SlashOption} from "discordx"
import {getConnection} from "typeorm"
import {Contract} from "../entity/contract.entity"
import {Network, Type} from "../interface/global"
import {StartonRole} from "../role"
import {Guild} from "../entity/guild.entity"

@Discord()
@SlashGroup("smartcontract", "Manage your smart contract")
abstract class RegisterContract {

    /**
     * TODO DEBUG PERMISSION
     */
    @Permission(false) // We will enable command for specific users/roles only, so disable it for everyone
    @Permission(async (guild, cmd): Promise<ApplicationCommandPermissions[]> => {
        const guildRepo = getConnection().getRepository(Guild)
        const guildEntity = await guildRepo.findOne({
            where: {
                guildId: guild.id
            }
        })
        if (guildEntity && guildEntity.administratorRole) {
            return [{ id: guildEntity.administratorRole, permission: true, type: "ROLE" }]
        } else {
            return [{ id: "test", permission: false, type: "ROLE" }]
        }
    })
    @Slash("add")
	private async addContract(

        @SlashChoice("Ethereum Mainnet", "ETHEREUM_MAINNET")
        @SlashChoice("Ethereum Ropsten", "ETHEREUM_ROPSTEN")
        @SlashChoice("Ethereum Goerli", "ETHEREUM_GOERLI")
        @SlashChoice("Avalanche Mainnet", "AVALANCHE_MAINNET")
        @SlashChoice("Avalanche Fuji", "AVALANCHE_FUJI")
        @SlashChoice("Polygon Mainnet", "POLYGON_MAINNET")
        @SlashChoice("Polygon Mumbai", "POLYGON_MUMBAI")
        @SlashChoice("Binance Mainnet", "BINANCE_MAINNET")
        @SlashChoice("Binance Testnet", "BINANCE_TESTNET")
        @SlashOption("network", { description: "Choose the network?", required: true })
            network: Network,

        @SlashChoice("ERC721", "ERC721")
        @SlashChoice("ERC1155 - Soon", "ERC1155")
        @SlashChoice("ERC20 - Soon", "ERC20")
        @SlashOption("type", { description: "Contract type?", required: true })
            type: Type,

		@SlashOption("address", { required: true})
		    address: string,

        @SlashOption("role", { type: "ROLE", required: true, description: "Role you want to give?" })
            role: Role,

        @SlashOption("min", { description: "Minimum amount of token required?"})
            min: number,

        @SlashOption("max", { description: "Maximum amount of token required?" })
            max: number,

        interaction: CommandInteraction
	) {

		await interaction.deferReply({
            ephemeral: true
        })
        const guildRepo = getConnection().getRepository(Guild)
        const guildEntity = await guildRepo.findOne({
            where: {
                guildId: interaction.guildId
            }
        })
        /**
         * TODO DEBUG PERMISSION AND REMOVE THIS PART
         */
        if (guildEntity && guildEntity.administratorRole) {
            // @ts-ignore
            if (!interaction.member._roles.includes(guildEntity.administratorRole)) {
                return interaction.editReply(`You are not allowed to use this command.`)
            }
        } else {
            return interaction.editReply(`You need to call the init function before`)
        }

        if (type !== Type.ERC721) {
            return interaction.editReply(`Right now only ERC721 are supported, please try again later`)
        }
        const validAddresses = address ? address.match(/0x[a-fA-F0-9]{40}/) : null
        if (!validAddresses) {
            return interaction.reply({
                content: "You must include a valid address :white_check_mark:",
                ephemeral: true
            })
        }

        /**
         * Try to save the contract
         */
        const contractRepo = getConnection().getRepository(Contract)
        const contract = await contractRepo.save({
            guildId: interaction?.guildId as string,
            address: address,
            role: role.id,
            type,
            min,
            max,
            network
        }).catch(err => {
            console.error(err)
            return interaction.editReply(`Could not register this contract, please try again later`)
        })

        /**
         * TODO Add a watcher on starton connect
         */
        await StartonRole.assignRoleToAllMembers(contract as Contract)
        await interaction.editReply(`Contract registered! Now user with a ${type} token on ${network} will get the role ${role}`)
    }

}
