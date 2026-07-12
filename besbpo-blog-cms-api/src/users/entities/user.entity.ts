import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Real per-user identity (Doc-01 Section 8 / Doc-04 Section 5). See
 * besbpo-blog-architecture/db/schema.sql's header comment on this table
 * for why this is genuine per-user login rather than SSO against a
 * specific external identity provider — no IdP has been chosen, and this
 * doesn't guess one; it replaces the single shared admin JWT every
 * service and the dashboard ran on before this with real, individual
 * accounts.
 *
 * `passwordHash` is never selected by default (see UsersService) — a
 * password hash has no reason to ever leave this service, let alone
 * appear in an API response by accident because someone forgot to strip
 * it from a returned User.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash', select: false })
  passwordHash: string;

  @Column({ name: 'display_name' })
  displayName: string;

  @Column({ type: 'text', array: true, default: '{}' })
  roles: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
