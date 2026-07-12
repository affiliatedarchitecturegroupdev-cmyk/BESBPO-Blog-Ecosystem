import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './entities/tenant.entity';
import { Article } from '../articles/entities/article.entity';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantsRepo: Repository<Tenant>,
  ) {}

  findAll(): Promise<Tenant[]> {
    return this.tenantsRepo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Tenant> {
    const tenant = await this.tenantsRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
    return tenant;
  }

  /**
   * Syndication reach preview (Doc-03 Section 10): given a draft article's
   * current division_tags, return every active tenant whose subscription
   * overlaps — so an editor can catch a mis-tagged article before publish.
   */
  async previewReach(article: Pick<Article, 'divisionTags'>): Promise<Tenant[]> {
    if (!article.divisionTags?.length) return [];
    const qb = this.tenantsRepo
      .createQueryBuilder('tenant')
      .where('tenant.status = :status', { status: 'active' })
      .andWhere('tenant.division_tags && :tags', { tags: article.divisionTags });
    return qb.getMany();
  }
}
