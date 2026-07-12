import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Division } from './entities/division.entity';

@Injectable()
export class DivisionsService {
  constructor(
    @InjectRepository(Division)
    private readonly divisionsRepo: Repository<Division>,
  ) {}

  findAll(): Promise<Division[]> {
    return this.divisionsRepo.find({ order: { label: 'ASC' } });
  }

  async findByKey(key: string): Promise<Division> {
    const division = await this.divisionsRepo.findOne({ where: { key } });
    if (!division) {
      throw new NotFoundException(`Division '${key}' not found`);
    }
    return division;
  }
}
