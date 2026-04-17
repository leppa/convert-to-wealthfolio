/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { DataProvider, SymbolQuery, SymbolResult } from "../../src/core/DataProvider";

class TestProvider extends DataProvider {
  constructor(description?: string) {
    super("Test", description);
  }

  query(_: SymbolQuery): SymbolResult {
    return {};
  }
}

describe("DataProvider", () => {
  let provider: DataProvider;

  beforeEach(() => {
    provider = new TestProvider("A test provider");
  });

  it("should expose name and description", () => {
    expect(provider.getName()).toBe("Test");
    expect(provider.getDescription()).toBe("A test provider");

    const providerNoDesc = new TestProvider();
    expect(providerNoDesc.getName()).toBe("Test");
    expect(providerNoDesc.getDescription()).toBe("");
  });

  it("should have `canHandle` return `true` by default", () => {
    const query: SymbolQuery = { symbol: "AAPL" };
    expect(provider.canHandle(query)).toBe(true);
  });

  it("should have `canHandle` return `true` for any query", () => {
    expect(provider.canHandle({})).toBe(true);
    expect(provider.canHandle({ symbol: "MSFT" })).toBe(true);
    expect(provider.canHandle({ isin: "US0378331005" })).toBe(true);
    expect(provider.canHandle({ cusip: "037833100" })).toBe(true);
    expect(provider.canHandle({ name: "Apple" })).toBe(true);
  });
});
