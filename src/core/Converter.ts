/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import fs from "fs";
import path from "path";

import { Options, parse } from "csv-parse";
import { stringify } from "csv-stringify/sync";

import { BaseFormat, WealthfolioRecord } from "./BaseFormat";
import { validateRecordFieldRequirements } from "./FieldRequirements";
import { roundToPrecision } from "./Utils";

// https://wealthfolio.app/docs/concepts/activity-types/ states that
// "eight-decimal precision is accepted"
const CSV_EXPORT_DECIMAL_PRECISION = 8;

/**
 * Main converter class that orchestrates the CSV conversion process
 */
export class Converter {
  private formatPlugins: BaseFormat[];

  constructor(formatPlugins: BaseFormat[] = []) {
    this.formatPlugins = formatPlugins;
  }

  /**
   * Register a new format plugin
   *
   * @param plugin - Format plugin instance
   */
  registerPlugin(plugin: BaseFormat): void {
    this.formatPlugins.push(plugin);
  }

  /**
   * Detect input format by validating against registered plugins
   *
   * @param content - Raw CSV file content
   * @returns Detected format plugin or null
   */
  async detectFormat(content: string): Promise<BaseFormat | null> {
    for (const plugin of this.formatPlugins) {
      try {
        // Get plugin-specific parse options and header line
        const parseOptions = plugin.getParseOptions();
        const validationLineCount = plugin.getValidationLineCount();

        // Parse a sample of the CSV to validate format
        const records = await this.parseCSV(content, {
          ...parseOptions,
          to_line: (parseOptions.from_line ?? 1) - 1 + validationLineCount,
        });

        // Validate with the plugin
        if (plugin.validate(records)) {
          return plugin;
        }
      } catch (_) {
        // If parsing fails for this plugin, continue to next
        continue;
      }
    }
    return null;
  }

  /**
   * Convert CSV file from input format to Wealthfolio format
   *
   * @param inputPath - Path to input CSV file
   * @param outputPath - Path to output CSV file
   * @param formatName - Optional format name to use (skip autodetection)
   */
  async convert(inputPath: string, outputPath: string, formatName?: string): Promise<void> {
    // Read input CSV content
    const fileContent = fs.readFileSync(path.resolve(inputPath), "utf-8");

    if (fileContent.trim().length === 0) {
      throw new Error("Input CSV is empty");
    }

    let format: BaseFormat | null;

    // If explicit format is provided, use it with validation
    if (formatName) {
      format = this.formatPlugins.find((f) => f.getName() === formatName) || null;
      if (!format) {
        const formatNames = this.formatPlugins.map((p) => p.getName()).join(", ");
        throw new Error(`Format '${formatName}' not found. Available formats: ${formatNames}`);
      } else {
        console.info(`Selected format: ${format.getName()}`);
      }
    } else {
      // Autodetect format
      format = await this.detectFormat(fileContent);
      if (!format) {
        const formatNames = this.formatPlugins.map((p) => p.getName()).join(", ");
        throw new Error(`Cannot detect input format. Registered formats: ${formatNames}`);
      }
      console.info(`Detected format: ${format.getName()}`);
    }

    // Parse the full CSV with format-specific options
    const parseOptions = format.getParseOptions();
    const records = await this.parseCSV(fileContent, parseOptions);

    if (formatName && !format.validate(records)) {
      throw new Error(`Input CSV does not match the '${formatName}' format`);
    }

    // Convert records
    const convertedRecords = format
      .convert(records)
      // Filter all records that don't meet field requirements
      .filter((record, index) => {
        const result = validateRecordFieldRequirements(record);
        if (!result.valid) {
          console.warn(`Skipping record ${index + 1} due to field errors:`);
          for (const field of result.invalidFields) {
            console.warn(`  - ${field.name} - ${field.error}, value:`, field.value);
          }
        }
        return result.valid;
      });

    // Write output CSV
    await this.writeCSV(outputPath, convertedRecords);
  }

  /**
   * Parse CSV content using csv-parse
   *
   * @param content - CSV content as string
   * @param customOptions - Optional custom parse options to override defaults
   * @returns Parsed records
   */
  private parseCSV(content: string, customOptions?: Options): Promise<Record<string, unknown>[]> {
    const defaultOptions = {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    };

    const parseOptions = { ...defaultOptions, ...customOptions };

    return new Promise((resolve, reject) => {
      parse(
        content,
        parseOptions,
        (err: Error | undefined, records?: Record<string, unknown>[]) => {
          if (err) {
            reject(err);
          } else {
            // Unless there's a parsing error, we should always get an array (possibly empty), but
            // it's never a bad idea to double-check
            /* istanbul ignore next */
            resolve(records || []);
          }
        },
      );
    });
  }

  /**
   * Write records to CSV file
   *
   * @param filePath - Output file path
   * @param records - Records to write
   */
  private async writeCSV(filePath: string, records: WealthfolioRecord[]): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // The Generic format converter will not return an empty array if input CSV had records,
        // but other converters might
        if (records.length === 0) {
          // We can't write
          reject(new Error("No records returned by the format converter"));
          return;
        }

        // Get column headers from first record
        const columns = Object.keys(records[0]) as (keyof WealthfolioRecord)[];
        const csvContent = stringify(records, {
          header: true,
          columns: columns,
          cast: {
            date: (value) =>
              // Invalid dates can't reach this point because records with invalid dates fail
              // validation and are filtered out before writing
              /* istanbul ignore next */
              isNaN(value.getTime()) ? "" : value.toISOString(),
            number: (value) =>
              isNaN(value) ? "" : roundToPrecision(value, CSV_EXPORT_DECIMAL_PRECISION).toString(),
            object: (value) => (Object.keys(value).length !== 0 ? JSON.stringify(value) : ""),
          },
        });

        fs.writeFileSync(path.resolve(filePath), csvContent, "utf-8");
        console.log(`Wrote ${records.length} records to: ${filePath}`);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get list of registered format names
   *
   * @returns Array of format names
   */
  getRegisteredFormats(): string[] {
    return this.formatPlugins.map((p) => p.getName());
  }
}
