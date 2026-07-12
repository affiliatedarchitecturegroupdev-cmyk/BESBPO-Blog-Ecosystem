import { IsArray, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

// Deliberately does NOT expose excerptSource/divisionTagsSource/seoMetaSource
// as settable fields — see ArticlesService.update()'s header comment for
// why: allowing a client to set those directly would let anyone claim a
// field is 'human_approved' without an actual human having approved
// anything, undermining the entire human-approval gate this platform is
// built around. Sources are only ever set by the SERVER, in response to
// specific, narrower actions (a direct content edit → 'human'; the
// approve endpoint → 'human_approved'; the AI-proposals endpoint →
// 'ai_proposed') — never by trusting a value the client sent.
export class CreateArticleDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  slug: string;

  @IsString()
  @IsOptional()
  bodyMdx?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  excerpt?: string;

  @IsArray()
  @IsOptional()
  divisionTags?: string[];

  @IsArray()
  @IsOptional()
  tagNames?: string[];

  @IsObject()
  @IsOptional()
  seoMeta?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  heroImageId?: string | null;
}
