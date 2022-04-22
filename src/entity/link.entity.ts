import { Entity, Column, PrimaryColumn } from "typeorm"

@Entity()
export class Link {
	@PrimaryColumn({ type: "uuid", generated: "uuid" })
	id: string

	@Column()
	memberId: string

	@Column()
	guildId: string
}
