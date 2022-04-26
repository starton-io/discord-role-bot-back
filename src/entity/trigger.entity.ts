import { Entity, Column, PrimaryColumn } from "typeorm"

@Entity()
export class Trigger {
	@PrimaryColumn({ type: "uuid", generated: "uuid" })
	id: string

	@Column()
	roleId: string

	@Column()
	contractId: string

	@Column({ default: 1 })
	min: number

	@Column({ nullable: true })
	max?: number

	@Column({ nullable: true })
	tokenId?: string
}
