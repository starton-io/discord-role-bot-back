import { Entity, Column, PrimaryColumn } from "typeorm"

@Entity()
export class Event {
	@PrimaryColumn({ type: "uuid", generated: "uuid" })
	id: string

	@Column()
	guildId: string

	@Column()
	name: string

	@Column()
	password: string

	@Column()
	channelId: string

	@Column()
	roleId: string
}
