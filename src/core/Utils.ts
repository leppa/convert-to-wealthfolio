/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { bold } from "colorette";

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

/**
 * Sanitize a (company) name to create a fallback symbol
 *
 * This method performs the following transformations to the input name:
 *
 * - If the name is empty or undefined, return the provided `fallbackSymbol`
 * - Replace all non-alphanumeric characters with dashes (consecutive characters will be replaced with a single dash)
 * - Trim leading and trailing dashes
 * - Convert to uppercase
 *
 * @param name - The name to sanitize
 * @param fallbackSymbol - The symbol to return if the name is empty or undefined
 * @returns Sanitized symbol string
 */
export function sanitizeName(name?: string, fallbackSymbol: string = ""): string {
  if (!name) {
    return fallbackSymbol;
  }

  const sanitized = name
    // Replace all non-alphanumeric characters with dashes (consecutive characters will be
    // replaced with a single dash)
    .replaceAll(/[\W_]+/g, "-");

  return sanitized
    .slice(
      // Trim leading dash (there can be only one due to the regex above)...
      sanitized.startsWith("-") ? 1 : 0,
      // ...and trailing dash (same here, only one possible)
      sanitized.endsWith("-") ? -1 : undefined,
    )
    .toUpperCase();
}

/**
 * Format a value for logging with an optional label
 *
 * Formats a value with an optional label for logging purposes. If the value is present, it will be
 * bolded and the label will be prepended. If the value is empty or undefined, an optional
 * `emptyLabel` will be returned instead.
 *
 * **Note:** No space is added between the label and the value, so the label should include any
 * necessary spacing.
 *
 * @param value - The value to format
 * @param label - The label to prepend if the value exists
 * @param emptyLabel - The label to use if the value is empty
 * @returns Formatted string for logging
 */
export function formatLoggedValue(
  value?: string,
  label: string = "",
  emptyLabel: string = "",
): string {
  return value ? `${label}${bold(value)}` : emptyLabel;
}
