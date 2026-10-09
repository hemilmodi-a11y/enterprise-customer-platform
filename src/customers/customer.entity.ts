import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../users/user.entity';

@Entity('customers')
@Index('IDX_customers_company_name', ['companyName'])
export class Customer {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => User, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'varchar',
    name: 'phone',
    length: 30,
    nullable: true,
  })
  phone: string | null;

  @Column({
    type: 'varchar',
    name: 'company_name',
    length: 150,
    nullable: true,
  })
  companyName: string | null;

  @Column({
    type: 'varchar',
    name: 'address',
    length: 500,
    nullable: true,
  })
  address: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
