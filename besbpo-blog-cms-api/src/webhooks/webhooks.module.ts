import { Module } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
