// Winston logger configuration
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} [${info.level}]: ${info.message}`
  )
);

// Production log format (JSON)
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define transports
const transports = [];

// Console transport (always enabled)
transports.push(
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' ? productionFormat : format,
  })
);

// File transports for production
if (process.env.NODE_ENV === 'production') {
  // Error logs
  transports.push(
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d',
      format: productionFormat,
    })
  );

  // Combined logs
  transports.push(
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '7d',
      format: productionFormat,
    })
  );

  // HTTP request logs
  transports.push(
    new DailyRotateFile({
      filename: 'logs/http-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'http',
      maxSize: '20m',
      maxFiles: '3d',
      format: productionFormat,
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  levels,
  transports,
  // Don't exit on uncaught errors
  exitOnError: false,
});

// Stream for Morgan HTTP logger
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

// Log unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

// Log uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Give the logger time to write before exiting
  setTimeout(() => process.exit(1), 1000);
});

// Express middleware for request logging
export function requestLogger(req, res, next) {
  const start = Date.now();
  
  // Log request
  logger.http(`${req.method} ${req.url}`, {
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
  });
  
  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http(`${req.method} ${req.url} ${res.statusCode} ${duration}ms`, {
      statusCode: res.statusCode,
      duration,
      contentLength: res.get('content-length'),
    });
  });
  
  next();
}

// API-specific logging functions
export function logApiRequest(endpoint, data) {
  logger.info(`API Request: ${endpoint}`, {
    endpoint,
    ...data,
  });
}

export function logApiError(endpoint, error, context = {}) {
  logger.error(`API Error: ${endpoint}`, {
    endpoint,
    error: {
      message: error.message,
      stack: error.stack,
      code: error.code,
    },
    ...context,
  });
}

export function logApiResponse(endpoint, statusCode, duration) {
  logger.info(`API Response: ${endpoint}`, {
    endpoint,
    statusCode,
    duration,
  });
}

// Security event logging
export function logSecurityEvent(event, details) {
  logger.warn(`Security Event: ${event}`, {
    event,
    ...details,
    timestamp: new Date().toISOString(),
  });
}

// Performance logging
export function logPerformance(metric, value, context = {}) {
  logger.info(`Performance: ${metric}`, {
    metric,
    value,
    ...context,
  });
}

// Chat-specific logging
export function logChatRequest(sessionId, model, messageLength) {
  logger.info('Chat Request', {
    sessionId,
    model,
    messageLength,
    timestamp: new Date().toISOString(),
  });
}

export function logChatResponse(sessionId, success, responseTime) {
  logger.info('Chat Response', {
    sessionId,
    success,
    responseTime,
    timestamp: new Date().toISOString(),
  });
}

// Rate limit logging
export function logRateLimit(ip, endpoint) {
  logger.warn('Rate Limit Exceeded', {
    ip,
    endpoint,
    timestamp: new Date().toISOString(),
  });
}

// Export logger instance
export default logger;