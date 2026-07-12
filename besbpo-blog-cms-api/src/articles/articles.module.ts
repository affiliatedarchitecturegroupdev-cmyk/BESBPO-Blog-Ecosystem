import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article } from './entities/article.entity';
import { ArticlesService } from './articles.service';
import { ArticlesController } from './articles.controller';
import { TagsModule } from '../tags/tags.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { AiProposalsModule } from '../ai-proposals/ai-proposals.module';
import { AuditModule } from '../audit/audit.module';
import { AuthorsModule } from '../authors/authors.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Article]),
    TagsModule,
    WebhooksModule,
    EmbeddingsModule,
    AiProposalsModule,
    AuditModule,
    AuthorsModule,
  ],
  providers: [ArticlesService],
  controllers: [ArticlesController],
  exports: [ArticlesService],
})
export class ArticlesModule {}
