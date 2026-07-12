import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ArticleStatus } from '../../common/enums/article-status.enum';
import { Tag } from '../../tags/entities/tag.entity';

// Implements Doc-03 Section 4.1. Note: `embedding` (pgvector) is deliberately
// left out of this TypeORM entity — avoiding a pgvector TypeORM driver
// dependency here. It IS now written from this service (Phase 9 — see
// ../../embeddings/embedding.service.ts), via a raw parameterized query
// with an explicit ::vector cast rather than through this entity/the
// repository's normal save() path, preserving the original reasoning for
// leaving it out of the entity while still actually wiring the write
// path Phase 5 (besbpo-blog-intelligence-svc) needed a caller for.
export type ContentFieldSource = 'human' | 'ai_proposed' | 'human_approved';

@Entity('articles')
export class Article {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  slug: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  excerpt?: string;

  @Column({ name: 'excerpt_source', default: 'human' })
  excerptSource: ContentFieldSource;

  @Column({ name: 'body_mdx', type: 'text', default: '' })
  bodyMdx: string;

  @Column({ type: 'enum', enum: ArticleStatus, default: ArticleStatus.DRAFT })
  status: ArticleStatus;

  @Column({ name: 'author_id' })
  authorId: string;

  @Column({ name: 'division_tags', type: 'text', array: true, default: '{}' })
  divisionTags: string[];

  @Column({ name: 'division_tags_source', default: 'human' })
  divisionTagsSource: ContentFieldSource;

  // Free-form, cross-cutting tags (Doc-03 Section 4.2). Matches the
  // `article_tags` join table in besbpo-blog-architecture/db/schema.sql —
  // column names set explicitly since no global snake_case naming strategy
  // is configured for this project.
  @ManyToMany(() => Tag, { cascade: false })
  @JoinTable({
    name: 'article_tags',
    joinColumn: { name: 'article_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags: Tag[];

  @Column({ name: 'hero_image_id', nullable: true })
  heroImageId?: string | null;

  @Column({ name: 'seo_meta', type: 'jsonb', default: {} })
  seoMeta: Record<string, unknown>;

  @Column({ name: 'seo_meta_source', default: 'human' })
  seoMetaSource: ContentFieldSource;

  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt?: Date;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt?: Date;

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
