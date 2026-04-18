/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { bold, red } from "colorette";
import { isISIN } from "validator";

import { DataProvider, DataProviderInfo, SymbolQuery, SymbolResult } from "./DataProvider";
import { Logger } from "./Logger";
import { formatLoggedValue, formatPair, sanitizeName } from "./Utils";

const FALLBACK_PROVIDER_NAME = "Fallback";

/**
 * Result from a symbol query
 */
export interface SymbolQueryResult {
  /** Resolved symbol */
  symbol?: string;
  /** Resolved ISIN */
  isin?: string;
  /** Which provider this result came from */
  provider: string;
}

/**
 * Manages symbol data providers and orchestrates symbol queries
 */
export class SymbolDataService {
  private providers: DataProvider[] = [];
  private resolutionCache: Record<string, SymbolQueryResult> = {};

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
   * **Note:** If all query fields end up missing after normalization, providers are not queried and
   * `null` is returned immediately, as there is no meaningful way to resolve an empty query.
   *
   * **Note:** If a cache hit contains result from the fallback provider, it will be treated as no
   * result from providers and `null` will be returned immediately. This is because fallback result
   * means that no provider was able to resolve the query when `querySymbolWithFallback()` was
   * called previously with the same query, and fallback result was returned.
   *
   * @param query - Symbol query parameters
   * @returns Symbol result from the first provider that has data, or `null` if no provider could resolve the symbol
   */
  querySymbol(query: SymbolQuery): SymbolQueryResult | null {
    const logger = Logger.getInstance();

    const normalizedQuery = this.normalizeQuery(query);
    if (
      !normalizedQuery.symbol &&
      !normalizedQuery.isin &&
      !normalizedQuery.cusip &&
      !normalizedQuery.name
    ) {
      logger.warn(
        `Received a query with ${bold("all fields missing or empty")} -> returning ${bold("null")}`,
      );
      return null;
    }

    const formattedQuery = this.formatQueryForLogging(query);
    const cachedResult = this.getFromCache(normalizedQuery);
    if (cachedResult) {
      if (cachedResult.provider === FALLBACK_PROVIDER_NAME) {
        // Cached result is from the fallback — this means that no provider was able to resolve the
        // query last time it was attempted, so we can skip querying providers again
        return null;
      } else {
        logger.trace(
          `Using cached result for ${formattedQuery} -> ${formatPair([cachedResult.symbol, cachedResult.isin], ["Symbol ", "ISIN "])} (provider: ${bold(cachedResult.provider)})`,
        );

        return cachedResult;
      }
    }

    // Try each provider in registration order
    for (const provider of this.providers) {
      const result = this.queryProvider(provider, normalizedQuery);
      if (!result) {
        continue;
      }

      logger.info(
        `Resolved ${formattedQuery} -> ${formatPair([result.symbol, result.isin], ["Symbol ", "ISIN "])} (provider: ${bold(result.provider)})`,
      );

      return this.addToCache(normalizedQuery, result);
    }

    // No provider found a result
    return null;
  }

  /**
   * Returns a result with fallback to the original query values
   *
   * `symbol` and `isin` will never be `undefined` in the returned result — if they are missing from
   * the provider result, they will be replaced with the original query values or empty strings.
   *
   * This simplifies the logic for format plugins that want to use symbol resolution as returned
   * values can be used directly without additional checks and fallbacks.
   *
   * @param query - Symbol query parameters
   * @returns Symbol result with fallback to the original query values or empty strings
   */
  querySymbolWithFallback(query: SymbolQuery): Required<SymbolQueryResult> {
    const logger = Logger.getInstance();
    const normalizedQuery = this.normalizeQuery(query);
    if (
      !normalizedQuery.symbol &&
      !normalizedQuery.isin &&
      !normalizedQuery.cusip &&
      !normalizedQuery.name
    ) {
      logger.warn(
        `Received a query with ${bold("all fields missing or empty")} -> returning ${bold("empty")} result`,
      );

      return {
        symbol: "",
        isin: "",
        provider: FALLBACK_PROVIDER_NAME,
      };
    }

    const fallbackSymbol = normalizedQuery.symbol || "";
    const fallbackISIN = normalizedQuery.isin || "";

    const result = this.querySymbol(query);
    if (result) {
      return this.withFallbackValues(result, fallbackSymbol, fallbackISIN);
    }

    const formattedQuery = this.formatQueryForLogging(query);

    // `querySymbol()` will return `null` for fallback cache entries, so we need to re-check the
    // cache for a fallback result.
    const cachedResult = this.getFromCache(normalizedQuery);
    if (cachedResult) {
      const result = this.withFallbackValues(cachedResult, fallbackSymbol, fallbackISIN);
      logger.trace(
        `Using cached result for ${formattedQuery} -> ${formatPair([result.symbol, result.isin], ["Symbol ", "ISIN "])} (provider: ${bold(result.provider)})`,
      );
      return result;
    }

    // For fallback, synthesize a symbol based on the original query values in the priority order:
    // symbol, empty symbol when ISIN is present, CUSIP, sanitized name
    const symbol =
      normalizedQuery.symbol ||
      // If ISIN is known, don't fallback to CUSIP or name, as ISIN will be returned in the result
      // and should be included in the dedicated column of the output CSV
      (normalizedQuery.isin
        ? undefined
        : normalizedQuery.cusip || sanitizeName(normalizedQuery.name));

    const fallbackResult = this.withFallbackValues(
      this.addToCache(normalizedQuery, {
        symbol,
        isin: normalizedQuery.isin,
        provider: FALLBACK_PROVIDER_NAME,
      }),
      fallbackSymbol,
      fallbackISIN,
    );

    // When query has a symbol and resolution doesn't return a result, this only means that there is
    // no override for that symbol. So we only log when there is no symbol in the query.
    if (!normalizedQuery.symbol) {
      logger.warn(
        `Couldn't resolve ${formattedQuery} -> falling back to ${formatPair([fallbackResult.symbol, fallbackResult.isin], ["symbol ", "ISIN "])}`,
      );
    }

    return fallbackResult;
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
   * Query the data provider with additional guard against provider returning query values
   *
   * @param provider - Data provider to query
   * @param normalizedQuery - Symbol query parameters
   * @returns Resolved symbol result if provider returns a result, `null` otherwise
   */
  private queryProvider(
    provider: DataProvider,
    normalizedQuery: SymbolQuery,
  ): SymbolQueryResult | null {
    if (!provider.canHandle(normalizedQuery)) {
      return null;
    }

    let { symbol, isin } = this.normalizeProviderResult(provider.query(normalizedQuery));

    // In addition to empty values, guard against providers returning symbol and ISIN that are
    // identical to the query (i.e. when they simply copy the query values)
    if (!symbol || symbol === normalizedQuery.symbol) {
      symbol = undefined;
    }
    if (!isin || isin === normalizedQuery.isin) {
      isin = undefined;
    }
    if (isin && !isISIN(isin)) {
      Logger.getInstance().warn(
        `${bold("Ignoring")} ${red("invalid ISIN")} for ${this.formatQueryForLogging(normalizedQuery)} -> ${bold(isin)} (provider: ${bold(provider.getName())})`,
      );
      isin = undefined;
    }

    if (!symbol && !isin) {
      return null;
    }

    // Normalize the result from the provider as well in case the provider returns values with extra
    // whitespace or inconsistent casing
    return {
      symbol,
      isin,
      provider: provider.getName(),
    };
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
   * `symbol`, `isin`, and `cusip` are trimmed and uppercased; `name` is only trimmed. Empty values
   * are converted to `undefined`. This ensures that queries that differ only in whitespace or
   * casing are treated as identical for caching and provider querying purposes.
   *
   * @param query - Symbol query to normalize
   * @returns Normalized symbol query
   */
  private normalizeQuery(query: SymbolQuery): SymbolQuery {
    return {
      symbol: query.symbol?.trim().toUpperCase() || undefined,
      isin: query.isin?.trim().toUpperCase() || undefined,
      cusip: query.cusip?.trim().toUpperCase() || undefined,
      name: query.name?.trim() || undefined,
    };
  }

  /**
   * Normalize a symbol query result by trimming whitespace and uppercasing the symbol and ISIN
   *
   * All fields are trimmed and uppercased. Empty values are converted to `undefined`.
   *
   * @param result - Symbol query result to normalize
   * @returns Normalized symbol query result
   */
  private normalizeProviderResult(result: SymbolResult): SymbolResult {
    return {
      symbol: result.symbol?.trim().toUpperCase() || undefined,
      isin: result.isin?.trim().toUpperCase() || undefined,
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
  private addToCache(query: SymbolQuery, result: SymbolQueryResult): SymbolQueryResult {
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
  private getFromCache(query: SymbolQuery): SymbolQueryResult | undefined {
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

  /**
   * Combine a symbol query result with fallback values for missing fields
   *
   * @param result - Symbol query result to combine with fallback values
   * @param symbol - Fallback symbol to use if `result.symbol` is missing
   * @param isin - Fallback ISIN to use if `result.isin` is missing
   * @returns A new symbol query result with fallback values for missing fields, guaranteed to have `symbol` and `isin`
   */
  private withFallbackValues(
    result: SymbolQueryResult,
    symbol: string,
    isin: string,
  ): Required<SymbolQueryResult> {
    return {
      symbol: result.symbol || symbol,
      isin: result.isin || isin,
      provider: result.provider,
    };
  }
}
