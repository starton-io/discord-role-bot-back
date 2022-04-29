import { CommandInteraction } from "discord.js";

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
}
