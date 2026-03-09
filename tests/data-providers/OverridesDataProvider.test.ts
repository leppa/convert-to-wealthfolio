/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import fs from "fs";
import os from "os";
import path from "path";

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
    expect(provider.query({ symbol: "AAPL" })).toBe("AAPL.US");
  });

  it("should normalize lookup keys from query fields", () => {
    expect(provider.query({ symbol: "  msft  " })).toBe("MSFT.US");
    expect(provider.query({ isin: "  us0378331005 " })).toBe("AAPL.ISIN");
    expect(provider.query({ cusip: "  594918104 " })).toBe("MSFT.CUSIP");
    expect(provider.query({ name: "  apple inc " })).toBe("AAPL.NAME");
  });

  it("should prefer symbol over ISIN, CUSIP, and name", () => {
    const result = provider.query({
      symbol: "AAPL",
      isin: "US5949181045",
      cusip: "594918104",
      name: "MICROSOFT CORPORATION",
    });

    expect(result).toBe("AAPL.US");
  });

  it("should prefer ISIN over CUSIP and name when symbol is not available", () => {
    const result = provider.query({
      isin: "US5949181045",
      cusip: "037833100",
      name: "APPLE INC",
    });

    expect(result).toBe("MSFT.ISIN");
  });

  it("should prefer CUSIP over name when symbol and ISIN are not available", () => {
    const result = provider.query({
      cusip: "037833100",
      name: "MICROSOFT CORPORATION",
    });

    expect(result).toBe("AAPL.CUSIP");
  });

  it("should return null when no override is found", () => {
    expect(
      provider.query({
        name: "Non Existent Inc.",
        symbol: "UNKNOWN",
      }),
    ).toBeNull();
    expect(provider.query({})).toBeNull();
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
