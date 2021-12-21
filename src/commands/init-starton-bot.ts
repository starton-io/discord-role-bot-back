import {CommandInteraction, Role} from "discord.js"
import {Discord, Slash, SlashOption} from "discordx"
import {getConnection} from "typeorm"
import { Discord as DiscordClass } from "../discord"
import {Guild} from "../entity/guild.entity"

@Discord()
abstract class InitStartonBot {

	@Slash("init")
	private async init(
        @SlashOption("key", { description: "Your starton api-key", required: true })
            key: string,

        @SlashOption("administrator", { type: "ROLE", required: true, description: "Role who can config this bot, add other smart contract etc.?" })
            administratorRole: Role,
		interaction: CommandInteraction
	) {
        await interaction.deferReply({
            ephemeral: true
        })
        const guildRepo = getConnection().getRepository(Guild)
        const existingGuild = await guildRepo.findOne({
            where: {
                guildId: interaction.guildId
            }
        })
        if (existingGuild) {
            return interaction.editReply(`This bot is already configured`)
        }
        await guildRepo.save({
            guildId: interaction?.guildId as string,
            apiKey: key,
            administratorRole: administratorRole.id
        }).catch(err => {
            console.error(err)
            return interaction.editReply(`Could not register your discord serve, please try again later`)
        })
        await DiscordClass.Client.initApplicationPermissions()
        await interaction.editReply(`Discord server registered!`)
    }
}
