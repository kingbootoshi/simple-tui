import { createLogger, format, transports, Logger } from 'winston';

/**
 * Create and export a pre-configured Winston logger instance.
 *
 * Why: Centralize logging config for consistent, structured logs across the codebase.
 * How: Attach timestamp, label, level, and message with JSON in prod and colorized console in dev.
 */
const isProduction: boolean = process.env.NODE_ENV === 'production';

// Configure a readable console formatter for development
const developmentFormat = format.combine(
  format.colorize(),
  format.timestamp(),
  format.printf(({ level, message, timestamp, ...meta }) => {
    const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}] ${message}${metaString}`;
  })
);

// Configure JSON logs for production (better for aggregators)
const productionFormat = format.combine(format.timestamp(), format.json());

const logger: Logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: isProduction ? productionFormat : developmentFormat,
  transports: [
    new transports.Console({
      handleExceptions: true,
    }),
  ],
  exitOnError: false,
});

export default logger;


