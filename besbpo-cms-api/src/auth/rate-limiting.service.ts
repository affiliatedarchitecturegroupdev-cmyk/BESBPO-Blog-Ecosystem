// Rate Limiting Service
// Reference: Master Plan Section 7 - Auth & Enterprise
// Implements login rate limiting to prevent brute force attacks

import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
}

@Injectable()
export class RateLimitingService {
  // Default rate limits
  private readonly limits: Record<string, RateLimitConfig> = {
    login: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5,            // 5 attempts per window
    },
    passwordReset: {
      windowMs: 60 * 60 * 1000,  // 1 hour
      maxRequests: 3,            // 3 requests per hour
    },
    api: {
      windowMs: 60 * 1000,        // 1 minute
      maxRequests: 60,           // 60 requests per minute
    },
    passwordChange: {
      windowMs: 60 * 60 * 1000,  // 1 hour
      maxRequests: 5,            // 5 changes per hour
    },
  };

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
  ) {}

  /**
   * Check if request is within rate limit
   */
  async checkRateLimit(
    identifier: string,
    action: string = 'api'
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const config = this.limits[action] || this.limits.api;
    const key = `ratelimit:${action}:${identifier}`;

    try {
      const current = await this.redisService.get(key);
      const count = current ? parseInt(current, 10) : 0;
      const now = Date.now();
      const windowStart = now - config.windowMs;

      // Calculate reset time
      const ttl = await this.redisService.ttl(key);
      const resetTime = ttl > 0 ? now + ttl * 1000 : now + config.windowMs;

      if (count >= config.maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          resetTime,
        };
      }

      return {
        allowed: true,
        remaining: config.maxRequests - count - 1,
        resetTime,
      };
    } catch (error) {
      // If Redis fails, allow the request (fail open)
      console.error('Rate limit check failed:', error);
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetTime: Date.now() + config.windowMs,
      };
    }
  }

  /**
   * Increment rate limit counter
   */
  async incrementRateLimit(
    identifier: string,
    action: string = 'api'
  ): Promise<void> {
    const config = this.limits[action] || this.limits.api;
    const key = `ratelimit:${action}:${identifier}`;

    try {
      const exists = await this.redisService.exists(key);
      
      if (exists) {
        await this.redisService.incr(key);
      } else {
        await this.redisService.setex(key, Math.ceil(config.windowMs / 1000), '1');
      }
    } catch (error) {
      // Log but don't fail the request
      console.error('Rate limit increment failed:', error);
    }
  }

  /**
   * Check and increment rate limit atomically
   */
  async consumeRateLimit(
    identifier: string,
    action: string = 'api'
  ): Promise<void> {
    const result = await this.checkRateLimit(identifier, action);

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please try again later.',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
        {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': result.resetTime.toString(),
        }
      );
    }

    await this.incrementRateLimit(identifier, action);
  }

  /**
   * Reset rate limit for an identifier
   */
  async resetRateLimit(identifier: string, action: string): Promise<void> {
    const key = `ratelimit:${action}:${identifier}`;
    try {
      await this.redisService.del(key);
    } catch (error) {
      console.error('Rate limit reset failed:', error);
    }
  }

  /**
   * Get current rate limit status
   */
  async getRateLimitStatus(
    identifier: string,
    action: string = 'api'
  ): Promise<{
    count: number;
    limit: number;
    remaining: number;
    resetTime: number;
  }> {
    const config = this.limits[action] || this.limits.api;
    const key = `ratelimit:${action}:${identifier}`;

    try {
      const current = await this.redisService.get(key);
      const count = current ? parseInt(current, 10) : 0;
      const ttl = await this.redisService.ttl(key);
      const resetTime = ttl > 0 ? Date.now() + ttl * 1000 : Date.now() + config.windowMs;

      return {
        count,
        limit: config.maxRequests,
        remaining: Math.max(0, config.maxRequests - count),
        resetTime,
      };
    } catch (error) {
      console.error('Get rate limit status failed:', error);
      return {
        count: 0,
        limit: config.maxRequests,
        remaining: config.maxRequests,
        resetTime: Date.now() + config.windowMs,
      };
    }
  }
}
