import { Module } from '@nestjs/common';
import { DivisionsModule } from '../divisions/divisions.module';
import { AiProposalService } from './ai-proposal.service';

@Module({
  imports: [DivisionsModule],
  providers: [AiProposalService],
  exports: [AiProposalService],
})
export class AiProposalsModule {}
