import { Entity, Column, PrimaryColumn } from "typeorm"
import { Network, Type } from "../interface/global"

@Entity()
export class Contract {
	@PrimaryColumn({ type: "uuid", generated: "uuid" })
	id: string

	@Column()
	guildId: string

	@Column()
	name: string

	@Column()
	address: string

	@Column("enum", { name: "type", enum: Type })
	type: Type

	@Column("enum", { name: "network", enum: Network })
	network: Network
}
