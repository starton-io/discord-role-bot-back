import { CommandInteraction, TextChannel } from "discord.js"
import { getConnection } from "typeorm"
import { Discord } from "./discord"
import { Guild } from "./entity/guild.entity"

export class Logger {
	static logInteraction(interaction: CommandInteraction) {
		console.log({
			type: interaction.type,
			commandName: interaction.commandName,
			applicationId: interaction.applicationId,
			channelId: interaction.channelId,
			guildId: interaction.guildId,
			memberPermissions: interaction.memberPermissions,
			user: interaction.user,
		})
	}

	static async logDiscord(guildId: string, message: string) {
		const guildRepo = getConnection().getRepository(Guild)
		const guild = await guildRepo.findOne({ where: { guildId } })

		if (!guild || !guild.logChannel) return
		try {
			await (Discord.Client.channels.cache.get(guild.logChannel) as TextChannel).send(message)
		} catch (e) {
			console.log(`Couldn't log on channel ${guild.logChannel}`)
		}
	}
}
