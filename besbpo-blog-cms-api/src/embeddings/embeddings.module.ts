import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article } from '../articles/entities/article.entity';
import { EmbeddingService } from './embedding.service';

@Module({
  imports: [TypeOrmModule.forFeature([Article])],
  providers: [EmbeddingService],
  exports: [EmbeddingService],
})
export class EmbeddingsModule {}
