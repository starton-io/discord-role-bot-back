import {Network, Type} from "./interface/global"
import {getConnection} from "typeorm"
import {Contract} from "./entity/contract.entity"
import abi from "./config/abi"
import {Discord} from "./discord"
import {Member} from "./entity/member.entity"
import axios from "axios";
import {Guild} from "./entity/guild.entity";

export class Starton {

    static async getApiKey(guildId: string) {
        const guildRepo = getConnection().getRepository(Guild)
        const guildEntity = await guildRepo.findOneOrFail({
            where: {
                guildId: guildId
            }
        })
        return guildEntity.apiKey
    }

    static async verifyApiKey(apiKey: string) {
        return axios.get("https://api-staging.starton.io/v2/smart-contract/", {
            headers: {
                "x-api-key": apiKey
            }
        })
    }

    static async registerContract(guildId: string, type: Type, network: Network, address: string) {
        return axios.post("https://api-staging.starton.io/v2/smart-contract/import-existing", {
            abi: abi[type],
            network: network,
            name: `${type}-${address}`,
            address: address
        }, {
            headers: {
                "x-api-key": await this.getApiKey(guildId)
            }
        })
    }

    static async assignRolesToMember(member: Member) {

        const contractRepo = getConnection().getRepository(Contract)
        const contracts = await contractRepo.find({
            where: {
                guildId: member.guildId
            }
        })
        for (const contractEntity of contracts) {
            let params
            if (contractEntity.type === Type.ERC721 || contractEntity.type === Type.ERC20) {
                params = [member.address]
            } else if (contractEntity.type === Type.ERC1155) {
                params = [member.address, contractEntity.tokenId]
            }

            try {
                const response = await axios.post(`https://api-staging.starton.io/v2/smart-contract/${contractEntity.network}/${contractEntity.address}/read`, {
                    functionName: "balanceOf",
                    params: params,
                }, {
                    headers: {
                        "x-api-key": await this.getApiKey(member.guildId)
                    }
                })
                const amount = parseInt(response.data.response.raw)
                if (amount >= contractEntity.min) {
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
            let params
            if (contractEntity.type === Type.ERC721 || contractEntity.type === Type.ERC20) {
                params = [member.address]
            } else if (contractEntity.type === Type.ERC1155) {
                params = [member.address, contractEntity.tokenId]
            }

            try {
                const response = await axios.post(`https://api-staging.starton.io/v2/smart-contract/${contractEntity.network}/${contractEntity.address}/read`, {
                    functionName: "balanceOf",
                    params: params,
                }, {
                    headers: {
                        "x-api-key": await this.getApiKey(member.guildId)
                    }
                })


                const amount = parseInt(response.data.response.raw)
                console.log("amount", amount)
                console.log("response.data", response.data)

                if (amount >= contractEntity.min) {
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
