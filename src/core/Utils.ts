/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import validator from "validator";

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
 * - If the name is empty or undefined, return the provided `fallbackSymbol`.
 * - Replace all non-alphanumeric characters with dashes (consecutive characters will be replaced
 *   with a single dash).
 * - Trim leading and trailing dashes.
 * - Convert to uppercase.
 *
 * @param name - The name to sanitize
 * @param fallbackSymbol - The symbol to return if the name is empty or undefined
 * @returns Sanitized symbol or empty string
 */
export function sanitizeName(name?: string, fallbackSymbol: string = ""): string {
  if (!name) {
    return fallbackSymbol;
  }

  const sanitized = name
    // Replace all non-alphanumeric characters with dashes (consecutive characters will be replaced
    // with a single dash)
    .replaceAll(/[\W_]+/g, "-");

  return validator.trim(sanitized, "-").toUpperCase();
}

/**
 * Validate a CUSIP identifier
 *
 * @param value - The string to validate
 * @returns `true` if the value is a valid CUSIP, `false` otherwise
 */
export function isCUSIP(value: string): boolean {
  // While I and O are discouraged in CUSIPs, they are not strictly invalid, thus included in the
  // regex range
  if (!/^[0-9A-Z*@#]{8}\d$/i.test(value)) {
    return false;
  }

  const upper = value.toUpperCase();
  let sum = 0;
  const zeroCode = "0".codePointAt(0)!;
  const aCode = "A".codePointAt(0)!;

  for (let i = 0; i < 8; i++) {
    const char = upper[i];
    let v: number;
    if (char >= "0" && char <= "9") {
      v = char.codePointAt(0)! - zeroCode;
    } else if (char >= "A" && char <= "Z") {
      v = char.codePointAt(0)! - aCode + 10;
    } else if (char === "*") {
      v = 36;
    } else if (char === "@") {
      v = 37;
    } else /* char === "#" */ {
      v = 38;
    }

    // Double values at 1-based even positions (which are 0-based odd indices)
    if (i % 2 === 1) {
      v *= 2;
    }

    sum += Math.floor(v / 10) + (v % 10);
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === Number.parseInt(upper[8], 10);
}

/**
 * Stringify a value for logging purposes
 *
 * This function converts various types of values into a string format suitable for logging:
 * - `undefined` is represented as `<undefined>`, and `null` as `<null>`.
 * - Strings are returned as-is.
 * - Dates are converted to ISO string format.
 * - Objects are stringified using `JSON.stringify()`, with a fallback to string coercion if
 *   stringification fails (e.g., due to circular references).
 * - Other types are converted to strings using `String()`.
 *
 * @param value - The value to stringify
 * @returns A string representation of the value for logging
 */
export function stringifyForLogging(value: unknown): string {
  if (value === undefined) {
    return "<undefined>";
  }
  if (value === null) {
    return "<null>";
  }
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Date) {
    try {
      return value.toISOString();
    } catch {
      return "<invalid date>";
    }
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      // No-op - fallback to string coercion below
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return String(value);
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
  return value ? label + bold(value) : emptyLabel;
}

/**
 * Format a pair of values for logging with corresponding labels
 *
 * Formats a pair of values with corresponding labels for logging purposes. Each value will be
 * formatted using `formatLoggedValue` with its respective label. If both values are present, they
 * will be separated by the specified `separator`.
 *
 * @param values - A pair of values to format
 * @param labels - A pair of labels corresponding to each value
 * @param separator - The separator to use between values if both are present (default: ", ")
 * @returns Formatted string for logging
 */
export function formatPair(
  values: [string?, string?],
  labels: [string, string],
  separator: string = ", ",
): string {
  const [value1, value2] = values;
  const [label1, label2] = labels;
  const sep = value1 && value2 ? separator : "";
  return formatLoggedValue(value1, label1) + sep + formatLoggedValue(value2, label2);
}

/**
 * Assert that a value is of type `never`, indicating that it should be unreachable
 *
 * This function is used as a type guard to ensure that all possible cases have been handled in
 * control flow, such as in a `switch` statement. If the function is called, it will throw an error
 * indicating that an unreachable code path has been executed.
 */
export function assertUnreachable(_: never): never {
  throw new Error("Value is expected to be unreachable");
}
