import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, OneToOne } from "typeorm"
import { User } from "./User"

@Entity({
    name: 't_aaa'
})
export class Aaa {

    @PrimaryGeneratedColumn({
        comment: '这是 id'
    })
    id: number

    // 一对一关联
    @JoinColumn()
    @OneToOne(() => User)
    user: User

    @Column({
        name: 'a_aa',
        type: 'text',
        comment: '这是 aaa'
    })
    aaa: string

    @Column({
        unique: true,
        nullable: false,
        length: 10,
        type: 'varchar',
        default: 'bbb'
    })
    bbb: string

    @Column({
        type: 'double',
    })
    ccc: number
}

