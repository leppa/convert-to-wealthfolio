/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { DataProvider, SymbolQuery } from "../../src/core/DataProvider";
import { SymbolDataService } from "../../src/core/SymbolDataService";

// Silence logging during tests
import { Logger, LogLevel } from "../../src/core/Logger";
Logger.setLogLevel(LogLevel.ERROR);

class TestProvider extends DataProvider {
  private readonly resolver: (query: SymbolQuery) => string | null;
  private readonly canHandleResolver: (query: SymbolQuery) => boolean;

  constructor(
    name: string,
    resolver: (query: SymbolQuery) => string | null,
    canHandleResolver: (query: SymbolQuery) => boolean = () => true,
    description?: string,
  ) {
    super(name, description);
    this.resolver = resolver;
    this.canHandleResolver = canHandleResolver;
  }

  query(query: SymbolQuery): string | null {
    return this.resolver(query);
  }

  canHandle(query: SymbolQuery): boolean {
    return this.canHandleResolver(query);
  }
}

describe("SymbolDataService", () => {
  let service: SymbolDataService;

  beforeEach(() => {
    service = new SymbolDataService();
  });

  it("should register providers and expose provider info", () => {
    service.registerProvider(
      new TestProvider(
        "ProviderA",
        () => null,
        () => true,
        "first",
      ),
    );
    service.registerProvider(
      new TestProvider(
        "ProviderB",
        () => null,
        () => true,
        "second",
      ),
    );

    expect(service.getProviderCount()).toBe(2);
    expect(service.getRegisteredProviders()).toEqual([
      { name: "ProviderA", description: "first" },
      { name: "ProviderB", description: "second" },
    ]);
  });

  it("should clear providers", () => {
    service.registerProvider(new TestProvider("ProviderA", () => null));

    service.clearProviders();

    expect(service.getProviderCount()).toBe(0);
    expect(service.getRegisteredProviders()).toEqual([]);
  });

  it("should query providers in registration order and return first match", () => {
    service.registerProvider(new TestProvider("First", () => "AAPL"));
    service.registerProvider(new TestProvider("Second", () => "MSFT"));

    const result = service.querySymbol({ symbol: "AAPL" });

    expect(result).toEqual({ symbol: "AAPL", provider: "First" });
  });

  it("should skip provider when `canHandle()` returns `false`", () => {
    service.registerProvider(
      new TestProvider(
        "SkipMe",
        () => "AAPL",
        () => false,
      ),
    );
    service.registerProvider(new TestProvider("Active", () => "MSFT"));

    const result = service.querySymbol({ symbol: "anything" });

    expect(result).toEqual({ symbol: "MSFT", provider: "Active" });
  });

  it("should return `null` when no providers resolve a symbol", () => {
    service.registerProvider(new TestProvider("ProviderA", () => null));
    service.registerProvider(new TestProvider("ProviderB", () => null));

    expect(service.querySymbol({ symbol: "UNKNOWN" })).toBeNull();
  });

  it("should return provider result in `querySymbolWithFallback()` when resolved", () => {
    service.registerProvider(new TestProvider("ProviderA", () => "AAPL"));

    const result = service.querySymbolWithFallback({ symbol: "aapl" });

    expect(result).toEqual({ symbol: "AAPL", provider: "ProviderA" });
  });

  it("should fallback to normalized symbol when providers do not resolve", () => {
    service.registerProvider(new TestProvider("ProviderA", () => null));

    const result = service.querySymbolWithFallback({ symbol: "  msft  " });

    expect(result).toEqual({ symbol: "MSFT", provider: "Fallback" });
  });

  it("should fallback in priority order when symbol is missing", () => {
    service.registerProvider(new TestProvider("ProviderA", () => null));

    const isinResult = service.querySymbolWithFallback({
      isin: " us0378331005 ",
      cusip: "037833100",
      name: "Apple Inc",
    });
    const cusipResult = service.querySymbolWithFallback({
      cusip: " 38259p508 ",
      name: "Google LLC",
    });
    const nameResult = service.querySymbolWithFallback({
      name: "Google LLC",
    });

    expect(isinResult).toEqual({ symbol: "", provider: "Fallback" });
    expect(cusipResult).toEqual({ symbol: "38259P508", provider: "Fallback" });
    expect(nameResult).toEqual({ symbol: "GOOGLE-LLC", provider: "Fallback" });
  });

  it("should return sanitized name when no symbol, ISIN, or CUSIP are provided", () => {
    service.registerProvider(new TestProvider("ProviderA", () => null));

    const result = service.querySymbolWithFallback({
      name: "ACME, Inc. / Class-A",
    });

    expect(result).toEqual({ symbol: "ACME-INC-CLASS-A", provider: "Fallback" });
  });

  it("should return empty fallback symbol when query contains no usable fields", () => {
    service.registerProvider(new TestProvider("ProviderA", () => null));

    const result = service.querySymbol({});

    expect(result).toEqual({ symbol: "", provider: "Fallback" });
  });

  it("should call provider only once for repeated identical queries", () => {
    const resolver = jest.fn(() => "AAPL");
    service.registerProvider(new TestProvider("ProviderA", resolver));

    service.querySymbol({ isin: "US0378331005" });
    service.querySymbol({ isin: "US0378331005" });
    service.querySymbolWithFallback({ isin: "US0378331005", cusip: "037833100" });
    service.querySymbol({ isin: "US0378331005" });

    expect(resolver).toHaveBeenCalledTimes(2);
  });

  it("should treat queries with different whitespace and casing as identical", () => {
    const resolver = jest.fn(() => "AAPL");
    service.registerProvider(new TestProvider("ProviderA", resolver));

    service.querySymbolWithFallback({ symbol: "  aapl  " });
    service.querySymbolWithFallback({ symbol: "AAPL" });
    service.querySymbol({ symbol: "aapl" });

    expect(resolver).toHaveBeenCalledTimes(1);
  });

  it("should re-evaluate fallback cache entries after a new provider is registered", () => {
    // First provider cannot resolve — result is cached as Fallback
    service.registerProvider(new TestProvider("ProviderA", () => null));
    expect(service.querySymbolWithFallback({ cusip: "037833100" })).toEqual({
      symbol: "037833100",
      provider: "Fallback",
    });

    // Register a second provider that can resolve
    const resolverB = jest.fn(() => "AAPL");
    service.registerProvider(new TestProvider("ProviderB", resolverB));

    // The fallback cache entry must have been cleared — ProviderB should now be queried
    expect(service.querySymbolWithFallback({ cusip: "037833100" })).toEqual({
      symbol: "AAPL",
      provider: "ProviderB",
    });
    expect(resolverB).toHaveBeenCalledTimes(1);
  });

  it("should not evict non-fallback cache entries when a new provider is registered", () => {
    // ProviderA resolves the query — result is cached as ProviderA
    const resolverA = jest.fn(() => "AAPL");
    service.registerProvider(new TestProvider("ProviderA", resolverA));
    service.querySymbolWithFallback({ isin: "US0378331005" });
    expect(resolverA).toHaveBeenCalledTimes(1);

    // Register a second provider
    const resolverB = jest.fn(() => "MSFT");
    service.registerProvider(new TestProvider("ProviderB", resolverB));
    expect(service.querySymbolWithFallback({ isin: "US0378331005" })).toEqual({
      symbol: "AAPL",
      provider: "ProviderA",
    });

    // Still only one call from the first query
    expect(resolverA).toHaveBeenCalledTimes(1);
    expect(resolverB).not.toHaveBeenCalled();
  });

  it("should clear the entire cache when all providers are cleared", () => {
    // ProviderA resolves and the result gets cached
    const resolverA = jest.fn(() => "AAPL");
    service.registerProvider(new TestProvider("ProviderA", resolverA));
    service.querySymbol({ isin: "US0378331005" });
    expect(resolverA).toHaveBeenCalledTimes(1);

    // Clearing providers must also wipe the cache
    service.clearProviders();

    // Register a new provider and re-query — new provider must be called
    const resolverB = jest.fn(() => "MSFT");
    service.registerProvider(new TestProvider("ProviderB", resolverB));
    expect(service.querySymbolWithFallback({ isin: "US0378331005" })).toEqual({
      symbol: "MSFT",
      provider: "ProviderB",
    });
    expect(resolverB).toHaveBeenCalledTimes(1);
  });

  it("should return `null` from `querySymbol()` without querying providers when a Fallback cache entry exists", () => {
    // Provider cannot resolve — result is cached as Fallback
    const resolver = jest.fn(() => null);
    service.registerProvider(new TestProvider("ProviderA", resolver));
    service.querySymbolWithFallback({ cusip: "037833100" });
    expect(resolver).toHaveBeenCalledTimes(1);

    // Direct querySymbol() should hit the Fallback cache entry and return null immediately
    const result = service.querySymbol({ cusip: "037833100" });

    expect(result).toBeNull();
    // Still only one call from the first query
    expect(resolver).toHaveBeenCalledTimes(1);

    // querySymbolWithFallback(), on the other hand, should hit the Fallback cache entry and return
    // the result
    const resultWithFallback = service.querySymbolWithFallback({ cusip: "037833100" });

    expect(resultWithFallback).toEqual({
      symbol: "037833100",
      provider: "Fallback",
    });
    // Still only one call from the first query
    expect(resolver).toHaveBeenCalledTimes(1);
  });
});
