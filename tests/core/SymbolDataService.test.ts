/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { DataProvider, SymbolQuery } from "../../src/core/DataProvider";
import { Logger, LogLevel } from "../../src/core/Logger";
import { SymbolDataService } from "../../src/core/SymbolDataService";

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

    expect(isinResult).toEqual({ symbol: "US0378331005", provider: "Fallback" });
    expect(cusipResult).toEqual({ symbol: "38259P508", provider: "Fallback" });
  });

  it("should sanitize name when no symbol, ISIN, or CUSIP are provided", () => {
    service.registerProvider(new TestProvider("ProviderA", () => null));

    expect(
      service.querySymbolWithFallback({
        name: "  ACME, Inc. / Class-A-  ",
      }),
    ).toEqual({ symbol: "ACME-INC-CLASS-A", provider: "Fallback" });

    expect(
      service.querySymbolWithFallback({
        name: "Some@Weird#Name_With$Special%Characters",
      }),
    ).toEqual({ symbol: "SOME-WEIRD-NAME-WITH-SPECIAL-CHARACTERS", provider: "Fallback" });
  });

  it("should return empty fallback symbol when query contains no usable fields", () => {
    service.registerProvider(new TestProvider("ProviderA", () => null));

    const result = service.querySymbolWithFallback({});

    expect(result).toEqual({ symbol: "", provider: "Fallback" });
  });

  it("should log debug with empty symbol marker when `query.symbol` is missing but provider resolves", () => {
    service.registerProvider(new TestProvider("ProviderA", () => "AAPL.RESOLVED"));

    const result = service.querySymbolWithFallback({
      isin: "US0378331005",
    });

    expect(result).toEqual({ symbol: "AAPL.RESOLVED", provider: "ProviderA" });
  });

  it("should include all query fields in debug message when they are present", () => {
    service.registerProvider(new TestProvider("ProviderA", () => "RESOLVED"));

    const result = service.querySymbolWithFallback({
      symbol: "AAPL",
      isin: "US0378331005",
      cusip: "037833100",
      name: "Apple Inc",
    });

    expect(result).toEqual({ symbol: "RESOLVED", provider: "ProviderA" });
  });
});
