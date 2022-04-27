import { Entity, Column, PrimaryColumn, CreateDateColumn } from "typeorm"

@Entity()
export class Participation {
	@PrimaryColumn({ type: "uuid", generated: "uuid" })
	id: string

	@Column()
	airdropId: string

	@Column()
	memberId: string

	@Column()
	address: string

	@CreateDateColumn()
	createdAt: Date;
}
