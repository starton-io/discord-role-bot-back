import { Entity, Column, PrimaryColumn } from "typeorm"

@Entity()
export class Guild {
	@PrimaryColumn({ type: "uuid", generated: "uuid" })
	id: string

	@Column()
	guildId: string

	@Column()
	administratorRole: string

	@Column()
	apiKey: string

	@Column()
	signingKey: string
}
