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
  validateRecordFieldRequirements,
  validateRequiredFieldValue,
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
  describe("validateRequiredFieldValue", () => {
    it("should validate string values", () => {
      expect(validateRequiredFieldValue("symbol", "AAPL")).toBe(true);
      expect(validateRequiredFieldValue("symbol", "")).toBe(false);
      expect(validateRequiredFieldValue("subtype", ActivitySubtype.None)).toBe(false);
      expect(validateRequiredFieldValue("subtype", ActivitySubtype.DRIP)).toBe(true);
    });

    it("should validate number values", () => {
      expect(validateRequiredFieldValue("amount", 1)).toBe(true);
      expect(validateRequiredFieldValue("amount", Number.NaN)).toBe(false);
      expect(validateRequiredFieldValue("amount", Infinity)).toBe(false);
    });

    it("should validate object values", () => {
      expect(validateRequiredFieldValue("date", new Date("2024-01-15"))).toBe(true);
      expect(validateRequiredFieldValue("date", new Date(Number.NaN))).toBe(false);
      expect(validateRequiredFieldValue("metadata", null)).toBe(false);
      expect(validateRequiredFieldValue("metadata", {})).toBe(false);
      expect(validateRequiredFieldValue("metadata", { source: { broker: "Schwab" } })).toBe(true);
    });

    it("should warn on unexpected types", () => {
      const warnSpy = jest.spyOn(Logger.getInstance(), "warn").mockImplementation(() => undefined);

      try {
        expect(validateRequiredFieldValue("amount", true)).toBe(false);
        expect(validateRequiredFieldValue("amount", undefined)).toBe(false);
        expect(warnSpy).toHaveBeenCalled();
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

      const warnSpy = jest.spyOn(Logger.getInstance(), "warn").mockImplementation(() => undefined);

      try {
        const result = validateRecordFieldRequirements(record);

        expect(result.valid).toBe(false);
        expect(result.invalidFields.map((field) => field.name)).toEqual(
          expect.arrayContaining(["unitPrice", "metadata"]),
        );
        expect(warnSpy).toHaveBeenCalled();
      } finally {
        warnSpy.mockRestore();
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

    it("should enforce transfer requirements based on symbol presence", () => {
      const withSymbol = createRecord({
        activityType: ActivityType.TransferIn,
        symbol: "AAPL",
        quantity: 1,
        unitPrice: 10,
        amount: Number.NaN,
      });
      const withoutSymbol = createRecord({
        activityType: ActivityType.TransferIn,
        symbol: "",
        quantity: Number.NaN,
        unitPrice: Number.NaN,
        amount: 100,
      });

      const resultWithSymbol = validateRecordFieldRequirements(withSymbol);
      const resultWithoutSymbol = validateRecordFieldRequirements(withoutSymbol);

      expect(resultWithSymbol.valid).toBe(true);
      expect(resultWithoutSymbol.valid).toBe(true);
    });

    it("should require amount when transfer has no symbol", () => {
      const record = createRecord({
        activityType: ActivityType.TransferOut,
        symbol: "",
        quantity: Number.NaN,
        unitPrice: Number.NaN,
        amount: Number.NaN,
      });

      const result = validateRecordFieldRequirements(record);

      expect(result.valid).toBe(false);
      expect(result.invalidFields.map((field) => field.name)).toContain("amount");
    });

    it("should keep instrument type for adjustment activity when symbol is present", () => {
      const record = createRecord({
        activityType: ActivityType.Adjustment,
        instrumentType: InstrumentType.Equity,
        symbol: "AAPL",
      });

      const result = validateRecordFieldRequirements(record, true);

      expect(result.valid).toBe(true);
      expect(record.instrumentType).toBe(InstrumentType.Equity);
    });

    it("should ignore instrument type for adjustment activity when symbol is missing", () => {
      const record = createRecord({
        activityType: ActivityType.Adjustment,
        instrumentType: InstrumentType.Equity,
        symbol: "",
      });

      const result = validateRecordFieldRequirements(record, true);

      expect(result.valid).toBe(true);
      expect(record.instrumentType).toBe(InstrumentType.Unknown);
    });

    it("should keep instrument type for unknown activity when symbol is present", () => {
      const record = createRecord({
        activityType: ActivityType.Unknown,
        instrumentType: InstrumentType.Equity,
        symbol: "AAPL",
      });

      const result = validateRecordFieldRequirements(record, true);

      expect(result.valid).toBe(true);
      expect(record.instrumentType).toBe(InstrumentType.Equity);
    });

    it("should ignore instrument type for unknown activity when symbol is missing", () => {
      const record = createRecord({
        activityType: ActivityType.Unknown,
        instrumentType: InstrumentType.Equity,
        symbol: "",
      });

      const result = validateRecordFieldRequirements(record, true);

      expect(result.valid).toBe(true);
      expect(record.instrumentType).toBe(InstrumentType.Unknown);
    });
  });
});
