// Password Reset Service
// Reference: Master Plan Section 7 - Auth & Enterprise

import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';

interface PasswordResetToken {
  userId: string;
  token: string;
  expiresAt: Date;
}

@Injectable()
export class PasswordResetService {
  // In-memory store for tokens (use Redis in production)
  private resetTokens: Map<string, PasswordResetToken> = new Map();

  // Token expiry time in minutes
  private readonly TOKEN_EXPIRY = 60;

  // Token length
  private readonly TOKEN_LENGTH = 32;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private configService: ConfigService,
  ) {}

  /**
   * Generate a password reset token and send email
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    // Always return success to prevent email enumeration
    // But only actually generate token if user exists
    if (!user) {
      console.log(`Password reset requested for non-existent email: ${email}`);
      return;
    }

    // Generate reset token
    const token = crypto.randomBytes(this.TOKEN_LENGTH).toString('hex');
    const expiresAt = new Date(Date.now() + this.TOKEN_EXPIRY * 60 * 1000);

    // Store token
    this.resetTokens.set(token, {
      userId: user.id,
      token,
      expiresAt,
    });

    // Send email (in production, integrate with email service)
    await this.sendResetEmail(user.email, token);

    console.log(`Password reset token generated for user: ${user.email}`);
  }

  /**
   * Validate a password reset token
   */
  async validateResetToken(token: string): Promise<boolean> {
    const resetData = this.resetTokens.get(token);

    if (!resetData) {
      return false;
    }

    if (new Date() > resetData.expiresAt) {
      this.resetTokens.delete(token);
      return false;
    }

    return true;
  }

  /**
   * Reset password using token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const resetData = this.resetTokens.get(token);

    if (!resetData) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (new Date() > resetData.expiresAt) {
      this.resetTokens.delete(token);
      throw new BadRequestException('Reset token has expired');
    }

    // Validate password strength
    this.validatePasswordStrength(newPassword);

    // Find user
    const user = await this.userRepository.findOne({
      where: { id: resetData.userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await this.userRepository.update(user.id, {
      passwordHash,
      updatedAt: new Date(),
    });

    // Delete token (one-time use)
    this.resetTokens.delete(token);

    // Invalidate all sessions for this user
    // This would interact with the session management service

    console.log(`Password reset completed for user: ${user.email}`);
  }

  /**
   * Validate password strength
   */
  private validatePasswordStrength(password: string): void {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (errors.length > 0) {
      throw new BadRequestException(errors.join('. '));
    }
  }

  /**
   * Send reset email (placeholder - integrate with email service)
   */
  private async sendResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${this.configService.get('APP_URL')}/reset-password?token=${token}`;
    
    // In production, integrate with email service (SendGrid, SES, etc.)
    console.log(`
      =====================================
      PASSWORD RESET EMAIL
      =====================================
      To: ${email}
      Subject: Reset your password
      
      Click the link below to reset your password:
      ${resetUrl}
      
      This link expires in ${this.TOKEN_EXPIRY} minutes.
      =====================================
    `);

    // Example SendGrid integration:
    // await this.emailService.send({
    //   to: email,
    //   subject: 'Reset your password',
    //   html: `
    //     <h1>Password Reset</h1>
    //     <p>Click <a href="${resetUrl}">here</a> to reset your password.</p>
    //     <p>This link expires in ${this.TOKEN_EXPIRY} minutes.</p>
    //   `,
    // });
  }

  /**
   * Clean up expired tokens
   */
  cleanupExpiredTokens(): void {
    const now = new Date();
    for (const [token, data] of this.resetTokens.entries()) {
      if (now > data.expiresAt) {
        this.resetTokens.delete(token);
      }
    }
  }
}
