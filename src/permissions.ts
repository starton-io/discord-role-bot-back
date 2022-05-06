import { GuildMember } from "discord.js"
import { getConnection } from "typeorm"
import { Guild } from "./entity/guild.entity"

export class Permissions {
	static async isAdmin(guildId: string, member: GuildMember) {
		const guildRepo = getConnection().getRepository(Guild)
		const guildEntity = await guildRepo.findOne({ where: { guildId } })

		if (!guildEntity || !guildEntity.administratorRole) {
			return false
		}

		return member.roles.cache.has(guildEntity.administratorRole)
	}
}

