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
 */
export interface SymbolQuery {
  /** Symbol/ticker name (e.g., AAPL, or can be the key for lookup) */
  symbol?: string;
  /** ISIN code */
  isin?: string;
  /** CUSIP identifier */
  cusip?: string;
  /** Company/asset name */
  name?: string;
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
   * @returns Resolved symbol string or `null` if not found
   */
  abstract query(query: SymbolQuery): string | null;

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
