// Session Management Service
// Reference: Master Plan Section 7 - Auth & Enterprise
// Handles session creation, validation, and revocation

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import * as crypto from 'crypto';

export interface Session {
  id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  lastAccessedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  revoked: boolean;
  revokedAt?: Date;
}

export interface CreateSessionOptions {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class SessionManagementService {
  // Session expiry time (7 days in seconds)
  private readonly SESSION_TTL = 7 * 24 * 60 * 60;

  // Refresh token expiry (30 days in seconds)
  private readonly REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60;

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
  ) {}

  /**
   * Create a new session
   */
  async createSession(options: CreateSessionOptions): Promise<{
    sessionId: string;
    refreshToken: string;
    accessToken: string;
    expiresAt: Date;
  }> {
    const sessionId = this.generateSessionId();
    const refreshToken = this.generateRefreshToken();
    const accessToken = this.generateAccessToken(sessionId);
    const expiresAt = new Date(Date.now() + this.SESSION_TTL * 1000);

    const session: Session = {
      id: sessionId,
      userId: options.userId,
      createdAt: new Date(),
      expiresAt,
      lastAccessedAt: new Date(),
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      revoked: false,
    };

    // Store session in Redis
    await this.redisService.setex(
      `session:${sessionId}`,
      this.SESSION_TTL,
      JSON.stringify(session)
    );

    // Store refresh token mapping
    await this.redisService.setex(
      `refresh:${refreshToken}`,
      this.REFRESH_TOKEN_TTL,
      JSON.stringify({ sessionId, userId: options.userId })
    );

    // Add session to user's session set
    await this.redisService.sadd(`user:${options.userId}:sessions`, sessionId);

    return {
      sessionId,
      refreshToken,
      accessToken,
      expiresAt,
    };
  }

  /**
   * Validate a session
   */
  async validateSession(sessionId: string): Promise<Session | null> {
    const sessionData = await this.redisService.get(`session:${sessionId}`);
    
    if (!sessionData) {
      return null;
    }

    const session: Session = JSON.parse(sessionData);

    // Check if session is expired or revoked
    if (session.revoked || new Date() > new Date(session.expiresAt)) {
      await this.revokeSession(sessionId);
      return null;
    }

    // Update last accessed time
    session.lastAccessedAt = new Date();
    await this.redisService.setex(
      `session:${sessionId}`,
      this.SESSION_TTL,
      JSON.stringify(session)
    );

    return session;
  }

  /**
   * Refresh an access token using a refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresAt: Date;
  } | null> {
    const refreshData = await this.redisService.get(`refresh:${refreshToken}`);
    
    if (!refreshData) {
      return null;
    }

    const { sessionId } = JSON.parse(refreshData);
    const session = await this.validateSession(sessionId);

    if (!session) {
      return null;
    }

    const accessToken = this.generateAccessToken(sessionId);
    const expiresAt = new Date(Date.now() + this.SESSION_TTL * 1000);

    return { accessToken, expiresAt };
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string): Promise<boolean> {
    const sessionData = await this.redisService.get(`session:${sessionId}`);
    
    if (!sessionData) {
      return false;
    }

    const session: Session = JSON.parse(sessionData);
    session.revoked = true;
    session.revokedAt = new Date();

    // Update session to revoked state (with short TTL for cleanup)
    await this.redisService.setex(
      `session:${sessionId}`,
      3600, // Keep for 1 hour for audit purposes
      JSON.stringify(session)
    );

    // Remove from user's session set
    await this.redisService.srem(`user:${session.userId}:sessions`, sessionId);

    return true;
  }

  /**
   * Revoke all sessions for a user (except current)
   */
  async revokeAllUserSessions(
    userId: string,
    exceptSessionId?: string
  ): Promise<number> {
    const sessionIds = await this.redisService.smembers(`user:${userId}:sessions`);
    
    let revokedCount = 0;
    for (const sessionId of sessionIds) {
      if (sessionId !== exceptSessionId) {
        await this.revokeSession(sessionId);
        revokedCount++;
      }
    }

    return revokedCount;
  }

  /**
   * Revoke all sessions for a user (including current)
   */
  async revokeAllSessions(userId: string): Promise<number> {
    return this.revokeAllUserSessions(userId);
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<Session[]> {
    const sessionIds = await this.redisService.smembers(`user:${userId}:sessions`);
    const sessions: Session[] = [];

    for (const sessionId of sessionIds) {
      const session = await this.validateSession(sessionId);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Get session count for a user
   */
  async getUserSessionCount(userId: string): Promise<number> {
    const sessions = await this.getUserSessions(userId);
    return sessions.length;
  }

  /**
   * Cleanup expired sessions (maintenance)
   */
  async cleanupExpiredSessions(): Promise<void> {
    // This is handled automatically by Redis TTL
    // This method is for any additional cleanup if needed
    console.log('Session cleanup triggered');
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate refresh token
   */
  private generateRefreshToken(): string {
    return crypto.randomBytes(48).toString('hex');
  }

  /**
   * Generate access token (JWT would be used in production)
   */
  private generateAccessToken(sessionId: string): string {
    // In production, this would create a proper JWT
    const payload = {
      sessionId,
      type: 'access',
      iat: Date.now(),
    };
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }
}
