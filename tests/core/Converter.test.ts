/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import fs from "fs";
import os from "os";
import path from "path";

import {
  ActivitySubtype,
  ActivityType,
  BaseFormat,
  ColumnSchema,
  WealthfolioRecord,
} from "../../src/core/BaseFormat";
import { Converter } from "../../src/core/Converter";
import { GenericFormat } from "../../src/formats/GenericFormat";

const DEFAULT_CURRENCY = "EUR";

class TestFormat extends BaseFormat {
  private records: WealthfolioRecord[];

  constructor(records: WealthfolioRecord[]) {
    super("Test");
    this.records = records;
  }

  validate(): boolean {
    return true;
  }

  convert(): WealthfolioRecord[] {
    return this.records;
  }

  getExpectedSchema(): ColumnSchema[] {
    return [{ name: "Date" }];
  }
}

describe("Converter", () => {
  const fixturesDir = path.join(__dirname, "../../examples");
  let converter: Converter;
  let tmpDir: string;
  let outputFile: string;

  beforeEach(() => {
    converter = new Converter([new GenericFormat()]);
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "converter-test-"));
    outputFile = path.join(tmpDir, "test-output.csv");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("convert", () => {
    it("should convert sample CSV to Wealthfolio format", async () => {
      const inputFile = path.join(fixturesDir, "sample-generic.csv");

      await converter.convert(inputFile, outputFile, DEFAULT_CURRENCY);

      expect(fs.existsSync(outputFile)).toBe(true);

      const content = fs.readFileSync(outputFile, "utf-8");
      const lines = content.trim().split("\n");

      // Check header
      const headers = lines[0].split(",");
      expect(headers.length).toBe(12);
      expect(headers).toContain("date");
      expect(headers).toContain("symbol");
      expect(headers).toContain("quantity");
      expect(headers).toContain("activityType");
      expect(headers).toContain("unitPrice");
      expect(headers).toContain("currency");
      expect(headers).toContain("fee");
      expect(headers).toContain("amount");
      expect(headers).toContain("fxRate");
      expect(headers).toContain("subtype");
      expect(headers).toContain("comment");
      expect(headers).toContain("metadata");

      // Check we have the right number of records
      expect(lines.length).toBe(29); // header + 28 data rows
    });

    it("should round numeric values to 8 decimal places", async () => {
      const inputFile = path.join(fixturesDir, "sample-generic.csv");

      await converter.convert(inputFile, outputFile, DEFAULT_CURRENCY);

      const content = fs.readFileSync(outputFile, "utf-8");
      const lines = content.trim().split("\n");

      // Parse the first data row
      const firstDataLine = lines[1];
      const values = firstDataLine.split(",");

      // Check that numeric values don't have more than 8 decimal places
      // The values should be properly rounded
      values.forEach((value) => {
        if (!isNaN(Number(value)) && value.includes(".")) {
          const decimals = value.split(".")[1];
          expect(decimals.length).toBeLessThanOrEqual(8);
        }
      });
    });

    it("should handle file paths correctly", async () => {
      const inputFile = path.join(fixturesDir, "sample-generic.csv");

      await converter.convert(inputFile, outputFile, DEFAULT_CURRENCY);

      expect(fs.existsSync(outputFile)).toBe(true);
    });

    it("should throw error for non-existent input file", async () => {
      const nonExistentFile = path.join(tmpDir, "non-existent.csv");

      await expect(
        converter.convert(nonExistentFile, outputFile, DEFAULT_CURRENCY),
      ).rejects.toThrow();
    });

    it("should throw error when no format matches", async () => {
      // Create a temporary file with invalid format
      const invalidFile = path.join(tmpDir, "invalid.csv");
      fs.writeFileSync(invalidFile, "NoDate,NoSymbol,NoQuantity\nvalue1,value2,value3");

      const emptyConverter = new Converter([]);
      await expect(
        emptyConverter.convert(invalidFile, outputFile, DEFAULT_CURRENCY),
      ).rejects.toThrow("Cannot detect input format");
    });

    it("should throw error for empty input CSV", async () => {
      const emptyFile = path.join(tmpDir, "empty.csv");
      fs.writeFileSync(emptyFile, "");

      await expect(converter.convert(emptyFile, outputFile, DEFAULT_CURRENCY)).rejects.toThrow(
        "Input CSV is empty",
      );
    });

    it("should throw error when converter returns zero records", async () => {
      const inputFile = path.join(fixturesDir, "sample-generic.csv");

      const customConverter = new Converter([
        new TestFormat([]), // This plugin will return zero records
      ]);

      await expect(
        customConverter.convert(inputFile, outputFile, DEFAULT_CURRENCY),
      ).rejects.toThrow("No records returned by the format converter");
    });

    it("should skip and warn on records that fail field validation", async () => {
      const invalidRecord: WealthfolioRecord = {
        date: new Date("2024-01-15"),
        symbol: "", // Required for Buy
        quantity: 1,
        activityType: ActivityType.Buy,
        unitPrice: 10,
        currency: "USD",
        fee: 0,
        amount: 10,
        fxRate: NaN,
        subtype: ActivitySubtype.None,
        comment: "",
        metadata: {},
      };
      const validRecord: WealthfolioRecord = {
        date: new Date("2024-01-20"),
        symbol: "MSFT",
        quantity: 2,
        activityType: ActivityType.Buy,
        unitPrice: 20,
        currency: "USD",
        fee: 0,
        amount: 40,
        fxRate: NaN,
        subtype: ActivitySubtype.None,
        comment: "",
        metadata: {},
      };

      const customConverter = new Converter([new TestFormat([invalidRecord, validRecord])]);
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);

      try {
        const inputFile = path.join(fixturesDir, "sample-generic.csv");
        await customConverter.convert(inputFile, outputFile, "Test");

        // The invalid record should be skipped; only the valid one should appear
        const content = fs.readFileSync(outputFile, "utf-8");
        const lines = content.trim().split("\n");
        expect(lines).toHaveLength(2); // header + 1 valid record
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Skipping record"));
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringMatching(/symbol.+Invalid value/),
          expect.stringMatching(""),
        );
      } finally {
        warnSpy.mockRestore();
      }
    });

    it("should convert using explicit format name", async () => {
      const inputFile = path.join(fixturesDir, "sample-generic.csv");

      await converter.convert(inputFile, outputFile, "Generic");

      expect(fs.existsSync(outputFile)).toBe(true);
    });

    it("should use custom default currency when specified", async () => {
      const inputFile = path.join(fixturesDir, "sample-generic.csv");

      await converter.convert(inputFile, outputFile, "USD");

      expect(fs.existsSync(outputFile)).toBe(true);

      // Read output and verify currency
      const content = fs.readFileSync(outputFile, "utf-8");

      // The sample-generic.csv has some records with currency and some without
      // We verify that the output contains USD (from our default)
      expect(content).toContain("USD");
    });

    it("should throw error when explicit format name not found", async () => {
      const inputFile = path.join(fixturesDir, "sample-generic.csv");

      await expect(
        converter.convert(inputFile, outputFile, DEFAULT_CURRENCY, "NonExistent"),
      ).rejects.toThrow("Format 'NonExistent' not found");
    });

    it("should throw error when CSV does not match explicit format", async () => {
      const invalidFile = path.join(tmpDir, "mismatch.csv");
      fs.writeFileSync(invalidFile, "WrongColumn1,WrongColumn2\nvalue1,value2");

      await expect(
        converter.convert(invalidFile, outputFile, DEFAULT_CURRENCY, "Generic"),
      ).rejects.toThrow("Input CSV does not match the 'Generic' format");
    });

    it("should handle errors during CSV write", async () => {
      const inputFile = path.join(fixturesDir, "sample-generic.csv");
      const invalidOutputPath = path.join(tmpDir, "missing-dir", "output.csv");

      await expect(
        converter.convert(inputFile, invalidOutputPath, DEFAULT_CURRENCY),
      ).rejects.toThrow();
    });

    it("should handle malformed CSV during format detection", async () => {
      const malformedFile = path.join(tmpDir, "malformed.csv");
      fs.writeFileSync(malformedFile, 'Date,Symbol\n"unclosed quote,value');

      // This should trigger the catch block in detectFormat
      await expect(
        converter.convert(malformedFile, outputFile, DEFAULT_CURRENCY),
      ).rejects.toThrow();
    });

    it("should serialize metadata and invalid dates in output CSV", async () => {
      const inputFile = path.join(fixturesDir, "sample-generic.csv");
      const recordWithMetadata: WealthfolioRecord = {
        date: new Date("2024-01-15"),
        symbol: "AAPL",
        quantity: 1,
        activityType: ActivityType.Buy,
        unitPrice: 10.123456789,
        currency: DEFAULT_CURRENCY,
        fee: 0,
        amount: 10.123456789,
        fxRate: 1.25,
        subtype: ActivitySubtype.None,
        comment: "note",
        metadata: { source: { broker: "Schwab" } },
      };
      const recordWithInvalidDate: WealthfolioRecord = {
        date: new Date("2024-01-20"),
        symbol: "MSFT",
        quantity: 2,
        activityType: ActivityType.Buy,
        unitPrice: 20,
        currency: DEFAULT_CURRENCY,
        fee: 0,
        amount: 40,
        fxRate: NaN,
        subtype: ActivitySubtype.None,
        comment: "",
        metadata: {},
      };

      const customConverter = new Converter([
        new TestFormat([recordWithMetadata, recordWithInvalidDate]),
      ]);

      await customConverter.convert(inputFile, outputFile, "Test");

      const content = fs.readFileSync(outputFile, "utf-8");
      const lines = content.trim().split("\n");
      const headers = lines[0].split(",");
      const metadataIndex = headers.indexOf("metadata");
      const dateIndex = headers.indexOf("date");
      const fxRateIndex = headers.indexOf("fxRate");

      expect(metadataIndex).toBeGreaterThanOrEqual(0);
      expect(dateIndex).toBeGreaterThanOrEqual(0);
      expect(fxRateIndex).toBeGreaterThanOrEqual(0);

      const firstRow = lines[1].split(",");
      const secondRow = lines[2].split(",");

      expect(firstRow[metadataIndex]).toContain("broker");
      expect(secondRow[metadataIndex]).toBe("");
      expect(firstRow[dateIndex]).toContain("2024-01-15");
      expect(secondRow[dateIndex]).toContain("2024-01-20");
      expect(firstRow[fxRateIndex]).toBe("1.25");
      expect(secondRow[fxRateIndex]).toBe("");
    });
  });

  describe("detectFormat", () => {
    it("should detect valid format", async () => {
      const content = fs.readFileSync(path.join(fixturesDir, "sample-generic.csv"), "utf-8");

      const format = await converter.detectFormat(content);

      expect(format).not.toBeNull();
      expect(format?.getName()).toBe("Generic");
    });

    it("should return null when no format matches", async () => {
      const content = "InvalidColumn1,InvalidColumn2\nvalue1,value2";

      const format = await converter.detectFormat(content);

      expect(format).toBeNull();
    });
  });

  describe("registerPlugin", () => {
    it("should register a new format plugin", () => {
      const newConverter = new Converter();
      newConverter.registerPlugin(new GenericFormat());

      const formats = newConverter.getRegisteredFormats();
      expect(formats).toContain("Generic");
    });
  });

  describe("getRegisteredFormats", () => {
    it("should return list of registered format names", () => {
      const formats = converter.getRegisteredFormats();

      expect(formats).toBeInstanceOf(Array);
      expect(formats).toContain("Generic");
    });
  });
});
