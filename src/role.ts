import {Network, Type} from "./interface/global"
import {BigNumber, ethers} from "ethers"
import {getConnection} from "typeorm"
import {Contract} from "./entity/contract.entity"
import networks from "./config/provider"
import abi from "./config/abi"
import {Discord} from "./discord"
import {Member} from "./entity/member.entity"

/**
 * Todo on v2 of starton connect api can be avoid all the providers with a call on starton
 */
export class StartonRole {

    static providers: Record<string, any> = {}

    static async start(): Promise<boolean> {

        for (const [network, providers] of Object.entries(networks)) {
            await this.initProvider(network as Network)
        }
        return true
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
                if (contractEntity.type === Type.ERC721) {
                    response = await contract.balanceOf(member.address)
                    const amount = BigNumber.from(response.toString())
                    console.log(amount)
                    if (amount.gt(contractEntity.min)) {
                        const guild = await Discord.Client.guilds.fetch(contractEntity.guildId)
                        const discordUser = await guild?.members.fetch(member.memberId)
                        discordUser?.roles.add(contractEntity.role)
                    }
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
                if (contractEntity.type === Type.ERC721) {
                    response = await contract.balanceOf(member.address)
                    const amount = BigNumber.from(response.toString())
                    console.log(amount)
                    if (amount.gt(contractEntity.min)) {
                        const guild = await Discord.Client.guilds.fetch(contractEntity.guildId)
                        const discordUser = await guild?.members.fetch(member.memberId)
                        discordUser?.roles.add(contractEntity.role)
                    }
                }
            } catch (e) {
                console.log(e)
            }
        }
    }

    static async initProvider(network: Network): Promise<boolean> {
        const providers = networks[network] as any
        const etherProviders = []
        for (const provider of providers) {
            try {
                const rpcProvider = new ethers.providers.StaticJsonRpcProvider(provider.rpc, provider.chainId)
                etherProviders.push({
                    provider: rpcProvider,
                    weight: provider.weight || 1,
                    priority: provider.priority || 1,
                    stallTimeout: provider.stallTimeout || null,
                })
            } catch (e: any) {
                console.error("Could not initialize provider : ", { provider, error: e.toString() })
            }
        }

        try {
            const provider = new ethers.providers.FallbackProvider(etherProviders, (providers as any).length  > 4 ? 2 : undefined)
            this.providers[network] = provider
            console.info("Provider for network initiated with success", { id: network })
        } catch (e) {
            console.error("Could not initialize the FallbackProvider : ", { etherProviders, error: e })
            await new Promise(r => setTimeout(r, 2000))
            return this.initProvider(network)
        }
        return true
    }


}
