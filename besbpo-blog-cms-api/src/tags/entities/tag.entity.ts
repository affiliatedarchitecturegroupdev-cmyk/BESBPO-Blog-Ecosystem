import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

// Free-form, cross-cutting tags — orthogonal to the formal division
// taxonomy (Doc-03 Section 4.2, `tags` table). Division tags drive
// syndication routing (Doc-02); these tags exist purely for the public
// blog's own archive/discovery pages (e.g. "case-study", "investor-update").
@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;
}
