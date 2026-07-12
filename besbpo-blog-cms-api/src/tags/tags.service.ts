import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tag } from './entities/tag.entity';

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(Tag)
    private readonly tagsRepo: Repository<Tag>,
  ) {}

  findAll(): Promise<Tag[]> {
    return this.tagsRepo.find({ order: { name: 'ASC' } });
  }

  async findByName(name: string): Promise<Tag> {
    const tag = await this.tagsRepo.findOne({ where: { name } });
    if (!tag) {
      throw new NotFoundException(`Tag '${name}' not found`);
    }
    return tag;
  }

  /**
   * Resolves a list of tag names to Tag entities, creating any that don't
   * already exist. Used by ArticlesService when an author supplies
   * free-form tag names on create/update rather than tag IDs, so authoring
   * a new tag doesn't require a separate round trip through this module's
   * own endpoints first.
   */
  async findOrCreateMany(names: string[]): Promise<Tag[]> {
    const normalised = [...new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean))];
    if (normalised.length === 0) return [];

    const existing = await this.tagsRepo
      .createQueryBuilder('tag')
      .where('tag.name IN (:...names)', { names: normalised })
      .getMany();

    const existingNames = new Set(existing.map((t) => t.name));
    const toCreate = normalised.filter((n) => !existingNames.has(n));

    const created = await Promise.all(
      toCreate.map((name) => this.tagsRepo.save(this.tagsRepo.create({ name }))),
    );

    return [...existing, ...created];
  }
}
