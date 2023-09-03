import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  OneToMany,
  JoinColumn,
} from 'typeorm';

import { Order } from '../../order/entities/order.entity';

@Entity()
export class Girl {
  // @PrimaryGeneratedColumn('uuid') // 主键
  @PrimaryGeneratedColumn() // 主键
  id: number;

  @OneToMany(() => Order, (order) => order.girl)
  @JoinColumn()
  order: Order[]; // 一对多关系

  @CreateDateColumn({ type: 'timestamp' })
  entryTime: Date;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'int' })
  age: number;

  @Column({ type: 'varchar' })
  skill: string;
}
