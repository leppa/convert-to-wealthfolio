/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { bold } from "colorette";

import { ActivitySubtype, ActivityType, WealthfolioRecord } from "./BaseFormat";
import { Logger } from "./Logger";

export interface FieldValidationResult {
  name: string;
  value: unknown;
  error: string;
}

export interface RecordValidationResult {
  valid: boolean;
  invalidFields: FieldValidationResult[];
}

export function validateRecordFieldRequirements(
  record: WealthfolioRecord,
  clearIgnoredFields: boolean = true,
): RecordValidationResult {
  const logger = Logger.getInstance();
  const fieldRequirements = RECORD_FIELD_REQUIREMENTS[record.activityType];
  const invalidFields: FieldValidationResult[] = [];
  const ignoredFields: (keyof WealthfolioRecord)[] = [];

  for (const field in fieldRequirements) {
    const requirement = fieldRequirements[field as keyof WealthfolioRecord];
    const value = record[field as keyof WealthfolioRecord];
    const requirementLevel = typeof requirement === "function" ? requirement(record) : requirement;

    if (
      requirementLevel === FieldRequirement.Required &&
      !validateRequiredFieldValue(field, value)
    ) {
      logger.warn(`Required field ${bold(field)} has invalid value:`, value);
      invalidFields.push({
        name: field,
        value,
        error: "Invalid value",
      });
    }

    if (requirementLevel === FieldRequirement.Ignored && clearIgnoredFields) {
      ignoredFields.push(field as keyof WealthfolioRecord);
    }
  }

  // Clear ignored fields after all validations so that requirement functions (which may also depend
  // on ignored fields) still function correctly.
  for (const field of ignoredFields) {
    clearField(record, field);
  }

  return { valid: invalidFields.length === 0, invalidFields };
}

/**
 * Validates the field value of a required field, failing if it's `undefined`, `null`, empty, not a
 * finite number, or an invalid date.
 *
 * @param field - The name of the field being validated
 * @param value - The value to validate
 * @returns `true` if the value is valid, `false` otherwise
 */
export function validateRequiredFieldValue(field: string, value: unknown): boolean {
  const logger = Logger.getInstance();
  logger.trace(`Validating field ${bold(field)} with type ${bold(typeof value)} and value:`, value);
  // TODO: Any way to check activityType and subtype enums?
  switch (typeof value) {
    case "string":
      if (value.trim().length === 0) {
        return false;
      }
      if (field === "subtype") {
        // This will actually never fail because `None` is "" and will fail the previous
        // validation. However, just in case we set `None` to something else in the future, we can
        // still validate it here.
        return (value as ActivitySubtype) !== ActivitySubtype.None;
      }
      return true;
    case "number":
      return Number.isFinite(value);
    case "object":
      if (value === null) {
        return false;
      }
      if (value instanceof Date) {
        // Should be a valid date
        return !Number.isNaN(value.getTime());
      }
      // Should not be an empty object (e.g., when metadata is required)
      return Object.keys(value).length !== 0;
    // `WealthfolioRecord` has no fields of these types
    case "boolean":
    case "bigint":
    case "symbol":
    case "function":
      logger.warn(`Unexpected type for field ${bold(field)}: ${bold(typeof value)}`);
    // eslint-disable-next-line no-fallthrough
    case "undefined":
    default:
      return false;
  }
}

/**
 * Checks if the given activity type can have a subtype
 *
 * This function is meant for checking whether the activity *may* have a subtype, not whether it
 * actually has one. For example, it will always return `true` if subtype requirement is a function,
 * even if the function may return `FieldRequirement.Ignored` for some records.
 *
 * @param activityType - The activity type to check
 * @returns `true` if the activity can have a subtype, `false` otherwise
 */
export function canHaveActivitySubtype(activityType: ActivityType): boolean {
  return RECORD_FIELD_REQUIREMENTS[activityType].subtype !== FieldRequirement.Ignored;
}

function clearField(record: WealthfolioRecord, field: keyof WealthfolioRecord): void {
  switch (typeof record[field]) {
    case "string":
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      (record[field] as string) = "";
      break;
    case "number":
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      (record[field] as number) = Number.NaN;
      break;
    case "object":
      if (record[field] instanceof Date) {
        // Set invalid date
        (record[field] as Date) = new Date(Number.NaN);
      } else {
        (record[field] as unknown) = {};
      }
      break;
  }
}

/**
 * Helper function for fields that are required when ISIN is not set
 *
 * Returns `FieldRequirement.Required` if ISIN is not set, otherwise returns `FieldRequirement.Optional`.
 *
 * @param record - The Wealthfolio record to check
 * @returns Field requirement based on the presence of ISIN
 */
function requiredWhenNoIsinElseOptional(record: WealthfolioRecord): FieldRequirement {
  return record.isin ? FieldRequirement.Optional : FieldRequirement.Required;
}

/**
 * Helper function for fields that are required when symbol is not set
 *
 * Returns `FieldRequirement.Required` if symbol is not set, otherwise returns `FieldRequirement.Optional`.
 *
 * @param record - The Wealthfolio record to check
 * @returns Field requirement based on the presence of symbol
 */
function requiredWhenNoSymbolElseOptional(record: WealthfolioRecord): FieldRequirement {
  return record.symbol ? FieldRequirement.Optional : FieldRequirement.Required;
}

/**
 * Helper function for fields that are required for asset transactions
 *
 * Returns `FieldRequirement.Required` when transaction is for an asset (symbol or ISIN is set),
 * otherwise returns `FieldRequirement.Ignored`.
 *
 * @param record - The Wealthfolio record to check
 * @returns Field requirement based on the presence of symbol or ISIN
 */
function requiredWhenAssetTransactionElseIgnored(record: WealthfolioRecord): FieldRequirement {
  return !!record.symbol || !!record.isin ? FieldRequirement.Required : FieldRequirement.Ignored;
}

/**
 * Helper function for fields that are optional for asset transactions
 *
 * Returns `FieldRequirement.Optional` when transaction is for an asset (symbol or ISIN is set),
 * otherwise returns `FieldRequirement.Ignored`.
 *
 * @param record - The Wealthfolio record to check
 * @returns Field requirement based on the presence of symbol or ISIN
 */
function optionalWhenAssetTransactionElseIgnored(record: WealthfolioRecord): FieldRequirement {
  return !!record.symbol || !!record.isin ? FieldRequirement.Optional : FieldRequirement.Ignored;
}

/**
 * Field requirement levels in a Wealthfolio record
 */
enum FieldRequirement {
  Required,
  Optional,
  Ignored,
}

/**
 * For more complex requirements, a function can be used based on the record content
 */
type FieldRequirementFunction = (record: WealthfolioRecord) => FieldRequirement;

type WealthfolioRecordFieldRequirements = {
  [key in keyof WealthfolioRecord]: FieldRequirement | FieldRequirementFunction;
};

// Most common requirements to avoid repetition
const COMMON_FIELD_REQUIREMENTS: Pick<
  WealthfolioRecordFieldRequirements,
  "date" | "activityType" | "fee" | "fxRate" | "subtype" | "comment" | "metadata" | "currency"
> = {
  date: FieldRequirement.Required,
  activityType: FieldRequirement.Required,
  fee: FieldRequirement.Optional,
  fxRate: FieldRequirement.Optional,
  subtype: FieldRequirement.Ignored, // Optional only for some activities
  comment: FieldRequirement.Optional,
  metadata: FieldRequirement.Optional,
  currency: FieldRequirement.Required,
};

/**
 * Field requirements for each activity type, based on Wealthfolio documentation
 *
 * Source: https://github.com/afadil/wealthfolio/blob/main/docs/activities/activity-types.md
 * Last update: 2026-04-06
 */
const RECORD_FIELD_REQUIREMENTS: {
  [key in ActivityType]: WealthfolioRecordFieldRequirements;
} = {
  [ActivityType.Buy]: {
    ...COMMON_FIELD_REQUIREMENTS,
    instrumentType: FieldRequirement.Optional,
    symbol: requiredWhenNoIsinElseOptional,
    isin: requiredWhenNoSymbolElseOptional,
    quantity: FieldRequirement.Required,
    unitPrice: FieldRequirement.Required,
    amount: FieldRequirement.Optional,
  },
  [ActivityType.Sell]: {
    ...COMMON_FIELD_REQUIREMENTS,
    instrumentType: FieldRequirement.Optional,
    symbol: requiredWhenNoIsinElseOptional,
    isin: requiredWhenNoSymbolElseOptional,
    quantity: FieldRequirement.Required,
    unitPrice: FieldRequirement.Required,
    amount: FieldRequirement.Optional,
  },
  [ActivityType.Dividend]: {
    ...COMMON_FIELD_REQUIREMENTS,
    instrumentType: FieldRequirement.Optional,
    symbol: requiredWhenNoIsinElseOptional,
    isin: requiredWhenNoSymbolElseOptional,
    quantity: FieldRequirement.Optional,
    unitPrice: (record) =>
      // DRIP and dividend in kind subtypes require unit price for cost basis calculation
      record.subtype === ActivitySubtype.DRIP || record.subtype === ActivitySubtype.DividendInKind
        ? FieldRequirement.Required
        : FieldRequirement.Ignored,
    amount: FieldRequirement.Required,
    subtype: FieldRequirement.Optional,
    metadata: (record) =>
      // Dividend in kind requires metadata with `received_asset_id` to know which asset was
      // received as dividends
      record.subtype === ActivitySubtype.DividendInKind
        ? FieldRequirement.Required
        : FieldRequirement.Optional,
  },
  [ActivityType.Interest]: {
    ...COMMON_FIELD_REQUIREMENTS,
    instrumentType: optionalWhenAssetTransactionElseIgnored,
    symbol: FieldRequirement.Optional,
    isin: FieldRequirement.Optional,
    quantity: FieldRequirement.Ignored,
    unitPrice: (record) =>
      // Staking reward subtype requires unit price (fair market value at the time of reward) for
      // cost basis calculation
      record.subtype === ActivitySubtype.StakingReward
        ? FieldRequirement.Required
        : FieldRequirement.Ignored,
    amount: FieldRequirement.Required,
    subtype: FieldRequirement.Optional,
  },
  [ActivityType.Deposit]: {
    ...COMMON_FIELD_REQUIREMENTS,
    instrumentType: FieldRequirement.Ignored,
    symbol: FieldRequirement.Ignored,
    isin: FieldRequirement.Ignored,
    quantity: FieldRequirement.Ignored,
    unitPrice: FieldRequirement.Ignored,
    amount: FieldRequirement.Required,
  },
  [ActivityType.Withdrawal]: {
    ...COMMON_FIELD_REQUIREMENTS,
    instrumentType: FieldRequirement.Ignored,
    symbol: FieldRequirement.Ignored,
    isin: FieldRequirement.Ignored,
    quantity: FieldRequirement.Ignored,
    unitPrice: FieldRequirement.Ignored,
    amount: FieldRequirement.Required,
  },
  [ActivityType.TransferIn]: {
    ...COMMON_FIELD_REQUIREMENTS,
    instrumentType: optionalWhenAssetTransactionElseIgnored,
    symbol: FieldRequirement.Optional,
    isin: FieldRequirement.Optional,
    quantity: requiredWhenAssetTransactionElseIgnored,
    unitPrice: requiredWhenAssetTransactionElseIgnored,
    amount: (record) =>
      record.symbol || record.isin ? FieldRequirement.Ignored : FieldRequirement.Required,
  },
  [ActivityType.TransferOut]: {
    ...COMMON_FIELD_REQUIREMENTS,
    instrumentType: optionalWhenAssetTransactionElseIgnored,
    symbol: FieldRequirement.Optional,
    isin: FieldRequirement.Optional,
    quantity: requiredWhenAssetTransactionElseIgnored,
    unitPrice: requiredWhenAssetTransactionElseIgnored,
    amount: (record) =>
      record.symbol || record.isin ? FieldRequirement.Ignored : FieldRequirement.Required,
  },
  [ActivityType.Fee]: {
    ...COMMON_FIELD_REQUIREMENTS,
    instrumentType: FieldRequirement.Ignored,
    symbol: FieldRequirement.Ignored,
    isin: FieldRequirement.Ignored,
    quantity: FieldRequirement.Ignored,
    unitPrice: FieldRequirement.Ignored,
    // Amount or fee - we'll use the amount
    fee: FieldRequirement.Ignored,
    amount: FieldRequirement.Required,
    subtype: FieldRequirement.Optional,
  },
  [ActivityType.Tax]: {
    ...COMMON_FIELD_REQUIREMENTS,
    instrumentType: FieldRequirement.Ignored,
    symbol: FieldRequirement.Ignored,
    isin: FieldRequirement.Ignored,
    quantity: FieldRequirement.Ignored,
    unitPrice: FieldRequirement.Ignored,
    amount: FieldRequirement.Required,
    subtype: FieldRequirement.Optional,
  },
  [ActivityType.Split]: {
    ...COMMON_FIELD_REQUIREMENTS,
    instrumentType: FieldRequirement.Optional,
    symbol: requiredWhenNoIsinElseOptional,
    isin: requiredWhenNoSymbolElseOptional,
    quantity: FieldRequirement.Ignored,
    unitPrice: FieldRequirement.Ignored,
    currency: FieldRequirement.Ignored,
    fee: FieldRequirement.Ignored,
    amount: FieldRequirement.Required,
  },
  [ActivityType.Credit]: {
    ...COMMON_FIELD_REQUIREMENTS,
    instrumentType: FieldRequirement.Ignored,
    symbol: FieldRequirement.Ignored,
    isin: FieldRequirement.Ignored,
    quantity: FieldRequirement.Ignored,
    unitPrice: FieldRequirement.Ignored,
    amount: FieldRequirement.Required,
    subtype: FieldRequirement.Optional,
  },
  // Documentation just states that field requirement "Varies by use case"
  [ActivityType.Adjustment]: {
    ...COMMON_FIELD_REQUIREMENTS,
    instrumentType: optionalWhenAssetTransactionElseIgnored,
    symbol: FieldRequirement.Optional,
    isin: FieldRequirement.Optional,
    quantity: FieldRequirement.Optional,
    unitPrice: FieldRequirement.Optional,
    currency: FieldRequirement.Optional,
    amount: FieldRequirement.Optional,
    subtype: FieldRequirement.Optional,
  },
  // Documentation states: "Activities imported with unrecognized types are marked as UNKNOWN and
  // flagged for review". Either ignore the whole activity or simply pass all fields through?
  [ActivityType.Unknown]: {
    ...COMMON_FIELD_REQUIREMENTS,
    instrumentType: optionalWhenAssetTransactionElseIgnored,
    symbol: FieldRequirement.Optional,
    isin: FieldRequirement.Optional,
    quantity: FieldRequirement.Optional,
    unitPrice: FieldRequirement.Optional,
    currency: FieldRequirement.Optional,
    amount: FieldRequirement.Optional,
    subtype: FieldRequirement.Optional,
  },
};
