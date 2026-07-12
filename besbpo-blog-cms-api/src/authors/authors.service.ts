import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Author } from './entities/author.entity';

/**
 * `articles.author_id` and `media_assets.uploaded_by` both reference
 * `authors(id)`, not `users(id)` — a real, previously-undiscovered
 * mismatch found while writing a CI workflow that applies schema.sql to
 * a real Postgres instance for the first time (see Author entity's doc
 * comment for the full story). This service is the actual fix:
 * `getOrCreateForUser` is the ONE place that resolves "the user who's
 * logged in" to "the author record a foreign key can legally point at."
 *
 * Deliberately auto-creates rather than requiring a separate explicit
 * author-registration step — every user who can log in and reach
 * ArticlesController.create/MediaController.upload already has
 * everything needed (a user id and a display name, both in the JWT) to
 * back an author record, so requiring a human to manually create one
 * first would be friction with no real benefit. An author record
 * created this way starts with no `divisionId`/`bio` — both nullable,
 * both fine to leave unset until there's a real reason to prompt for
 * them.
 */
@Injectable()
export class AuthorsService {
  constructor(
    @InjectRepository(Author)
    private readonly authorsRepo: Repository<Author>,
  ) {}

  async getOrCreateForUser(userId: string, displayName: string): Promise<Author> {
    const existing = await this.authorsRepo.findOne({ where: { userId } });
    if (existing) {
      return existing;
    }

    const author = this.authorsRepo.create({ userId, displayName });
    return this.authorsRepo.save(author);
  }
}
