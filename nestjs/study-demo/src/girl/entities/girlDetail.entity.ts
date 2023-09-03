import {
  Entity,
  OneToOne,
  Column,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  JoinColumn,
} from 'typeorm';
import { Girl } from './girl.entity';

@Entity()
export class GirlDetail {
  @OneToOne(() => Girl)
  @JoinColumn({ name: 'girl_id' })
  girl: Girl;

  @PrimaryGeneratedColumn() // 主键
  id: number;

  @CreateDateColumn({ type: 'timestamp' })
  entryTime: Date;

  @Column({ type: 'int' })
  weight: number;

  @Column({ type: 'int' })
  height: number;

  @Column({ type: 'varchar' })
  address: string;
}
