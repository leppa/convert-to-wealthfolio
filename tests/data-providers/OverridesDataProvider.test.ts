/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  OverridesByType,
  OverridesDataProvider,
  parseOverridesFile,
} from "../../src/data-providers/OverridesDataProvider";

import { Logger, LogLevel } from "../../src/core/Logger";
Logger.setLogLevel(LogLevel.ERROR);

describe("OverridesDataProvider", () => {
  let overrides: OverridesByType;
  let provider: OverridesDataProvider;

  beforeEach(() => {
    overrides = {
      symbol: {
        symbols: new Map([
          ["AAPL", "AAPL.US"],
          ["MSFT", "MSFT.US"],
        ]),
        isins: new Map([
          ["US0378331005", "AAPL.ISIN"],
          ["US5949181045", "MSFT.ISIN"],
        ]),
        cusips: new Map([
          ["037833100", "AAPL.CUSIP"],
          ["594918104", "MSFT.CUSIP"],
        ]),
        names: new Map([
          ["APPLE INC", "AAPL.NAME"],
          ["MICROSOFT CORPORATION", "MSFT.NAME"],
        ]),
      },
    };

    provider = new OverridesDataProvider(overrides);
  });

  it("should expose provider metadata", () => {
    expect(provider.getName()).toBe("Overrides");
    expect(provider.getDescription()).toContain("INI file");
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

  it("should resolve ISIN from isin section by ISIN key", () => {
    const isinProvider = new OverridesDataProvider({
      isin: {
        symbols: new Map(),
        isins: new Map([["US0378331005", "US0378331005-OVERRIDE"]]),
        cusips: new Map(),
        names: new Map(),
      },
    });

    expect(isinProvider.query({ isin: "US0378331005" })).toEqual({
      symbol: undefined,
      isin: "US0378331005-OVERRIDE",
    });
  });

  it("should resolve ISIN from isin section by symbol key", () => {
    const isinProvider = new OverridesDataProvider({
      isin: {
        symbols: new Map([["AAPL", "US0378331005"]]),
        isins: new Map(),
        cusips: new Map(),
        names: new Map(),
      },
    });

    expect(isinProvider.query({ symbol: "AAPL" })).toEqual({
      symbol: undefined,
      isin: "US0378331005",
    });
  });

  it("should resolve both symbol and ISIN when both sections are populated", () => {
    const combinedProvider = new OverridesDataProvider({
      symbol: {
        symbols: new Map([["AAPL", "AAPL.US"]]),
        isins: new Map(),
        cusips: new Map(),
        names: new Map(),
      },
      isin: {
        symbols: new Map([["AAPL", "US0378331005"]]),
        isins: new Map(),
        cusips: new Map(),
        names: new Map(),
      },
    });

    expect(combinedProvider.query({ symbol: "AAPL" })).toEqual({
      symbol: "AAPL.US",
      isin: "US0378331005",
    });
  });

  it("should resolve ISIN from isin section by CUSIP key", () => {
    const isinProvider = new OverridesDataProvider({
      isin: {
        symbols: new Map(),
        isins: new Map(),
        cusips: new Map([["037833100", "US0378331005"]]),
        names: new Map(),
      },
    });

    expect(isinProvider.query({ cusip: "037833100" })).toEqual({
      symbol: undefined,
      isin: "US0378331005",
    });
  });

  it("should resolve ISIN from isin section by name key", () => {
    const isinProvider = new OverridesDataProvider({
      isin: {
        symbols: new Map(),
        isins: new Map(),
        cusips: new Map(),
        names: new Map([["APPLE INC", "US0378331005"]]),
      },
    });

    expect(isinProvider.query({ name: "Apple Inc" })).toEqual({
      symbol: undefined,
      isin: "US0378331005",
    });
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

  it("should parse and normalize [Symbol.*] sections", () => {
    const iniPath = path.join(tmpDir, "overrides.ini");

    fs.writeFileSync(
      iniPath,
      [
        "[Symbol.Symbol]",
        " aapl = aapl.us ",
        "MsFt= msft.us",
        "",
        "[Symbol.ISIN]",
        " us0378331005 = aapl-isin ",
        "",
        "[Symbol.CUSIP]",
        " 037833100 = aapl-cusip ",
        "",
        "[Symbol.Name]",
        " apple inc = aapl-name ",
        "",
      ].join("\n"),
      "utf-8",
    );

    const parsed = parseOverridesFile(iniPath);

    expect(parsed.symbol).toBeDefined();
    expect(parsed.symbol?.symbols.get("AAPL")).toBe("AAPL.US");
    expect(parsed.symbol?.symbols.get("MSFT")).toBe("MSFT.US");
    expect(parsed.symbol?.isins.get("US0378331005")).toBe("AAPL-ISIN");
    expect(parsed.symbol?.cusips.get("037833100")).toBe("AAPL-CUSIP");
    expect(parsed.symbol?.names.get("APPLE INC")).toBe("AAPL-NAME");
  });

  it("should parse and normalize [ISIN.*] sections", () => {
    const iniPath = path.join(tmpDir, "isin-overrides.ini");

    fs.writeFileSync(
      iniPath,
      [
        "[ISIN.ISIN]",
        " us0378331005 = us5949181045 ",
        "",
        "[ISIN.Symbol]",
        " aapl = us0378331005 ",
        "",
      ].join("\n"),
      "utf-8",
    );

    const parsed = parseOverridesFile(iniPath);

    expect(parsed.isin).toBeDefined();
    expect(parsed.isin?.isins.get("US0378331005")).toBe("US5949181045");
    expect(parsed.isin?.symbols.get("AAPL")).toBe("US0378331005");
    expect(parsed.symbol).toBeUndefined();
  });

  it("should parse both [Symbol.*] and [ISIN.*] sections from a single file", () => {
    const iniPath = path.join(tmpDir, "combined-overrides.ini");

    fs.writeFileSync(
      iniPath,
      [
        "[Symbol.Symbol]",
        "aapl = aapl.us",
        "",
        "[Symbol.ISIN]",
        "us0378331005 = aapl-isin",
        "",
        "[ISIN.Symbol]",
        "aapl = us0378331005",
        "",
        "[ISIN.ISIN]",
        "us0378331005 = us5949181045",
        "",
      ].join("\n"),
      "utf-8",
    );

    const parsed = parseOverridesFile(iniPath);

    expect(parsed.symbol).toBeDefined();
    expect(parsed.symbol?.symbols.get("AAPL")).toBe("AAPL.US");
    expect(parsed.symbol?.isins.get("US0378331005")).toBe("AAPL-ISIN");

    expect(parsed.isin).toBeDefined();
    expect(parsed.isin?.symbols.get("AAPL")).toBe("US0378331005");
    expect(parsed.isin?.isins.get("US0378331005")).toBe("US5949181045");
  });

  it("should ignore invalid ISIN values in [ISIN.*] sections", () => {
    const iniPath = path.join(tmpDir, "invalid-isin.ini");

    fs.writeFileSync(
      iniPath,
      [
        "[ISIN.ISIN]",
        "US0378331005 = NOTANISIN",
        "[ISIN.Symbol]",
        "AAPL = INVALID_ISIN",
        "[ISIN.CUSIP]",
        "037833100 = NOT_AN_ISIN",
        "[ISIN.Name]",
        "APPLE INC = WRONG_ISIN",
        "",
      ].join("\n"),
      "utf-8",
    );

    const parsed = parseOverridesFile(iniPath);
    expect(parsed.isin).toBeDefined();
    expect(parsed.isin?.isins.get("US0378331005")).toBeUndefined();
    expect(parsed.isin?.symbols.get("AAPL")).toBeUndefined();
    expect(parsed.isin?.cusips.get("037833100")).toBeUndefined();
    expect(parsed.isin?.names.get("APPLE INC")).toBeUndefined();
  });

  it("should return undefined for symbol and isin when sections are missing", () => {
    const iniPath = path.join(tmpDir, "minimal.ini");
    fs.writeFileSync(iniPath, "[Other]\nA=B\n", "utf-8");

    const parsed = parseOverridesFile(iniPath);

    expect(parsed.symbol).toBeUndefined();
    expect(parsed.isin).toBeUndefined();
  });

  it("should throw when overrides file does not exist", () => {
    const missingPath = path.join(tmpDir, "missing.ini");

    expect(() => parseOverridesFile(missingPath)).toThrow(
      `Overrides file not found: ${path.resolve(missingPath)}`,
    );
  });
});
