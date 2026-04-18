/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import fs from "node:fs";
import path from "node:path";

import { bold, green, italic, red } from "colorette";
import { CsvError, OptionsWithColumns, parse } from "csv-parse";
import { stringify } from "csv-stringify/sync";

import { BaseFormat, WealthfolioRecord } from "./BaseFormat";
import {
  clearField,
  FieldRequirementLevel,
  FieldRequirementViolationKind,
  FieldValidationResult,
  validateRecordFieldRequirements,
} from "./FieldRequirements";
import { Logger } from "./Logger";
import { SymbolDataService } from "./SymbolDataService";
import { assertUnreachable, parseNumber, roundToPrecision, stringifyForLogging } from "./Utils";

import { OverridesByType, OverridesDataProvider, parseOverridesFile } from "../data-providers";

// https://wealthfolio.app/docs/concepts/activity-types/ states that
// "eight-decimal precision is accepted"
const CSV_EXPORT_DECIMAL_PRECISION = 8;

/**
 * Main converter class that orchestrates the CSV conversion process
 */
export class Converter {
  private readonly formatPlugins: BaseFormat[];

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
    const logger = Logger.getInstance();
    logger.trace(
      `Starting format detection with ${bold(this.formatPlugins.length)} registered formats`,
    );
    for (const plugin of this.formatPlugins) {
      try {
        logger.trace(`Validating format ${bold(plugin.getName())}...`);

        // Get plugin-specific parse options and header line
        const parseOptions = plugin.getParseOptions();
        const validationLineCount = plugin.getValidationLineCount();

        // Parse a sample of the CSV to validate format
        const records = await this.parseCSV(content, {
          ...parseOptions,
          to_line: parseNumber(parseOptions.from_line, 1) - 1 + validationLineCount,
        });

        // Validate with the plugin
        if (plugin.validate(records)) {
          logger.trace(`  ...validation ${bold("succeeded")}`);
          return plugin;
        }
        logger.trace(
          `  ...validation ${bold("failed")} with \`validate()\` returning ${italic("false")}`,
        );
      } catch (error) {
        logger.trace(`  ...validation ${bold("failed")} with parsing error:`, error);
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
   * @param defaultCurrency - Default currency code to use when not specified in records
   * @param formatName - Optional format name to use (skip autodetection)
   * @param overridesPath - Optional path to overrides INI file
   */
  async convert(
    inputPath: string,
    outputPath: string,
    defaultCurrency: string,
    formatName?: string,
    overridesPath?: string,
  ): Promise<void> {
    const logger = Logger.getInstance();

    // Read input CSV content
    const fileContent = fs.readFileSync(path.resolve(inputPath), "utf-8");

    if (fileContent.trim().length === 0) {
      throw new Error("Input CSV is empty");
    }

    let format: BaseFormat | null;

    // If explicit format is provided, use it with validation
    if (formatName) {
      format = this.formatPlugins.find((f) => f.getName() === formatName) || null;
      if (format) {
        logger.info(`Selected format: ${bold(format.getName())}`);
      } else {
        const formatNames = this.formatPlugins.map((p) => p.getName()).join(", ");
        throw new Error(`Format '${formatName}' not found. Available formats: ${formatNames}`);
      }
    } else {
      // Autodetect format
      format = await this.detectFormat(fileContent);
      if (!format) {
        const formatNames = this.formatPlugins.map((p) => p.getName()).join(", ");
        throw new Error(`Cannot detect input format. Registered formats: ${formatNames}`);
      }
      logger.info(`Detected format: ${bold(format.getName())}`);
    }

    // Parse the full CSV with format-specific options
    const parseOptions = format.getParseOptions();
    const records = await this.parseCSV(fileContent, parseOptions);
    logger.info(`Loaded ${bold(records.length)} records from: ${bold(inputPath)}`);

    if (formatName && !format.validate(records)) {
      throw new Error(`Input CSV does not match the '${formatName}' format`);
    }

    const symbolDataService = new SymbolDataService();
    let overrides: OverridesByType | undefined;
    // Load overrides if provided and register as a data provider
    if (overridesPath) {
      overrides = parseOverridesFile(overridesPath);
      symbolDataService.registerProvider(new OverridesDataProvider(overrides));
    }

    // Convert records
    let convertedRecords = format
      .convert(records, defaultCurrency, symbolDataService)
      // Filter all records that don't meet field requirements
      .filter((record, index) => {
        const result = validateRecordFieldRequirements(record);
        logger.trace(
          `Validating record ${bold(index + 1)}: ${result.valid ? green("passed") : red("failed")}`,
        );
        let skip = false;
        if (!result.valid) {
          skip = result.invalidFields.some(
            (field) => field.requirementLevel === FieldRequirementLevel.Required,
          );
          if (skip) {
            logger.warn(
              `${bold("Skipping")} record ${italic(index + 1)} due to invalid required fields:`,
            );
          } else {
            logger.warn(
              `Record ${italic(index + 1)} has invalid optional fields, they ${bold("will be cleared")}:`,
            );
          }
          for (const field of result.invalidFields) {
            logger.warn(`  - ${formatFieldValidationResult(field)}`);
            if (!skip && field.requirementLevel === FieldRequirementLevel.Optional) {
              // Clear the optional invalid field
              // WARNING: Modifies original records in-place
              clearField(record, field.name);
            }
          }
        }
        return !skip;
      });

    const symbolOverrides = overrides?.symbol;
    const isinOverrides = overrides?.isin;
    if (
      (symbolOverrides && symbolOverrides.symbols.size > 0) ||
      (isinOverrides && isinOverrides.isins.size > 0)
    ) {
      // If overrides file was provided, apply symbol and ISIN overrides.
      convertedRecords = convertedRecords.map((record, index) => {
        const newRecord = { ...record };
        if (symbolOverrides) {
          newRecord.symbol = getOverrideFor(
            newRecord.symbol,
            symbolOverrides.symbols,
            index,
            "symbol",
          );
        }
        if (isinOverrides) {
          newRecord.isin = getOverrideFor(newRecord.isin, isinOverrides.isins, index, "ISIN");
        }
        return newRecord;
      });
    }

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
  private parseCSV(
    content: string,
    customOptions?: OptionsWithColumns<Record<string, unknown>>,
  ): Promise<Record<string, unknown>[]> {
    const defaultOptions: OptionsWithColumns<Record<string, unknown>> = {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    };

    const parseOptions = { ...defaultOptions, ...customOptions };

    return new Promise((resolve, reject) => {
      parse(
        content,
        parseOptions,
        (err: CsvError | undefined, records?: Record<string, unknown>[]) => {
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
              Number.isNaN(value.getTime()) ? "" : value.toISOString(),
            number: (value) =>
              Number.isNaN(value)
                ? ""
                : roundToPrecision(value, CSV_EXPORT_DECIMAL_PRECISION).toString(),
            object: (value) => (Object.keys(value).length === 0 ? "" : JSON.stringify(value)),
          },
        });

        fs.writeFileSync(path.resolve(filePath), csvContent, "utf-8");
        Logger.getInstance().info(`Wrote ${bold(records.length)} records to: ${bold(filePath)}`);
        resolve();
      } catch (error) {
        if (error instanceof Error) {
          reject(error);
        } else {
          reject(new Error(String(error)));
        }
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

/**
 * Get override value for a given key from the overrides map
 *
 * @param key - Original value to check for override
 * @param overridesMap - Map of overrides to check against
 * @param recordIndex - Index of the record being processed (for logging)
 * @param fieldName - Name of the field being overridden (for logging)
 * @returns Overridden value if found, otherwise the original key (possibly normalized)
 */
function getOverrideFor(
  key: string,
  overridesMap: Map<string, string>,
  recordIndex: number,
  fieldName: string,
): string {
  const logger = Logger.getInstance();

  const normalizedKey = key.trim().toUpperCase();
  if (!normalizedKey) {
    logger.trace(
      `Skipping ${italic(fieldName)} override for record ${italic(recordIndex + 1)}: ${bold("empty")} value`,
    );
    return "";
  }

  const mappedValue = overridesMap.get(normalizedKey);
  if (mappedValue) {
    logger.debug(
      `Overriding ${italic(fieldName)} for record ${italic(recordIndex + 1)}: ${bold(key)} -> ${bold(mappedValue)}`,
    );
    return mappedValue;
  }
  if (key !== normalizedKey) {
    logger.info(
      `Normalizing ${italic(fieldName)} for record ${italic(recordIndex + 1)}: ${bold(key)} -> ${bold(normalizedKey)}`,
    );
  }
  return normalizedKey; // Normalize even if no override
}

/**
 * Format a field validation result for logging
 *
 * @param result - Field validation result
 * @returns Formatted log message
 */
// Export to make the function testable, even though it's only used in this file for now
export function formatFieldValidationResult(result: FieldValidationResult): string {
  let requirementLevel = "";
  switch (result.requirementLevel) {
    case FieldRequirementLevel.Required:
      requirementLevel = "required";
      break;
    case FieldRequirementLevel.Optional:
      requirementLevel = "optional";
      break;
    case FieldRequirementLevel.Ignored:
      requirementLevel = "ignored";
      break;
    default:
      assertUnreachable(result.requirementLevel);
  }

  let errorMessage = "";
  switch (result.violationKind) {
    case FieldRequirementViolationKind.Valid:
      errorMessage = green("Valid");
      break;
    case FieldRequirementViolationKind.Unset:
      errorMessage = red("Empty value");
      break;
    case FieldRequirementViolationKind.Invalid:
      errorMessage = red(`Invalid value: ${bold(stringifyForLogging(result.value))}`);
      break;
    default:
      assertUnreachable(result.violationKind);
  }

  return `${bold(result.name)} (${italic(requirementLevel)}) - ${errorMessage}`;
}
