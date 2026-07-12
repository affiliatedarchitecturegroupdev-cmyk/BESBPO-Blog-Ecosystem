import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ArticlesService, ApprovableField } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Role } from '../common/enums/role.enum';
import { ArticleStatus } from '../common/enums/article-status.enum';

// Implements the /articles paths of the Syndication API contract
// (besbpo-blog-architecture/openapi/syndication-api.yaml), plus the
// authoring endpoints layered on top for the Editorial Dashboard.
//
// AUTH NOTE: RolesGuard is class-level (it no-ops on routes without a
// @Roles() decorator, e.g. findOne below — the intentionally-public
// canonical article lookup). JwtAuthGuard is applied per-method instead,
// only on the routes that actually require an authenticated caller —
// applying it class-wide would incorrectly require a token on findOne
// too, breaking the public canonical-site use case Doc-02 Section 5
// documents for that endpoint.
@ApiTags('articles')
@Controller('articles')
@UseGuards(RolesGuard)
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @Roles(Role.DIVISION_AUTHOR, Role.DIVISION_EDITOR, Role.CORPORATE_COMMS, Role.SYNDICATION_ADMIN, Role.SUPER_ADMIN)
  findAll(
    @Query('division') division?: string,
    @Query('status') status?: ArticleStatus,
    @Query('tag') tag?: string,
  ) {
    return this.articlesService.findAll({ division, status, tag });
  }

  // Note: this doesn't structurally collide with ':slug' below regardless
  // of registration order — Express/Nest's `:param` syntax matches
  // exactly one path segment, so `/articles/:slug` can never match a
  // two-segment path like `/articles/id/{uuid}`. Registered first anyway,
  // as the clearer convention (more specific/literal routes before
  // generic wildcards), not because it's load-bearing here.
  @Get('id/:id')
  @UseGuards(JwtAuthGuard)
  @Roles(Role.DIVISION_AUTHOR, Role.DIVISION_EDITOR, Role.CORPORATE_COMMS, Role.SYNDICATION_ADMIN, Role.SUPER_ADMIN)
  findById(@Param('id') id: string) {
    return this.articlesService.findById(id);
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.articlesService.findBySlug(slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @Roles(Role.DIVISION_AUTHOR, Role.DIVISION_EDITOR, Role.CORPORATE_COMMS, Role.SUPER_ADMIN)
  create(@Body() dto: CreateArticleDto, @Req() req: any) {
    return this.articlesService.create(dto, req.user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @Roles(Role.DIVISION_AUTHOR, Role.DIVISION_EDITOR, Role.CORPORATE_COMMS, Role.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateArticleDto) {
    return this.articlesService.update(id, dto);
  }

  @Patch(':id/transition')
  @UseGuards(JwtAuthGuard)
  @Roles(Role.DIVISION_EDITOR, Role.CORPORATE_COMMS, Role.SUPER_ADMIN)
  transition(@Param('id') id: string, @Body('status') status: ArticleStatus, @Req() req: any) {
    return this.articlesService.transition(id, status, req.user?.id);
  }

  // Doc-03 Section 6: the explicit "I reviewed this AI proposal and
  // accept it as-is" action — distinct from a PATCH :id update, which
  // always means a human is providing/changing the content itself. See
  // ArticlesService.approveField's doc comment for the full reasoning.
  @Post(':id/approve/:field')
  @UseGuards(JwtAuthGuard)
  @Roles(Role.DIVISION_EDITOR, Role.CORPORATE_COMMS, Role.SUPER_ADMIN)
  approveField(@Param('id') id: string, @Param('field') field: ApprovableField, @Req() req: any) {
    return this.articlesService.approveField(id, field, req.user?.id);
  }

  // Doc-03 Section 6: requests fresh AI proposals for excerpt, division
  // tags, and SEO meta from besbpo-blog-intelligence-svc, all at once —
  // the "AI proposes" half of the human-approval gate, which had no
  // caller anywhere in this codebase before this endpoint existed.
  @Post(':id/ai-proposals')
  @UseGuards(JwtAuthGuard)
  @Roles(Role.DIVISION_AUTHOR, Role.DIVISION_EDITOR, Role.CORPORATE_COMMS, Role.SUPER_ADMIN)
  requestAiProposals(@Param('id') id: string) {
    return this.articlesService.requestAiProposals(id);
  }
}
