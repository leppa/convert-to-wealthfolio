/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { bgRed, bold, gray, green, italic, red, reset, yellow } from "colorette";

import { stringifyForLogging } from "./Utils";

/**
 * Log levels enumeration
 */
export enum LogLevel {
  FATAL = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  TRACE = 5,
}

export const DEFAULT_LOG_LEVEL = LogLevel.INFO;

function formatMessageWithArgs(message: string, args: unknown[]): string {
  if (args.length === 0) {
    return message;
  }

  const argStr = args.map(stringifyForLogging).join(" ");
  return `${message} ${argStr}`;
}

/**
 * Logger class with configurable log levels and colored output support
 *
 * This logger is designed to be used throughout the application, with a singleton instance
 * accessible via `Logger.getInstance()`. The log level can be configured globally using
 * `Logger.setLogLevel()`, and all log messages will be filtered accordingly. The logger supports
 * different log levels and outputs log messages to `stderr` with appropriate coloring for better
 * visibility.
 *
 * There is also a `message()` method for outputting messages to `stdout`, which is intended for
 * output of non-log messages intended for the user (i.e., prompts, command results, etc.).
 */
export class Logger {
  private static instance: Logger;
  private static logLevel: LogLevel = DEFAULT_LOG_LEVEL;

  private constructor() {
    // Private constructor to prevent direct instantiation
  }

  /**
   * Set the log level for all logger instances
   *
   * @param logLevel - Log level to set
   */
  static setLogLevel(logLevel: LogLevel): void {
    Logger.logLevel = logLevel;
    // Avoid creating an instance just to log the log level change that won't be shown
    if (logLevel < LogLevel.ERROR) {
      Logger.logLevel = LogLevel.WARN;
      this.getInstance().warn(
        `Levels below ${bold(this.getLogLevelName(LogLevel.ERROR))} ${italic("will")} hide important messages. Requested ${bold(this.getLogLevelName(logLevel))} log level, setting to ${bold(this.getLogLevelName(LogLevel.ERROR))} instead.`,
      );
      Logger.logLevel = LogLevel.ERROR;
    } else if (logLevel >= LogLevel.INFO) {
      this.getInstance().info(`Setting log level to ${bold(this.getLogLevelName(logLevel))}`);
    }
  }

  /**
   * Get the log level for all logger instances
   *
   * @return The current log level
   */
  static getLogLevel(): LogLevel {
    return Logger.logLevel;
  }

  /**
   * Get or create the singleton logger instance
   *
   * @return The singleton Logger instance
   */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Parse log level from string
   *
   * @param logLevel - Log level as string (e.g., "DEBUG", "INFO")
   * @returns LogLevel enum value corresponding to the input string
   */
  static parseLogLevel(logLevel: string): LogLevel {
    const upper = logLevel.toUpperCase();
    switch (upper) {
      case "FATAL":
        return LogLevel.FATAL;
      case "ERROR":
        return LogLevel.ERROR;
      case "WARN":
      case "WARNING":
        return LogLevel.WARN;
      case "INFO":
        return LogLevel.INFO;
      case "DEBUG":
        return LogLevel.DEBUG;
      case "TRACE":
        return LogLevel.TRACE;
      default:
        throw new Error(`Invalid log level: ${bold(logLevel)}`);
    }
  }

  /**
   * Get the name from the log level
   *
   * @param level - Log level enum value
   * @returns Log level name as string
   */
  static getLogLevelName(level: LogLevel): string {
    switch (level) {
      case LogLevel.FATAL:
        return "FATAL";
      case LogLevel.ERROR:
        return "ERROR";
      case LogLevel.WARN:
        return "WARN";
      case LogLevel.INFO:
        return "INFO";
      case LogLevel.DEBUG:
        return "DEBUG";
      case LogLevel.TRACE:
        return "TRACE";
      default:
        return "UNKNOWN";
    }
  }

  /**
   * Log a message to stdout regardless of log level settings
   *
   * This is useful for non-log output that should always be shown. E.g., when a command is expected
   * to output data to the user.
   */
  message(message: string, ...args: unknown[]): void {
    process.stdout.write(formatMessageWithArgs(message, args) + "\n");
  }

  /**
   * Log a trace message
   */
  trace(message: string, ...args: unknown[]): void {
    if (Logger.logLevel >= LogLevel.TRACE) {
      const prefix = gray("[TRACE]");
      const formattedMessage = gray(formatMessageWithArgs(message, args));
      process.stderr.write(`${prefix} ${formattedMessage}\n`);
    }
  }

  /**
   * Log a debug message
   */
  debug(message: string, ...args: unknown[]): void {
    if (Logger.logLevel >= LogLevel.DEBUG) {
      const prefix = gray("[DEBUG]");
      const formattedMessage = formatMessageWithArgs(message, args);
      process.stderr.write(`${prefix} ${formattedMessage}\n`);
    }
  }

  /**
   * Log an info message
   */
  info(message: string, ...args: unknown[]): void {
    if (Logger.logLevel >= LogLevel.INFO) {
      const prefix = green("[INFO ]");
      const formattedMessage = formatMessageWithArgs(message, args);
      process.stderr.write(`${prefix} ${formattedMessage}\n`);
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string, ...args: unknown[]): void {
    if (Logger.logLevel >= LogLevel.WARN) {
      const prefix = yellow("[WARN ]");
      const formattedMessage = formatMessageWithArgs(message, args);
      process.stderr.write(`${prefix} ${formattedMessage}\n`);
    }
  }

  /**
   * Log an error message
   */
  error(message: string, ...args: unknown[]): void {
    /* istanbul ignore else */ // Not possible to trigger else - can't set log level below ERROR
    if (Logger.logLevel >= LogLevel.ERROR) {
      const prefix = red("[ERROR]");
      const formattedMessage = red(formatMessageWithArgs(message, args));
      process.stderr.write(`${prefix} ${formattedMessage}\n`);
    }
  }

  /**
   * Log a fatal error message
   */
  fatal(message: string, ...args: unknown[]): void {
    /* istanbul ignore else */ // Not possible to trigger else - can't set log level below ERROR
    if (Logger.logLevel >= LogLevel.FATAL) {
      const prefix = "[FATAL]";
      const formattedMessage = formatMessageWithArgs(message, args);
      process.stderr.write(bgRed(`${prefix} ${formattedMessage}`) + reset("\n"));
    }
  }
}
