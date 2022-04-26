import { Entity, Column, PrimaryColumn } from "typeorm"

@Entity()
export class Participation {
	@PrimaryColumn({ type: "uuid", generated: "uuid" })
	id: string

	@Column()
	airdropId: string

	@Column()
	memberId: string

	@Column({ type: "date"})
	date: Date
}
