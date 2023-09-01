import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class Girl {
  // @PrimaryGeneratedColumn('uuid') // 主键
  @PrimaryGeneratedColumn() // 主键
  id: number;

  @CreateDateColumn({ type: 'timestamp' })
  entryTime: Date;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'int' })
  age: number;

  @Column({ type: 'varchar' })
  skill: string;
}
