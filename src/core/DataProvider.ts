/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * Data provider information
 */
export interface DataProviderInfo {
  name: string;
  description?: string;
}

/**
 * Query parameters for symbol lookup
 *
 * At least one of `symbol`, `isin`, `cusip`, or `name` should be provided for a valid query.
 */
export interface SymbolQuery {
  /** Symbol / ticker name */
  symbol?: string;
  /** ISIN code */
  isin?: string;
  /** CUSIP identifier */
  cusip?: string;
  /** Company/asset name */
  name?: string;
}

/**
 * Result of a symbol query
 *
 * At least one of `symbol` or `isin` will be present if the query was successfully resolved.
 */
export interface SymbolResult {
  /** Resolved symbol / ticker name */
  symbol?: string;
  /** Resolved ISIN code */
  isin?: string;
}

/**
 * Base class for symbol data providers
 * Implement this to create custom data provider plugins
 */
export abstract class DataProvider {
  protected name: string;
  protected description?: string;

  constructor(name: string, description?: string) {
    this.name = name;
    this.description = description;
  }

  /**
   * Get the provider name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Get the provider description
   */
  getDescription(): string {
    return this.description || "";
  }

  /**
   * Query for a symbol and related identifiers
   *
   * @param query - Symbol query parameters
   * @returns Resolved symbol result or empty object if cannot resolve
   */
  abstract query(query: SymbolQuery): SymbolResult;

  /**
   * Optional: Check if this provider can handle the query
   * Used to skip providers that don't have data for certain lookup types
   *
   * @param query - Symbol query parameters
   * @returns `true` if this provider supports resolving this query, `false` otherwise
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  canHandle(query: SymbolQuery): boolean {
    return true; // Default: all providers can resolve all queries
  }
}
