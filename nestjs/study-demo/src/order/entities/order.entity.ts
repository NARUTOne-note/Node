import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Girl } from '../../girl/entities/girl.entity';

@Entity()
export class Order {
  @ManyToOne(() => Girl, (girl) => girl.order)
  girl: Girl; // 多对一关系

  @PrimaryGeneratedColumn()
  orderId: number;

  @Column()
  orderDate: Date;

  @Column()
  orderMoney: number;
}
