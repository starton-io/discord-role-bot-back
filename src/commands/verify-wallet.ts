import { CommandInteraction } from "discord.js"
import { Discord, Slash } from "discordx"
import {getConnection} from "typeorm"
import {Link} from "../entity/link.entity"

@Discord()
abstract class VerifyWallet {

	@Slash("verify")
	private async verify(
		interaction: CommandInteraction
	) {
		await interaction.deferReply({
            ephemeral: true
        })
        const linkRepository = getConnection().getRepository(Link)
        const link = await linkRepository.save({
            memberId: interaction?.user.id,
            guildId: interaction?.guildId as string
        })
        await interaction.editReply(`Hey <@${interaction.user.id}>! Please click on this link and connect your wallet: ${process.env.FRONT_URL}?id=${link.id}`)
	}
}
