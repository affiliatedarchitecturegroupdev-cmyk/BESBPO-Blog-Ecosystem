import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TagsService } from './tags.service';

// Public read endpoints used by besbpo-blog-web's tag archive pages
// (app/tags/[tag]/page.tsx). Tag creation happens implicitly through
// ArticlesService.create/update via TagsService.findOrCreateMany — there is
// deliberately no POST /tags here.
@ApiTags('tags')
@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  findAll() {
    return this.tagsService.findAll();
  }

  @Get(':name')
  findOne(@Param('name') name: string) {
    return this.tagsService.findByName(name);
  }
}
