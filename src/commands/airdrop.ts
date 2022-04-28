import { ApplicationCommandPermissions, CommandInteraction, GuildChannel } from "discord.js"
import { Discord, Permission, Slash, SlashGroup, SlashOption } from "discordx"
import { getConnection } from "typeorm"
import { Airdrop } from "../entity/airdrop.entity"
import { Contract } from "../entity/contract.entity"
import { Guild as GuildEntity } from "../entity/guild.entity"
import { Participation } from "../entity/participation.entity"
import { Type } from "../interface/global"
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
@SlashGroup({ name: "airdrops", description: "Manage your airdrops" })
@SlashGroup("airdrops")
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

		try {
			const contractRepo = getConnection().getRepository(Contract)
			const contract = await contractRepo.findOne({ where: { id: contractId } })
			if (!contract) {
				return await interaction.editReply(`Couldn't find this contract`)
			}

			if (contract.type == Type.ERC1155 && !tokenId) {
				return await interaction.editReply(
					`You must provide a token for an ERC-1155 contract`,
				)
			} else if (contract.type == Type.ERC721 && !metadataUri) {
				return await interaction.editReply(
					`You must provide metadata for an ERC-721 contract`,
				)
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
			replies.push(
				`${airdrop.name} (${airdrop.id}) | password : ${
					airdrop.password ? airdrop.password : "none"
				}.`,
			)
		})
		if (!replies.length) {
			return await interaction.editReply("You don't have any airdrops yet")
		}
		await interaction.editReply(replies.join("\n"))
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

		try {
			const airdropRepo = getConnection().getRepository(Airdrop)
			const airdrop = await airdropRepo.findOneOrFail({ where: { id: airdropId } })

			const participationRepo = getConnection().getRepository(Participation)
			const participations = await participationRepo.find({ where: { airdropId } })
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

@Discord()
abstract class ClaimCommand {
	private async airdrop(airdrop: Airdrop, address: string, userId: string): Promise<string> {
		const contractRepo = getConnection().getRepository(Contract)
		const contract = await contractRepo.findOneOrFail({ where: { id: airdrop.contractId } })

		const response = await Starton.mintToken(contract, address, airdrop)
		return `Congratulation <@${userId}> you won :rocket: :partying_face: :gift:. You wan see your transaction on ${contract.network} with the transaction hash ${response.transactionHash}`
	}

	private formatTime(time: number): string {
		const hours = Math.floor(time / 3600)
		const minutes = Math.floor((time % 3600) / 60)
		const seconds = Math.floor(time % 60)

		return `${hours < 10 ? `0${hours}` : `${hours}`}:${
			minutes < 10 ? `0${minutes}` : `${minutes}`
		}:${seconds < 10 ? `0${seconds}` : `${seconds}`}`
	}

	private isUserAllowed(airdrop: Airdrop, password: string, channelId: string) {
		return (
			(!airdrop.channelId || airdrop.channelId === channelId) &&
			(!airdrop.password || airdrop.password === password)
		)
	}

	@Slash("claim")
	private async claim(
		@SlashOption("address", { required: true, description: "Your wallet address" })
		address: string,

		@SlashOption("password", { required: false })
		password: string,

		interaction: CommandInteraction,
	) {
		await interaction.deferReply({ ephemeral: true })

		if (!address.match(/0x[a-fA-F0-9]{40}/)) {
			return await interaction.editReply(
				"You must provide a valid address :white_check_mark:",
			)
		}

		try {
			const airdropRepo = getConnection().getRepository(Airdrop)
			const participationRepo = getConnection().getRepository(Participation)
			const airdrops = await airdropRepo.find({ where: { guildId: interaction.guild?.id } })
			const replies: string[] = []

			for (const airdrop of airdrops) {
				if (!this.isUserAllowed(airdrop, password, interaction.channel?.id as string))
					continue

				const participations = await participationRepo.find({
					where: [
						{ airdropId: airdrop.id, address },
						{ airdropId: airdrop.id, memberId: interaction.user.id },
					],
				})

				const timeFromLastParticipation = participations.at(-1)
					? (Date.now() - (participations.at(-1) as Participation).createdAt.valueOf()) /
					  1000
					: 0
				if (
					!participations.at(-1) ||
					(airdrop.interval !== -1 && timeFromLastParticipation >= airdrop.interval)
				) {
					try {
						if (airdrop.chance >= Math.floor(Math.random() * 101)) {
							replies.push(await this.airdrop(airdrop, address, interaction.user.id))
						} else {
							replies.push(
								`Sorry <@${interaction.user.id}> you didn't win :cry:` +
									(airdrop.interval === -1 || !participations.at(-1)
										? ``
										: ` Try again in ${this.formatTime(
												airdrop.interval - timeFromLastParticipation,
										  )} !`),
							)
						}
						await participationRepo.save({
							airdropId: airdrop.id,
							memberId: interaction.user.id,
							address,
						})
					} catch (e) {
						console.log(e)
						replies.push(`Couldn't participate to the airdrop ${airdrop.name}. Please try again later.`)
					}
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
			await interaction.editReply(
				replies.length
					? replies.join("\n")
					: "There are no airdrops matching these conditions :cry:",
			)
		} catch (e) {
			console.log(e)
			await interaction.editReply(
				"Couldn't participate to the airdrops. Please try again later.",
			)
		}
	}
}
