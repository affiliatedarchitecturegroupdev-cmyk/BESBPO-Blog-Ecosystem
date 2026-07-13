// Audit Trail Outbox Pattern Service
// Reference: Master Plan Section 7 - Auth & Enterprise
// Implements the outbox pattern for reliable audit event publishing

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';

export enum AuditEventType {
  // Auth events
  USER_LOGIN = 'user.login',
  USER_LOGOUT = 'user.logout',
  USER_LOGIN_FAILED = 'user.login_failed',
  PASSWORD_RESET_REQUESTED = 'user.password_reset_requested',
  PASSWORD_RESET_COMPLETED = 'user.password_reset_completed',
  PASSWORD_CHANGED = 'user.password_changed',
  SESSION_REVOKED = 'user.session_revoked',
  ALL_SESSIONS_REVOKED = 'user.all_sessions_revoked',
  
  // Article events
  ARTICLE_CREATED = 'article.created',
  ARTICLE_UPDATED = 'article.updated',
  ARTICLE_DELETED = 'article.deleted',
  ARTICLE_STATUS_CHANGED = 'article.status_changed',
  ARTICLE_PUBLISHED = 'article.published',
  
  // Admin events
  USER_CREATED = 'admin.user_created',
  USER_UPDATED = 'admin.user_updated',
  USER_DELETED = 'admin.user_deleted',
  TENANT_CREATED = 'admin.tenant_created',
  TENANT_UPDATED = 'admin.tenant_updated',
  TENANT_DELETED = 'admin.tenant_deleted',
  SETTINGS_CHANGED = 'admin.settings_changed',
}

@Entity('audit_outbox')
@Index(['status', 'createdAt'])
@Index(['eventType', 'createdAt'])
export class AuditOutbox {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: AuditEventType })
  eventType: AuditEventType;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ type: 'varchar', length: 64 })
  entityType: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  entityId: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent: string | null;

  @Column({
    type: 'enum',
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
  })
  status: 'pending' | 'processing' | 'completed' | 'failed';

  @Column({ type: 'integer', default: 0 })
  retryCount: number;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  nextRetryAt: Date | null;
}

@Injectable()
export class AuditOutboxService implements OnModuleInit {
  private readonly logger = new Logger(AuditOutboxService.name);
  
  // Batch processing settings
  private readonly BATCH_SIZE = 100;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 5000;
  private readonly PROCESSOR_INTERVAL_MS = 1000;

  private isProcessing = false;
  private processorInterval: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(AuditOutbox)
    private outboxRepository: Repository<AuditOutbox>,
  ) {}

  /**
   * Start the background processor
   */
  onModuleInit() {
    this.startProcessor();
    this.logger.log('Audit outbox processor started');
  }

  /**
   * Stop the background processor
   */
  async onModuleDestroy() {
    this.stopProcessor();
    this.logger.log('Audit outbox processor stopped');
  }

  /**
   * Record an audit event
   */
  async recordEvent(params: {
    eventType: AuditEventType;
    payload: Record<string, any>;
    entityType: string;
    entityId?: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditOutbox> {
    const event = this.outboxRepository.create({
      eventType: params.eventType,
      payload: params.payload,
      entityType: params.entityType,
      entityId: params.entityId || null,
      userId: params.userId || null,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
      status: 'pending',
      retryCount: 0,
    });

    const saved = await this.outboxRepository.save(event);
    this.logger.debug(`Recorded audit event: ${params.eventType}`);
    
    return saved;
  }

  /**
   * Start the background processor
   */
  private startProcessor(): void {
    if (this.processorInterval) {
      return;
    }

    this.processorInterval = setInterval(
      () => this.processOutbox(),
      this.PROCESSOR_INTERVAL_MS
    );
  }

  /**
   * Stop the background processor
   */
  private stopProcessor(): void {
    if (this.processorInterval) {
      clearInterval(this.processorInterval);
      this.processorInterval = null;
    }
  }

  /**
   * Process pending events
   */
  private async processOutbox(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      // Get pending events
      const events = await this.outboxRepository.find({
        where: [
          { status: 'pending' as const },
          {
            status: 'failed' as const,
            nextRetryAt: LessThan(new Date()),
            retryCount: LessThan(this.MAX_RETRIES),
          },
        ],
        order: { createdAt: 'ASC' },
        take: this.BATCH_SIZE,
      });

      for (const event of events) {
        await this.processEvent(event);
      }
    } catch (error) {
      this.logger.error('Error processing outbox:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single event
   */
  private async processEvent(event: AuditOutbox): Promise<void> {
    try {
      // Mark as processing
      await this.outboxRepository.update(event.id, {
        status: 'processing',
      });

      // Publish to external systems (Elasticsearch, S3, etc.)
      await this.publishEvent(event);

      // Mark as completed
      await this.outboxRepository.update(event.id, {
        status: 'completed',
        processedAt: new Date(),
      });

      this.logger.debug(`Processed audit event: ${event.eventType}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Increment retry count
      const newRetryCount = event.retryCount + 1;
      const nextRetryAt = new Date(Date.now() + this.RETRY_DELAY_MS * newRetryCount);

      if (newRetryCount >= this.MAX_RETRIES) {
        // Mark as failed
        await this.outboxRepository.update(event.id, {
          status: 'failed',
          retryCount: newRetryCount,
          errorMessage,
          nextRetryAt,
        });
        
        this.logger.error(`Audit event ${event.id} failed permanently: ${errorMessage}`);
      } else {
        // Schedule retry
        await this.outboxRepository.update(event.id, {
          status: 'failed',
          retryCount: newRetryCount,
          errorMessage,
          nextRetryAt,
        });
        
        this.logger.warn(`Audit event ${event.id} failed, retry ${newRetryCount}: ${errorMessage}`);
      }
    }
  }

  /**
   * Publish event to external systems
   */
  private async publishEvent(event: AuditOutbox): Promise<void> {
    this.logger.log(`Publishing audit event: ${event.eventType}`, {
      eventId: event.id,
      entityType: event.entityType,
      entityId: event.entityId,
      userId: event.userId,
    });
  }

  /**
   * Get audit trail for an entity
   */
  async getEntityAuditTrail(
    entityType: string,
    entityId: string,
    limit: number = 100
  ): Promise<AuditOutbox[]> {
    return this.outboxRepository.find({
      where: { entityType, entityId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get audit trail for a user
   */
  async getUserAuditTrail(
    userId: string,
    limit: number = 100
  ): Promise<AuditOutbox[]> {
    return this.outboxRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get failed events for monitoring
   */
  async getFailedEvents(limit: number = 50): Promise<AuditOutbox[]> {
    return this.outboxRepository.find({
      where: { status: 'failed' },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  /**
   * Retry failed events manually
   */
  async retryFailedEvents(): Promise<number> {
    const events = await this.outboxRepository.find({
      where: { status: 'failed' },
      order: { createdAt: 'ASC' },
      take: this.BATCH_SIZE,
    });

    for (const event of events) {
      await this.outboxRepository.update(event.id, {
        status: 'pending',
        nextRetryAt: null,
      });
    }

    return events.length;
  }

  /**
   * Cleanup old completed events
   */
  async cleanupOldEvents(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    
    const result = await this.outboxRepository.delete({
      status: 'completed',
      createdAt: LessThan(cutoffDate),
    });

    this.logger.log(`Cleaned up ${result.affected} old audit events`);
    return result.affected || 0;
  }

  /**
   * Get outbox statistics
   */
  async getStatistics(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
  }> {
    const counts = await this.outboxRepository
      .createQueryBuilder('outbox')
      .select('outbox.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('outbox.status')
      .getRawMany();

    const stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      total: 0,
    };

    for (const row of counts) {
      stats[row.status] = parseInt(row.count, 10);
      stats.total += parseInt(row.count, 10);
    }

    return stats;
  }
}
