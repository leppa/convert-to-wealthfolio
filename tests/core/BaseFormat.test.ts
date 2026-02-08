/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {
  ActivitySubtype,
  ActivityType,
  BaseFormat,
  ColumnSchema,
  WealthfolioRecord,
} from "../../src/core/BaseFormat";

// Create a concrete implementation for testing
class TestFormat extends BaseFormat {
  constructor() {
    super("TestFormat");
  }

  validate(records: Record<string, unknown>[]): boolean {
    return records.length > 0 && "testField" in records[0];
  }

  convert(records: Record<string, unknown>[]): WealthfolioRecord[] {
    return records.map((record) => ({
      date: new Date("2024-01-15"),
      symbol: String(record.testField || "TEST"),
      quantity: 100,
      activityType: ActivityType.Buy,
      unitPrice: 150.0,
      currency: "EUR",
      fee: 0,
      amount: 15000,
      fxRate: NaN,
      subtype: ActivitySubtype.None,
      comment: "",
      metadata: {},
    }));
  }

  getExpectedSchema(): ColumnSchema[] {
    return [{ name: "TestField" }, { name: "OptionalField", optional: true }];
  }
}

describe("BaseFormat", () => {
  let format: TestFormat;

  beforeEach(() => {
    format = new TestFormat();
  });

  describe("getName", () => {
    it("should return the format name", () => {
      expect(format.getName()).toBe("TestFormat");
    });
  });

  describe("getParseOptions", () => {
    it("should return empty object by default", () => {
      expect(format.getParseOptions()).toEqual({});
    });
  });

  describe("getValidationLineCount", () => {
    it("should return 2 by default", () => {
      expect(format.getValidationLineCount()).toBe(2);
    });
  });

  describe("validate", () => {
    it("should validate records based on implementation", () => {
      const validRecords = [{ testField: "value" }];
      const invalidRecords = [{ wrongField: "value" }];

      expect(format.validate(validRecords)).toBe(true);
      expect(format.validate(invalidRecords)).toBe(false);
    });
  });

  describe("convert", () => {
    it("should convert records based on implementation", () => {
      const records = [{ testField: "AAPL" }];

      const result = format.convert(records);

      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe("AAPL");
    });
  });

  describe("getExpectedSchema", () => {
    it("should return expected schema", () => {
      const schema = format.getExpectedSchema();

      expect(schema).toHaveLength(2);
      expect(schema[0].name).toBe("TestField");
      expect(schema[1].name).toBe("OptionalField");
      expect(schema[1].optional).toBe(true);
    });
  });
});
