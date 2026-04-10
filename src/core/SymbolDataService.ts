/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { bold } from "colorette";

import { DataProvider, DataProviderInfo, SymbolQuery } from "./DataProvider";
import { Logger } from "./Logger";
import { formatLoggedValue, sanitizeName } from "./Utils";

// TODO: Should we use "UNKNOWN" or something similar here instead of an empty string?
const UNKNOWN_SYMBOL = "";

const FALLBACK_PROVIDER_NAME = "Fallback";

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
  private resolutionCache: Record<string, SymbolResult> = {};

  /**
   * Register a data provider
   *
   * The provider will be added to the end of the list. If multiple providers can resolve the same
   * symbol, the first registered provider takes precedence.
   *
   * This also clears the resolution cache for the fallback provider to ensure that cached fallback
   * results are re-evaluated against the new provider. There's no need to clear the cache of other
   * providers, as new providers are added to the end of the list and will only be used if earlier
   * providers don't return a result.
   *
   * @param provider - Data provider instance
   */
  registerProvider(provider: DataProvider): void {
    this.clearCacheForProvider(FALLBACK_PROVIDER_NAME);
    this.providers.push(provider);
  }

  /**
   * Query for a symbol across all registered providers
   *
   * Tries each provider in order until one returns a result. The query is normalized before
   * querying providers: `symbol`, `ISIN`, and `CUSIP` are trimmed and uppercased, while `name` is
   * only trimmed. Therefore, queries that differ only in whitespace or casing are treated as
   * identical.
   *
   * **Note:** If all query fields end up missing or empty after normalization, providers are not
   * queried and a result with an empty symbol is returned immediately, as there is no meaningful
   * way to resolve an empty query.
   *
   * **Note:** If a cache hit contains result from the fallback provider, it will be treated as no
   * result from providers and `null` will be returned immediately. This is because fallback result
   * means that no provider was able to resolve the query when `querySymbolWithFallback()` was
   * called previously with the same query, and fallback result was returned.
   *
   * @param query - Symbol query parameters
   * @returns Symbol result from the first provider that has data, or `null` if no provider could resolve the symbol
   */
  querySymbol(query: SymbolQuery): SymbolResult | null {
    const logger = Logger.getInstance();

    const normalizedQuery = this.normalizeQuery(query);
    if (
      !normalizedQuery.symbol &&
      !normalizedQuery.isin &&
      !normalizedQuery.cusip &&
      !normalizedQuery.name
    ) {
      logger.warn(
        `Received a query with ${bold("all fields missing or empty")} -> returning ${bold("empty")} symbol`,
      );
      return {
        symbol: UNKNOWN_SYMBOL,
        provider: FALLBACK_PROVIDER_NAME,
      };
    }

    const formattedQuery = this.formatQueryForLogging(query);
    const cachedResult = this.getFromCache(normalizedQuery);
    if (cachedResult) {
      if (cachedResult.provider === FALLBACK_PROVIDER_NAME) {
        // Cached result is from the fallback — this means that no provider was able to resolve the
        // query last time it was attempted, so we can skip querying providers again
        return null;
      } else {
        if (cachedResult.symbol !== query.symbol) {
          // Log only if the resulting symbol is different from the original query symbol
          logger.trace(
            `Using cached result for ${formattedQuery} -> ${bold(cachedResult.symbol)} (provider: ${bold(cachedResult.provider)})`,
          );
        }

        return cachedResult;
      }
    }

    // Try each provider in registration order
    for (const provider of this.providers) {
      if (!provider.canHandle(normalizedQuery)) {
        continue;
      }

      const symbol = provider.query(normalizedQuery);
      if (symbol) {
        const result = {
          symbol,
          provider: provider.getName(),
        };
        logger.info(
          `Resolved ${formattedQuery} -> ${bold(result.symbol)} (provider: ${bold(result.provider)})`,
        );

        return this.addToCache(normalizedQuery, result);
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
    const result = this.querySymbol(query);
    if (result) {
      return result;
    }

    const logger = Logger.getInstance();
    const normalizedQuery = this.normalizeQuery(query);
    const formattedQuery = this.formatQueryForLogging(query);

    const cachedResult = this.getFromCache(normalizedQuery);
    if (cachedResult) {
      // `querySymbol()` will return `null` for fallback cache entries, so we need to re-check the
      // cache for a fallback result.
      logger.trace(
        `Using cached result for ${formattedQuery} -> ${bold(cachedResult.symbol)} (provider: ${bold(cachedResult.provider)})`,
      );
      return cachedResult;
    }

    // Fallback: return the symbol based on the original query values in the priority order: symbol,
    // ISIN, CUSIP, sanitized name
    const symbol =
      normalizedQuery.symbol ||
      normalizedQuery.isin ||
      normalizedQuery.cusip ||
      sanitizeName(normalizedQuery.name, UNKNOWN_SYMBOL);

    // When query has a symbol and resolution doesn't return a result, this only means that there is
    // no override for that symbol. So we only log when there is no symbol in the query.
    if (!normalizedQuery.symbol) {
      logger.warn(`Couldn't resolve ${formattedQuery} -> falling back to ${bold(symbol)}`);
    }

    return this.addToCache(normalizedQuery, {
      symbol,
      provider: FALLBACK_PROVIDER_NAME,
    });
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
   *
   * This also clears the resolution cache to ensure that stale results from removed providers are
   * not returned on subsequent queries.
   */
  clearProviders(): void {
    this.clearCache();
    this.providers = [];
  }

  /**
   * Get the number of registered providers
   */
  getProviderCount(): number {
    return this.providers.length;
  }

  /**
   * Format a symbol query for logging
   *
   * The resulting string includes only non-empty fields with appropriate labels and formatting.
   *
   * @param query - Symbol query to format
   * @returns Formatted string for logging
   */
  private formatQueryForLogging(query: SymbolQuery): string {
    return `${formatLoggedValue(query.symbol, "symbol ", bold("empty") + " symbol")}${formatLoggedValue(query.isin, ", ISIN: ")}${formatLoggedValue(query.cusip, ", CUSIP: ")}${formatLoggedValue(query.name, ", name: ")}`;
  }

  /**
   * Normalize a symbol query by trimming whitespace and uppercasing identifiers
   *
   * `symbol`, `isin`, and `cusip` are trimmed and uppercased; `name` is only trimmed. This ensures
   * that queries that differ only in whitespace or casing are treated as identical for caching and
   * provider querying purposes.
   */
  private normalizeQuery(query: SymbolQuery): SymbolQuery {
    return {
      symbol: query.symbol?.trim().toUpperCase(),
      isin: query.isin?.trim().toUpperCase(),
      cusip: query.cusip?.trim().toUpperCase(),
      name: query.name?.trim(),
    };
  }

  /**
   * Add a resolved symbol result to the cache for a given query
   *
   * Pass a normalized query to ensure consistent caching. This ensures that subsequent queries that
   * differ only in whitespace or casing will hit the same cache entry.
   *
   * @param query - Symbol query, preferably normalized
   * @param result - Symbol result to cache
   * @returns `query` that was passed as an argument (for method chaining)
   */
  private addToCache(query: SymbolQuery, result: SymbolResult): SymbolResult {
    const cacheKey = JSON.stringify(query);
    // Store a copy to prevent external mutations from affecting the cache
    this.resolutionCache[cacheKey] = { ...result };
    return result;
  }

  /**
   * Retrieve a symbol result from the cache for a given query
   *
   * Pass a normalized query to ensure consistent cache retrieval. This ensures that queries that
   * differ only in whitespace or casing will hit the same cache entry.
   *
   * @param query - Symbol query, preferably normalized
   * @returns Cached symbol result if found, or `undefined` if not in cache
   */
  private getFromCache(query: SymbolQuery): SymbolResult | undefined {
    const cacheKey = JSON.stringify(query);
    const result = this.resolutionCache[cacheKey];
    // Return a copy to prevent external mutations from affecting the cache
    return result ? { ...result } : undefined;
  }

  /**
   * Clear the whole resolution cache
   */
  private clearCache(): void {
    this.resolutionCache = {};
  }

  /**
   * Clear only results from a specific provider in the resolution cache
   *
   * This is useful when a provider is removed, to ensure that stale results from that provider are
   * not returned on subsequent queries without clearing the entire cache and losing results from
   * other providers.
   *
   * @param providerName - Name of the provider whose cached results should be cleared
   */
  private clearCacheForProvider(providerName: string): void {
    for (const key in this.resolutionCache) {
      if (this.resolutionCache[key].provider === providerName) {
        delete this.resolutionCache[key];
      }
    }
  }
}
