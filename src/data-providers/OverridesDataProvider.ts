/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import fs from "fs";
import ini from "ini";
import path from "path";

import { bold } from "colorette";

import { DataProvider, SymbolQuery } from "../core/DataProvider";
import { Logger } from "../core/Logger";

/**
 * Interface for override mappings
 */
export interface Overrides {
  symbols: Map<string, string>;
  isin: Map<string, string>;
  cusip: Map<string, string>;
  names: Map<string, string>;
}

/**
 * Data provider that loads symbol overrides, as well as ISIN, CUSIP, and company name mappings from
 * an INI file
 */
export class OverridesDataProvider extends DataProvider {
  private overrides: Overrides;

  constructor(overrides: Overrides) {
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
   * @returns Symbol result or `null` if not found
   */
  query(query: SymbolQuery): string | null {
    if (query.symbol) {
      const symbol = this.overrides.symbols.get(query.symbol.trim().toUpperCase());
      if (symbol) {
        return symbol;
      }
    }

    if (query.isin) {
      const symbol = this.overrides.isin.get(query.isin.trim().toUpperCase());
      if (symbol) {
        return symbol;
      }
    }

    if (query.cusip) {
      const symbol = this.overrides.cusip.get(query.cusip.trim().toUpperCase());
      if (symbol) {
        return symbol;
      }
    }

    if (query.name) {
      const symbol = this.overrides.names.get(query.name.trim().toUpperCase());
      if (symbol) {
        return symbol;
      }
    }

    return null;
  }
}

/**
 * Parse an INI file with symbol, ISIN, and CUSIP overrides
 *
 * @param filePath - Path to the INI file
 * @returns Parsed overrides
 */
export function parseOverridesFile(overridesPath: string): Overrides {
  const overrides: Overrides = {
    symbols: new Map(),
    isin: new Map(),
    cusip: new Map(),
    names: new Map(),
  };

  const filePath = path.resolve(overridesPath);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Overrides file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const parsed = ini.parse(content);

  if (parsed.Symbol) {
    for (const [key, value] of Object.entries(parsed.Symbol)) {
      overrides.symbols.set(key.trim().toUpperCase(), String(value).trim().toUpperCase());
    }
  }

  if (parsed.ISIN) {
    for (const [key, value] of Object.entries(parsed.ISIN)) {
      overrides.isin.set(key.trim().toUpperCase(), String(value).trim().toUpperCase());
    }
  }

  if (parsed.CUSIP) {
    for (const [key, value] of Object.entries(parsed.CUSIP)) {
      overrides.cusip.set(key.trim().toUpperCase(), String(value).trim().toUpperCase());
    }
  }

  if (parsed.Name) {
    for (const [key, value] of Object.entries(parsed.Name)) {
      overrides.names.set(key.trim().toUpperCase(), String(value).trim().toUpperCase());
    }
  }

  const logger = Logger.getInstance();
  logger.info(
    `Loaded ${bold(overrides.symbols.size + overrides.isin.size + overrides.cusip.size + overrides.names.size)} overrides from: ${bold(overridesPath)}`,
  );
  logger.info(`  Symbols: ${bold(overrides.symbols.size)}`);
  logger.info(`  ISINs: ${bold(overrides.isin.size)}`);
  logger.info(`  CUSIPs: ${bold(overrides.cusip.size)}`);
  logger.info(`  Company names: ${bold(overrides.names.size)}`);

  return overrides;
}
