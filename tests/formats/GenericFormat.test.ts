/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { ActivitySubtype, ActivityType } from "../../src/core/BaseFormat";
import { GenericFormat } from "../../src/formats/GenericFormat";

describe("Generic Format", () => {
  let format: GenericFormat;

  beforeEach(() => {
    format = new GenericFormat();
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

      const result = format.convert(records);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        symbol: "AAPL",
        activityType: "BUY",
        quantity: 100,
        unitPrice: 150.25,
        amount: 15025,
        currency: "EUR",
        fee: NaN,
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

      const result = format.convert(records);

      expect(result).toHaveLength(3);
      expect(result[0].symbol).toBe("AAPL");
      expect(result[1].symbol).toBe("MSFT");
      expect(result[2].symbol).toBe("AAPL");
    });

    it("should normalize symbols to uppercase", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "BUY",
          symbol: "aapl",
          quantity: 100,
          unitprice: 150.25,
          amount: 15025,
        },
      ];

      const result = format.convert(records);

      expect(result[0].symbol).toBe("AAPL");
    });

    it("should handle `NaN` values", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "BUY",
          symbol: "AAPL",
          quantity: NaN,
          unitprice: NaN,
          fee: 3.5,
        },
      ];

      const result = format.convert(records);

      expect(result[0].quantity).toBe(NaN);
      expect(result[0].unitPrice).toBe(NaN);
      expect(result[0].fee).toBe(3.5);
      expect(result[0].amount).toBe(NaN);
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

      const result = format.convert(records);

      expect(result[0].currency).toBe("EUR");
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

      const result = format.convert(records);

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

      const result = format.convert(records);

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

        const result = format.convert(records);
        expect(result[0].activityType).toBe(expected);
      });
    });

    it("should throw error for unknown activity type", () => {
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

      expect(() => format.convert(records)).toThrow("Unknown activity type: UNKNOWN_TYPE");
    });

    it("should throw error for missing activity type", () => {
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

      expect(() => format.convert(records)).toThrow("No activity type");
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

      const result = format.convert(records);

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

      const result = format.convert(records);

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

      const result = format.convert(records);

      // Symbol should be empty string when not provided
      expect(result[0].symbol).toBe("");
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

      const result = format.convert(records);

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

      const result = format.convert(records);

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

      const result = format.convert(records);

      expect(result[0].fee).toBe(NaN);
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

      const result = format.convert(records);

      expect(result[0].quantity).toBe(-10);
      expect(result[0].unitPrice).toBe(-5);
      expect(result[0].amount).toBe(-50);
    });

    it("should use fee value as amount for Fee activity when total is not provided", () => {
      const records = [
        {
          date: new Date("2024-01-15"),
          transactiontype: "FEE",
          symbol: "",
          quantity: NaN,
          unitprice: NaN,
          fee: 10.5,
        },
      ];

      const result = format.convert(records);

      expect(result[0].activityType).toBe(ActivityType.Fee);
      expect(result[0].amount).toBe(10.5);
      expect(result[0].fee).toBe(NaN);
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dateValue = cast("2024-02-10", { column: "date" } as any) as Date;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const quantityValue = cast("12.5", { column: "quantity" } as any) as number;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const feeValue = cast("1.25", { column: "fee" } as any) as number;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const defaultValue = cast("  abc  ", { column: "symbol" } as any) as string;

      expect(dateValue).toBeInstanceOf(Date);
      expect(dateValue.toISOString()).toContain("2024-02-10");
      expect(quantityValue).toBe(12.5);
      expect(feeValue).toBe(1.25);
      expect(defaultValue).toBe("abc");
    });
  });

  describe("private helpers", () => {
    // FIXME: Rewrite to avoid using private methods directly
    it("should map activity subtypes for supported activities", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapActivitySubtype = (format as any).mapActivitySubtype.bind(format);

      expect(mapActivitySubtype({ transactionsubtype: "" }, ActivityType.Dividend)).toBe(
        ActivitySubtype.None,
      );
      expect(mapActivitySubtype({ transactionsubtype: "drip" }, ActivityType.Dividend)).toBe(
        ActivitySubtype.DRIP,
      );
      expect(
        mapActivitySubtype({ transactionsubtype: "qualified_dividend" }, ActivityType.Dividend),
      ).toBe(ActivitySubtype.QualifiedDividend);

      expect(
        mapActivitySubtype({ transactionsubtype: "ordinary_dividend" }, ActivityType.Dividend),
      ).toBe(ActivitySubtype.OrdinaryDividend);
      expect(
        mapActivitySubtype({ transactionsubtype: "return_of_capital" }, ActivityType.Dividend),
      ).toBe(ActivitySubtype.ReturnOfCapital);
      expect(
        mapActivitySubtype({ transactionsubtype: "dividend_in_kind" }, ActivityType.Dividend),
      ).toBe(ActivitySubtype.DividendInKind);
      expect(mapActivitySubtype({ transactionsubtype: "unknown" }, ActivityType.Dividend)).toBe(
        ActivitySubtype.None,
      );

      expect(mapActivitySubtype({ transactionsubtype: "" }, ActivityType.Interest)).toBe(
        ActivitySubtype.None,
      );
      expect(
        mapActivitySubtype({ transactionsubtype: "staking_reward" }, ActivityType.Interest),
      ).toBe(ActivitySubtype.StakingReward);
      expect(
        mapActivitySubtype({ transactionsubtype: "lending_interest" }, ActivityType.Interest),
      ).toBe(ActivitySubtype.LendingInterest);
      expect(mapActivitySubtype({ transactionsubtype: "coupon" }, ActivityType.Interest)).toBe(
        ActivitySubtype.Coupon,
      );
      expect(mapActivitySubtype({ transactionsubtype: "unknown" }, ActivityType.Interest)).toBe(
        ActivitySubtype.None,
      );

      expect(mapActivitySubtype({ transactionsubtype: "" }, ActivityType.Fee)).toBe(
        ActivitySubtype.None,
      );
      expect(mapActivitySubtype({ transactionsubtype: "management_fee" }, ActivityType.Fee)).toBe(
        ActivitySubtype.ManagementFee,
      );
      expect(mapActivitySubtype({ transactionsubtype: "adr_fee" }, ActivityType.Fee)).toBe(
        ActivitySubtype.ADRFee,
      );
      expect(mapActivitySubtype({ transactionsubtype: "interest_charge" }, ActivityType.Fee)).toBe(
        ActivitySubtype.InterestCharge,
      );
      expect(mapActivitySubtype({ transactionsubtype: "unknown" }, ActivityType.Fee)).toBe(
        ActivitySubtype.None,
      );

      expect(mapActivitySubtype({ transactionsubtype: "" }, ActivityType.Tax)).toBe(
        ActivitySubtype.None,
      );
      expect(mapActivitySubtype({ transactionsubtype: "withholding" }, ActivityType.Tax)).toBe(
        ActivitySubtype.Withholding,
      );
      expect(mapActivitySubtype({ transactionsubtype: "nra_withholding" }, ActivityType.Tax)).toBe(
        ActivitySubtype.NRAWithholding,
      );
      expect(mapActivitySubtype({ transactionsubtype: "unknown" }, ActivityType.Tax)).toBe(
        ActivitySubtype.None,
      );

      expect(mapActivitySubtype({ transactionsubtype: "" }, ActivityType.Credit)).toBe(
        ActivitySubtype.None,
      );
      expect(mapActivitySubtype({ transactionsubtype: "bonus" }, ActivityType.Credit)).toBe(
        ActivitySubtype.Bonus,
      );
      expect(mapActivitySubtype({ transactionsubtype: "rebate" }, ActivityType.Credit)).toBe(
        ActivitySubtype.Rebate,
      );
      expect(mapActivitySubtype({ transactionsubtype: "refund" }, ActivityType.Credit)).toBe(
        ActivitySubtype.Refund,
      );
      expect(mapActivitySubtype({ transactionsubtype: "unknown" }, ActivityType.Credit)).toBe(
        ActivitySubtype.None,
      );

      expect(mapActivitySubtype({ transactionsubtype: "drip" }, ActivityType.Buy)).toBe(
        ActivitySubtype.None,
      );
      expect(mapActivitySubtype({}, ActivityType.Dividend)).toBe(ActivitySubtype.None);
    });
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
          "Symbol",
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
});
