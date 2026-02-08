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
