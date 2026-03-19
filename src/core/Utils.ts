/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * Utility functions for CSV conversion
 */

/**
 * Round a number to a specified precision
 *
 * Positive precision rounds to the right of the decimal point, negative precision rounds to the
 * left. E.g., (1234.5678, 2) => 1234.57, (1234.5678, -2) => 1200.
 *
 * @param value - The number to round
 * @param precision - The number of decimal places
 * @returns The rounded number
 */
export function roundToPrecision(value: number, precision: number): number {
  const factor = Math.pow(10, precision);
  return Math.round(value * factor) / factor;
}

/**
 * Parse a value into a number, with a default fallback for invalid inputs
 *
 * Handles `null`, `undefined`, non-numeric strings, and non-finite numbers gracefully by returning
 * a specified default value.
 *
 * @param value - The value to parse
 * @param defaultValue - The default value to return if parsing fails
 * @returns The parsed number or the default value
 */
export function parseNumber(value?: null | number | string, defaultValue: number = 0): number {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : defaultValue;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}
