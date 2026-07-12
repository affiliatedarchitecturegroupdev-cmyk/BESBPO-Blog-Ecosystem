import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaAsset } from './entities/media-asset.entity';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { S3StorageBackend, LocalFilesystemStorageBackend } from './storage-backend';
import { AuthorsModule } from '../authors/authors.module';

@Module({
  imports: [TypeOrmModule.forFeature([MediaAsset]), AuthorsModule],
  providers: [MediaService, S3StorageBackend, LocalFilesystemStorageBackend],
  controllers: [MediaController],
  exports: [MediaService],
})
export class MediaModule {}
