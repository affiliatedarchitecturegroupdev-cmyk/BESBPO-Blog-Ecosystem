// Structured Logger for BESBPO Blog Platform
// Reference: Master Plan Section 7 - Observability
// 
// Provides consistent, structured logging across all services
// Outputs JSON format for easy parsing by log aggregators

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogContext {
  // Standard fields
  timestamp: string;
  level: LogLevel;
  message: string;
  
  // Service context
  service: string;
  version: string;
  environment: string;
  
  // Request context (set by middleware)
  requestId?: string;
  userId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  
  // HTTP context
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  
  // Resource context
  resourceType?: string;
  resourceId?: string;
  
  // Error context
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  
  // Additional metadata
  [key: string]: unknown;
}

export interface LoggerOptions {
  service: string;
  version: string;
  environment: string;
  minLevel?: LogLevel;
  redactKeys?: string[];
}

const DEFAULT_REDACT_KEYS = [
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'x-api-key',
  'apiKey',
  'accessToken',
  'refreshToken',
];

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
    this.redactKeys = new Set([
      ...DEFAULT_REDACT_KEYS,
      ...(options.redactKeys || []),
    ]);
  }

  private shouldLog(level: LogLevel): boolean {
    return (
      StructuredLogger.levelPriority[level] >=
      StructuredLogger.levelPriority[this.minLevel]
    );
  }

  private redact(value: unknown, key?: string): unknown {
    if (key && this.redactKeys.has(key.toLowerCase())) {
      return '[REDACTED]';
    }
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        return value.map((item) => this.redact(item));
      }
      const redacted: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        redacted[k] = this.redact(v, k);
      }
      return redacted;
    }
    return value;
  }

  private formatLog(
    level: LogLevel,
    message: string,
    context: Partial<LogContext> = {}
  ): LogContext {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.service,
      version: this.version,
      environment: this.environment,
      ...this.redact(context),
    } as LogContext;
  }

  private output(log: LogContext): void {
    // Console output in development
    if (this.environment === 'development') {
      const { level, message, ...meta } = log;
      const color = {
        debug: '\x1b[36m',   // cyan
        info: '\x1b[32m',   // green
        warn: '\x1b[33m',   // yellow
        error: '\x1b[31m',  // red
      }[level] || '\x1b[0m';
      
      console.log(
        `${color}[${log.level.toUpperCase()}]${'\x1b[0m'} ${log.message}`,
        Object.keys(meta).length > 4 ? meta : ''
      );
    }

    // JSON output for production (sent to log aggregator)
    if (this.environment === 'production') {
      console.log(JSON.stringify(log));
    }
  }

  debug(message: string, context?: Partial<LogContext>): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    this.output(this.formatLog(LogLevel.DEBUG, message, context));
  }

  info(message: string, context?: Partial<LogContext>): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    this.output(this.formatLog(LogLevel.INFO, message, context));
  }

  warn(message: string, context?: Partial<LogContext>): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    this.output(this.formatLog(LogLevel.WARN, message, context));
  }

  error(message: string, error?: Error, context?: Partial<LogContext>): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    
    const errorContext: Partial<LogContext> = error
      ? {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        }
      : {};

    this.output(this.formatLog(LogLevel.ERROR, message, { ...context, ...errorContext }));
  }

  // Request logging helper
  logRequest(req: {
    method: string;
    path: string;
    ip?: string;
    headers?: Record<string, string>;
  }, res: {
    statusCode: number;
  }, durationMs: number, requestId: string): void {
    this.info('HTTP Request', {
      requestId,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
      statusCode: res.statusCode,
      durationMs,
    });
  }

  // Child logger with additional context
  child(additionalContext: Record<string, unknown>): ChildLogger {
    return new ChildLogger(this, additionalContext);
  }
}

export class ChildLogger {
  private parent: StructuredLogger;
  private context: Record<string, unknown>;

  constructor(parent: StructuredLogger, context: Record<string, unknown>) {
    this.parent = parent;
    this.context = context;
  }

  debug(message: string, context?: Partial<LogContext>): void {
    this.parent.debug(message, { ...this.context, ...context });
  }

  info(message: string, context?: Partial<LogContext>): void {
    this.parent.info(message, { ...this.context, ...context });
  }

  warn(message: string, context?: Partial<LogContext>): void {
    this.parent.warn(message, { ...this.context, ...context });
  }

  error(message: string, error?: Error, context?: Partial<LogContext>): void {
    this.parent.error(message, error, { ...this.context, ...context });
  }
}

// Factory function for creating loggers
export function createLogger(options: LoggerOptions): StructuredLogger {
  return new StructuredLogger(options);
}

// Default logger instance (can be overridden)
export const logger = new StructuredLogger({
  service: process.env.SERVICE_NAME || 'cms-api',
  version: process.env.SERVICE_VERSION || '1.0.0',
  environment: process.env.NODE_ENV || 'development',
  minLevel: process.env.LOG_LEVEL as LogLevel || LogLevel.INFO,
});

// Express middleware for request logging
export function requestLoggerMiddleware(
  req: { method: string; path: string; ip?: string; headers: Record<string, string> },
  res: { statusCode: number },
  next: () => void
): void {
  const requestId = req.headers['x-request-id'] as string || generateRequestId();
  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    logger.logRequest(req, res, durationMs, requestId);
  });

  next();
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
