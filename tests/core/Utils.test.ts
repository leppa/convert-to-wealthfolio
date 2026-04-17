/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { bold } from "colorette";

import {
  formatLoggedValue,
  formatPair,
  parseNumber,
  roundToPrecision,
  sanitizeName,
} from "../../src/core/Utils";

describe("Utils", () => {
  describe("roundToPrecision", () => {
    it("should round positive numbers to specified precision", () => {
      expect(roundToPrecision(123.456, 2)).toBe(123.46);
      expect(roundToPrecision(123.454, 2)).toBe(123.45);
      expect(roundToPrecision(123.455, 2)).toBe(123.46);
    });

    it("should round negative numbers to specified precision", () => {
      expect(roundToPrecision(-123.456, 2)).toBe(-123.46);
      expect(roundToPrecision(-123.454, 2)).toBe(-123.45);
      expect(roundToPrecision(-123.455, 2)).toBe(-123.45);
    });

    it("should round numbers with negative precision", () => {
      expect(roundToPrecision(1353, -1)).toBe(1350);
      expect(roundToPrecision(1789.18, -3)).toBe(2000);
      expect(roundToPrecision(-138.1, -1)).toBe(-140);
    });

    it("should handle zero precision (round to integer)", () => {
      expect(roundToPrecision(123.456, 0)).toBe(123);
      expect(roundToPrecision(123.5, 0)).toBe(124);
      expect(roundToPrecision(123.4, 0)).toBe(123);
      expect(roundToPrecision(-123.5, 0)).toBe(-123);
    });

    it("should handle precision of 1", () => {
      expect(roundToPrecision(123.456, 1)).toBe(123.5);
      expect(roundToPrecision(123.44, 1)).toBe(123.4);
      expect(roundToPrecision(123.45, 1)).toBe(123.5);
    });

    it("should handle high precision values", () => {
      expect(roundToPrecision(123.456789, 5)).toBe(123.45679);
      expect(roundToPrecision(123.456784, 5)).toBe(123.45678);
      expect(roundToPrecision(1.23456789, 6)).toBe(1.234568);
    });

    it("should handle zero values", () => {
      expect(roundToPrecision(0, 2)).toBe(0);
      expect(roundToPrecision(0.0, 5)).toBe(0);
      // Note: JavaScript distinguishes between +0 and -0
    });

    it("should handle very small numbers", () => {
      expect(roundToPrecision(0.001, 2)).toBe(0);
      expect(roundToPrecision(0.001, 3)).toBe(0.001);
      expect(roundToPrecision(0.0015, 3)).toBe(0.002);
      expect(roundToPrecision(0.0014, 3)).toBe(0.001);
    });

    it("should handle very large numbers", () => {
      expect(roundToPrecision(123456789.123456, 2)).toBe(123456789.12);
      expect(roundToPrecision(999999999.999, 2)).toBe(1000000000);
    });

    it("should handle numbers that don't need rounding", () => {
      expect(roundToPrecision(123.45, 2)).toBe(123.45);
      expect(roundToPrecision(100, 2)).toBe(100);
      expect(roundToPrecision(0.5, 1)).toBe(0.5);
    });

    it("should handle edge case of 0.5 rounding", () => {
      // Math.round rounds half towards positive infinity
      expect(roundToPrecision(2.5, 0)).toBe(3);
      expect(roundToPrecision(3.5, 0)).toBe(4);
      expect(roundToPrecision(-2.5, 0)).toBe(-2);
      expect(roundToPrecision(-3.5, 0)).toBe(-3);
    });

    it("should handle decimal precision edge cases", () => {
      // Test floating point precision issues
      expect(roundToPrecision(0.1 + 0.2, 1)).toBe(0.3);
      expect(roundToPrecision(0.1 + 0.2, 10)).toBe(0.3);
    });
  });

  describe("parseNumber", () => {
    it("should return default value for `null` and `undefined`", () => {
      expect(parseNumber()).toBe(0);
      expect(parseNumber(null)).toBe(0);
      expect(parseNumber(undefined, 42)).toBe(42);
      expect(parseNumber(null, -5)).toBe(-5);
    });

    it("should return finite numeric values unchanged", () => {
      expect(parseNumber(123)).toBe(123);
      expect(parseNumber(0)).toBe(0);
      expect(parseNumber(-45.67)).toBe(-45.67);
      expect(parseNumber(123, 999)).toBe(123);
    });

    it("should return default value for non-finite numeric values", () => {
      expect(parseNumber(Number.NaN)).toBe(0);
      expect(parseNumber(Number.POSITIVE_INFINITY)).toBe(0);
      expect(parseNumber(Number.NEGATIVE_INFINITY)).toBe(0);
      expect(parseNumber(Number.NaN, 99)).toBe(99);
    });

    it("should parse valid numeric strings", () => {
      expect(parseNumber("123.45")).toBe(123.45);
      expect(parseNumber("-10")).toBe(-10);
      expect(parseNumber(" 42 ")).toBe(42);
      expect(parseNumber("3.14abc")).toBe(3.14);
    });

    it("should return default value for invalid strings", () => {
      expect(parseNumber("")).toBe(0);
      expect(parseNumber("abc")).toBe(0);
      expect(parseNumber("NaN")).toBe(0);
      expect(parseNumber("Infinity")).toBe(0);
      expect(parseNumber("abc", 7)).toBe(7);
    });
  });

  describe("sanitizeName", () => {
    it("should return fallbackSymbol for undefined or empty name", () => {
      expect(sanitizeName()).toBeUndefined();
      expect(sanitizeName(undefined, "FB")).toBe("FB");
      expect(sanitizeName("", "FALLBACK")).toBe("FALLBACK");
    });

    it("should replace non-alphanumeric characters with dashes", () => {
      expect(sanitizeName("Apple Inc.")).toBe("APPLE-INC");
      expect(sanitizeName("ACME, Inc. / Class-A")).toBe("ACME-INC-CLASS-A");
    });

    it("should collapse consecutive special characters into a single dash", () => {
      expect(sanitizeName("Some_Weird_Name@#!With$Special%Characters")).toBe(
        "SOME-WEIRD-NAME-WITH-SPECIAL-CHARACTERS",
      );
      expect(sanitizeName("A  B")).toBe("A-B");
    });

    it("should trim leading and trailing dashes", () => {
      expect(sanitizeName("  ACME, Inc. / Class-A-  ")).toBe("ACME-INC-CLASS-A");
      expect(sanitizeName("-Leading")).toBe("LEADING");
      expect(sanitizeName("Trailing-")).toBe("TRAILING");
    });

    it("should convert result to uppercase", () => {
      expect(sanitizeName("apple inc")).toBe("APPLE-INC");
      expect(sanitizeName("mixedCase")).toBe("MIXEDCASE");
    });

    it("should handle purely alphanumeric input", () => {
      expect(sanitizeName("AAPL")).toBe("AAPL");
      expect(sanitizeName("msft")).toBe("MSFT");
      expect(sanitizeName("ABC123")).toBe("ABC123");
    });
  });

  describe("formatLoggedValue", () => {
    it("should return bold value when called without label or emptyLabel", () => {
      expect(formatLoggedValue("hello")).toBe(bold("hello"));
    });

    it("should prepend label to bold value when value is present", () => {
      expect(formatLoggedValue("world", "Label: ")).toBe(`Label: ${bold("world")}`);
      expect(formatLoggedValue("X", ", key: ")).toBe(`, key: ${bold("X")}`);
    });

    it("should return empty string when value is absent and emptyLabel is omitted", () => {
      expect(formatLoggedValue()).toBe("");
      expect(formatLoggedValue("")).toBe("");
    });

    it("should return emptyLabel when value is absent", () => {
      expect(formatLoggedValue(undefined, "", "N/A")).toBe("N/A");
      expect(formatLoggedValue("", "Label: ", "missing")).toBe("missing");
    });
  });

  describe("formatPair", () => {
    it("should format both values with separator when both are present", () => {
      expect(formatPair(["AAPL", "US0378331005"], ["Symbol ", "ISIN "])).toBe(
        `Symbol ${bold("AAPL")}, ISIN ${bold("US0378331005")}`,
      );
    });

    it("should use custom separator when both values are present", () => {
      expect(formatPair(["AAPL", "US0378331005"], ["Symbol ", "ISIN "], " | ")).toBe(
        `Symbol ${bold("AAPL")} | ISIN ${bold("US0378331005")}`,
      );
    });

    it("should omit separator when only first value is present", () => {
      expect(formatPair(["AAPL", undefined], ["Symbol ", "ISIN "])).toBe(`Symbol ${bold("AAPL")}`);
    });

    it("should omit separator when only second value is present", () => {
      expect(formatPair([undefined, "US0378331005"], ["Symbol ", "ISIN "])).toBe(
        `ISIN ${bold("US0378331005")}`,
      );
    });

    it("should return empty string when both values are absent", () => {
      expect(formatPair([undefined, undefined], ["Symbol ", "ISIN "])).toBe("");
    });
  });
});
