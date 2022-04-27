import { Network, Type } from "./interface/global"
import { BigNumber } from "ethers"
import { getConnection } from "typeorm"
import { Contract } from "./entity/contract.entity"
import { Discord } from "./discord"
import { Member } from "./entity/member.entity"
import axios from "axios"
import abi from "./interface/abi"
import { Guild } from "./entity/guild.entity"
import { RoleTrigger } from "./entity/role-trigger.entity"
import { Airdrop } from "./entity/airdrop.entity"

export class Starton {
	static async getApiKey(guildId: string): Promise<string | undefined> {
		const guildRepo = getConnection().getRepository(Guild)
		const guild = await guildRepo.findOne({
			where: {
				guildId: guildId,
			},
		})
		return guild?.apiKey
	}

	static async regenerateSigningKey(apiKey: string) {
		const response = await axios
			.post(
				process.env.BACK_URL + "webhook/signing-secret/regenerate",
				{},
				{
					headers: {
						"x-api-key": apiKey,
					},
				},
			)
			.catch((err) => {
				console.log(err)
			})
		return response?.data?.secret
	}

	static async getSigningKey(apiKey: string) {
		const response = await axios
			.get(process.env.BACK_URL + "webhook/signing-secret", {
				headers: {
					"x-api-key": apiKey,
				},
			})
			.catch((err) => {
				console.log(err)
			})
		return response?.data?.secret
	}

	static async registerContract(
		guildId: string,
		type: Type,
		network: Network,
		address: string,
		name: string,
	): Promise<Contract> {
		await axios.post(
			process.env.BACK_URL + "/smart-contract/import-existing",
			{
				abi: abi[type],
				network: network,
				name: name,
				address: address,
			},
			{
				headers: {
					"x-api-key": await this.getApiKey(guildId),
				},
			},
		)

		const contractRepo = getConnection().getRepository(Contract)
		return contractRepo.save({
			guildId,
			address,
			type,
			network,
			name,
		})
	}

	static async mintToken(contract: Contract, address: string, airdrop: Airdrop) {
		let body

		if (contract.type === Type.ERC721) {
			body = { functionName: "safeMint", params: [address, airdrop.metadataUri] }
		} else if (contract.type === Type.ERC20) {
			body = { functionName: "mint", params: [address, airdrop.amount] }
		} else if (contract.type === Type.ERC1155) {
			body = { functionName: "mint", params: [address, airdrop.tokenId, airdrop.amount] }
		}

		await axios.post(
			process.env.BACK_URL + `/smart-contract/${contract.address}/call`,
			{ ...body, signerWallet: airdrop.signerWallet },
			{
				headers: {
					"x-api-key": await this.getApiKey(contract.guildId),
				},
			},
		)
	}

	static async createWatcher(contract: Contract, triggerId: string, watcherType: string) {
		const response = await axios
			.post(
				process.env.BACK_URL + "watcher",
				{
					address: contract.address,
					network: contract.network,
					type: watcherType,
					webhookUrl: process.env.WEBHOOK_URL + "hook?id=" + triggerId,
					confirmationsBlocks: 3,
				},
				{
					headers: {
						"x-api-key": await this.getApiKey(contract.guildId),
					},
				},
			)
			.catch((err) => {
				if (err.response.data.statusCode === 409) return { data: {} }
				console.log(err.response.data)
			})
		return response?.data
	}

	private static async getBalanceOf(
		contract: Contract,
		trigger: RoleTrigger,
		member: Member,
	): Promise<BigNumber> {
		let params

		if (contract.type === Type.ERC721 || contract.type === Type.ERC20) {
			params = [member.address]
		} else if (contract.type === Type.ERC1155) {
			params = [member.address, trigger?.tokenId]
		}

		const response = await axios
			.post(
				process.env.BACK_URL +
					`smart-contract/${contract.network}/${contract.address}/read`,
				{
					functionName: "balanceOf",
					params,
				},
				{
					headers: {
						"x-api-key": await this.getApiKey(contract.guildId),
					},
				},
			)
			.catch((err) => {
				console.log(err.response.data)
			})
		return BigNumber.from(response?.data.response.raw)
	}

	private static async assignRoleToMember(
		contract: Contract,
		trigger: RoleTrigger,
		member: Member,
	) {
		const amount = await this.getBalanceOf(contract, trigger, member)

		if (amount.gte(trigger.min) && (!trigger.max || amount.lte(trigger.max))) {
			try {
				const guild = await Discord.Client.guilds.fetch(contract.guildId)
				const discordMember = await guild.members.fetch(member.memberId)

				discordMember.roles.add(trigger.roleId)
			} catch (err) {
				console.log(err)
			}

			console.log(
				`Role ${trigger.roleId} given to user ${member.memberId} (${
					member.address
				}) with ${amount.toString()} ${contract.type} (${contract.address}) `,
			)
		}
	}

	static async assignRolesToMember(member: Member) {
		const contractRepo = getConnection().getRepository(Contract)
		const triggerRepo = getConnection().getRepository(RoleTrigger)
		const contracts = await contractRepo.find({
			where: {
				guildId: member.guildId,
			},
		})
		let triggers = []

		for (const contract of contracts) {
			triggers = await triggerRepo.find({
				where: {
					contractId: contract.id,
				},
			})
			for (const trigger of triggers) {
				await this.assignRoleToMember(contract, trigger, member)
			}
		}
	}

	static async assignRoleToAllMembers(contract: Contract, trigger: RoleTrigger) {
		const memberRepo = getConnection().getRepository(Member)
		const members = await memberRepo.find({
			where: {
				guildId: contract.guildId,
			},
		})

		for (const member of members) {
			await this.assignRoleToMember(contract, trigger, member)
		}
	}

	static async updateMemberRole(contract: Contract, trigger: RoleTrigger, member: Member) {
		const amount = await this.getBalanceOf(contract, trigger, member)

		try {
			const guild = await Discord.Client.guilds.fetch(contract.guildId)
			const discordMember = await guild.members.fetch(member.memberId)

			if (amount.gte(trigger.min) && (!trigger.max || amount.lte(trigger.max))) {
				discordMember.roles.add(trigger.roleId)

				console.log(
					`Role ${trigger.roleId} given to user ${member.memberId} (${
						member.address
					}) with ${amount.toString()} ${contract.type} (${contract.address}) `,
				)
			} else {
				discordMember.roles.remove(trigger.roleId)

				console.log(
					`Role ${trigger.roleId} removed from user ${member.memberId} (${member.address})`,
				)
			}
		} catch (err) {
			console.log(err)
		}
	}
}
