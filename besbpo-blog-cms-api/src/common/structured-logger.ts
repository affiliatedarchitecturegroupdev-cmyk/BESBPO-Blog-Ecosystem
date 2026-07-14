// Structured Logger for BESBPO Blog Platform
// Reference: Master Plan Section 7 - Observability
//
// Provides consistent, structured logging across all services

import { Request, Response, NextFunction } from 'express';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogContext {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  version: string;
  environment: string;
  requestId?: string;
  userId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  ip?: string;
  userAgent?: string;
  error?: { name: string; message: string; stack?: string };
  [key: string]: unknown;
}

export interface LoggerOptions {
  service: string;
  version: string;
  environment: string;
  minLevel?: LogLevel;
  redactKeys?: string[];
}

const DEFAULT_REDACT_KEYS = ['password', 'token', 'secret', 'authorization', 'cookie', 'x-api-key', 'apiKey', 'accessToken', 'refreshToken'];

export class StructuredLogger {
  private service: string;
  private version: string;
  private environment: string;
  private minLevel: LogLevel;
  private redactKeys: Set<string>;

  private static levelPriority: Record<LogLevel, number> = {
    [LogLevel.DEBUG]: 0,
    [LogLevel.INFO]: 1,
    [LogLevel.WARN]: 2,
    [LogLevel.ERROR]: 3,
  };

  constructor(options: LoggerOptions) {
    this.service = options.service;
    this.version = options.version;
    this.environment = options.environment || 'development';
    this.minLevel = options.minLevel || LogLevel.INFO;
    this.redactKeys = new Set([...DEFAULT_REDACT_KEYS, ...(options.redactKeys || [])]);
  }

  private shouldLog(level: LogLevel): boolean {
    return StructuredLogger.levelPriority[level] >= StructuredLogger.levelPriority[this.minLevel];
  }

  private redactValue(value: unknown): unknown {
    if (typeof value === 'string' && this.redactKeys.has(value.toLowerCase())) {
      return '[REDACTED]';
    }
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = this.redactValue(v);
      }
      return result;
    }
    return value;
  }

  private formatLog(level: LogLevel, message: string, context: Partial<LogContext> = {}): LogContext {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.service,
      version: this.version,
      environment: this.environment,
      ...this.redactValue(context) as Partial<LogContext>,
    };
  }

  private output(log: LogContext): void {
    if (this.environment === 'development') {
      const color = { debug: '\x1b[36m', info: '\x1b[32m', warn: '\x1b[33m', error: '\x1b[31m' }[log.level] || '\x1b[0m';
      console.log(`${color}[${log.level.toUpperCase()}]${'\x1b[0m'} ${log.message}`);
    } else {
      console.log(JSON.stringify(log));
    }
  }

  debug(message: string, context?: Partial<LogContext>): void {
    if (this.shouldLog(LogLevel.DEBUG)) this.output(this.formatLog(LogLevel.DEBUG, message, context));
  }

  info(message: string, context?: Partial<LogContext>): void {
    if (this.shouldLog(LogLevel.INFO)) this.output(this.formatLog(LogLevel.INFO, message, context));
  }

  warn(message: string, context?: Partial<LogContext>): void {
    if (this.shouldLog(LogLevel.WARN)) this.output(this.formatLog(LogLevel.WARN, message, context));
  }

  error(message: string, context?: Partial<LogContext>): void {
    if (this.shouldLog(LogLevel.ERROR)) this.output(this.formatLog(LogLevel.ERROR, message, context));
  }

  logRequest(req: Request, res: Response, durationMs: number, requestId: string): void {
    const context: Partial<LogContext> = {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };
    const level = res.statusCode >= 500 ? LogLevel.ERROR : res.statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    this.output(this.formatLog(level, `${req.method} ${req.path}`, context));
  }

  child(additionalContext: Partial<LogContext>): { debug: (msg: string, ctx?: Partial<LogContext>) => void; info: (msg: string, ctx?: Partial<LogContext>) => void; warn: (msg: string, ctx?: Partial<LogContext>) => void; error: (msg: string, ctx?: Partial<LogContext>) => void } {
    const parent = this;
    return {
      debug(msg: string, ctx?: Partial<LogContext>) { parent.debug(msg, { ...additionalContext, ...ctx }); },
      info(msg: string, ctx?: Partial<LogContext>) { parent.info(msg, { ...additionalContext, ...ctx }); },
      warn(msg: string, ctx?: Partial<LogContext>) { parent.warn(msg, { ...additionalContext, ...ctx }); },
      error(msg: string, ctx?: Partial<LogContext>) { parent.error(msg, { ...additionalContext, ...ctx }); },
    };
  }
}

export const logger = new StructuredLogger({
  service: 'cms-api',
  version: '1.0.0',
  environment: process.env.NODE_ENV || 'development',
});

export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const start = Date.now();
  res.setHeader('x-request-id', requestId);
  
  res.on('finish', function() {
    const durationMs = Date.now() - start;
    logger.logRequest(req, res, durationMs, requestId);
  });
  
  next();
}
