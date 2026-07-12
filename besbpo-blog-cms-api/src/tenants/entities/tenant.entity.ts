import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type TenantStatus = 'pending' | 'active' | 'suspended' | 'offboarded';
export type DeliveryMode = 'client_side' | 'build_time' | 'both';

// Mirrors the tenant model defined in Doc-02 Section 2 and the OpenAPI
// `Tenant` schema in besbpo-blog-architecture/openapi/syndication-api.yaml.
// NOTE: this table is owned operationally by the Go Syndication Distribution
// Service (besbpo-blog-syndication-svc); it is mirrored here so the CMS core
// and Editorial Dashboard can show syndication reach previews (Doc-03
// Section 10) without a cross-service call on every keystroke. Keep the two
// schemas in sync via the webhook in src/webhooks.
@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  domain: string;

  @Column({ name: 'division_tags', type: 'text', array: true, default: '{}' })
  divisionTags: string[];

  @Column({ name: 'display_config', type: 'jsonb', default: {} })
  displayConfig: Record<string, unknown>;

  @Column({ name: 'delivery_mode', default: 'client_side' })
  deliveryMode: DeliveryMode;

  @Column({ default: 'pending' })
  status: TenantStatus;

  @Column({ name: 'github_repo', nullable: true })
  githubRepo?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
