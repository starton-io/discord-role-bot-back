import {Network, Type} from "./interface/global"
import {BigNumber, ethers} from "ethers"
import {getConnection} from "typeorm"
import {Contract} from "./entity/contract.entity"
import networks from "./config/provider"
import abi from "./config/abi"
import {Discord} from "./discord"
import {Member} from "./entity/member.entity"

export class Starton {

    static async registerContract() {

    }

    static async assignRolesToMember(member: Member) {

        const contractRepo = getConnection().getRepository(Contract)
        const contracts = await contractRepo.find({
            where: {
                guildId: member.guildId
            }
        })
        for (const contractEntity of contracts) {
            let contract: ethers.Contract
            try {
                const provider = this.providers[contractEntity.network] as ethers.providers.FallbackProvider
                contract = new ethers.Contract(contractEntity.address, abi[contractEntity.type], provider)
            } catch (e) {
                console.error("Could not initialize the contract")
                return
            }

            /**
             * Read the contract data
             */
            let response
            try {
                if (contractEntity.type === Type.ERC721 || contractEntity.type === Type.ERC20) {
                    response = await contract.balanceOf(member.address)
                } else if (contractEntity.type === Type.ERC1155) {
                    response = await contract.balanceOf(member.address, contractEntity.tokenId)
                }
                const amount = BigNumber.from(response.toString())
                if (amount.gte(contractEntity.min)) {
                    const guild = await Discord.Client.guilds.fetch(contractEntity.guildId)
                    const discordUser = await guild?.members.fetch(member.memberId)
                    discordUser?.roles.add(contractEntity.role)
                    console.log(`Role ${contractEntity.role} given to user ${member.memberId} (${member.address}) with ${amount.toString()} ${contractEntity.type} (${contractEntity.address}) `)
                }
            } catch (e) {
                console.log(e)
            }
        }


    }

    static async assignRoleToAllMembers(contractEntity: Contract) {

        let contract: ethers.Contract
        try {
            const provider = this.providers[contractEntity.network] as ethers.providers.FallbackProvider
            contract = new ethers.Contract(contractEntity.address, abi[contractEntity.type], provider)
        } catch (e) {
            console.error("Could not initialize the contract")
            return
        }

        const memberRepo = getConnection().getRepository(Member)
        const members = await memberRepo.find({
            where: {
                guildId: contractEntity.guildId
            }
        })
        for (const member of members) {
            /**
             * Read the contract data
             */
            let response
            try {
                if (contractEntity.type === Type.ERC721 || contractEntity.type === Type.ERC20) {
                    response = await contract.balanceOf(member.address)
                } else if (contractEntity.type === Type.ERC1155) {
                    response = await contract.balanceOf(member.address, contractEntity.tokenId)
                }
                const amount = BigNumber.from(response.toString())
                if (amount.gte(contractEntity.min)) {
                    const guild = await Discord.Client.guilds.fetch(contractEntity.guildId)
                    const discordUser = await guild?.members.fetch(member.memberId)
                    discordUser?.roles.add(contractEntity.role)
                    console.log(`Role ${contractEntity.role} given to user ${member.memberId} (${member.address}) with ${amount.toString()} ${contractEntity.type} (${contractEntity.address}) `)
                }
            } catch (e) {
                console.log(e)
            }
        }
    }
}
