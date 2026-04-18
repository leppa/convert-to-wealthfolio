/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { isISIN, isISO4217 } from "validator";

import { bold } from "colorette";

import { ActivitySubtype, ActivityType, WealthfolioRecord } from "./BaseFormat";
import { Logger } from "./Logger";

/**
 * Violation kinds for field requirements
 */
export enum FieldRequirementViolationKind {
  Valid,
  Unset,
  Invalid,
}

/**
 * Field requirement levels
 */
export enum FieldRequirementLevel {
  Required,
  Optional,
  Ignored,
}

/**
 * Validation result for a single field
 *
 * Includes the field name, value, requirement level, and violation kind (valid, unset, or invalid).
 */
export interface FieldValidationResult {
  name: keyof WealthfolioRecord;
  value: unknown;
  requirementLevel: FieldRequirementLevel;
  violationKind: FieldRequirementViolationKind;
}

/**
 * Validation result for a Wealthfolio record against the field requirements
 *
 * Includes a boolean indicating overall validity and an array of fields that failed the validation,
 * along with details on the violations.
 */
export interface RecordValidationResult {
  valid: boolean;
  invalidFields: FieldValidationResult[];
}

/**
 * Validates a Wealthfolio record against the field requirements
 */
export function validateRecordFieldRequirements(
  record: WealthfolioRecord,
  clearIgnoredFields: boolean = true,
): RecordValidationResult {
  const fieldRequirements = RECORD_FIELD_REQUIREMENTS[record.activityType];
  const invalidFields: FieldValidationResult[] = [];
  const ignoredFields: (keyof WealthfolioRecord)[] = [];

  for (const field in fieldRequirements) {
    const fieldKey = field as keyof WealthfolioRecord;
    const requirement = fieldRequirements[fieldKey];
    const value = record[fieldKey];
    const requirementLevel = typeof requirement === "function" ? requirement(record) : requirement;

    const violationKind = validateFieldValue(fieldKey, value);
    if (
      // Required fields must be set and valid
      (requirementLevel === FieldRequirementLevel.Required &&
        violationKind !== FieldRequirementViolationKind.Valid) ||
      // Optional fields can be unset but not invalid
      (requirementLevel === FieldRequirementLevel.Optional &&
        violationKind === FieldRequirementViolationKind.Invalid)
    ) {
      invalidFields.push({
        name: fieldKey,
        value,
        requirementLevel,
        violationKind,
      });
    }

    if (requirementLevel === FieldRequirementLevel.Ignored && clearIgnoredFields) {
      ignoredFields.push(fieldKey);
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
 * Validates the field value
 *
 * The validation will return `FieldRequirementViolationKind.Unset` for empty strings (including
 * all-whitespace strings) and `FieldRequirementViolationKind.Invalid` for invalid values.
 *
 * @param field - The name of the field being validated
 * @param value - The value to validate
 * @returns Validation result indicating whether the value is valid, unset, or invalid
 */
export function validateFieldValue(
  field: keyof WealthfolioRecord,
  value: unknown,
): FieldRequirementViolationKind {
  const logger = Logger.getInstance();
  logger.trace(`Validating field ${bold(field)} with type ${bold(typeof value)} and value:`, value);
  switch (typeof value) {
    case "string":
      return validateStringFieldValue(field, value);
    case "number":
      if (Number.isNaN(value)) {
        // We use NaN to indicate unset numeric fields
        return FieldRequirementViolationKind.Unset;
      }
      return Number.isFinite(value)
        ? FieldRequirementViolationKind.Valid
        : FieldRequirementViolationKind.Invalid;
    case "object":
      if (value === null) {
        // `WealthfolioRecord` has no nullable fields
        return FieldRequirementViolationKind.Invalid;
      }
      if (value instanceof Date) {
        return Number.isNaN(value.getTime())
          ? FieldRequirementViolationKind.Invalid
          : FieldRequirementViolationKind.Valid;
      }
      // Should not be an empty object (e.g., when metadata is required)
      return Object.keys(value).length === 0
        ? FieldRequirementViolationKind.Unset
        : FieldRequirementViolationKind.Valid;
    case "undefined":
      // `WealthfolioRecord` has no optional fields
      return FieldRequirementViolationKind.Invalid;
    // `WealthfolioRecord` has no fields of these types
    case "boolean":
    case "bigint":
    case "symbol":
    case "function":
      logger.warn(`Unexpected type for field ${bold(field)}: ${bold(typeof value)}`);
    // eslint-disable-next-line no-fallthrough
    default:
      return FieldRequirementViolationKind.Invalid;
  }
}

/**
 * Checks if the given activity type can have a subtype
 *
 * This function is meant for checking whether the activity *may* have a subtype, not whether it
 * actually has one. For example, it will always return `true` if subtype requirement is a function,
 * even if the function may return `FieldRequirementLevel.Ignored` for some records.
 *
 * @param activityType - The activity type to check
 * @returns `true` if the activity can have a subtype, `false` otherwise
 */
export function canHaveActivitySubtype(activityType: ActivityType): boolean {
  return RECORD_FIELD_REQUIREMENTS[activityType].subtype !== FieldRequirementLevel.Ignored;
}

/**
 * Clears the value of a field in a Wealthfolio record based on its type
 *
 * - For string fields, sets to an empty string (`""`).
 * - For number fields, sets to `NaN`.
 * - For Date fields, sets to an invalid date (`new Date(NaN)`).
 * - For object fields, sets to an empty object (`{}`).
 *
 * @param record - The Wealthfolio record to modify
 * @param field - The name of the field to clear
 */
export function clearField(record: WealthfolioRecord, field: keyof WealthfolioRecord): void {
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
 * Validates string field values based on the field name
 *
 * Assumes that input values are normalized: whitespaces are trimmed; ISINs, CUSIPs, and currency
 * codes are uppercased.
 *
 * @param field - The name of the field being validated
 * @param value - The normalized string value to validate
 * @returns Validation result indicating whether the value is valid, unset, or invalid
 */
function validateStringFieldValue(
  field: keyof WealthfolioRecord,
  value: string,
): FieldRequirementViolationKind {
  if (value.trim().length === 0) {
    // All-whitespace string is considered empty / unset
    return FieldRequirementViolationKind.Unset;
  }
  if (field === "subtype") {
    // `None` will actually never reach here because it's mapped to an empty string ("") and will
    // fail the previous validation. However, just in case `None` becomes something else in the
    // future, we should still validate it here.
    /* istanbul ignore next: unreachable safeguard */
    if ((value as ActivitySubtype) === ActivitySubtype.None) {
      return FieldRequirementViolationKind.Unset;
    }
    return FieldRequirementViolationKind.Valid;
  }
  if (field === "isin") {
    return isISIN(value)
      ? FieldRequirementViolationKind.Valid
      : FieldRequirementViolationKind.Invalid;
  }
  if (field === "currency") {
    return isISO4217(value)
      ? FieldRequirementViolationKind.Valid
      : FieldRequirementViolationKind.Invalid;
  }
  return FieldRequirementViolationKind.Valid;
}

/**
 * Helper function for fields that are required when ISIN is not set
 *
 * Returns `FieldRequirementLevel.Required` if ISIN is not set, otherwise returns `FieldRequirementLevel.Optional`.
 *
 * @param record - The Wealthfolio record to check
 * @returns Field requirement based on the presence of ISIN
 */
function requiredWhenNoIsinElseOptional(record: WealthfolioRecord): FieldRequirementLevel {
  return record.isin ? FieldRequirementLevel.Optional : FieldRequirementLevel.Required;
}

/**
 * Helper function for fields that are required when symbol is not set
 *
 * Returns `FieldRequirementLevel.Required` if symbol is not set, otherwise returns `FieldRequirementLevel.Optional`.
 *
 * @param record - The Wealthfolio record to check
 * @returns Field requirement based on the presence of symbol
 */
function requiredWhenNoSymbolElseOptional(record: WealthfolioRecord): FieldRequirementLevel {
  return record.symbol ? FieldRequirementLevel.Optional : FieldRequirementLevel.Required;
}

/**
 * Helper function for fields that are required for asset transactions
 *
 * Returns `FieldRequirementLevel.Required` when transaction is for an asset (symbol or ISIN is set),
 * otherwise returns `FieldRequirementLevel.Ignored`.
 *
 * @param record - The Wealthfolio record to check
 * @returns Field requirement based on the presence of symbol or ISIN
 */
function requiredWhenAssetTransactionElseIgnored(record: WealthfolioRecord): FieldRequirementLevel {
  return !!record.symbol || !!record.isin
    ? FieldRequirementLevel.Required
    : FieldRequirementLevel.Ignored;
}

/**
 * Helper function for fields that are optional for asset transactions
 *
 * Returns `FieldRequirementLevel.Optional` when transaction is for an asset (symbol or ISIN is set),
 * otherwise returns `FieldRequirementLevel.Ignored`.
 *
 * @param record - The Wealthfolio record to check
 * @returns Field requirement based on the presence of symbol or ISIN
 */
function optionalWhenAssetTransactionElseIgnored(record: WealthfolioRecord): FieldRequirementLevel {
  return !!record.symbol || !!record.isin
    ? FieldRequirementLevel.Optional
    : FieldRequirementLevel.Ignored;
}

/**
 * For more complex requirements, a function can be used based on the record content
 */
type FieldRequirementFunction = (record: WealthfolioRecord) => FieldRequirementLevel;

type WealthfolioRecordFieldRequirements = {
  [key in keyof WealthfolioRecord]: FieldRequirementLevel | FieldRequirementFunction;
};

// Most common requirements to avoid repetition
const COMMON_FIELD_REQUIREMENTS: Pick<
  WealthfolioRecordFieldRequirements,
  "date" | "activityType" | "fee" | "fxRate" | "subtype" | "comment" | "metadata" | "currency"
> = {
  date: FieldRequirementLevel.Required,
  activityType: FieldRequirementLevel.Required,
  fee: FieldRequirementLevel.Optional,
  fxRate: FieldRequirementLevel.Optional,
  subtype: FieldRequirementLevel.Ignored, // Optional only for some activities
  comment: FieldRequirementLevel.Optional,
  metadata: FieldRequirementLevel.Optional,
  currency: FieldRequirementLevel.Required,
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
    instrumentType: FieldRequirementLevel.Optional,
    symbol: requiredWhenNoIsinElseOptional,
    isin: requiredWhenNoSymbolElseOptional,
    quantity: FieldRequirementLevel.Required,
    unitPrice: FieldRequirementLevel.Required,
    amount: FieldRequirementLevel.Optional,
  },
  [ActivityType.Sell]: {
    ...COMMON_FIELD_REQUIREMENTS,
    instrumentType: FieldRequirementLevel.Optional,
    symbol: requiredWhenNoIsinElseOptional,
    isin: requiredWhenNoSymbolElseOptional,
    quantity: FieldRequirementLevel.Required,
    unitPrice: FieldRequirementLevel.Required,
    amount: FieldRequirementLevel.Optional,
  },
  [ActivityType.Dividend]: {
    ...COMMON_FIELD_REQUIREMENTS,
    instrumentType: FieldRequirementLevel.Optional,
    symbol: requiredWhenNoIsinElseOptional,
    isin: requiredWhenNoSymbolElseOptional,
    quantity: FieldRequirementLevel.Optional,
    unitPrice: (record) =>
      // DRIP and dividend in kind subtypes require unit price for cost basis calculation
      record.subtype === ActivitySubtype.DRIP || record.subtype === ActivitySubtype.DividendInKind
        ? FieldRequirementLevel.Required
        : FieldRequirementLevel.Ignored,
    amount: FieldRequirementLevel.Required,
    subtype: FieldRequirementLevel.Optional,
    metadata: (record) =>
      // Dividend in kind requires metadata with `received_asset_id` to know which asset was
      // received as dividends
      record.subtype === ActivitySubtype.DividendInKind
        ? FieldRequirementLevel.Required
        : FieldRequirementLevel.Optional,
  },
  [ActivityType.Interest]: {
    ...COMMON_FIELD_REQUIREMENTS,
    instrumentType: optionalWhenAssetTransactionElseIgnored,
    symbol: FieldRequirementLevel.Optional,
    isin: FieldRequirementLevel.Optional,
    quantity: FieldRequirementLevel.Ignored,
    unitPrice: (record) =>
      // Staking reward subtype requires unit price (fair market value at the time of reward) for
      // cost basis calculation
      record.subtype === ActivitySubtype.StakingReward
        ? FieldRequirementLevel.Required
        : FieldRequirementLevel.Ignored,
    amount: FieldRequirementLevel.Required,
    subtype: FieldRequirementLevel.Optional,
  },
  [ActivityType.Deposit]: {
    ...COMMON_FIELD_REQUIREMENTS,
    instrumentType: FieldRequirementLevel.Ignored,
    symbol: FieldRequirementLevel.Ignored,
    isin: FieldRequirementLevel.Ignored,
    quantity: FieldRequirementLevel.Ignored,
    unitPrice: FieldRequirementLevel.Ignored,
    amount: FieldRequirementLevel.Required,
  },
  [ActivityType.Withdrawal]: {
    ...COMMON_FIELD_REQUIREMENTS,
    instrumentType: FieldRequirementLevel.Ignored,
    symbol: FieldRequirementLevel.Ignored,
    isin: FieldRequirementLevel.Ignored,
    quantity: FieldRequirementLevel.Ignored,
    unitPrice: FieldRequirementLevel.Ignored,
    amount: FieldRequirementLevel.Required,
  },
  [ActivityType.TransferIn]: {
    ...COMMON_FIELD_REQUIREMENTS,
    instrumentType: optionalWhenAssetTransactionElseIgnored,
    symbol: FieldRequirementLevel.Optional,
    isin: FieldRequirementLevel.Optional,
    quantity: requiredWhenAssetTransactionElseIgnored,
    unitPrice: requiredWhenAssetTransactionElseIgnored,
    amount: (record) =>
      record.symbol || record.isin ? FieldRequirementLevel.Ignored : FieldRequirementLevel.Required,
  },
  [ActivityType.TransferOut]: {
    ...COMMON_FIELD_REQUIREMENTS,
    instrumentType: optionalWhenAssetTransactionElseIgnored,
    symbol: FieldRequirementLevel.Optional,
    isin: FieldRequirementLevel.Optional,
    quantity: requiredWhenAssetTransactionElseIgnored,
    unitPrice: requiredWhenAssetTransactionElseIgnored,
    amount: (record) =>
      record.symbol || record.isin ? FieldRequirementLevel.Ignored : FieldRequirementLevel.Required,
  },
  [ActivityType.Fee]: {
    ...COMMON_FIELD_REQUIREMENTS,
    instrumentType: FieldRequirementLevel.Ignored,
    symbol: FieldRequirementLevel.Ignored,
    isin: FieldRequirementLevel.Ignored,
    quantity: FieldRequirementLevel.Ignored,
    unitPrice: FieldRequirementLevel.Ignored,
    // Amount or fee - we'll use the amount
    fee: FieldRequirementLevel.Ignored,
    amount: FieldRequirementLevel.Required,
    subtype: FieldRequirementLevel.Optional,
  },
  [ActivityType.Tax]: {
    ...COMMON_FIELD_REQUIREMENTS,
    instrumentType: FieldRequirementLevel.Ignored,
    symbol: FieldRequirementLevel.Ignored,
    isin: FieldRequirementLevel.Ignored,
    quantity: FieldRequirementLevel.Ignored,
    unitPrice: FieldRequirementLevel.Ignored,
    amount: FieldRequirementLevel.Required,
    subtype: FieldRequirementLevel.Optional,
  },
  [ActivityType.Split]: {
    ...COMMON_FIELD_REQUIREMENTS,
    instrumentType: FieldRequirementLevel.Optional,
    symbol: requiredWhenNoIsinElseOptional,
    isin: requiredWhenNoSymbolElseOptional,
    quantity: FieldRequirementLevel.Ignored,
    unitPrice: FieldRequirementLevel.Ignored,
    currency: FieldRequirementLevel.Ignored,
    fee: FieldRequirementLevel.Ignored,
    amount: FieldRequirementLevel.Required,
  },
  [ActivityType.Credit]: {
    ...COMMON_FIELD_REQUIREMENTS,
    instrumentType: FieldRequirementLevel.Ignored,
    symbol: FieldRequirementLevel.Ignored,
    isin: FieldRequirementLevel.Ignored,
    quantity: FieldRequirementLevel.Ignored,
    unitPrice: FieldRequirementLevel.Ignored,
    amount: FieldRequirementLevel.Required,
    subtype: FieldRequirementLevel.Optional,
  },
  // Documentation just states that field requirement "Varies by use case"
  [ActivityType.Adjustment]: {
    ...COMMON_FIELD_REQUIREMENTS,
    instrumentType: optionalWhenAssetTransactionElseIgnored,
    symbol: FieldRequirementLevel.Optional,
    isin: FieldRequirementLevel.Optional,
    quantity: FieldRequirementLevel.Optional,
    unitPrice: FieldRequirementLevel.Optional,
    currency: FieldRequirementLevel.Optional,
    amount: FieldRequirementLevel.Optional,
    subtype: FieldRequirementLevel.Optional,
  },
  // Documentation states: "Activities imported with unrecognized types are marked as UNKNOWN and
  // flagged for review". Either ignore the whole activity or simply pass all fields through?
  [ActivityType.Unknown]: {
    ...COMMON_FIELD_REQUIREMENTS,
    instrumentType: optionalWhenAssetTransactionElseIgnored,
    symbol: FieldRequirementLevel.Optional,
    isin: FieldRequirementLevel.Optional,
    quantity: FieldRequirementLevel.Optional,
    unitPrice: FieldRequirementLevel.Optional,
    currency: FieldRequirementLevel.Optional,
    amount: FieldRequirementLevel.Optional,
    subtype: FieldRequirementLevel.Optional,
  },
};
