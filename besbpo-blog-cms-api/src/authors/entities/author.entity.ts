import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Maps to `authors` in besbpo-blog-architecture/db/schema.sql. Deliberately
 * a DISTINCT concept from `User` (users/entities/user.entity.ts), not a
 * relabelling of it — `authors.user_id` is nullable, meaning an author can
 * exist with no corresponding login user at all (e.g. a guest byline, or
 * an author record migrated from a system that predates this platform's
 * own login). `articles.author_id`/`media_assets.uploaded_by` both
 * reference THIS table, not `users` directly — a real, previously-
 * undiscovered mismatch (every article create would have hard-failed a
 * NOT NULL foreign key constraint against real Postgres, since
 * ArticlesService was passing a raw user ID where an author ID was
 * required) found while writing a CI workflow that validates schema.sql
 * against a real Postgres instance for the first time — see
 * AuthorsService.getOrCreateForUser, which is the actual fix.
 */
@Entity('authors')
export class Author {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', nullable: true })
  userId?: string;

  @Column({ name: 'display_name' })
  displayName: string;

  @Column({ name: 'division_id', nullable: true })
  divisionId?: string;

  @Column({ nullable: true })
  bio?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
