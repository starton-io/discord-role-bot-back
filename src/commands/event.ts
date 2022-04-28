import {
	ApplicationCommandPermissions,
	CommandInteraction,
	Guild,
	GuildChannel,
	GuildMember,
	Role,
} from "discord.js"
import { Discord, Permission, Slash, SlashGroup, SlashOption } from "discordx"
import { getConnection } from "typeorm"
import { Event } from "../entity/event.entity"
import { Guild as GuildEntity } from "../entity/guild.entity"

@Discord()
@Permission(false)
@Permission(async (guild, cmd): Promise<ApplicationCommandPermissions[]> => {
	const guildRepo = getConnection().getRepository(GuildEntity)
	const guildEntity = await guildRepo.findOne({ where: { guildId: guild.id } })

	if (guildEntity && guildEntity.administratorRole) {
		return [{ id: guildEntity.administratorRole, permission: true, type: "ROLE" }]
	}
	return []
})
@SlashGroup("event", "Manage your events")
abstract class EventCommand {
	private async createChannel(guild: Guild, name: string, roleId: string): Promise<GuildChannel> {
		const guildRepo = getConnection().getRepository(GuildEntity)
		const guildEntity = await guildRepo.findOneOrFail({ where: { guildId: guild.id } })

		const channel = await guild.channels.create(name, {
			type: "GUILD_TEXT",
			permissionOverwrites: [
				{ id: guildEntity.administratorRole, allow: ["ADMINISTRATOR"] },
				{
					id: roleId,
					allow: [
						"VIEW_CHANNEL",
						"ADD_REACTIONS",
						"SEND_MESSAGES",
						"ATTACH_FILES",
						"READ_MESSAGE_HISTORY",
					],
				},
				{
					id: guild.roles.everyone,
					deny: ["VIEW_CHANNEL"],
				},
			],
		})
		return channel
	}

	private async updateChannel(channel: GuildChannel, role: Role) {
		if (!channel.isText()) {
			throw "You must provide a text based channel"
		}
		await channel.permissionOverwrites.create(role, {
			VIEW_CHANNEL: true,
			ADD_REACTIONS: true,
			SEND_MESSAGES: true,
			ATTACH_FILES: true,
			READ_MESSAGE_HISTORY: true,
		})
	}

	@Slash("create")
	private async createEvent(
		@SlashOption("name", { required: true, description: "Name of the event" })
		name: string,

		@SlashOption("password", { required: true, description: "Password of the event" })
		password: string,

		@SlashOption("channel", {
			type: "CHANNEL",
			required: false,
			description: "Channel you want to use for this event",
		})
		channel: GuildChannel,

		@SlashOption("new-channel", {
			required: false,
			description:
				"Name of the channel you want to create for this event (not used if channel is given)",
		})
		newChannel: string,

		@SlashOption("role", {
			type: "ROLE",
			required: false,
			description: "Role you want to use for this event",
		})
		role: Role,

		@SlashOption("new-role", {
			required: false,
			description:
				"Name of the role you want to create for this event (not used if role is given)",
		})
		newRole: string,

		interaction: CommandInteraction,
	) {
		await interaction.deferReply({ ephemeral: true })

		if (!role && !newRole) {
			return await interaction.editReply(`You must provide a role (an existing or a new one)`)
		}

		try {
			const eventRepo = getConnection().getRepository(Event)
			const existingEvent = await eventRepo.findOne({
				where: {
					guildId: interaction?.guildId as string,
					password: password,
				},
			})
			if (existingEvent) {
				return await interaction.editReply(`An event with this password already exists`)
			}

			if (!role) {
				role = (await interaction.guild?.roles.create({ name: newRole })) as Role
				if (!role) {
					throw "Couldn't create role"
				}
			}

			if (channel) {
				await this.updateChannel(channel, role)
			} else if (!channel && newChannel) {
				channel = await this.createChannel(interaction.guild as Guild, newChannel, role.id)
			}

			await eventRepo.save({
				name,
				guildId: interaction?.guildId as string,
				password: password,
				channelId: channel?.id,
				roleId: role.id,
			})
			await interaction.editReply(`Event ${name} created`)
		} catch (e) {
			console.log(e)
			await interaction.editReply(`Could not register this event, please try again later`)
		}
	}

	@Slash("list")
	private async listEvents(interaction: CommandInteraction) {
		await interaction.deferReply({ ephemeral: true })

		const eventRepo = getConnection().getRepository(Event)
		const events = await eventRepo
			.find({ where: { guildId: interaction.guild?.id } })
			.catch((e) => {
				console.log(e)
				return []
			})

		const replies: String[] = []
		events.forEach((event) => {
			replies.push(`${event.name}: ${event.password}`)
		})
		if (!replies.length) {
			return await interaction.editReply("You don't have any events yet")
		}
		await interaction.editReply(replies.join("\n"))
	}

	@Slash("delete")
	private async deleteEvent(
		@SlashOption("password", {
			required: true,
			description: "Password of the event you want to delete",
		})
		password: string,

		@SlashOption("delete-channel", {
			required: false,
			description: "Do you want to delete the channel linked to this event ? Default: False",
		})
		deleteChannel: boolean = false,

		@SlashOption("delete-role", {
			required: false,
			description: "Do you want to delete the role linked to this event ? Default: False",
		})
		deleteRole: boolean = false,

		interaction: CommandInteraction,
	) {
		await interaction.deferReply({ ephemeral: true })

		try {
			const eventRepo = getConnection().getRepository(Event)
			const event = await eventRepo.findOneOrFail({
				where: {
					guildId: interaction?.guildId as string,
					password: password,
				},
			})

			if (deleteChannel && event.channelId) {
				await interaction.guild?.channels.cache
					.get(event.channelId)
					?.delete()
					.catch((e) => {
						console.log(e)
					})
			}
			if (deleteRole) {
				await interaction.guild?.roles.cache
					.get(event.roleId)
					?.delete()
					.catch((e) => {
						console.log(e)
					})
			}
			eventRepo.delete(event)

			await interaction.editReply(`Event ${event.name} deleted.`)
		} catch (err) {
			await interaction.editReply(`Could not delete this event`)
		}
	}
}

@Discord()
abstract class JoinCommand {
	@Slash("join")
	private async join(
		@SlashOption("password", { required: true, description: "Password of the event" })
		password: string,

		interaction: CommandInteraction,
	) {
		await interaction.deferReply({ ephemeral: true })

		try {
			const eventRepo = getConnection().getRepository(Event)
			const event = await eventRepo.findOneOrFail({
				where: {
					guildId: interaction?.guildId as string,
					password: password,
				},
			})

			const member = (await interaction.guild?.members.fetch(
				interaction.member.user.id,
			)) as GuildMember

			member.roles.add(event.roleId)
			await interaction.editReply(
				`You joined the ${event.name} event, enjoy your new privileges !`,
			)
		} catch (e) {
			console.log(e)
			await interaction.editReply(`Couldn't join this event`)
		}
	}
}
