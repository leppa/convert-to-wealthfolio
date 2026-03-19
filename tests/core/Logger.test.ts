/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { DEFAULT_LOG_LEVEL, Logger, LogLevel } from "../../src/core/Logger";

describe("Logger", () => {
  let stderrSpy: jest.SpyInstance;
  let stdoutSpy: jest.SpyInstance;

  beforeEach(() => {
    // Suppress "Setting log level to INFO" message to reduce noise in test output
    const suppressLogMessage = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
    // Reset logger to default state before each test
    Logger.setLogLevel(DEFAULT_LOG_LEVEL);
    suppressLogMessage.mockRestore();

    // Spy on stderr and stdout
    stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
    stdoutSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();
  });

  describe("Singleton pattern", () => {
    it("should return the same instance", () => {
      const instance1 = Logger.getInstance();
      const instance2 = Logger.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe("parseLogLevel", () => {
    it("should parse valid log level strings", () => {
      expect(Logger.parseLogLevel("TRACE")).toBe(LogLevel.TRACE);
      expect(Logger.parseLogLevel("DEBUG")).toBe(LogLevel.DEBUG);
      expect(Logger.parseLogLevel("INFO")).toBe(LogLevel.INFO);
      expect(Logger.parseLogLevel("WARN")).toBe(LogLevel.WARN);
      expect(Logger.parseLogLevel("WARNING")).toBe(LogLevel.WARN);
      expect(Logger.parseLogLevel("ERROR")).toBe(LogLevel.ERROR);
      expect(Logger.parseLogLevel("FATAL")).toBe(LogLevel.FATAL);
    });

    it("should parse case-insensitive log level strings", () => {
      expect(Logger.parseLogLevel("trace")).toBe(LogLevel.TRACE);
      expect(Logger.parseLogLevel("DeBuG")).toBe(LogLevel.DEBUG);
      expect(Logger.parseLogLevel("info")).toBe(LogLevel.INFO);
      expect(Logger.parseLogLevel("warning")).toBe(LogLevel.WARN);
    });

    it("should throw error for invalid log level", () => {
      expect(() => Logger.parseLogLevel("INVALID")).toThrow("Invalid log level:");
      expect(() => Logger.parseLogLevel("")).toThrow("Invalid log level:");
      expect(() => Logger.parseLogLevel("test")).toThrow("Invalid log level:");
    });
  });

  describe("getLogLevelName", () => {
    it("should return correct name for each log level", () => {
      expect(Logger.getLogLevelName(LogLevel.TRACE)).toBe("TRACE");
      expect(Logger.getLogLevelName(LogLevel.DEBUG)).toBe("DEBUG");
      expect(Logger.getLogLevelName(LogLevel.INFO)).toBe("INFO");
      expect(Logger.getLogLevelName(LogLevel.WARN)).toBe("WARN");
      expect(Logger.getLogLevelName(LogLevel.ERROR)).toBe("ERROR");
      expect(Logger.getLogLevelName(LogLevel.FATAL)).toBe("FATAL");
    });

    it("should return UNKNOWN for invalid log level", () => {
      expect(Logger.getLogLevelName(999 as LogLevel)).toBe("UNKNOWN");
    });
  });

  describe("setLogLevel and getLogLevel", () => {
    it("should set and get log level", () => {
      Logger.setLogLevel(LogLevel.DEBUG);
      expect(Logger.getLogLevel()).toBe(LogLevel.DEBUG);

      Logger.setLogLevel(LogLevel.ERROR);
      expect(Logger.getLogLevel()).toBe(LogLevel.ERROR);
    });

    it("should log info message when setting log level to INFO or below", () => {
      stderrSpy.mockClear();

      Logger.setLogLevel(LogLevel.TRACE);
      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("[INFO ]"));
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Setting log level to"));
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("TRACE"));

      stderrSpy.mockClear();
      Logger.setLogLevel(LogLevel.INFO);
      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("INFO"));
    });

    it("should not log when setting log level above INFO", () => {
      stderrSpy.mockClear();

      Logger.setLogLevel(LogLevel.WARN);
      expect(stderrSpy).not.toHaveBeenCalled();

      Logger.setLogLevel(LogLevel.ERROR);
      expect(stderrSpy).not.toHaveBeenCalled();
    });

    it("should cap log level at ERROR and warn when attempting to set above ERROR", () => {
      stderrSpy.mockClear();

      Logger.setLogLevel(LogLevel.FATAL);
      expect(Logger.getLogLevel()).toBe(LogLevel.ERROR);
      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("[WARN ]"));
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("hide important messages"));
    });
  });

  describe("message", () => {
    it("should write to stdout", () => {
      const logger = Logger.getInstance();
      logger.message("Test message");

      expect(stdoutSpy).toHaveBeenCalledWith("Test message\n");
      expect(stderrSpy).not.toHaveBeenCalled();
    });

    it("should format message with arguments", () => {
      const logger = Logger.getInstance();
      logger.message("Test", "with", "args");

      expect(stdoutSpy).toHaveBeenCalledWith("Test with args\n");
    });

    it("should format message with object arguments", () => {
      const logger = Logger.getInstance();
      logger.message("Data:", { key: "value" });

      expect(stdoutSpy).toHaveBeenCalledWith('Data: {"key":"value"}\n');
    });

    it("should always output regardless of log level", () => {
      const logger = Logger.getInstance();
      Logger.setLogLevel(LogLevel.ERROR);
      stdoutSpy.mockClear();

      logger.message("Always shown");

      expect(stdoutSpy).toHaveBeenCalledWith("Always shown\n");
    });
  });

  describe("trace", () => {
    it("should write to stderr when log level is TRACE", () => {
      Logger.setLogLevel(LogLevel.TRACE);
      stderrSpy.mockClear();

      const logger = Logger.getInstance();
      logger.trace("Trace message");

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("[TRACE]"));
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Trace message"));
    });

    it("should not write when log level is above TRACE", () => {
      Logger.setLogLevel(LogLevel.DEBUG);
      stderrSpy.mockClear();

      const logger = Logger.getInstance();
      logger.trace("Trace message");

      expect(stderrSpy).not.toHaveBeenCalled();
    });

    it("should format message with arguments", () => {
      Logger.setLogLevel(LogLevel.TRACE);
      stderrSpy.mockClear();

      const logger = Logger.getInstance();
      logger.trace("Trace", "with", "args");

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Trace with args"));
    });
  });

  describe("debug", () => {
    it("should write to stderr when log level is DEBUG or below", () => {
      Logger.setLogLevel(LogLevel.DEBUG);
      stderrSpy.mockClear();

      const logger = Logger.getInstance();
      logger.debug("Debug message");

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("[DEBUG]"));
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Debug message"));
    });

    it("should not write when log level is above DEBUG", () => {
      Logger.setLogLevel(LogLevel.INFO);
      stderrSpy.mockClear();

      const logger = Logger.getInstance();
      logger.debug("Debug message");

      expect(stderrSpy).not.toHaveBeenCalled();
    });

    it("should format message with arguments", () => {
      Logger.setLogLevel(LogLevel.DEBUG);
      stderrSpy.mockClear();

      const logger = Logger.getInstance();
      logger.debug("Debug", 123, { test: true });

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('Debug 123 {"test":true}'));
    });
  });

  describe("info", () => {
    it("should write to stderr when log level is INFO or below", () => {
      Logger.setLogLevel(LogLevel.INFO);
      stderrSpy.mockClear();

      const logger = Logger.getInstance();
      logger.info("Info message");

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("[INFO ]"));
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Info message"));
    });

    it("should not write when log level is above INFO", () => {
      Logger.setLogLevel(LogLevel.WARN);
      stderrSpy.mockClear();

      const logger = Logger.getInstance();
      logger.info("Info message");

      expect(stderrSpy).not.toHaveBeenCalled();
    });

    it("should format message with arguments", () => {
      Logger.setLogLevel(LogLevel.INFO);
      stderrSpy.mockClear();

      const logger = Logger.getInstance();
      logger.info("Status:", "active");

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Status: active"));
    });
  });

  describe("warn", () => {
    it("should write to stderr when log level is WARN or below", () => {
      Logger.setLogLevel(LogLevel.WARN);
      stderrSpy.mockClear();

      const logger = Logger.getInstance();
      logger.warn("Warning message");

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("[WARN ]"));
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Warning message"));
    });

    it("should not write when log level is above WARN", () => {
      Logger.setLogLevel(LogLevel.ERROR);
      stderrSpy.mockClear();

      const logger = Logger.getInstance();
      logger.warn("Warning message");

      expect(stderrSpy).not.toHaveBeenCalled();
    });

    it("should format message with arguments", () => {
      Logger.setLogLevel(LogLevel.WARN);
      stderrSpy.mockClear();

      const logger = Logger.getInstance();
      logger.warn("Warning:", { code: 123 });

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('Warning: {"code":123}'));
    });
  });

  describe("error", () => {
    it("should always write to stderr", () => {
      Logger.setLogLevel(LogLevel.ERROR);
      stderrSpy.mockClear();

      const logger = Logger.getInstance();
      logger.error("Error message");

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("[ERROR]"));
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Error message"));
    });

    it("should format message with arguments", () => {
      Logger.setLogLevel(LogLevel.ERROR);
      stderrSpy.mockClear();

      const logger = Logger.getInstance();
      logger.error("Error code:", 500);

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Error code: 500"));
    });
  });

  describe("fatal", () => {
    it("should always write to stderr", () => {
      Logger.setLogLevel(LogLevel.FATAL);
      stderrSpy.mockClear();

      const logger = Logger.getInstance();
      logger.fatal("Fatal error");

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("[FATAL]"));
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Fatal error"));
    });

    it("should format message with arguments", () => {
      Logger.setLogLevel(LogLevel.FATAL);
      stderrSpy.mockClear();

      const logger = Logger.getInstance();
      logger.fatal("Critical:", { error: "system failure" });

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('Critical: {"error":"system failure"}'),
      );
    });
  });

  describe("Argument formatting", () => {
    it("should handle multiple primitive arguments", () => {
      Logger.setLogLevel(LogLevel.INFO);
      stderrSpy.mockClear();

      const logger = Logger.getInstance();
      logger.info("Values:", 1, "text", true);

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Values: 1 text true"));
    });

    it("should handle BigInt values", () => {
      Logger.setLogLevel(LogLevel.INFO);
      stderrSpy.mockClear();

      const logger = Logger.getInstance();
      logger.info("BigInt value:", BigInt("12345678901234567890"));

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining("BigInt value: 12345678901234567890"),
      );
    });

    it("should handle Date objects", () => {
      Logger.setLogLevel(LogLevel.INFO);
      stderrSpy.mockClear();

      const logger = Logger.getInstance();
      const date = new Date("2024-01-01T00:00:00Z");
      logger.info("Date value:", date);

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Date value: ${date.toISOString()}`),
      );
    });

    it("should handle special numbers", () => {
      Logger.setLogLevel(LogLevel.INFO);
      stderrSpy.mockClear();

      const logger = Logger.getInstance();
      logger.info(
        "Special number:",
        Number.NEGATIVE_INFINITY,
        Number.NaN,
        Number.POSITIVE_INFINITY,
      );

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining("Special number: -Infinity NaN Infinity"),
      );
    });

    it("should handle objects that cannot be stringified", () => {
      Logger.setLogLevel(LogLevel.INFO);
      stderrSpy.mockClear();

      const circular: { self?: unknown } = {};
      circular.self = circular;

      const logger = Logger.getInstance();
      logger.info("Circular:", circular);

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Circular: [object Object]"));
      // Should fall back to String() conversion
    });

    it("should handle `null` and `undefined` arguments", () => {
      Logger.setLogLevel(LogLevel.INFO);
      stderrSpy.mockClear();

      const logger = Logger.getInstance();
      logger.info("Values:", null, undefined);

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Values: null undefined"));
    });
  });

  describe("Log level filtering", () => {
    it("should filter messages based on log level", () => {
      const logger = Logger.getInstance();

      // Set to INFO, should see INFO, WARN, ERROR, and FATAL, but not TRACE or DEBUG
      Logger.setLogLevel(LogLevel.INFO);
      stderrSpy.mockClear();

      logger.trace("trace");
      logger.debug("debug");
      logger.info("info");
      logger.warn("warn");
      logger.error("error");
      logger.fatal("fatal");

      expect(stderrSpy).toHaveBeenCalledTimes(4); // info, warn, error, fatal
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("info"));
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("warn"));
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("error"));
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("fatal"));
    });

    it("should show all messages at TRACE level", () => {
      const logger = Logger.getInstance();
      Logger.setLogLevel(LogLevel.TRACE);
      stderrSpy.mockClear();

      logger.trace("trace");
      logger.debug("debug");
      logger.info("info");
      logger.warn("warn");
      logger.error("error");
      logger.fatal("fatal");

      expect(stderrSpy).toHaveBeenCalledTimes(6);
      expect(stderrSpy).toHaveBeenNthCalledWith(1, expect.stringContaining("trace"));
      expect(stderrSpy).toHaveBeenNthCalledWith(2, expect.stringContaining("debug"));
      expect(stderrSpy).toHaveBeenNthCalledWith(3, expect.stringContaining("info"));
      expect(stderrSpy).toHaveBeenNthCalledWith(4, expect.stringContaining("warn"));
      expect(stderrSpy).toHaveBeenNthCalledWith(5, expect.stringContaining("error"));
      expect(stderrSpy).toHaveBeenNthCalledWith(6, expect.stringContaining("fatal"));
    });

    it("should show only ERROR and FATAL messages at ERROR level", () => {
      const logger = Logger.getInstance();
      Logger.setLogLevel(LogLevel.ERROR);
      stderrSpy.mockClear();

      logger.trace("trace");
      logger.debug("debug");
      logger.info("info");
      logger.warn("warn");
      logger.error("error");
      logger.fatal("fatal");

      expect(stderrSpy).toHaveBeenCalledTimes(2); // error, fatal
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("error"));
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("fatal"));
    });
  });
});
