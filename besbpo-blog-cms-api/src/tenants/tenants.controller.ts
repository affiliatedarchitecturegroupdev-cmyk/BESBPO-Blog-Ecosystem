import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Role } from '../common/enums/role.enum';

// Read-side mirror of tenant admin operations. Tenant CRUD (create,
// rotate-key) is owned by besbpo-blog-syndication-svc per Doc-02 Section 5 —
// this controller intentionally only exposes read + reach-preview endpoints
// needed by the Editorial Dashboard.
//
// AUTH NOTE: unlike ArticlesController, every endpoint here requires an
// authenticated admin caller — there's no public route to protect against
// over-guarding — so JwtAuthGuard is applied class-wide alongside
// RolesGuard rather than per-method. See JwtAuthGuard's own doc comment
// for why it's needed at all (found missing during a Docker Compose
// integration review).
@ApiTags('tenants')
@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SYNDICATION_ADMIN, Role.SUPER_ADMIN, Role.CORPORATE_COMMS)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  findAll() {
    return this.tenantsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Post('preview-reach')
  previewReach(@Body('divisionTags') divisionTags: string[]) {
    return this.tenantsService.previewReach({ divisionTags });
  }
}
