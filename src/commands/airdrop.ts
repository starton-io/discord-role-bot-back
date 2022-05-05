import { Modal, showModal, TextInputComponent } from "discord-modals"
import { ApplicationCommandPermissions, CommandInteraction, GuildChannel } from "discord.js"
import { Discord, Permission, Slash, SlashGroup, SlashOption } from "discordx"
import { Discord as DiscordClient } from "../discord"
import { getConnection } from "typeorm"
import validate from "uuid-validate"
import { Airdrop } from "../entity/airdrop.entity"
import { Contract } from "../entity/contract.entity"
import { Guild as GuildEntity } from "../entity/guild.entity"
import { Participation } from "../entity/participation.entity"
import { Type } from "../interface/global"
import { Logger } from "../logger"
import { Starton } from "../starton"

@Discord()
// @Permission(true)
// @Permission(async (guild, cmd): Promise<ApplicationCommandPermissions[]> => {
// 	const guildRepo = getConnection().getRepository(GuildEntity)
// 	const guildEntity = await guildRepo.findOne({ where: { guildId: guild.id } })
//
// 	if (guildEntity && guildEntity.administratorRole) {
// 		return [{ id: guildEntity.administratorRole, permission: true, type: "ROLE" }]
// 	}
// 	return []
// })
@SlashGroup({ name: "airdrop", description: "Manage your airdrops" })
@SlashGroup("airdrop")
abstract class AirdropCommand {
	@Slash("create")
	private async createAirdrop(
		@SlashOption("name", { required: true, description: "Name of the airdrop" })
		name: string,

		@SlashOption("contract", {
			required: true,
			description: "ID of the contract you want to link to this airdrop",
		})
		contractId: string,

		@SlashOption("signer", { required: true, description: "Address of the signer wallet" })
		signerWallet: string,

		@SlashOption("amount", {
			required: false,
			description: "Amount of tokens you want to aidrop. (Default 1)",
		})
		amount: number,

		@SlashOption("metadata", { required: false, description: "Token metadata (for ERC-721)" })
		metadataUri: string,

		@SlashOption("token", { required: false, description: "Token ID (for ERC-1155)" })
		tokenId: string,

		@SlashOption("data", { required: false, description: "Token data (for ERC-1155)" })
		data: string,

		@SlashOption("channel", {
			type: "CHANNEL",
			required: false,
			description: "Channel in which the user must be to claim the tokens",
		})
		channel: GuildChannel,

		@SlashOption("password", {
			required: false,
			description: "Password needed to participate to the airdrop. (Default none)",
		})
		password: string,

		@SlashOption("interval", {
			required: false,
			description:
				"How many seconds before the user can participate again. (Default -1 for a single participation)",
		})
		interval: number,

		@SlashOption("chance", {
			required: false,
			description: "Percentage of chance that the user will receive the token. (Default 100)",
		})
		chance: number,

		interaction: CommandInteraction,
	) {
		await interaction.deferReply({ ephemeral: true })

		if (!validate(contractId)) {
			return await interaction.editReply(`You must provide a valid ID.`)
		}
		if (!signerWallet.match(/0x[a-fA-F0-9]{40}/)) {
			return await interaction.editReply(
				"You must provide a valid signer wallet :white_check_mark:",
			)
		}

		const contractRepo = getConnection().getRepository(Contract)
		const contract = await contractRepo.findOne({ where: { id: contractId } })
		if (!contract) {
			return await interaction.editReply(`Couldn't find this contract.`)
		}

		if (contract.type == Type.ERC1155 && !tokenId) {
			return await interaction.editReply(`You must provide a token for an ERC-1155 contract.`)
		} else if (contract.type == Type.ERC721 && !metadataUri) {
			return await interaction.editReply(`You must provide metadata for an ERC-721 contract.`)
		}

		const airdropRepo = getConnection().getRepository(Airdrop)
		await airdropRepo.save({
			name,
			guildId: interaction.guild?.id,
			contractId: contract.id,
			signerWallet,
			amount,
			metadataUri,
			tokenId,
			data,
			password,
			channelId: channel?.id,
			interval,
			chance,
		})

		await Logger.logDiscord(
			contract.guildId as string,
			`:green_circle: Airdrop ${name} created by <@${interaction.user.id}>.`,
		)
		await interaction.editReply(`Airdrop created.`)
	}

	@Slash("list")
	private async listAirdrops(interaction: CommandInteraction) {
		await interaction.deferReply({ ephemeral: true })

		const airdropRepo = getConnection().getRepository(Airdrop)
		const airdrops = await airdropRepo.find({ where: { guildId: interaction.guild?.id } })

		const replies: String[] = []
		airdrops.forEach((airdrop) => {
			replies.push(
				`${airdrop.name} (${airdrop.id}) | password : ${
					airdrop.password ? airdrop.password : "none"
				}.`,
			)
		})

		await interaction.editReply(
			replies.length ? replies.join("\n") : "You don't have any airdrops yet.",
		)
	}

	@Slash("delete")
	private async deleteAirdrop(
		@SlashOption("airdrop", {
			required: true,
			description: "ID of the airdrop you want to delete",
		})
		airdropId: string,

		interaction: CommandInteraction,
	) {
		await interaction.deferReply({ ephemeral: true })

		const airdropRepo = getConnection().getRepository(Airdrop)
		const airdrop = await airdropRepo.findOne({ where: { id: airdropId } })
		if (!airdrop) {
			return await interaction.editReply(`Couldn't find this airdrop.`)
		}

		const participationRepo = getConnection().getRepository(Participation)
		const participations = await participationRepo.find({ where: { airdropId } })
		for (const participation of participations) {
			await participationRepo.delete(participation)
		}

		await airdropRepo.delete(airdrop)

		await Logger.logDiscord(
			airdrop.guildId as string,
			`:green_circle: Airdrop ${airdrop.name} deleted by <@${interaction.user.id}>.`,
		)
		await interaction.editReply(`Airdrop ${airdrop.name} deleted.`)
	}
}

@Discord()
abstract class ClaimCommand {
	@Slash("claim")
	private async openModal(interaction: CommandInteraction) {
		const modal = new Modal()
			.setCustomId("claim-airdrop-modal")
			.setTitle("Airdrop password")
			.addComponents(
				new TextInputComponent()
					.setCustomId("claim-airdrop-address")
					.setLabel("Address")
					.setStyle("SHORT")
					.setMinLength(0)
					.setMaxLength(100)
					.setPlaceholder("address")
					.setRequired(true),
				new TextInputComponent()
					.setCustomId("claim-airdrop-password")
					.setLabel("Password")
					.setStyle("SHORT")
					.setMinLength(0)
					.setMaxLength(100)
					.setPlaceholder("password")
					.setRequired(false),
			)

		await showModal(modal, {
			client: DiscordClient.Client,
			interaction: interaction,
		})
	}
}

export class ClaimAirdrop {
	private static async airdrop(
		airdrop: Airdrop,
		participation: Participation,
		timeFromLastParticipation: number,
		address: string,
		userId: string,
	): Promise<string> {
		let response
		try {
			if (airdrop.chance >= Math.floor(Math.random() * 101)) {
				const contractRepo = getConnection().getRepository(Contract)
				const contract = await contractRepo.findOneOrFail({
					where: { id: airdrop.contractId },
				})

				const startonResponse = await Starton.mintToken(contract, address, airdrop)

				response = `Congratulation <@${userId}> you won :rocket: :partying_face: :gift:. You can see your transaction on ${contract.network} with the transaction hash ${startonResponse.transactionHash} !`
			} else {
				response =
					`Sorry <@${userId}> you didn't win :cry:` +
					(airdrop.interval === -1 || !participation)
						? ``
						: ` Try again in ${this.formatTime(
								airdrop.interval - timeFromLastParticipation,
						  )} !`
			}
			const participationRepo = getConnection().getRepository(Participation)
			await participationRepo.save({
				airdropId: airdrop.id,
				memberId: userId,
				address,
			})

			await Logger.logDiscord(
				airdrop.guildId as string,
				`:green_circle: Airdrop ${airdrop.name} claimed by <@${userId}>.`,
			)
		} catch (e: any) {
			const contractRepo = getConnection().getRepository(Contract)
			const contract = await contractRepo.findOne({ where: { id: airdrop.contractId } })
			if (contract) {
				await Logger.logDiscord(
					contract.guildId as string,
					":red_circle: An error occured during the creation of an airdrop." +
						"```json\n" +
						JSON.stringify({
							address,
							contract: contract.id,
							airdrop: airdrop.id,
							status: e.response.data.statusCode,
							error: e.response.data.errorCode,
							message: e.response.data.message,
							date: e.response.headers.date,
						}) +
						"\n```",
				)
			}
			console.log(e)
			response = `Couldn't participate to the airdrop ${airdrop.name}. Please try again later.`
		}
		return response
	}

	private static formatTime(time: number): string {
		const hours = Math.floor(time / 3600)
		const minutes = Math.floor((time % 3600) / 60)
		const seconds = Math.floor(time % 60)

		return `${hours < 10 ? `0${hours}` : `${hours}`}:${
			minutes < 10 ? `0${minutes}` : `${minutes}`
		}:${seconds < 10 ? `0${seconds}` : `${seconds}`}`
	}

	private static isUserAllowed(airdrop: Airdrop, password: string, channelId: string) {
		return (
			(!airdrop.channelId || airdrop.channelId === channelId) &&
			((!airdrop.password && !password) || (password && airdrop.password === password))
		)
	}

	static async claim(
		guildId: string,
		channelId: string,
		userId: string,
		address: string,
		password: string,
	): Promise<string> {
		if (!address || !address.match(/0x[a-fA-F0-9]{40}/)) {
			return "You must provide a valid address."
		}

		const airdropRepo = getConnection().getRepository(Airdrop)
		const participationRepo = getConnection().getRepository(Participation)
		const airdrops = await airdropRepo.find({ where: { guildId: guildId } })
		const replies: string[] = []

		for (const airdrop of airdrops) {
			if (!this.isUserAllowed(airdrop, password, channelId as string)) continue

			const participations = await participationRepo.find({
				where: [
					{ airdropId: airdrop.id, address },
					{ airdropId: airdrop.id, memberId: userId },
				],
			})

			const timeFromLastParticipation = participations.at(-1)
				? (Date.now() - (participations.at(-1) as Participation).createdAt.valueOf()) / 1000
				: 0
			if (
				!participations.at(-1) ||
				(airdrop.interval !== -1 && timeFromLastParticipation >= airdrop.interval)
			) {
				replies.push(
					await this.airdrop(
						airdrop,
						participations.at(-1) as Participation,
						timeFromLastParticipation,
						address,
						userId,
					),
				)
			} else {
				replies.push(
					`You have already claimed this airdrop.` +
						(airdrop.interval === -1
							? ``
							: ` Try again in ${this.formatTime(
									airdrop.interval - timeFromLastParticipation,
							  )} !`),
				)
			}
		}

		return replies.length
			? replies.join("\n")
			: "There are no airdrops matching these conditions :cry:"
	}
}
