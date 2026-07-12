import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

// Implements Doc-03 Section 5 (taxonomy) / Doc-01 architecture repo taxonomy seed.
@Entity('divisions')
export class Division {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  key: string; // e.g. 'built-environment'

  @Column()
  label: string; // e.g. 'Built Environment'

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
