import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { MediaService } from './media.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

// Implements the media half of Doc-03 Section 4.1/9. Every route requires
// authentication — unlike ArticlesController's GET /articles/:slug, there
// is no public read path here: media is only ever fetched from within the
// authenticated authoring UI (an article's actual public rendering, once
// media resolution is wired into besbpo-blog-web, would go through that
// app's own build/fetch process, not a direct call to this endpoint — not
// yet built, see this repo's README).
@ApiTags('media')
@Controller('media')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DIVISION_AUTHOR, Role.DIVISION_EDITOR, Role.CORPORATE_COMMS, Role.SUPER_ADMIN)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: Express.Multer.File, @Body('altText') altText: string | undefined, @Req() req: any) {
    // req.user.id, NOT req.user.sub — JwtStrategy.validate()
    // (auth/jwt.strategy.ts) returns { id: payload.sub, ... }, so the
    // JWT payload's own field is called `sub`, but the VALIDATED
    // request.user object Passport actually populates uses `id`. Passing
    // the whole req.user object through (rather than picking `.id` off it
    // here) also fixed a second, related bug: MediaService.upload needs
    // displayName too now, to resolve the real `authors` record this
    // upload should be attributed to (media_assets.uploaded_by is a
    // foreign key to authors(id), not users(id) — see
    // MediaService.upload's own doc comment for that story).
    return this.mediaService.upload(
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      req.user,
      altText,
    );
  }

  // The media library — lets an editor reuse a previously-uploaded image
  // instead of uploading a duplicate. limit/offset arrive as query
  // strings (always strings in Express, even for numeric-looking values)
  // so they're parsed here — MediaService.findAll (via clampPagination)
  // treats anything that parses to NaN the same as "not specified".
  @Get()
  findAll(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.mediaService.findAll(Number(limit), Number(offset));
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.mediaService.findById(id);
  }

  @Patch(':id')
  updateAltText(@Param('id') id: string, @Body('altText') altText: string) {
    return this.mediaService.updateAltText(id, altText);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.mediaService.delete(id);
  }
}
