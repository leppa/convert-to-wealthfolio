/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Logger, LogLevel } from "../../src/core/Logger";
import {
  Overrides,
  OverridesDataProvider,
  parseOverridesFile,
} from "../../src/data-providers/OverridesDataProvider";

Logger.setLogLevel(LogLevel.ERROR);

describe("OverridesDataProvider", () => {
  let overrides: Overrides;
  let provider: OverridesDataProvider;

  beforeEach(() => {
    overrides = {
      symbols: new Map([
        ["AAPL", "AAPL.US"],
        ["MSFT", "MSFT.US"],
      ]),
      isin: new Map([
        ["US0378331005", "AAPL.ISIN"],
        ["US5949181045", "MSFT.ISIN"],
      ]),
      cusip: new Map([
        ["037833100", "AAPL.CUSIP"],
        ["594918104", "MSFT.CUSIP"],
      ]),
      names: new Map([
        ["APPLE INC", "AAPL.NAME"],
        ["MICROSOFT CORPORATION", "MSFT.NAME"],
      ]),
    };

    provider = new OverridesDataProvider(overrides);
  });

  it("should expose provider metadata", () => {
    expect(provider.getName()).toBe("Overrides");
    expect(provider.getDescription()).toContain("INI file");
  });

  it("should resolve by symbol", () => {
    expect(provider.query({ symbol: "AAPL" })).toEqual({ symbol: "AAPL.US" });
  });

  it("should resolve using various identifier types with pre-normalized inputs", () => {
    expect(provider.query({ symbol: "MSFT" })).toEqual({ symbol: "MSFT.US" });
    expect(provider.query({ isin: "US0378331005" })).toEqual({ symbol: "AAPL.ISIN" });
    expect(provider.query({ cusip: "594918104" })).toEqual({ symbol: "MSFT.CUSIP" });
    expect(provider.query({ name: "APPLE INC" })).toEqual({ symbol: "AAPL.NAME" });
  });

  it("should prefer symbol over ISIN, CUSIP, and name", () => {
    const result = provider.query({
      symbol: "AAPL",
      isin: "US5949181045",
      cusip: "594918104",
      name: "MICROSOFT CORPORATION",
    });

    expect(result).toEqual({ symbol: "AAPL.US" });
  });

  it("should prefer ISIN over CUSIP and name when symbol is not available", () => {
    const result = provider.query({
      isin: "US5949181045",
      cusip: "037833100",
      name: "APPLE INC",
    });

    expect(result).toEqual({ symbol: "MSFT.ISIN" });
  });

  it("should prefer CUSIP over name when symbol and ISIN are not available", () => {
    const result = provider.query({
      cusip: "037833100",
      name: "MICROSOFT CORPORATION",
    });

    expect(result).toEqual({ symbol: "AAPL.CUSIP" });
  });

  it("should return empty result when no override is found", () => {
    expect(
      provider.query({
        name: "Non Existent Inc.",
        symbol: "UNKNOWN",
      }),
    ).toEqual({ symbol: undefined });
    expect(provider.query({})).toEqual({ symbol: undefined });
  });
});

describe("parseOverridesFile", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "overrides-provider-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should parse and normalize Symbol, ISIN, CUSIP, and Name sections", () => {
    const iniPath = path.join(tmpDir, "overrides.ini");

    fs.writeFileSync(
      iniPath,
      [
        "[Symbol]",
        " aapl = aapl.us ",
        "MsFt= msft.us",
        "",
        "[ISIN]",
        " us0378331005 = aapl-isin ",
        "",
        "[CUSIP]",
        " 037833100 = aapl-cusip ",
        "",
        "[Name]",
        " apple inc = aapl-name ",
        "",
      ].join("\n"),
      "utf-8",
    );

    const parsed = parseOverridesFile(iniPath);

    expect(parsed.symbols.get("AAPL")).toBe("AAPL.US");
    expect(parsed.symbols.get("MSFT")).toBe("MSFT.US");
    expect(parsed.isin.get("US0378331005")).toBe("AAPL-ISIN");
    expect(parsed.cusip.get("037833100")).toBe("AAPL-CUSIP");
    expect(parsed.names.get("APPLE INC")).toBe("AAPL-NAME");
  });

  it("should return empty maps when sections are missing", () => {
    const iniPath = path.join(tmpDir, "minimal.ini");
    fs.writeFileSync(iniPath, "[Other]\nA=B\n", "utf-8");

    const parsed = parseOverridesFile(iniPath);

    expect(parsed.symbols.size).toBe(0);
    expect(parsed.isin.size).toBe(0);
    expect(parsed.cusip.size).toBe(0);
    expect(parsed.names.size).toBe(0);
  });

  it("should throw when overrides file does not exist", () => {
    const missingPath = path.join(tmpDir, "missing.ini");

    expect(() => parseOverridesFile(missingPath)).toThrow(
      `Overrides file not found: ${path.resolve(missingPath)}`,
    );
  });
});
