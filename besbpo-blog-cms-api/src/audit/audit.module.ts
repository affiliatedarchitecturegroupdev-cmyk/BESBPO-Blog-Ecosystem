import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditService } from './audit.service';

@Module({
  imports: [AuthModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
