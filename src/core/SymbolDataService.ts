/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { bold } from "colorette";

import { DataProvider, DataProviderInfo, SymbolQuery } from "./DataProvider";
import { Logger } from "./Logger";

// TODO: Should we use "UNKNOWN" or something similar here instead of an empty string?
const UNKNOWN_SYMBOL = "";

/**
 * Result from a symbol query
 */
export interface SymbolResult {
  /** Resolved symbol */
  symbol: string;
  /** Which provider this result came from */
  provider: string;
}

/**
 * Manages symbol data providers and orchestrates symbol queries
 */
export class SymbolDataService {
  private providers: DataProvider[] = [];

  /**
   * Register a data provider
   *
   * @param provider - Data provider instance
   */
  registerProvider(provider: DataProvider): void {
    this.providers.push(provider);
  }

  /**
   * Query for a symbol across all registered providers
   *
   * Tries each provider in order until one returns a result.
   *
   * @param query - Symbol query parameters
   * @returns Symbol result from the first provider that has data, or null
   */
  querySymbol(query: SymbolQuery): SymbolResult | null {
    // Try each provider in registration order
    for (const provider of this.providers) {
      if (!provider.canHandle(query)) {
        continue;
      }

      const symbol = provider.query(query);
      if (symbol) {
        return {
          symbol,
          provider: provider.getName(),
        };
      }
    }

    // No provider found a result
    return null;
  }

  /**
   * Query with fallback - returns a result with fallback to original query values
   *
   * @param query - Symbol query parameters
   * @returns Symbol result with fallback to original values, never null
   */
  querySymbolWithFallback(query: SymbolQuery): SymbolResult {
    const logger = Logger.getInstance();
    const result = this.querySymbol(query);

    if (result) {
      logger.debug(
        `Resolved ${query.symbol ? "symbol " + bold(query.symbol) : bold("empty") + " symbol"}${query.isin ? ", ISIN: " + bold(query.isin) : ""}${query.cusip ? ", CUSIP: " + bold(query.cusip) : ""}${query.name ? ", name: " + bold(query.name) : ""} -> ${bold(result.symbol)} (provider: ${bold(result.provider)})`,
      );

      return result;
    }

    // Fallback: return the symbol based on the original query values in the priority order: symbol,
    // ISIN, CUSIP, sanitized name
    const symbol = (query.symbol || query.isin || query.cusip || this.sanitizeName(query.name))
      .trim()
      .toUpperCase();

    if (!query.symbol) {
      logger.warn(
        `Couldn't resolve ${bold("empty")} symbol${query.isin ? ", ISIN: " + bold(query.isin) : ""}${query.cusip ? ", CUSIP: " + bold(query.cusip) : ""}${query.name ? ", name: " + bold(query.name) : ""} -> falling back to ${bold(symbol)}`,
      );
    }

    return {
      symbol,
      provider: "Fallback",
    };
  }

  /**
   * Get list of registered providers
   *
   * @returns Array of provider info objects
   */
  getRegisteredProviders(): DataProviderInfo[] {
    return this.providers.map((p) => ({
      name: p.getName(),
      description: p.getDescription(),
    }));
  }

  /**
   * Clear all providers
   */
  clearProviders(): void {
    this.providers = [];
  }

  /**
   * Get the number of registered providers
   */
  getProviderCount(): number {
    return this.providers.length;
  }

  private sanitizeName(name?: string): string {
    if (!name) {
      return UNKNOWN_SYMBOL;
    }

    return (
      name
        // Replace all non-alphanumeric characters with dashes.
        .replace(/[\W-]/g, "-")
        // Reaplace multiple consecutive dashes with a single dash.
        .replace(/--+/g, "-")
        // Trim leading and trailing dashes.
        .replace(/^-*|-*$/g, "")
    );
  }
}
