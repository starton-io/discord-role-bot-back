import {
	ApplicationCommandPermissions,
	CommandInteraction,
	Guild,
	GuildChannel,
	GuildMember,
	Interaction,
	Role,
} from "discord.js"
import { Discord, Permission, Slash, SlashGroup, SlashOption } from "discordx"
import { getConnection } from "typeorm"
import { Event } from "../entity/event.entity"
import { Guild as GuildEntity } from "../entity/guild.entity"
import { Logger } from "../logger"
import { Discord as DiscordClient } from "../discord"
import { Modal, TextInputComponent, showModal } from "discord-modals"
import { Permissions } from "../permissions"

@Discord()
// @Permission(false)
// @Permission(async (guild, cmd): Promise<ApplicationCommandPermissions[]> => {
// 	const guildRepo = getConnection().getRepository(GuildEntity)
// 	const guildEntity = await guildRepo.findOne({ where: { guildId: guild.id } })
//
// 	if (guildEntity && guildEntity.administratorRole) {
// 		return [{ id: guildEntity.administratorRole, permission: true, type: "ROLE" }]
// 	}
// 	return []
// })
@SlashGroup({ name: "event", description: "Manage your events" })
@SlashGroup("event")
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

		if (! await Permissions.isAdmin(interaction.guild?.id as string, interaction.member as GuildMember)) {
			return await interaction.editReply(`You are not allowed to use this command.`)
		}

		if (!role && !newRole) {
			return await interaction.editReply(`You must provide a role (an existing or a new one).`)
		}

		const eventRepo = getConnection().getRepository(Event)
		const existingEvent = await eventRepo.findOne({
			where: {
				guildId: interaction?.guildId as string,
				password: password,
			},
		})
		if (existingEvent) {
			return await interaction.editReply(`An event with this password already exists.`)
		}

		if (!role) {
			role = (await interaction.guild?.roles.create({ name: newRole })) as Role
			if (!role) {
				return await interaction.editReply(
					"A problem occured during the creation of the role. Please try again later.",
				)
			}
		}

		let channelFailed = false
		try {
			if (channel) {
				await this.updateChannel(channel, role)
			} else if (!channel && newChannel) {
				channel = await this.createChannel(interaction.guild as Guild, newChannel, role.id)
			}
		} catch (e) {
			channelFailed = true
			console.log(e)
		}

		const event = await eventRepo.save({
			name,
			guildId: interaction?.guildId as string,
			password: password,
			channelId: channel?.id,
			roleId: role.id,
		})

		await Logger.logDiscord(
			event.guildId as string,
			`:green_circle: Event ${name} created by <@${interaction.user.id}>.`,
		)
		if (channelFailed) {
			await interaction.editReply(
				`A problem occured with the channel, but the event ${name} has been created.`,
			)
		} else {
			await interaction.editReply(`Event ${name} created.`)
		}
	}

	@Slash("list")
	private async listEvents(interaction: CommandInteraction) {
		await interaction.deferReply({ ephemeral: true })

		if (! await Permissions.isAdmin(interaction.guild?.id as string, interaction.member as GuildMember)) {
			return await interaction.editReply(`You are not allowed to use this command.`)
		}

		const eventRepo = getConnection().getRepository(Event)
		const events = await eventRepo.find({ where: { guildId: interaction.guild?.id } })

		const replies: String[] = []
		events.forEach((event) => {
			replies.push(`${event.name}: ${event.password}`)
		})

		await interaction.editReply(
			replies.length ? replies.join("\n") : "You don't have any events yet.",
		)
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

		if (! await Permissions.isAdmin(interaction.guild?.id as string, interaction.member as GuildMember)) {
			return await interaction.editReply(`You are not allowed to use this command.`)
		}

		const eventRepo = getConnection().getRepository(Event)
		const event = await eventRepo.findOne({
			where: {
				guildId: interaction?.guildId as string,
				password: password,
			},
		})
		if (!event) {
			return await interaction.editReply(`Couldn't find this event.`)
		}

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

		await Logger.logDiscord(
			event.guildId as string,
			`:green_circle: Event ${event.name} deleted by <@${interaction.user.id}>.`,
		)
		await interaction.editReply(`Event ${event.name} deleted.`)
	}
}

@Discord()
abstract class JoinCommand {
	@Slash("join")
	private async openModal(interaction: CommandInteraction) {
		const modal = new Modal()
			.setCustomId("join-event-modal")
			.setTitle("Event password")
			.addComponents(
				new TextInputComponent()
					.setCustomId("join-event-password")
					.setLabel("Password")
					.setStyle("SHORT")
					.setMinLength(0)
					.setMaxLength(100)
					.setPlaceholder("password")
					.setRequired(true),
			)

		await showModal(modal, {
			client: DiscordClient.Client,
			interaction: interaction,
		})
	}
}

export class JoinEvent {
	static async join(member: GuildMember, password: string): Promise<string> {
		const eventRepo = getConnection().getRepository(Event)
		const event = await eventRepo.findOne({ where: { guildId: member.guild.id, password } })

		if (!event) {
			return "This password doesn't match any events :cry:."
		}

		member.roles.add(event.roleId)

		await Logger.logDiscord(
			event.guildId as string,
			`:green_circle: <@${member.id}> as join the event ${event.name}.`,
		)
		return `You joined the ${event.name} event, enjoy your new privileges !`
	}
}
