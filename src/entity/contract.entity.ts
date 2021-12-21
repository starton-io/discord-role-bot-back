import {Entity, Column, PrimaryColumn} from "typeorm"
import {Network, Type} from "../interface/global"

@Entity()
export class Contract {

    @PrimaryColumn({ type: "uuid", generated: "uuid" })
    id: string

    @Column()
    guildId: string

    @Column()
    address: string

    @Column()
    role: string

    @Column("enum", { name: "type", enum: Type })
    type: Type

    @Column("enum", { name: "network", enum: Network })
    network: Network

    @Column({ default: 1 })
    min: number

    @Column({nullable: true})
    max?: number


}

