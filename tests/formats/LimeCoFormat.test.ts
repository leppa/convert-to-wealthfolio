/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { ActivitySubtype, ActivityType } from "../../src/core/BaseFormat";
import { DataProvider, SymbolQuery, SymbolResult } from "../../src/core/DataProvider";
import { SymbolDataService } from "../../src/core/SymbolDataService";
import { LimeCoFormat } from "../../src/formats/LimeCoFormat";

// Silence logging during tests
import { Logger, LogLevel } from "../../src/core/Logger";
Logger.setLogLevel(LogLevel.ERROR);

const DEFAULT_CURRENCY = "USD";

describe("Lime.co Format", () => {
  let format: LimeCoFormat;
  let symbolDataService: SymbolDataService;

  beforeEach(() => {
    format = new LimeCoFormat();
    symbolDataService = new SymbolDataService();
  });

  describe("validate", () => {
    it("should validate correct Lime.co format", () => {
      const records = [
        {
          date: "2025-10-08 00:00:00",
          description: "Sell 108 MSFT @1.94",
          symbol: "MSFT",
          direction: "sell",
          quantity: "-108",
          price: "1.94",
          fees: "-0.87",
          amount: "208.65",
        },
      ];

      expect(format.validate(records)).toBe(true);
    });

    it("should reject invalid format", () => {
      const records = [
        {
          someother: "value",
          column: "value",
        },
      ];

      expect(format.validate(records)).toBe(false);
    });

    it("should reject empty records", () => {
      expect(format.validate([])).toBe(false);
    });

    it("should reject records with different column order", () => {
      const records = [
        {
          description: "Buy 10 AAPL @100",
          date: "2025-01-01 00:00:00",
          symbol: "AAPL",
          direction: "buy",
          quantity: "10",
          price: "100",
          fees: "0",
          amount: "1000",
        },
      ];

      expect(format.validate(records)).toBe(false);
    });
  });

  describe("convert", () => {
    describe("direction: buy / sell", () => {
      it("should convert buy transaction", () => {
        const records = [
          {
            date: new Date("2022-07-18T00:00:00"),
            description: "Buy 105 AAPL @4.75",
            symbol: "AAPL",
            direction: "buy",
            quantity: 105,
            price: 4.75,
            fees: 2.82,
            amount: 501.57,
          },
        ];

        const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          symbol: "AAPL",
          quantity: 105,
          activityType: ActivityType.Buy,
          unitPrice: 4.75,
          fee: 2.82,
          amount: 501.57,
        });
      });

      it("should convert sell transaction", () => {
        const records = [
          {
            date: new Date("2025-10-08T00:00:00"),
            description: "Sell 108 MSFT @1.94",
            symbol: "MSFT",
            direction: "sell",
            quantity: 108,
            price: 1.94,
            fees: 0.87,
            amount: 208.65,
          },
        ];

        const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          symbol: "MSFT",
          quantity: 108,
          activityType: ActivityType.Sell,
          unitPrice: 1.94,
          fee: 0.87,
        });
      });
    });

    describe("direction: deposit / withdrawal", () => {
      it("should convert deposit", () => {
        const records = [
          {
            date: new Date("2017-10-27T00:00:00"),
            description: "INCOMING WIRE BNY",
            symbol: "",
            direction: "deposit",
            quantity: 0,
            price: 0,
            fees: 0,
            amount: 2000,
          },
        ];

        const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          activityType: ActivityType.Deposit,
          amount: 2000,
        });
      });

      it("should convert interest deposit", () => {
        const records = [
          {
            date: new Date("2017-10-31T00:00:00"),
            description: "Interest Paid .10000% 8 DAYS,BAL= $4250",
            symbol: "",
            direction: "deposit",
            quantity: 0,
            price: 0,
            fees: 0,
            amount: 0.09,
          },
        ];

        const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          activityType: ActivityType.Interest,
          amount: 0.09,
        });
      });

      it("should convert dividend deposit", () => {
        const records = [
          {
            date: new Date("2024-06-05T00:00:00"),
            description: "Dividend PROSPECT CAPITA 75",
            symbol: "",
            direction: "deposit",
            quantity: 0,
            price: 0,
            fees: 0,
            amount: 1,
          },
          {
            date: new Date("2024-06-04T00:00:00"),
            description: "Cash Dividend ALTERA I 8.50PR 50",
            symbol: "",
            direction: "deposit",
            quantity: 0,
            price: 0,
            fees: 0,
            amount: 2,
          },
          {
            date: new Date("2019-06-03T00:00:00"),
            description: "Qualified Dividend COHEN & STEERS 10",
            symbol: "",
            direction: "deposit",
            quantity: 0,
            price: 0,
            fees: 0,
            amount: 2.08,
          },
        ];

        const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

        expect(result).toHaveLength(3);
        expect(result[0]).toMatchObject({
          symbol: "COHEN-STEERS", // Extracted from description
          activityType: ActivityType.Dividend,
          quantity: 10, // Extracted from description
          subtype: ActivitySubtype.QualifiedDividend,
          amount: 2.08,
        });
        expect(result[0].unitPrice).toBeCloseTo(2.08 / 10, 5);
        expect(result[1]).toMatchObject({
          symbol: "ALTERA-I-8-50PR", // Extracted from description
          activityType: ActivityType.Dividend,
          quantity: 50, // Extracted from description
          subtype: ActivitySubtype.OrdinaryDividend,
          amount: 2,
        });
        expect(result[1].unitPrice).toBeCloseTo(2 / 50, 5);
        expect(result[2]).toMatchObject({
          symbol: "PROSPECT-CAPITA", // Extracted from description
          activityType: ActivityType.Dividend,
          quantity: 75, // Extracted from description
          subtype: ActivitySubtype.None,
          amount: 1,
        });
        expect(result[2].unitPrice).toBeCloseTo(1 / 75, 5);
      });

      it("should convert cash-in-lieu deposit", () => {
        const records = [
          {
            date: new Date("2024-06-02T00:00:00"),
            description: "Cash Journal CIL from merger",
            symbol: "",
            direction: "deposit",
            quantity: 0,
            price: 0,
            fees: 0,
            amount: 7.5,
          },
        ];

        const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          activityType: ActivityType.Credit,
          symbol: "",
          amount: 7.5,
        });
      });

      it("should keep empty symbol for dividend when description has no quantity suffix", () => {
        const records = [
          {
            date: new Date("2024-05-01T00:00:00"),
            description: "Qualified Dividend without quantity",
            symbol: "",
            direction: "deposit",
            quantity: 0,
            price: 0,
            fees: 0,
            amount: 3.2,
          },
        ];

        const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          activityType: ActivityType.Dividend,
          symbol: "",
          quantity: 0, // Can't extract quantity from description
          amount: 3.2,
          unitPrice: 0, // Can't calculate unit price without quantity
        });
      });

      it("should set unitPrice to NaN when dividend description has zero quantity", () => {
        const records = [
          {
            date: new Date("2024-05-02T00:00:00"),
            description: "Dividend SOME CORP 0",
            symbol: "",
            direction: "deposit",
            quantity: 0,
            price: 0,
            fees: 0,
            amount: 1.5,
          },
        ];

        const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          activityType: ActivityType.Dividend,
          quantity: 0,
          amount: 1.5,
        });
        expect(result[0].unitPrice).toBeNaN();
      });

      it("should convert withdrawal", () => {
        const records = [
          {
            date: new Date("2023-11-06T00:00:00"),
            description: "CASH JOURNAL OUTGOING WIRE",
            symbol: "",
            direction: "withdrawal",
            quantity: 0,
            price: 0,
            fees: 0,
            amount: 5000,
          },
        ];

        const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          activityType: ActivityType.Withdrawal,
          amount: 5000,
        });
      });

      it("should convert fee withdrawal", () => {
        const records = [
          {
            date: new Date("2023-11-06T00:00:00"),
            description: "CASH JOURNAL ACAT DELIVERY FEE",
            symbol: "",
            direction: "withdrawal",
            quantity: 0,
            price: 0,
            fees: 0,
            amount: 25,
          },
        ];

        const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          activityType: ActivityType.Fee,
          amount: 25,
        });
      });

      it("should convert tax withdrawal", () => {
        const records = [
          {
            date: new Date("2021-03-01T00:00:00"),
            description: "Foreign Tax Withholding NRA WITHHOLD: DIVIDEND",
            symbol: "",
            direction: "withdrawal",
            quantity: 0,
            price: 0,
            fees: 0,
            amount: 0.18,
          },
        ];

        const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          activityType: ActivityType.Tax,
          amount: 0.18,
        });
      });

      it("should map tax subtypes for withholding and fallback none", () => {
        const records = [
          {
            date: new Date("2024-06-07T00:00:00"),
            description: "Tax withhold on dividend",
            symbol: "",
            direction: "withdrawal",
            quantity: 0,
            price: 0,
            fees: 0,
            amount: 0.3,
          },
          {
            date: new Date("2024-06-06T00:00:00"),
            description: "Tax",
            symbol: "",
            direction: "withdrawal",
            quantity: 0,
            price: 0,
            fees: 0,
            amount: 0.2,
          },
        ];

        const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

        expect(result).toHaveLength(2);
        expect(result[0].subtype).toBe(ActivitySubtype.None);
        expect(result[1].subtype).toBe(ActivitySubtype.Withholding);
      });

      it("should convert withdrawal variants and deposit adjustment", () => {
        const records = [
          {
            date: new Date("2024-02-04T00:00:00"),
            description: "Wire sent",
            symbol: "",
            direction: "withdrawal",
            quantity: 0,
            price: 0,
            fees: 0,
            amount: 20,
          },
          {
            date: new Date("2024-02-03T00:00:00"),
            description: "Bookkeeping fix",
            symbol: "",
            direction: "withdrawal",
            quantity: 0,
            price: 0,
            fees: 0,
            amount: 0.5,
          },
          {
            date: new Date("2024-02-02T00:00:00"),
            description: "Interest collect adjustment",
            symbol: "",
            direction: "withdrawal",
            quantity: 0,
            price: 0,
            fees: 0,
            amount: 1,
          },
          {
            date: new Date("2024-02-01T00:00:00"),
            description: "Account fix",
            symbol: "",
            direction: "deposit",
            quantity: 0,
            price: 0,
            fees: 0,
            amount: 12.5,
          },
        ];

        const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

        expect(result).toHaveLength(4);
        expect(result[0].activityType).toBe(ActivityType.Adjustment);
        expect(result[1].activityType).toBe(ActivityType.Fee);
        expect(result[2].activityType).toBe(ActivityType.Adjustment);
        expect(result[3].activityType).toBe(ActivityType.Withdrawal);
      });
    });

    describe("direction: in / out", () => {
      it("should convert transfer in/out and conversion directions", () => {
        const records = [
          {
            date: new Date("2024-01-12T00:00:00"),
            description: "Portfolio transfer out",
            symbol: "MSFT",
            direction: "out",
            quantity: 1,
            price: 0,
            fees: 0,
            amount: 0,
          },
          {
            date: new Date("2024-01-12T00:00:00"),
            description: "Portfolio transfer in without symbol",
            symbol: "",
            direction: "in",
            quantity: 1,
            price: 0,
            fees: 0,
            amount: 0,
          },
          {
            date: new Date("2024-01-11T00:00:00"),
            description: "Portfolio transfer in",
            symbol: "AAPL",
            direction: "in",
            quantity: 1,
            price: 0,
            fees: 0,
            amount: 0,
          },
          {
            date: new Date("2024-01-10T00:00:00"),
            description: "Asset conversion in",
            symbol: "AAPL",
            direction: "in",
            quantity: 5,
            price: 180,
            fees: 0,
            amount: 900,
          },
          {
            date: new Date("2024-01-10T00:00:00"),
            description: "Asset conversion out",
            symbol: "MSFT",
            direction: "out",
            quantity: 2,
            price: 350,
            fees: 0,
            amount: 700,
          },
        ];

        const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

        expect(result).toHaveLength(5);
        expect(result[0].activityType).toBe(ActivityType.Sell);
        expect(result[1]).toMatchObject({
          activityType: ActivityType.Buy,
          symbol: "AAPL",
        });
        expect(result[2].activityType).toBe(ActivityType.TransferIn);
        expect(result[3].activityType).toBe(ActivityType.TransferIn);
        expect(result[4].activityType).toBe(ActivityType.TransferOut);
      });

      it("should combine forward and reverse split entries", () => {
        const records = [
          {
            date: new Date("2017-04-10T00:00:00"),
            description: "Split out",
            symbol: "AAPL",
            direction: "out",
            quantity: 100,
            price: 0,
            fees: 0,
            amount: 0,
          },
          {
            date: new Date("2017-04-10T00:00:00"),
            description: "Split in",
            symbol: "AAPL",
            direction: "in",
            quantity: 2500,
            price: 0,
            fees: 0,
            amount: 0,
          },
          {
            date: new Date("2018-03-05T00:00:00"),
            description: "Reverse Split REVERSE SPLITREVERSE SPLIT",
            symbol: "AAPL",
            direction: "in",
            quantity: 100,
            price: 0,
            fees: 0,
            amount: 0,
          },
          {
            date: new Date("2018-03-05T00:00:00"),
            description: "Reverse Split REVERSE SPLITREVERSE SPLIT",
            symbol: "AAPL",
            direction: "out",
            quantity: 2500,
            price: 0,
            fees: 0,
            amount: 0,
          },
        ];

        const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({
          symbol: "AAPL",
          activityType: ActivityType.Split,
          quantity: Number.NaN,
          unitPrice: Number.NaN,
          fee: Number.NaN,
          amount: 100 / 2500, // 1:25 reverse split
          comment: "Reverse Split REVERSE SPLITREVERSE SPLIT",
        });
        expect(result[1]).toMatchObject({
          symbol: "AAPL",
          activityType: ActivityType.Split,
          quantity: Number.NaN,
          unitPrice: Number.NaN,
          fee: Number.NaN,
          amount: 2500 / 100, // 25:1 forward split
          comment: "Split in / Split out",
        });
      });

      it("should ignore unmatched split transactions", () => {
        const records = [
          {
            date: new Date("2024-04-01T00:00:00"),
            description: "Split pending",
            symbol: "TSLA",
            direction: "in",
            quantity: 3,
            price: 0,
            fees: 0,
            amount: 0,
          },
        ];

        const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);
        expect(result).toEqual([]);
      });

      it("should not match split transactions with different symbols", () => {
        const records = [
          {
            date: new Date("2024-04-01T00:00:00"),
            description: "Split part out",
            symbol: "TSLA",
            direction: "out",
            quantity: 3,
            price: 0,
            fees: 0,
            amount: 0,
          },
          {
            date: new Date("2024-04-01T00:00:00"),
            description: "Split part in",
            symbol: "MSFT",
            direction: "in",
            quantity: 30,
            price: 0,
            fees: 0,
            amount: 0,
          },
        ];

        const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);
        expect(result).toHaveLength(0);
      });

      it("should skip zero and invalid quantities in split transactions", () => {
        const records = [
          {
            date: new Date("2024-04-02T00:00:00"),
            description: "Split part out",
            symbol: "TSLA",
            direction: "out",
            quantity: 0,
            price: 0,
            fees: 0,
            amount: 0,
          },
          {
            date: new Date("2024-04-02T00:00:00"),
            description: "Split part in",
            symbol: "TSLA",
            direction: "in",
            quantity: Number.NaN,
            price: 0,
            fees: 0,
            amount: 0,
          },
        ];

        const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

        expect(result).toHaveLength(0);
      });

      it("should skip when two split records have the same direction", () => {
        const records = [
          {
            date: new Date("2024-05-01T00:00:00"),
            description: "Split in",
            symbol: "TSLA",
            direction: "in",
            quantity: 300,
            price: 0,
            fees: 0,
            amount: 0,
          },
          {
            date: new Date("2024-05-01T00:00:00"),
            description: "Split in duplicate",
            symbol: "TSLA",
            direction: "in",
            quantity: 900,
            price: 0,
            fees: 0,
            amount: 0,
          },
        ];

        const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

        expect(result).toHaveLength(0);
      });

      it("should skip symbol rename transfer entries", () => {
        const records = [
          {
            date: new Date("2024-06-01T00:00:00"),
            description: "Ticker rename AAPL -> AAPL1",
            symbol: "AAPL",
            direction: "out",
            quantity: 1,
            price: 0,
            fees: 0,
            amount: 0,
          },
          {
            date: new Date("2024-06-01T00:00:00"),
            description: "Ticker rename AAPL -> AAPL1",
            symbol: "AAPL1",
            direction: "in",
            quantity: 1,
            price: 0,
            fees: 0,
            amount: 0,
          },
        ];

        const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);
        expect(result).toEqual([]);
      });
    });

    it("should ignore *FROM MARGIN*, *TO CASH*, and cash journal move entries", () => {
      const records = [
        {
          date: new Date("2024-03-01T00:00:00"),
          description: "Cash Journal Move",
          symbol: "",
          direction: "deposit",
          quantity: 0,
          price: 0,
          fees: 0,
          amount: 10,
        },
        {
          date: new Date("2023-11-08T00:00:00"),
          description: "CASH JOURNAL *FROM MARGIN*",
          symbol: "",
          direction: "deposit",
          quantity: 0,
          price: 0,
          fees: 0,
          amount: 11000,
        },
        {
          date: new Date("2023-11-08T00:00:00"),
          description: "CASH JOURNAL *TO CASH*",
          symbol: "",
          direction: "withdrawal",
          quantity: 0,
          price: 0,
          fees: 0,
          amount: 11000,
        },
        {
          date: new Date("2022-07-18T00:00:00"),
          description: "Buy 105 AAPL @4.75",
          symbol: "AAPL",
          direction: "buy",
          quantity: 105,
          price: 4.75,
          fees: 2.82,
          amount: 501.57,
        },
      ];

      const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe("AAPL");
    });

    it("should ignore unknown and empty directions", () => {
      const records = [
        {
          date: new Date("2024-03-02T00:00:00"),
          description: "Unknown direction test",
          symbol: "AAPL",
          direction: "invalid",
          quantity: 1,
          price: 1,
          fees: 0,
          amount: 1,
        },
        {
          date: new Date("2024-03-02T00:00:00"),
          description: "Empty direction test",
          symbol: "AAPL",
          direction: "",
          quantity: 1,
          price: 1,
          fees: 0,
          amount: 1,
        },
      ];

      const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);
      expect(result).toEqual([]);
    });
  });

  describe("symbol resolution", () => {
    it("should set ISIN from provider resolution", () => {
      class ISINProvider extends DataProvider {
        constructor() {
          super("ISINProvider");
        }
        query(_: SymbolQuery): SymbolResult {
          return { isin: "US0378331005" };
        }
      }
      symbolDataService.registerProvider(new ISINProvider());

      const records = [
        {
          date: new Date("2024-01-15T00:00:00"),
          description: "Buy 10 AAPL @150",
          symbol: "AAPL",
          direction: "buy",
          quantity: 10,
          price: 150,
          fees: 0,
          amount: 1500,
        },
      ];

      const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

      expect(result[0].symbol).toBe("AAPL");
      expect(result[0].isin).toBe("US0378331005");
    });

    it("should set symbol and ISIN from provider resolution when symbol is empty", () => {
      class SymbolISINProvider extends DataProvider {
        constructor() {
          super("SymbolISINProvider");
        }
        query(_: SymbolQuery): SymbolResult {
          return { symbol: "AAPL", isin: "US0378331005" };
        }
      }
      symbolDataService.registerProvider(new SymbolISINProvider());

      const records = [
        {
          date: new Date("2024-01-15T00:00:00"),
          description: "Qualified Dividend APPLE INC 10",
          symbol: "",
          direction: "deposit",
          quantity: Number.NaN,
          price: Number.NaN,
          fees: Number.NaN,
          amount: 150,
        },
      ];

      const result = format.convert(records, DEFAULT_CURRENCY, symbolDataService);

      expect(result[0].symbol).toBe("AAPL");
      expect(result[0].isin).toBe("US0378331005");
    });
  });

  describe("getParseOptions", () => {
    it("should have correct parse options", () => {
      const options = format.getParseOptions();
      expect(options.delimiter).toBe(";");
      expect(options.from_line).toBe(2);
      expect(options.trim).toBe(true);
    });

    it("should expose parse options callbacks for cast and header normalization", () => {
      const options = format.getParseOptions();
      const headerMapper = options.columns as (header: string[]) => string[];
      const caster = options.cast as (value: string, context: { column: string }) => unknown;

      expect(options.from_line).toBe(2);
      expect(headerMapper([" Date ", " Symbol ", "Direction "])).toEqual([
        "date",
        "symbol",
        "direction",
      ]);

      const castDate = caster("2024-01-01 00:00:00", { column: "date" });
      expect(castDate).toBeInstanceOf(Date);
      expect(castDate).toEqual(new Date("2024-01-01T21:00:00.000Z")); // 16:00 US Eastern Time in UTC

      expect(caster(" aapl ", { column: "symbol" })).toBe("AAPL");
      expect(caster(" BUY ", { column: "direction" })).toBe("buy");
      expect(caster(" -10.50", { column: "quantity" })).toBe(-10.5);
      expect(caster("", { column: "price" })).toBeNaN();
      expect(caster("-1.25 ", { column: "fees" })).toBe(-1.25);
      expect(caster("-100", { column: "amount" })).toBe(-100);
      expect(caster(" note ", { column: "description" })).toBe("note");
    });
  });

  describe("getExpectedSchema", () => {
    it("should return correct schema", () => {
      const schema = format.getExpectedSchema();
      const columnNames = schema.map((col) => col.name);
      expect(columnNames).toEqual([
        "Date",
        "Description",
        "Symbol",
        "Direction",
        "Quantity",
        "Price",
        "Fees",
        "Amount",
      ]);
    });
  });
});
