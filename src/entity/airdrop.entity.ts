import { Entity, Column, PrimaryColumn } from "typeorm"

@Entity()
export class Airdrop {
	@PrimaryColumn({ type: "uuid", generated: "uuid" })
	id: string

	@Column()
	name: string

	@Column()
	guildId: string

	@Column()
	contractId: string

	@Column({ nullable: true, default: 1 })
	amount: number

	@Column({ nullable: true, default: -1 })
	interval: number

	@Column({ nullable: true, default: 100 })
	chance: number

	@Column({ nullable: true })
	password?: string

	@Column({ nullable: true })
	tokenId?: string

	@Column({ nullable: true })
	channelId?: string
}
