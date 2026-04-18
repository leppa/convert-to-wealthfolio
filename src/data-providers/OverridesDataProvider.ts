/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import ini from "ini";
import fs from "node:fs";
import path from "node:path";

import { bold, red } from "colorette";
import { isISIN } from "validator";

import { DataProvider, SymbolQuery, SymbolResult } from "../core/DataProvider";
import { Logger } from "../core/Logger";

/**
 * Interface for override mappings
 */
export interface Overrides {
  symbols: Map<string, string>;
  isins: Map<string, string>;
  cusips: Map<string, string>;
  names: Map<string, string>;
}

/**
 * Interface for overrides organized by type
 */
export interface OverridesByType {
  symbol?: Overrides;
  isin?: Overrides;
}

/**
 * Data provider that loads symbol overrides, as well as ISIN, CUSIP, and company name mappings from
 * an INI file
 */
export class OverridesDataProvider extends DataProvider {
  private readonly overrides: OverridesByType;

  constructor(overrides: OverridesByType) {
    super(
      "Overrides",
      "Loads symbol overrides and ISIN, CUSIP, and company name mappings from an INI file",
    );
    this.overrides = overrides;
  }

  /**
   * Query for a symbol in the overrides
   *
   * @param query - Symbol query parameters
   * @returns Resolved symbol result or empty object if cannot resolve
   */
  query(query: SymbolQuery): SymbolResult {
    const isin = this.getISINFromOverrides(query);

    // If ISIN was overridden, we use the override value for symbol lookup
    const symbol = this.getSymbolFromOverrides({ ...query, isin: isin || query.isin });

    return { symbol, isin };
  }

  /**
   * Get an ISIN from the overrides
   *
   * The override lookup order is: ISIN, symbol, CUSIP, company name.
   *
   * @param query - Symbol query parameters
   * @returns Resolved ISIN or `undefined` if cannot resolve
   */
  private getISINFromOverrides(query: SymbolQuery): string | undefined {
    const isinOverrides = this.overrides.isin;
    if (!isinOverrides) {
      return undefined;
    }

    let isin: string | undefined;
    if (query.isin) {
      isin = isinOverrides.isins.get(query.isin);
    }
    if (!isin && query.symbol) {
      isin = isinOverrides.symbols.get(query.symbol);
    }
    if (!isin && query.cusip) {
      isin = isinOverrides.cusips.get(query.cusip);
    }
    if (!isin && query.name) {
      isin = isinOverrides.names.get(query.name.toUpperCase());
    }
    return isin;
  }

  /**
   * Get a symbol from the overrides
   *
   * The override lookup order is: symbol, `isin` parameter, ISIN from query,
   * CUSIP, company name.
   *
   * @param query - Symbol query parameters
   * @returns Resolved symbol or `undefined` if cannot resolve
   */
  private getSymbolFromOverrides(query: SymbolQuery): string | undefined {
    const symbolOverrides = this.overrides.symbol;
    if (!symbolOverrides) {
      return undefined;
    }

    let symbol: string | undefined;
    if (query.symbol) {
      symbol = symbolOverrides.symbols.get(query.symbol);
    }
    if (!symbol && query.isin) {
      symbol = symbolOverrides.isins.get(query.isin);
    }
    if (!symbol && query.cusip) {
      symbol = symbolOverrides.cusips.get(query.cusip);
    }
    if (!symbol && query.name) {
      symbol = symbolOverrides.names.get(query.name.toUpperCase());
    }
    return symbol;
  }
}

/**
 * Parse an INI file with symbol, ISIN, and CUSIP overrides
 *
 * @param filePath - Path to the INI file
 * @returns Parsed overrides
 */
export function parseOverridesFile(overridesPath: string): OverridesByType {
  const filePath = path.resolve(overridesPath);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Overrides file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const parsed = ini.parse(content);

  const overrides: OverridesByType = {};
  if (parsed.ISIN) {
    overrides.isin = parseSection(parsed.ISIN as Record<string, Record<string, string>>, isISIN);
    logOverridesSummary(overrides.isin, "ISIN", overridesPath);
  }
  if (parsed.Symbol) {
    overrides.symbol = parseSection(parsed.Symbol as Record<string, Record<string, string>>);
    logOverridesSummary(overrides.symbol, "Symbol", overridesPath);
  }

  return overrides;
}

/**
 * Parse a section of the INI file and validate values if a validator is provided
 *
 * @param section - Section of the INI file to parse
 * @param valueValidator - Optional function to validate values
 * @returns Parsed overrides for the section
 */
function parseSection(
  section: Record<string, Record<string, string>>,
  valueValidator?: (value: string) => boolean,
): Overrides {
  const overrides: Overrides = {
    symbols: new Map(),
    isins: new Map(),
    cusips: new Map(),
    names: new Map(),
  };

  if (section.Symbol) {
    overrides.symbols = parseSubsection(section.Symbol, valueValidator);
  }

  if (section.ISIN) {
    overrides.isins = parseSubsection(section.ISIN, valueValidator);
  }

  if (section.CUSIP) {
    overrides.cusips = parseSubsection(section.CUSIP, valueValidator);
  }

  if (section.Name) {
    overrides.names = parseSubsection(section.Name, valueValidator);
  }

  return overrides;
}

/**
 * Parse a subsection of the INI file and validate values if a validator is provided
 *
 * @param section - Subsection of the INI file to parse
 * @param valueValidator - Optional function to validate values
 * @returns Map of parsed and validated overrides
 */
function parseSubsection(
  section: Record<string, string>,
  valueValidator?: (value: string) => boolean,
): Map<string, string> {
  const overrides = new Map<string, string>();
  for (const [key, value] of Object.entries(section)) {
    const normalizedValue = value.trim().toUpperCase();
    if (normalizedValue && (!valueValidator || valueValidator(normalizedValue))) {
      overrides.set(key.trim().toUpperCase(), normalizedValue);
    } else {
      Logger.getInstance().warn(
        `${red("Invalid value")} for key ${bold(key)} in overrides file: ${bold(value)} - will be ${bold("ignored")}`,
      );
    }
  }
  return overrides;
}

/**
 * Log a summary of loaded overrides to the console
 *
 * @param overrides - Overrides to summarize
 * @param type - Type of overrides (e.g. "Symbol", "ISIN")
 * @param overridesPath - Path to the overrides file for logging
 */
function logOverridesSummary(overrides: Overrides, type: string, overridesPath: string): void {
  const logger = Logger.getInstance();
  logger.info(
    `Loaded ${bold(overrides.symbols.size + overrides.isins.size + overrides.cusips.size + overrides.names.size)} ${bold(type)} overrides from: ${bold(overridesPath)}`,
  );
  logger.info(`  Symbols: ${bold(overrides.symbols.size)}`);
  logger.info(`  ISINs: ${bold(overrides.isins.size)}`);
  logger.info(`  CUSIPs: ${bold(overrides.cusips.size)}`);
  logger.info(`  Company names: ${bold(overrides.names.size)}`);
}
