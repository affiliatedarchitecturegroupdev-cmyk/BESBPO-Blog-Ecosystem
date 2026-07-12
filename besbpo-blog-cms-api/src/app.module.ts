import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { DivisionsModule } from './divisions/divisions.module';
import { ArticlesModule } from './articles/articles.module';
import { TenantsModule } from './tenants/tenants.module';
import { AuthModule } from './auth/auth.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { TagsModule } from './tags/tags.module';
import { MediaModule } from './media/media.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      // Deliberately OFF, always — not just gated on NODE_ENV. Found during
      // a Docker Compose integration review: besbpo-blog-architecture's
      // db/schema.sql is mounted as the Postgres init script in
      // docker-compose.yml and is the canonical, ADR-tracked schema
      // referenced throughout this project's documentation. Also letting
      // TypeORM's `synchronize` auto-alter tables against that same
      // database gives two different mechanisms ownership of the same
      // table structure — synchronize would try to reconcile entities
      // against tables schema.sql already created, which is exactly the
      // kind of drift a real migration tool (the Phase 1 TODO this
      // comment replaces) is supposed to prevent, not paper over.
      // Entities must be kept in sync with schema.sql by hand until a
      // migration tool is introduced.
      synchronize: false,
    }),
    AuthModule,
    DivisionsModule,
    ArticlesModule,
    TenantsModule,
    WebhooksModule,
    TagsModule,
    MediaModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
