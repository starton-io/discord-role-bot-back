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

	@Column()
	signerWallet: string

	@Column({ default: 1 })
	amount: number

	@Column({ default: -1 })
	interval: number

	@Column({ default: 100 })
	chance: number

	@Column({ nullable: true })
	password?: string

	@Column({ nullable: true })
	channelId?: string

	//Mandatory for a 721 token
	@Column({ nullable: true })
	metadataUri?: string

	//Mandatory for a 1155 token
	@Column({ nullable: true })
	tokenId?: string
}
