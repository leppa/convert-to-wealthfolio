/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { roundToPrecision } from "../../src/core/Utils";

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
});
