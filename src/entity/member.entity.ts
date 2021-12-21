import {Entity, Column, PrimaryColumn} from "typeorm"

@Entity()
export class Member {

    @PrimaryColumn({ type: "uuid", generated: "uuid" })
    id: string

    @Column()
    memberId: string

    @Column()
    guildId: string

    @Column()
    address: string
}
