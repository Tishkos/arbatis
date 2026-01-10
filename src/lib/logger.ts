/**
 * Logging utility
 * Centralized logging for audit and debugging
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  userId?: string;
  metadata?: Record<string, unknown>;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private enableAudit = process.env.ENABLE_AUDIT_LOGGING !== 'false';

  private formatMessage(entry: LogEntry): string {
    const { level, message, timestamp, userId, metadata } = entry;
    const parts = [
      `[${timestamp.toISOString()}]`,
      `[${level.toUpperCase()}]`,
      message,
    ];
    
    if (userId) parts.push(`[User: ${userId}]`);
    if (metadata) parts.push(JSON.stringify(metadata));
    
    return parts.join(' ');
  }

  private log(level: LogLevel, message: string, userId?: string, metadata?: Record<string, unknown>) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      userId,
      metadata,
    };

    const formatted = this.formatMessage(entry);

    switch (level) {
      case 'error':
        console.error(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'debug':
        if (this.isDevelopment) {
          console.debug(formatted);
        }
        break;
      default:
        console.log(formatted);
    }

    // TODO: In production, send to logging service (e.g., Sentry, Datadog)
    // if (this.enableAudit && level === 'error') {
    //   await sendToLoggingService(entry);
    // }
  }

  info(message: string, userId?: string, metadata?: Record<string, unknown>) {
    this.log('info', message, userId, metadata);
  }

  warn(message: string, userId?: string, metadata?: Record<string, unknown>) {
    this.log('warn', message, userId, metadata);
  }

  error(message: string, userId?: string, metadata?: Record<string, unknown>) {
    this.log('error', message, userId, metadata);
  }

  debug(message: string, userId?: string, metadata?: Record<string, unknown>) {
    this.log('debug', message, userId, metadata);
  }

  /**
   * Audit log for critical operations
   */
  audit(
    action: string,
    entityType: string,
    entityId: string,
    userId: string,
    details?: Record<string, unknown>
  ) {
    this.log('info', `AUDIT: ${action}`, userId, {
      action,
      entityType,
      entityId,
      ...details,
    });
  }
}

export const logger = new Logger();

