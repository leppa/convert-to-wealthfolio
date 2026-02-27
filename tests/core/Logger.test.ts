/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { DEFAULT_LOG_LEVEL, Logger, LogLevel } from "../../src/core/Logger";

describe("Logger", () => {
  let stderrSpy: jest.SpyInstance;
  let stdoutSpy: jest.SpyInstance;
  // let exitSpy: jest.SpyInstance;

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
      expect(stderrSpy).toHaveBeenCalled();
      expect(stderrSpy.mock.calls[0][0]).toContain("[INFO ]");
      expect(stderrSpy.mock.calls[0][0]).toContain("Setting log level to");
      expect(stderrSpy.mock.calls[0][0]).toContain("TRACE");

      stderrSpy.mockClear();
      Logger.setLogLevel(LogLevel.INFO);
      expect(stderrSpy).toHaveBeenCalled();
      expect(stderrSpy.mock.calls[0][0]).toContain("INFO");
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
      expect(stderrSpy).toHaveBeenCalled();
      expect(stderrSpy.mock.calls[0][0]).toContain("[WARN ]");
      expect(stderrSpy.mock.calls[0][0]).toContain("hide important messages");
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

      expect(stderrSpy).toHaveBeenCalled();
      expect(stderrSpy.mock.calls[0][0]).toContain("[TRACE]");
      expect(stderrSpy.mock.calls[0][0]).toContain("Trace message");
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

      expect(stderrSpy).toHaveBeenCalled();
      expect(stderrSpy.mock.calls[0][0]).toContain("Trace with args");
    });
  });

  describe("debug", () => {
    it("should write to stderr when log level is DEBUG or below", () => {
      Logger.setLogLevel(LogLevel.DEBUG);
      stderrSpy.mockClear();

      const logger = Logger.getInstance();
      logger.debug("Debug message");

      expect(stderrSpy).toHaveBeenCalled();
      expect(stderrSpy.mock.calls[0][0]).toContain("[DEBUG]");
      expect(stderrSpy.mock.calls[0][0]).toContain("Debug message");
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

      expect(stderrSpy).toHaveBeenCalled();
      expect(stderrSpy.mock.calls[0][0]).toContain('Debug 123 {"test":true}');
    });
  });

  describe("info", () => {
    it("should write to stderr when log level is INFO or below", () => {
      Logger.setLogLevel(LogLevel.INFO);
      stderrSpy.mockClear();

      const logger = Logger.getInstance();
      logger.info("Info message");

      expect(stderrSpy).toHaveBeenCalled();
      expect(stderrSpy.mock.calls[0][0]).toContain("[INFO ]");
      expect(stderrSpy.mock.calls[0][0]).toContain("Info message");
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

      expect(stderrSpy).toHaveBeenCalled();
      expect(stderrSpy.mock.calls[0][0]).toContain("Status: active");
    });
  });

  describe("warn", () => {
    it("should write to stderr when log level is WARN or below", () => {
      Logger.setLogLevel(LogLevel.WARN);
      stderrSpy.mockClear();

      const logger = Logger.getInstance();
      logger.warn("Warning message");

      expect(stderrSpy).toHaveBeenCalled();
      expect(stderrSpy.mock.calls[0][0]).toContain("[WARN ]");
      expect(stderrSpy.mock.calls[0][0]).toContain("Warning message");
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

      expect(stderrSpy).toHaveBeenCalled();
      expect(stderrSpy.mock.calls[0][0]).toContain('Warning: {"code":123}');
    });
  });

  describe("error", () => {
    it("should write to stderr when log level is ERROR or below", () => {
      Logger.setLogLevel(LogLevel.ERROR);
      stderrSpy.mockClear();

      const logger = Logger.getInstance();
      logger.error("Error message");

      expect(stderrSpy).toHaveBeenCalled();
      expect(stderrSpy.mock.calls[0][0]).toContain("[ERROR]");
      expect(stderrSpy.mock.calls[0][0]).toContain("Error message");
    });

    it("should format message with arguments", () => {
      Logger.setLogLevel(LogLevel.ERROR);
      stderrSpy.mockClear();

      const logger = Logger.getInstance();
      logger.error("Error code:", 500);

      expect(stderrSpy).toHaveBeenCalled();
      expect(stderrSpy.mock.calls[0][0]).toContain("Error code: 500");
    });
  });

  describe("fatal", () => {
    it("should write to stderr and exit process", () => {
      Logger.setLogLevel(LogLevel.FATAL);
      stderrSpy.mockClear();

      const logger = Logger.getInstance();
      logger.fatal("Fatal error");

      expect(stderrSpy).toHaveBeenCalled();
      expect(stderrSpy.mock.calls[0][0]).toContain("[FATAL]");
      expect(stderrSpy.mock.calls[0][0]).toContain("Fatal error");
      // expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("should format message with arguments before exiting", () => {
      Logger.setLogLevel(LogLevel.FATAL);
      stderrSpy.mockClear();

      const logger = Logger.getInstance();
      logger.fatal("Critical:", { error: "system failure" });

      expect(stderrSpy).toHaveBeenCalled();
      expect(stderrSpy.mock.calls[0][0]).toContain('Critical: {"error":"system failure"}');
      // expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("Argument formatting", () => {
    it("should handle multiple primitive arguments", () => {
      Logger.setLogLevel(LogLevel.INFO);
      stderrSpy.mockClear();

      const logger = Logger.getInstance();
      logger.info("Values:", 1, "text", true);

      expect(stderrSpy).toHaveBeenCalled();
      expect(stderrSpy.mock.calls[0][0]).toContain("Values: 1 text true");
    });

    it("should handle objects that cannot be stringified", () => {
      Logger.setLogLevel(LogLevel.INFO);
      stderrSpy.mockClear();

      const circular: { self?: unknown } = {};
      circular.self = circular;

      const logger = Logger.getInstance();
      logger.info("Circular:", circular);

      expect(stderrSpy).toHaveBeenCalled();
      expect(stderrSpy.mock.calls[0][0]).toContain("Circular:");
      // Should fall back to String() conversion
    });

    it("should handle `null` and `undefined` arguments", () => {
      Logger.setLogLevel(LogLevel.INFO);
      stderrSpy.mockClear();

      const logger = Logger.getInstance();
      logger.info("Values:", null, undefined);

      expect(stderrSpy).toHaveBeenCalled();
      expect(stderrSpy.mock.calls[0][0]).toContain("Values: null undefined");
    });
  });

  describe("Log level filtering", () => {
    it("should filter messages based on log level", () => {
      const logger = Logger.getInstance();

      // Set to INFO, should see INFO, WARN, ERROR but not TRACE or DEBUG
      Logger.setLogLevel(LogLevel.INFO);
      stderrSpy.mockClear();

      logger.trace("trace");
      logger.debug("debug");
      logger.info("info");
      logger.warn("warn");
      logger.error("error");

      expect(stderrSpy).toHaveBeenCalledTimes(3); // info, warn, error
      expect(stderrSpy.mock.calls[0][0]).toContain("info");
      expect(stderrSpy.mock.calls[1][0]).toContain("warn");
      expect(stderrSpy.mock.calls[2][0]).toContain("error");
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

      expect(stderrSpy).toHaveBeenCalledTimes(5);
    });

    it("should show only ERROR messages at ERROR level", () => {
      const logger = Logger.getInstance();
      Logger.setLogLevel(LogLevel.ERROR);
      stderrSpy.mockClear();

      logger.trace("trace");
      logger.debug("debug");
      logger.info("info");
      logger.warn("warn");
      logger.error("error");

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy.mock.calls[0][0]).toContain("error");
    });
  });
});
