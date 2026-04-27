/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { bold } from "colorette";

import { ActivitySubtype, ActivityType, InstrumentType } from "../../src/core/BaseFormat";
import { Converter } from "../../src/core/Converter";
import { SymbolDataService } from "../../src/core/SymbolDataService";
import { OverridesDataProvider } from "../../src/data-providers";
import { GenericFormat } from "../../src/formats/GenericFormat";

// Silence logging during tests
import { Logger, LogLevel } from "../../src/core/Logger";
Logger.setLogLevel(LogLevel.ERROR);

const DEFAULT_CURRENCY = "EUR";

describe("Generic Format", () => {
  let format: GenericFormat;
  let symbolDataService: SymbolDataService;

  beforeEach(() => {
    format = new GenericFormat();
    symbolDataService = new SymbolDataService();
  });

  describe("validate", () => {
    it("should return `true` for records with all required columns", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "BUY",
          symbol: "AAPL",
          quantity: 100,
          unitprice: 150.25,
        },
        {
          date: new Date("2024-01-20"),
          transactiontype: "SELL",
          symbol: "MSFT",
          quantity: 50,
          unitprice: 350.1,
        },
      ];
      expect(format.validate(records)).toBe(true);
    });

    it("should return `true` for records with ISIN field", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "BUY",
          isin: "US0378331005",
          quantity: 100,
          unitprice: 150.25,
        },
      ];
      expect(format.validate(records)).toBe(true);
    });

    it("should return `true` for records with CUSIP field", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "BUY",
          cusip: "037833100",
          quantity: 100,
          unitprice: 150.25,
        },
      ];
      expect(format.validate(records)).toBe(true);
    });

    it("should return `true` for records with CompanyName field", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "BUY",
          companyname: "Apple Inc.",
          quantity: 100,
          unitprice: 150.25,
        },
      ];
      expect(format.validate(records)).toBe(true);
    });

    it("should return `false` for empty records", () => {
      expect(format.validate([])).toBe(false);
    });

    it("should return `false` for records missing required fields", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "BUY",
          symbol: "AAPL",
        },
      ];
      expect(format.validate(records)).toBe(false);
    });
  });

  describe("convert", () => {
    it("should convert sample CSV records correctly", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "BUY",
          symbol: "AAPL",
          quantity: 100,
          unitprice: 150.25,
          total: 15025,
        },
      ];

      const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        symbol: "AAPL",
        activityType: "BUY",
        quantity: 100,
        unitPrice: 150.25,
        amount: 15025,
        currency: DEFAULT_CURRENCY,
        fee: Number.NaN,
      });
      expect(result[0].date).toBeInstanceOf(Date);
      expect(result[0].date.toISOString()).toContain("2024-01-15");
    });

    it("should convert multiple records", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "BUY",
          symbol: "AAPL",
          quantity: 100,
          unitprice: 150.25,
          amount: 15025,
        },
        {
          date: new Date("2024-01-20"),
          transactiontype: "BUY",
          symbol: "MSFT",
          quantity: 50,
          unitprice: 350.1,
          amount: 17505,
        },
        {
          date: new Date("2024-02-01"),
          transactiontype: "SELL",
          symbol: "AAPL",
          quantity: 50,
          unitprice: 152.5,
          amount: 7625,
        },
      ];

      const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

      expect(result).toHaveLength(3);
      expect(result[0].symbol).toBe("AAPL");
      expect(result[1].symbol).toBe("MSFT");
      expect(result[2].symbol).toBe("AAPL");
    });

    it("should handle `NaN` values", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "BUY",
          symbol: "AAPL",
          quantity: Number.NaN,
          unitprice: Number.NaN,
          fee: 3.5,
        },
      ];

      const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

      expect(result[0]).toMatchObject({
        quantity: Number.NaN,
        unitPrice: Number.NaN,
        fee: 3.5,
        amount: Number.NaN,
      });
    });

    it("should handle missing optional fields", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "BUY",
          symbol: "AAPL",
          quantity: 100,
          unitprice: 150.25,
        },
      ];

      const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

      expect(result[0].currency).toBe(DEFAULT_CURRENCY);
    });

    it("should use custom default currency when specified", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "BUY",
          symbol: "AAPL",
          quantity: 100,
          unitprice: 150.25,
        },
      ];

      const result = format.convert(records, "GBP", symbolDataService);

      expect(result[0].currency).toBe("GBP");
    });

    it("should use record currency over default currency", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "BUY",
          symbol: "AAPL",
          quantity: 100,
          unitprice: 150.25,
          currency: "USD",
        },
      ];

      const result = format.convert(records, "GBP", symbolDataService);

      expect(result[0].currency).toBe("USD");
    });

    it("should calculate amount when not provided", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "BUY",
          symbol: "AAPL",
          quantity: 100,
          unitprice: 150.25,
        },
      ];

      const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

      expect(result[0].amount).toBe(100 * 150.25);
    });

    it("should map activity types correctly", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "BUY",
          symbol: "AAPL",
          quantity: 100,
          unitprice: 150.25,
          amount: 15025,
        },
        {
          date: new Date("2024-02-01"),
          transactiontype: "SELL",
          symbol: "AAPL",
          quantity: 50,
          unitprice: 152.5,
          amount: 7625,
        },
      ];

      const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

      expect(result[0].activityType).toBe(ActivityType.Buy);
      expect(result[1].activityType).toBe(ActivityType.Sell);
    });

    it("should map all activity types correctly", () => {
      const activityTypes = [
        { input: "BUY", expected: ActivityType.Buy },
        { input: "Purchase", expected: ActivityType.Buy },
        { input: "acquisition", expected: ActivityType.Buy },
        { input: "SELL", expected: ActivityType.Sell },
        { input: "Sale", expected: ActivityType.Sell },
        { input: "disposal", expected: ActivityType.Sell },
        { input: "DIVIDEND", expected: ActivityType.Dividend },
        { input: "INTEREST", expected: ActivityType.Interest },
        { input: "DEPOSIT", expected: ActivityType.Deposit },
        { input: "WITHDRAWAL", expected: ActivityType.Withdrawal },
        { input: "IN", expected: ActivityType.TransferIn },
        { input: "Transfer In", expected: ActivityType.TransferIn },
        { input: "transfer_in", expected: ActivityType.TransferIn },
        { input: "ADD", expected: ActivityType.TransferIn },
        { input: "OUT", expected: ActivityType.TransferOut },
        { input: "Transfer Out", expected: ActivityType.TransferOut },
        { input: "transfer_out", expected: ActivityType.TransferOut },
        { input: "REMOVE", expected: ActivityType.TransferOut },
        { input: "Dividends", expected: ActivityType.Dividend },
        { input: "FEE", expected: ActivityType.Fee },
        { input: "TAX", expected: ActivityType.Tax },
        { input: "SPLIT", expected: ActivityType.Split },
        { input: "CREDIT", expected: ActivityType.Credit },
        { input: "ADJUSTMENT", expected: ActivityType.Adjustment },
      ];

      activityTypes.forEach(({ input, expected }) => {
        const records = [
          {
            date: new Date("2024-01-15"),
            transactiontype: input,
            symbol: "AAPL",
            quantity: 100,
            unitprice: 150.25,
            amount: 15025,
          },
        ];

        const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);
        expect(result[0].activityType).toBe(expected);
      });
    });

    it("should warn and skip record with unknown activity type", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "UNKNOWN_TYPE",
          symbol: "AAPL",
          quantity: 100,
          unitprice: 150.25,
          amount: 15025,
        },
      ];

      const warnSpy = jest.spyOn(Logger.getInstance(), "warn").mockImplementation(() => undefined);
      try {
        const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);
        expect(result).toHaveLength(0);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Unknown activity type"));
      } finally {
        warnSpy.mockRestore();
      }
    });

    it("should warn and skip record with missing activity type", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "",
          symbol: "AAPL",
          quantity: 100,
          unitprice: 150.25,
          amount: 15025,
        },
      ];

      const warnSpy = jest.spyOn(Logger.getInstance(), "warn").mockImplementation(() => undefined);
      try {
        const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);
        expect(result).toHaveLength(0);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("No activity type"));
      } finally {
        warnSpy.mockRestore();
      }
    });

    it("should use total field when provided", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "BUY",
          symbol: "AAPL",
          quantity: 100,
          unitprice: 150.25,
          total: 15000, // Different from quantity * unitPrice
        },
      ];

      const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

      expect(result[0].amount).toBe(15000);
    });

    it("should calculate total from quantity and unitPrice when total is not provided", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "SELL",
          symbol: "AAPL",
          quantity: 100,
          unitprice: 150.25,
          fee: 10,
        },
      ];

      const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

      // For SELL, fee should be deducted (cash credit)
      expect(result[0].amount).toBe(100 * 150.25);
      expect(result[0].fee).toBe(10);
    });

    it("should handle missing symbol field", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "BUY",
          isin: "US0378331005",
          quantity: 100,
          unitprice: 150.25,
        },
      ];

      const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

      // When symbol is missing, ISIN is kept in the isin field and symbol stays empty
      expect(result[0].symbol).toBe("");
      expect(result[0].isin).toBe("US0378331005");
    });

    it("should handle missing quantity with default 0", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "DEPOSIT",
          symbol: "",
          quantity: 0,
          unitprice: 1,
          total: 1000,
        },
      ];

      const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

      expect(result[0].quantity).toBe(0);
    });

    it("should handle missing unitPrice with default 0", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "DEPOSIT",
          symbol: "",
          quantity: 1000,
          unitprice: 0,
          total: 1000,
        },
      ];

      const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

      expect(result[0].unitPrice).toBe(0);
    });

    it("should handle missing fee with default `NaN`", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "BUY",
          symbol: "AAPL",
          quantity: 100,
          unitprice: 150.25,
        },
      ];

      const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

      expect(result[0].fee).toBe(Number.NaN);
    });

    it("should preserve negative values for adjustment activity", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "ADJUSTMENT",
          symbol: "AAPL",
          quantity: -10,
          unitprice: -5,
          total: -50,
        },
      ];

      const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

      expect(result[0]).toMatchObject({
        quantity: -10,
        unitPrice: -5,
        amount: -50,
      });
    });

    it("should use fee value as amount for Fee activity when total is not provided", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "FEE",
          symbol: "",
          quantity: Number.NaN,
          unitprice: Number.NaN,
          fee: 10.5,
        },
      ];

      const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

      expect(result[0]).toMatchObject({
        activityType: ActivityType.Fee,
        amount: 10.5,
        fee: Number.NaN,
      });
    });

    describe("special cases", () => {
      let tmpDir: string;
      let outputFile: string;
      let converter: Converter;

      beforeEach(() => {
        converter = new Converter([format]);
        symbolDataService = new SymbolDataService();
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "generic-format-test-"));
        outputFile = path.join(tmpDir, "test-output.csv");
      });

      afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      });

      it("should trim whitespace from input values", async () => {
        const inputFile = path.join(tmpDir, "whitespace.csv");
        fs.writeFileSync(
          inputFile,
          [
            "Date,TransactionType,Symbol,Quantity,UnitPrice,Comment",
            '2024-01-15,   buy ,  "AAPL  ","  100.5",\t120, "\nUntrimmed comment\t"',
          ].join("\n"),
          "utf-8",
        );

        await converter.convert(inputFile, outputFile, DEFAULT_CURRENCY, "Generic");

        const content = fs.readFileSync(outputFile, "utf-8");
        const lines = content.trim().split("\n");
        expect(lines).toHaveLength(2); // Header + 1 data row

        const headers = lines[0].split(",");
        const symbolIndex = headers.indexOf("symbol");
        const quantityIndex = headers.indexOf("quantity");
        const activityTypeIndex = headers.indexOf("activityType");
        const unitPriceIndex = headers.indexOf("unitPrice");
        const amountIndex = headers.indexOf("amount");
        const commentIndex = headers.indexOf("comment");

        expect(symbolIndex).toBeGreaterThanOrEqual(0);
        expect(quantityIndex).toBeGreaterThanOrEqual(0);
        expect(activityTypeIndex).toBeGreaterThanOrEqual(0);
        expect(unitPriceIndex).toBeGreaterThanOrEqual(0);
        expect(amountIndex).toBeGreaterThanOrEqual(0);
        expect(commentIndex).toBeGreaterThanOrEqual(0);

        const dataRow = lines[1].split(",");
        expect(dataRow[symbolIndex]).toBe("AAPL");
        expect(dataRow[quantityIndex]).toBe("100.5");
        expect(dataRow[activityTypeIndex]).toBe("BUY");
        expect(dataRow[unitPriceIndex]).toBe("120");
        expect(dataRow[amountIndex]).toBe("12060"); // 100.5 * 120
        expect(dataRow[commentIndex]).toBe("Untrimmed comment");
      });

      it("should load invalid ISINs and fix the one that has overrides", async () => {
        const inputFile = path.join(tmpDir, "invalid-isins.csv");
        const overridesFile = path.join(tmpDir, "isin-overrides.ini");

        fs.writeFileSync(
          inputFile,
          [
            "Date,TransactionType,ISIN,Quantity,UnitPrice",
            // Wrong check digit but has override
            "2024-01-15,buy,US0378331000,100,120",
            // Invalid ISIN without override
            "2024-01-16,buy,INVALID_ISIN,50,200",
          ].join("\n"),
          "utf-8",
        );
        fs.writeFileSync(overridesFile, "[ISIN.ISIN]\nUS0378331000=US0378331005\n", "utf-8");

        const warnSpy = jest
          .spyOn(Logger.getInstance(), "warn")
          .mockImplementation(() => undefined);

        try {
          await converter.convert(inputFile, outputFile, "EUR", "Generic", overridesFile);

          const content = fs.readFileSync(outputFile, "utf-8");
          const lines = content.trim().split("\n");
          expect(lines).toHaveLength(2); // Header + 1 valid record
          expect(lines[1]).toContain("US0378331005");

          expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining(`Invalid value: ${bold("INVALID_ISIN")}`),
          );
        } finally {
          warnSpy.mockRestore();
        }
      });
    });
  });

  describe("getParseOptions", () => {
    it("should return parse options with column normalization", () => {
      const options = format.getParseOptions();

      expect(options).toBeDefined();
      expect(options.columns).toBeDefined();

      // Test the column transformation function
      if (typeof options.columns === "function") {
        const headers = ["Date", "Symbol", "  Quantity  ", "ACTIVITYTYPE"];
        const normalized = options.columns(headers);
        expect(normalized).toEqual(["date", "symbol", "quantity", "activitytype"]);
      }
    });

    it("should cast date and number fields", () => {
      const options = format.getParseOptions();
      expect(typeof options.cast).toBe("function");
      if (typeof options.cast !== "function") {
        return;
      }

      const cast = options.cast;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument,
      const dateValue = cast("2024-02-10", { column: "date" } as any) as Date;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument,
      const quantityValue = cast("12.5", { column: "quantity" } as any) as number;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument,
      const feeValue = cast("1.25", { column: "fee" } as any) as number;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument,
      const columnValue = cast("  abc  ", { column: "symbol" } as any) as string;

      expect(dateValue).toBeInstanceOf(Date);
      expect(dateValue.toISOString()).toContain("2024-02-10");
      expect(quantityValue).toBe(12.5);
      expect(feeValue).toBe(1.25);
      expect(columnValue).toBe("ABC");
    });

    it("should return normalized ISIN for a valid ISIN value", () => {
      const options = format.getParseOptions();
      expect(typeof options.cast).toBe("function");
      if (typeof options.cast !== "function") {
        return;
      }

      const cast = options.cast;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      expect(cast("us0378331005", { column: "isin", lines: 2 } as any)).toBe("US0378331005");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      expect(cast("", { column: "isin", lines: 2 } as any)).toBe("");
    });

    it("should warn and return the value as-is for an invalid ISIN value", () => {
      const options = format.getParseOptions();
      expect(typeof options.cast).toBe("function");
      if (typeof options.cast !== "function") {
        return;
      }

      const cast = options.cast;
      const warnSpy = jest.spyOn(Logger.getInstance(), "warn").mockImplementation(() => undefined);

      try {
        // Wrong check digit
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
        expect(cast("US0378331006", { column: "isin", lines: 2 } as any)).toBe("US0378331006");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
        expect(cast("NOTANISIN", { column: "isin", lines: 2 } as any)).toBe("NOTANISIN");

        expect(warnSpy).toHaveBeenCalledTimes(2);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid ISIN"));
      } finally {
        warnSpy.mockRestore();
      }
    });

    it("should return normalized CUSIP for a valid CUSIP value", () => {
      const options = format.getParseOptions();
      expect(typeof options.cast).toBe("function");
      if (typeof options.cast !== "function") {
        return;
      }

      const cast = options.cast;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      expect(cast("30303m102", { column: "cusip", lines: 2 } as any)).toBe("30303M102");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      expect(cast("", { column: "cusip", lines: 2 } as any)).toBe("");
    });

    it("should warn and return the value as-is for an invalid CUSIP value", () => {
      const options = format.getParseOptions();
      expect(typeof options.cast).toBe("function");
      if (typeof options.cast !== "function") {
        return;
      }

      const cast = options.cast;
      const warnSpy = jest.spyOn(Logger.getInstance(), "warn").mockImplementation(() => undefined);

      try {
        // Wrong check digit
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
        expect(cast("037833102", { column: "cusip", lines: 2 } as any)).toBe("037833102");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
        expect(cast("NOTACUSIP!", { column: "cusip", lines: 2 } as any)).toBe("NOTACUSIP!");

        expect(warnSpy).toHaveBeenCalledTimes(2);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid CUSIP"));
      } finally {
        warnSpy.mockRestore();
      }
    });

    it("should warn and return `undefined` for invalid currency", () => {
      const options = format.getParseOptions();
      expect(typeof options.cast).toBe("function");
      if (typeof options.cast !== "function") {
        return;
      }

      const cast = options.cast;
      const warnSpy = jest.spyOn(Logger.getInstance(), "warn").mockImplementation(() => undefined);

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
        expect(cast("INVALID", { column: "currency", lines: 2 } as any)).toBeUndefined();
        // Three letters but not a valid currency code
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
        expect(cast("ZZZ", { column: "currency", lines: 2 } as any)).toBeUndefined();
        // Empty string means currency is not specified, so no warning and return empty string
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
        expect(cast("", { column: "currency", lines: 2 } as any)).toBe("");
        expect(warnSpy).toHaveBeenCalledTimes(2);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid currency code"));
      } finally {
        warnSpy.mockRestore();
      }
    });
  });

  describe("private helpers", () => {
    // FIXME: Rewrite to avoid using private methods directly
    /* eslint-disable @typescript-eslint/no-unsafe-call */
    it("should map instrument types for supported aliases", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const mapInstrumentType = (format as any).mapInstrumentType.bind(format);

      const aliases: Array<[string, InstrumentType]> = [
        ["equity", InstrumentType.Equity],
        ["stock", InstrumentType.Equity],
        ["etf", InstrumentType.Equity],
        ["mutualfund", InstrumentType.Equity],
        ["mutual_fund", InstrumentType.Equity],
        ["mutual fund", InstrumentType.Equity],
        ["index", InstrumentType.Equity],
        ["crypto", InstrumentType.Crypto],
        ["cryptocurrency", InstrumentType.Crypto],
        ["crypto_currency", InstrumentType.Crypto],
        ["crypto currency", InstrumentType.Crypto],
        ["fx", InstrumentType.Fx],
        ["forex", InstrumentType.Fx],
        ["currency", InstrumentType.Fx],
        ["option", InstrumentType.Option],
        ["opt", InstrumentType.Option],
        ["metal", InstrumentType.Metal],
        ["commodity", InstrumentType.Metal],
        ["bond", InstrumentType.Bond],
        ["fixedincome", InstrumentType.Bond],
        ["fixed_income", InstrumentType.Bond],
        ["fixed income", InstrumentType.Bond],
        ["debt", InstrumentType.Bond],
      ];

      aliases.forEach(([input, expected]) => {
        expect(mapInstrumentType(input)).toBe(expected);
      });

      expect(mapInstrumentType("unknown_type")).toBe(InstrumentType.Unknown);
      expect(mapInstrumentType("   ")).toBe(InstrumentType.Unknown);
      expect(mapInstrumentType()).toBe(InstrumentType.Unknown);
    });

    it("should map activity subtypes for supported activities", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const mapActivitySubtype = (format as any).mapActivitySubtype.bind(format);

      const aliases: Array<[ActivityType, string | undefined, ActivitySubtype]> = [
        [ActivityType.Dividend, "", ActivitySubtype.None],
        [ActivityType.Dividend, "drip", ActivitySubtype.DRIP],
        [ActivityType.Dividend, "qualified_dividend", ActivitySubtype.QualifiedDividend],
        [ActivityType.Dividend, "ordinary_dividend", ActivitySubtype.OrdinaryDividend],
        [ActivityType.Dividend, "return_of_capital", ActivitySubtype.ReturnOfCapital],
        [ActivityType.Dividend, "dividend_in_kind", ActivitySubtype.DividendInKind],
        [ActivityType.Dividend, "unknown", ActivitySubtype.None],
        [ActivityType.Interest, "", ActivitySubtype.None],
        [ActivityType.Interest, "staking_reward", ActivitySubtype.StakingReward],
        [ActivityType.Interest, "lending_interest", ActivitySubtype.LendingInterest],
        [ActivityType.Interest, "coupon", ActivitySubtype.Coupon],
        [ActivityType.Interest, "unknown", ActivitySubtype.None],
        [ActivityType.Fee, "", ActivitySubtype.None],
        [ActivityType.Fee, "management_fee", ActivitySubtype.ManagementFee],
        [ActivityType.Fee, "adr_fee", ActivitySubtype.ADRFee],
        [ActivityType.Fee, "interest_charge", ActivitySubtype.InterestCharge],
        [ActivityType.Fee, "unknown", ActivitySubtype.None],
        [ActivityType.Tax, "", ActivitySubtype.None],
        [ActivityType.Tax, "withholding", ActivitySubtype.Withholding],
        [ActivityType.Tax, "nra_withholding", ActivitySubtype.NRAWithholding],
        [ActivityType.Tax, "unknown", ActivitySubtype.None],
        [ActivityType.Credit, "", ActivitySubtype.None],
        [ActivityType.Credit, "bonus", ActivitySubtype.Bonus],
        [ActivityType.Credit, "rebate", ActivitySubtype.Rebate],
        [ActivityType.Credit, "refund", ActivitySubtype.Refund],
        [ActivityType.Credit, "unknown", ActivitySubtype.None],
        [ActivityType.Adjustment, "nonexistent_subtype", ActivitySubtype.None],
        [ActivityType.Buy, "drip", ActivitySubtype.None],
        [ActivityType.Dividend, undefined, ActivitySubtype.None],
      ];

      aliases.forEach(([activityType, input, expected]) => {
        const record = input === undefined ? {} : { transactionsubtype: input };
        expect(mapActivitySubtype(record, activityType)).toBe(expected);
      });
    });
    /* eslint-enable @typescript-eslint/no-unsafe-call */
  });

  describe("getExpectedSchema", () => {
    it("should return expected schema", () => {
      const schema = format.getExpectedSchema();
      const columnNames = schema.map((col) => col.name);

      expect(columnNames).toEqual(
        expect.arrayContaining([
          "Date",
          "TransactionType",
          "TransactionSubtype",
          "InstrumentType",
          "Symbol",
          "ISIN",
          "CUSIP",
          "CompanyName",
          "Quantity",
          "UnitPrice",
          "Fee",
          "Total",
          "Currency",
          "FXRate",
          "Comment",
        ]),
      );
    });
  });

  describe("getName", () => {
    it("should return the format name", () => {
      expect(format.getName()).toBe("Generic");
    });
  });

  describe("overrides", () => {
    it("should convert ISIN to symbol using overrides", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "BUY",
          isin: "US0378331005",
          quantity: 100,
          unitprice: 150.25,
          amount: 15025,
        },
      ];

      const overrides = {
        symbol: {
          symbols: new Map(),
          isins: new Map([["US0378331005", "AAPL"]]),
          cusips: new Map(),
          names: new Map(),
        },
      };

      symbolDataService.registerProvider(new OverridesDataProvider(overrides));
      const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

      expect(result[0].symbol).toBe("AAPL");
    });

    it("should convert CUSIP to symbol using overrides", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "BUY",
          cusip: "037833100",
          quantity: 100,
          unitprice: 150.25,
          amount: 15025,
        },
      ];

      const overrides = {
        symbol: {
          symbols: new Map(),
          isins: new Map(),
          cusips: new Map([["037833100", "AAPL"]]),
          names: new Map(),
        },
      };

      symbolDataService.registerProvider(new OverridesDataProvider(overrides));
      const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

      expect(result[0].symbol).toBe("AAPL");
    });

    it("should convert company name to symbol using overrides", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "BUY",
          companyname: "Apple Inc.",
          quantity: 100,
          unitprice: 150.25,
          amount: 15025,
        },
      ];

      const overrides = {
        symbol: {
          symbols: new Map(),
          isins: new Map(),
          cusips: new Map(),
          // Keys are always uppercased when loaded from an INI file
          names: new Map([["APPLE INC.", "AAPL"]]),
        },
      };

      symbolDataService.registerProvider(new OverridesDataProvider(overrides));
      const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

      expect(result[0].symbol).toBe("AAPL");
    });

    it("should prefer symbol over ISIN when both are present", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "BUY",
          symbol: "AAPL",
          isin: "US0378331005",
          quantity: 100,
          unitprice: 150.25,
          amount: 15025,
        },
      ];

      const overrides = {
        symbol: {
          symbols: new Map(),
          isins: new Map([["US0378331005", "DIFFERENT"]]),
          cusips: new Map(),
          names: new Map(),
        },
      };

      symbolDataService.registerProvider(new OverridesDataProvider(overrides));
      const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

      expect(result[0].symbol).toBe("AAPL");
    });

    it("should prefer ISIN over CUSIP when symbol is missing", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "BUY",
          isin: "US0378331005",
          cusip: "037833100",
          quantity: 100,
          unitprice: 150.25,
          amount: 15025,
        },
      ];

      const overrides = {
        symbol: {
          symbols: new Map(),
          isins: new Map([["US0378331005", "AAPL"]]),
          cusips: new Map([["037833100", "CUSIP_APPLE"]]),
          names: new Map(),
        },
      };

      symbolDataService.registerProvider(new OverridesDataProvider(overrides));
      const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

      expect(result[0].symbol).toBe("AAPL");
    });

    it("should make ISIN uppercase when no override is found", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "BUY",
          isin: "us0378331005",
          quantity: 100,
          unitprice: 150.25,
          amount: 15025,
        },
      ];

      const overrides = {
        symbol: {
          symbols: new Map(),
          isins: new Map(),
          cusips: new Map(),
          names: new Map(),
        },
      };

      symbolDataService.registerProvider(new OverridesDataProvider(overrides));
      const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

      expect(result[0].symbol).toBe("");
      expect(result[0].isin).toBe("US0378331005");
    });

    it("should make CUSIP uppercase when no override is found", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "BUY",
          cusip: "38259p508",
          quantity: 100,
          unitprice: 150.25,
          amount: 15025,
        },
      ];

      const overrides = {
        symbol: {
          symbols: new Map(),
          isins: new Map(),
          cusips: new Map(),
          names: new Map(),
        },
      };

      symbolDataService.registerProvider(new OverridesDataProvider(overrides));
      const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

      expect(result[0].symbol).toBe("38259P508");
    });

    it("should not modify symbols when no overrides are set", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "BUY",
          symbol: "AAPL",
          quantity: 100,
          unitprice: 150.25,
          amount: 15025,
        },
      ];

      const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

      expect(result[0].symbol).toBe("AAPL");
    });

    it("should resolve ISIN when symbol is present but ISIN is missing", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "BUY",
          symbol: "AAPL",
          cusip: "037833100",
          quantity: 100,
          unitprice: 150.25,
          amount: 15025,
        },
      ];

      const overrides = {
        isin: {
          symbols: new Map([["AAPL", "US0378331005"]]),
          isins: new Map(),
          cusips: new Map(),
          names: new Map(),
        },
      };

      symbolDataService.registerProvider(new OverridesDataProvider(overrides));
      const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

      // Symbol stays as-is; ISIN is resolved from the isin section via symbol key
      expect(result[0].symbol).toBe("AAPL");
      expect(result[0].isin).toBe("US0378331005");
    });
  });
});
