/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {
  ActivitySubtype,
  ActivityType,
  InstrumentType,
  WealthfolioRecord,
} from "../../src/core/BaseFormat";
import {
  FieldRequirementViolationKind,
  validateFieldValue,
  validateRecordFieldRequirements,
} from "../../src/core/FieldRequirements";

// Silence logging during tests
import { Logger, LogLevel } from "../../src/core/Logger";
Logger.setLogLevel(LogLevel.ERROR);

const createRecord = (overrides: Partial<WealthfolioRecord> = {}): WealthfolioRecord => {
  const { instrumentType, ...restOverrides } = overrides;

  return {
    date: new Date("2024-01-15"),
    instrumentType: instrumentType ?? InstrumentType.Unknown,
    symbol: "AAPL",
    isin: "",
    quantity: 1,
    activityType: ActivityType.Buy,
    unitPrice: 10,
    currency: "USD",
    fee: 0,
    amount: 10,
    fxRate: Number.NaN,
    subtype: ActivitySubtype.None,
    comment: "",
    metadata: {},
    ...restOverrides,
  };
};

describe("FieldRequirements", () => {
  describe("validateFieldValue", () => {
    it("should validate string values", () => {
      expect(validateFieldValue("symbol", "AAPL")).toBe(FieldRequirementViolationKind.Valid);
      expect(validateFieldValue("symbol", "")).toBe(FieldRequirementViolationKind.Unset);
      expect(validateFieldValue("subtype", ActivitySubtype.None)).toBe(
        FieldRequirementViolationKind.Unset,
      );
      expect(validateFieldValue("subtype", ActivitySubtype.DRIP)).toBe(
        FieldRequirementViolationKind.Valid,
      );
      expect(validateFieldValue("isin", "US0378331005")).toBe(FieldRequirementViolationKind.Valid);
      expect(validateFieldValue("isin", "NOTANISIN")).toBe(FieldRequirementViolationKind.Invalid);
      expect(validateFieldValue("isin", "")).toBe(FieldRequirementViolationKind.Unset);
      expect(validateFieldValue("currency", "USD")).toBe(FieldRequirementViolationKind.Valid);
      expect(validateFieldValue("currency", "NOTACURRENCY")).toBe(
        FieldRequirementViolationKind.Invalid,
      );
    });

    it("should validate number values", () => {
      expect(validateFieldValue("amount", 1)).toBe(FieldRequirementViolationKind.Valid);
      expect(validateFieldValue("amount", Number.NaN)).toBe(FieldRequirementViolationKind.Unset);
      expect(validateFieldValue("amount", Infinity)).toBe(FieldRequirementViolationKind.Invalid);
    });

    it("should return Invalid for undefined values", () => {
      expect(validateFieldValue("amount", undefined)).toBe(FieldRequirementViolationKind.Invalid);
    });

    it("should validate object values", () => {
      expect(validateFieldValue("date", new Date("2024-01-15"))).toBe(
        FieldRequirementViolationKind.Valid,
      );
      expect(validateFieldValue("date", new Date(Number.NaN))).toBe(
        FieldRequirementViolationKind.Invalid,
      );
      expect(validateFieldValue("metadata", null)).toBe(FieldRequirementViolationKind.Invalid);
      expect(validateFieldValue("metadata", {})).toBe(FieldRequirementViolationKind.Unset);
      expect(validateFieldValue("metadata", { source: { broker: "Schwab" } })).toBe(
        FieldRequirementViolationKind.Valid,
      );
    });

    it("should warn on unexpected types", () => {
      const warnSpy = jest.spyOn(Logger.getInstance(), "warn").mockImplementation(() => undefined);

      try {
        expect(validateFieldValue("amount", true)).toBe(FieldRequirementViolationKind.Invalid);
        expect(validateFieldValue("amount", () => {})).toBe(FieldRequirementViolationKind.Invalid);
        expect(warnSpy).toHaveBeenCalledTimes(2);
      } finally {
        warnSpy.mockRestore();
      }
    });
  });

  describe("validateRecordFieldRequirements", () => {
    it("should flag missing required fields", () => {
      const record = createRecord({ symbol: "" });

      const result = validateRecordFieldRequirements(record);

      expect(result.valid).toBe(false);
      expect(result.invalidFields.map((field) => field.name)).toContain("symbol");
    });

    it("should clear ignored fields when requested", () => {
      const record = createRecord({
        activityType: ActivityType.Deposit,
        symbol: "CASH",
        quantity: new Date("2024-01-01") as unknown as number,
        unitPrice: { note: "ignored" } as unknown as number,
        subtype: ActivitySubtype.DRIP,
        amount: 100,
      });

      const result = validateRecordFieldRequirements(record, true);

      expect(result.valid).toBe(true);
      expect(record.symbol).toBe("");
      expect(record.quantity).toBeInstanceOf(Date);
      expect(Number.isNaN((record.quantity as unknown as Date).getTime())).toBe(true);
      expect(record.unitPrice).toEqual({});
      expect(record.subtype).toBe("");
    });

    it("should clear ignored numeric fields", () => {
      const record = createRecord({
        activityType: ActivityType.Deposit,
        symbol: "CASH",
        quantity: 5,
        unitPrice: 2,
        amount: 100,
      });

      const result = validateRecordFieldRequirements(record, true);

      expect(result.valid).toBe(true);
      expect(Number.isNaN(record.quantity)).toBe(true);
      expect(Number.isNaN(record.unitPrice)).toBe(true);
    });

    it("should keep ignored fields when not requested", () => {
      const record = createRecord({
        activityType: ActivityType.Deposit,
        symbol: "CASH",
        quantity: 5,
        unitPrice: 2,
        subtype: ActivitySubtype.DRIP,
        amount: 100,
      });

      const result = validateRecordFieldRequirements(record, false);

      expect(result.valid).toBe(true);
      expect(record.symbol).toBe("CASH");
      expect(record.quantity).toBe(5);
      expect(record.unitPrice).toBe(2);
      expect(record.subtype).toBe(ActivitySubtype.DRIP);
    });

    it("should enforce conditional requirements", () => {
      const record = createRecord({
        activityType: ActivityType.Dividend,
        subtype: ActivitySubtype.DividendInKind,
        unitPrice: Number.NaN,
        metadata: {},
        amount: 2,
      });

      const result = validateRecordFieldRequirements(record);

      expect(result.valid).toBe(false);
      expect(result.invalidFields.map((field) => field.name)).toEqual(
        expect.arrayContaining(["unitPrice", "metadata"]),
      );
    });

    it("should require symbol or ISIN for asset transactions", () => {
      const activityTypes: ActivityType[] = [
        ActivityType.Buy,
        ActivityType.Sell,
        ActivityType.Dividend,
        ActivityType.Split,
      ];

      for (const activityType of activityTypes) {
        const record = createRecord({
          activityType,
          symbol: "",
          isin: "",
          amount: 100,
        });

        const result = validateRecordFieldRequirements(record);

        expect(result.valid).toBe(false);
        expect(result.invalidFields.map((field) => field.name)).toContain("symbol");
        expect(result.invalidFields.map((field) => field.name)).toContain("isin");
      }
    });

    it("should allow empty symbol when ISIN is provided for asset transactions", () => {
      const activityTypes: ActivityType[] = [
        ActivityType.Buy,
        ActivityType.Sell,
        ActivityType.Dividend,
        ActivityType.Split,
      ];

      for (const activityType of activityTypes) {
        const record = createRecord({
          activityType,
          symbol: "",
          isin: "US0378331005",
          amount: 100,
        });

        const result = validateRecordFieldRequirements(record);

        expect(result.valid).toBe(true);
      }
    });

    it("should allow empty ISIN when symbol is provided for asset transactions", () => {
      const activityTypes: ActivityType[] = [
        ActivityType.Buy,
        ActivityType.Sell,
        ActivityType.Dividend,
        ActivityType.Split,
      ];

      for (const activityType of activityTypes) {
        const record = createRecord({
          activityType,
          symbol: "AAPL",
          isin: "",
          amount: 100,
        });

        const result = validateRecordFieldRequirements(record);

        expect(result.valid).toBe(true);
      }
    });

    it("should allow ignored dividend unit price when subtype is not DRIP", () => {
      const record = createRecord({
        activityType: ActivityType.Dividend,
        subtype: ActivitySubtype.OrdinaryDividend,
        unitPrice: Number.NaN,
        metadata: {},
        amount: 2,
      });

      const result = validateRecordFieldRequirements(record);

      expect(result.valid).toBe(true);
      expect(Number.isNaN(record.unitPrice)).toBe(true);
    });

    it("should require unit price for staking rewards", () => {
      const record = createRecord({
        activityType: ActivityType.Interest,
        subtype: ActivitySubtype.StakingReward,
        unitPrice: Number.NaN,
        amount: 1,
      });

      const result = validateRecordFieldRequirements(record);

      expect(result.valid).toBe(false);
      expect(result.invalidFields.map((field) => field.name)).toContain("unitPrice");
    });

    it("should allow ignored unit price for non-staking interest", () => {
      const record = createRecord({
        activityType: ActivityType.Interest,
        subtype: ActivitySubtype.Coupon,
        unitPrice: Number.NaN,
        amount: 1,
      });

      const result = validateRecordFieldRequirements(record);

      expect(result.valid).toBe(true);
      expect(Number.isNaN(record.unitPrice)).toBe(true);
    });

    it("should preserve subtype for activities where subtype is optional", () => {
      const cases: Array<{ activityType: ActivityType; subtype: ActivitySubtype }> = [
        { activityType: ActivityType.Dividend, subtype: ActivitySubtype.DRIP },
        { activityType: ActivityType.Interest, subtype: ActivitySubtype.StakingReward },
        { activityType: ActivityType.Fee, subtype: ActivitySubtype.ManagementFee },
        { activityType: ActivityType.Tax, subtype: ActivitySubtype.Withholding },
        { activityType: ActivityType.Credit, subtype: ActivitySubtype.Bonus },
        { activityType: ActivityType.Adjustment, subtype: ActivitySubtype.Refund },
        { activityType: ActivityType.Unknown, subtype: ActivitySubtype.Rebate },
      ];

      for (const { activityType, subtype } of cases) {
        const record = createRecord({
          activityType,
          subtype,
          amount: 100,
        });

        const result = validateRecordFieldRequirements(record, true);

        expect(result.valid).toBe(true);
        expect(record.subtype).toBe(subtype);
      }
    });

    it("should clear subtype for activities where subtype is ignored", () => {
      const cases: ActivityType[] = [
        ActivityType.Buy,
        ActivityType.Sell,
        ActivityType.Deposit,
        ActivityType.Withdrawal,
        ActivityType.TransferIn,
        ActivityType.TransferOut,
        ActivityType.Split,
      ];

      for (const activityType of cases) {
        const record = createRecord({
          activityType,
          subtype: ActivitySubtype.DRIP,
          amount: 100,
        });

        const result = validateRecordFieldRequirements(record, true);

        expect(result.valid).toBe(true);
        expect(record.subtype).toBe("");
      }
    });

    it("should enforce transfer requirements based on symbol presence", () => {
      const withSymbol = createRecord({
        activityType: ActivityType.TransferIn,
        symbol: "AAPL",
        quantity: 1,
        unitPrice: 10,
        amount: Number.NaN,
      });
      const withISIN = createRecord({
        activityType: ActivityType.TransferOut,
        symbol: "",
        isin: "US0378331005",
        quantity: 1,
        unitPrice: 10,
        amount: Number.NaN,
      });
      const withoutSymbol = createRecord({
        activityType: ActivityType.TransferIn,
        symbol: "",
        isin: "",
        quantity: Number.NaN,
        unitPrice: Number.NaN,
        amount: 100,
      });

      const resultWithSymbol = validateRecordFieldRequirements(withSymbol);
      const resultWithISIN = validateRecordFieldRequirements(withISIN);
      const resultWithoutSymbol = validateRecordFieldRequirements(withoutSymbol);

      expect(resultWithSymbol.valid).toBe(true);
      expect(resultWithISIN.valid).toBe(true);
      expect(resultWithoutSymbol.valid).toBe(true);
    });

    it("should require amount when transfer has both symbol and ISIN missing", () => {
      const record = createRecord({
        activityType: ActivityType.TransferOut,
        symbol: "",
        isin: "",
        quantity: Number.NaN,
        unitPrice: Number.NaN,
        amount: Number.NaN,
      });

      const result = validateRecordFieldRequirements(record);

      expect(result.valid).toBe(false);
      expect(result.invalidFields.map((field) => field.name)).toContain("amount");
    });

    it("should keep instrument type for adjustment activity when symbol or ISIN is present", () => {
      const recordSymbol = createRecord({
        activityType: ActivityType.Adjustment,
        instrumentType: InstrumentType.Equity,
        symbol: "AAPL",
      });
      const recordISIN = createRecord({
        activityType: ActivityType.Adjustment,
        instrumentType: InstrumentType.Equity,
        isin: "US0378331005",
      });

      const resultSymbol = validateRecordFieldRequirements(recordSymbol, true);
      const resultISIN = validateRecordFieldRequirements(recordISIN, true);

      expect(resultSymbol.valid).toBe(true);
      expect(resultISIN.valid).toBe(true);
      expect(recordSymbol.instrumentType).toBe(InstrumentType.Equity);
      expect(recordISIN.instrumentType).toBe(InstrumentType.Equity);
    });

    it("should ignore instrument type for adjustment activity when symbol and ISIN are missing", () => {
      const record = createRecord({
        activityType: ActivityType.Adjustment,
        instrumentType: InstrumentType.Equity,
        symbol: "",
        isin: "",
      });

      const result = validateRecordFieldRequirements(record, true);

      expect(result.valid).toBe(true);
      expect(record.instrumentType).toBe(InstrumentType.Unknown);
    });

    it("should keep instrument type for unknown activity when symbol or ISIN is present", () => {
      const recordSymbol = createRecord({
        activityType: ActivityType.Unknown,
        instrumentType: InstrumentType.Equity,
        symbol: "AAPL",
      });
      const recordISIN = createRecord({
        activityType: ActivityType.Unknown,
        instrumentType: InstrumentType.Equity,
        isin: "US0378331005",
      });

      const resultSymbol = validateRecordFieldRequirements(recordSymbol, true);
      const resultISIN = validateRecordFieldRequirements(recordISIN, true);

      expect(resultSymbol.valid).toBe(true);
      expect(resultISIN.valid).toBe(true);
      expect(recordSymbol.instrumentType).toBe(InstrumentType.Equity);
      expect(recordISIN.instrumentType).toBe(InstrumentType.Equity);
    });

    it("should ignore instrument type for unknown activity when symbol and ISIN are missing", () => {
      const record = createRecord({
        activityType: ActivityType.Unknown,
        instrumentType: InstrumentType.Equity,
        symbol: "",
        isin: "",
      });

      const result = validateRecordFieldRequirements(record, true);

      expect(result.valid).toBe(true);
      expect(record.instrumentType).toBe(InstrumentType.Unknown);
    });
  });
});
