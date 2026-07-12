import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DivisionsService } from './divisions.service';

// Mirrors GET /api/v1/taxonomy/divisions from the Syndication API contract
// (besbpo-blog-architecture/openapi/syndication-api.yaml).
@ApiTags('taxonomy')
@Controller('taxonomy/divisions')
export class DivisionsController {
  constructor(private readonly divisionsService: DivisionsService) {}

  @Get()
  findAll() {
    return this.divisionsService.findAll();
  }

  @Get(':key')
  findOne(@Param('key') key: string) {
    return this.divisionsService.findByKey(key);
  }
}
