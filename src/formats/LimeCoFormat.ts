/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

import { bold } from "colorette";
import { OptionsWithColumns } from "csv-parse";

import {
  ActivitySubtype,
  ActivityType,
  BaseFormat,
  ColumnSchema,
  InstrumentType,
  WealthfolioRecord,
  WealthfolioRecordMetadata,
} from "../core/BaseFormat";
import { canHaveActivitySubtype } from "../core/FieldRequirements";
import { Logger } from "../core/Logger";
import { SymbolDataService } from "../core/SymbolDataService";

// Activate dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

// Lime.co transactions are always in USD
const CURRENCY = "USD";

interface LimeCoRecord extends Record<string, unknown> {
  date: Date;
  description: string;
  symbol: string;
  direction: string;
  quantity: number;
  price: number;
  fees: number;
  amount: number;
}

/**
 * Lime.co format plugin
 *
 * Handles semicolon-delimited CSV files exported from the Lime Trading brokerage.
 */
export class LimeCoFormat extends BaseFormat {
  constructor() {
    super("Lime.co");
  }

  validate(records: Record<string, unknown>[]): boolean {
    if (records.length < 1) {
      return false;
    }

    const columns = Object.keys(records[0]);
    if (columns.length !== 8) {
      return false;
    }

    const expectedColumns = this.getExpectedSchema().map((column) => column.name);

    // Check if all expected columns are present and in the same order
    for (let i = 0; i < columns.length; i++) {
      if (columns[i] !== expectedColumns[i].toLowerCase()) {
        return false;
      }
    }

    return true;
  }

  convert(
    records: LimeCoRecord[],
    _defaultCurrency: string,
    symbolDataService: SymbolDataService,
  ): WealthfolioRecord[] {
    const logger = Logger.getInstance();

    const results: WealthfolioRecord[] = [];
    const pendingSplits = new Map<string, LimeCoRecord>();
    // Export is in reverse chronological order, but we want it in the chronological one to avoid
    // some edge cases (like buying and selling the same symbol on the same day)
    const chronologicalRecords = records.toReversed();

    for (const record of chronologicalRecords) {
      if (this.shouldSkipRecord(record, logger)) {
        continue;
      }
      const activityType = this.getActivityType(record);
      const metadata: WealthfolioRecordMetadata = {};

      const result: WealthfolioRecord = {
        date: record.date,
        // NOTE: While Lime.co supports options, I only had equity transactions and don't have
        // examples of how options are represented in the CSV
        instrumentType: InstrumentType.Unknown,
        symbol: record.symbol,
        isin: "",
        quantity: this.maybeMakeAbsolute(record.quantity, activityType),
        activityType,
        unitPrice: this.maybeMakeAbsolute(record.price, activityType),
        currency: CURRENCY,
        fee: this.maybeMakeAbsolute(record.fees, activityType),
        amount: this.maybeMakeAbsolute(record.amount, activityType),
        fxRate: Number.NaN, // Not applicable, as Lime.co only supports USD
        subtype: this.getActivitySubtype(record, activityType),
        comment: record.description.trim(),
        metadata,
      };

      if (result.activityType === ActivityType.Split) {
        this.processSplitRecord(record, result, pendingSplits, results, symbolDataService);
        continue;
      } else if (
        result.activityType === ActivityType.TransferIn ||
        result.activityType === ActivityType.TransferOut
      ) {
        // Assume that all transfers are external
        metadata.flow = { is_external: true };
      }

      if (result.activityType === ActivityType.Unknown) {
        logger.warn(
          `Unknown activity type on ${bold(record.date.toISOString())} with direction: ${bold(record.direction)}, description: ${bold(record.description)}`,
        );
        continue;
      }

      this.updateSymbol(result, symbolDataService);
      results.push(result);
    }

    if (pendingSplits.size > 0) {
      const count = pendingSplits.size;
      const verb = count === 1 ? "is" : "are";
      const plural = count === 1 ? "" : "s";
      logger.warn(
        `There ${verb} ${bold(count)} pending split record${plural} that ${verb} missing corresponding in / out record:`,
      );

      pendingSplits.forEach((record) =>
        logger.warn(
          `  - ${bold(record.date.toISOString())}, symbol: ${bold(record.symbol)}, direction: ${bold(record.direction)}, quantity: ${bold(record.quantity)}, description: ${bold(record.description)}`,
        ),
      );
    }

    return results;
  }

  private maybeMakeAbsolute(value: number, activityType: ActivityType): number {
    if (activityType === ActivityType.Adjustment) {
      // Adjustments can be either positive or negative - keep the sign as is
      return value;
    }
    // Other activities imply the movement direction - no need for the sign
    return Math.abs(value);
  }

  private shouldSkipRecord(record: LimeCoRecord, logger: Logger): boolean {
    const descriptionLower = record.description.toLowerCase();
    const activityType = this.getActivityType(record);

    if (
      (activityType === ActivityType.Deposit || activityType === ActivityType.Withdrawal) &&
      (descriptionLower.includes("*from margin*") ||
        descriptionLower.includes("*to cash*") ||
        descriptionLower.includes("cash journal move"))
    ) {
      // Skip internal cash movements
      logger.debug(
        `Skipping internal cash movement on ${bold(record.date.toISOString())} with direction: ${bold(record.direction)}, description: ${bold(record.description)}`,
      );
      return true;
    }

    if (
      (activityType === ActivityType.TransferIn || activityType === ActivityType.TransferOut) &&
      /rename|name change|->/.test(descriptionLower)
    ) {
      // Skip symbol renames
      logger.debug(
        `Skipping symbol rename on ${bold(record.date.toISOString())} ${activityType === ActivityType.TransferOut ? "from" : "to"} ${bold(record.symbol)}, description: ${bold(record.description)}`,
      );
      return true;
    }

    return false;
  }

  private processSplitRecord(
    record: LimeCoRecord,
    result: WealthfolioRecord,
    pendingSplits: Map<string, LimeCoRecord>,
    results: WealthfolioRecord[],
    symbolDataService: SymbolDataService,
  ): void {
    const key = `${record.date.toISOString()}_${record.symbol}`;
    const existing = pendingSplits.get(key);

    if (!existing) {
      pendingSplits.set(key, record);
      return;
    } else if (existing.direction === record.direction) {
      // This should not happen, but just in case, log a warning and skip both records
      const logger = Logger.getInstance();
      logger.warn(
        `Found two split records on ${bold(record.date.toISOString())} for symbol ${bold(record.symbol)} with the same ${bold(record.direction)} direction:`,
      );
      logger.warn(
        `  - quantity: ${bold(existing.quantity)}, description: ${bold(existing.description)}`,
      );
      logger.warn(
        `  - quantity: ${bold(record.quantity)}, description: ${bold(record.description)}`,
      );
      pendingSplits.delete(key);
      return;
    }

    // We have both parts, combine them
    const inRecord = record.direction === "in" ? record : existing;
    const outRecord = record.direction === "out" ? record : existing;

    const quantityIn = Math.abs(inRecord.quantity);
    const quantityOut = Math.abs(outRecord.quantity);

    if (Number.isFinite(quantityIn) && Number.isFinite(quantityOut) && quantityOut !== 0) {
      result.symbol = record.symbol;
      result.quantity = Number.NaN;
      result.unitPrice = Number.NaN;
      result.fee = Number.NaN;
      result.amount = quantityIn / quantityOut; // Split ratio
      result.comment = this.combineDescriptions(inRecord.description, outRecord.description);

      this.updateSymbol(result, symbolDataService);
      results.push(result);
    } else {
      const logger = Logger.getInstance();
      logger.warn(
        `Skipping invalid split transaction on ${bold(record.date.toISOString())} for symbol ${bold(record.symbol)}:`,
      );
      logger.warn(
        `  - ${bold("in")}  quantity: ${bold(quantityIn)}, description: ${bold(inRecord.description)}`,
      );
      logger.warn(
        `  - ${bold("out")} quantity: ${bold(quantityOut)}, description: ${bold(outRecord.description)}`,
      );
    }

    pendingSplits.delete(key);
  }

  private getActivityType(record: LimeCoRecord): ActivityType {
    const descriptionLower = record.description.toLowerCase();
    switch (record.direction) {
      case "buy":
        return ActivityType.Buy;
      case "sell":
        return ActivityType.Sell;
      case "deposit":
      case "withdrawal":
        return this.getDepositOrWithdrawalType(record);
      case "in":
        if (/conversion|merger/.test(descriptionLower)) {
          return ActivityType.Buy;
        } else if (descriptionLower.includes("split")) {
          return ActivityType.Split;
        }
        // NOTE: Assumption - I didn't have share transfers, so can't verify
        return ActivityType.TransferIn;
      case "out":
        if (/conversion|merger/.test(descriptionLower)) {
          return ActivityType.Sell;
        } else if (descriptionLower.includes("split")) {
          return ActivityType.Split;
        }
        // NOTE: Assumption - I didn't have share transfers, so can't verify
        return ActivityType.TransferOut;
      default:
        return ActivityType.Unknown;
    }
  }

  private getDepositOrWithdrawalType(record: LimeCoRecord): ActivityType {
    const descriptionLower = record.description.toLowerCase();
    const isDeposit = record.direction === "deposit";
    if (descriptionLower.startsWith("rounding of") || descriptionLower.includes("fix")) {
      return ActivityType.Adjustment;
    } else if (descriptionLower.includes("tax")) {
      return ActivityType.Tax;
    } else if (descriptionLower.includes("dividend")) {
      return ActivityType.Dividend;
    } else if (descriptionLower.startsWith("interest") || descriptionLower.includes("fee")) {
      return isDeposit ? ActivityType.Interest : ActivityType.Fee;
    } else if (descriptionLower.startsWith("cash journal cil")) {
      // CIL - cash in lieu
      return ActivityType.Credit;
    }
    return isDeposit ? ActivityType.Deposit : ActivityType.Withdrawal;
  }

  private getActivitySubtype(record: LimeCoRecord, activityType: ActivityType): ActivitySubtype {
    if (!canHaveActivitySubtype(activityType)) {
      return ActivitySubtype.None;
    }

    const descriptionLower = record.description.toLowerCase();
    switch (activityType) {
      case ActivityType.Dividend:
        // FIXME: Missing `DRIP`, `ReturnOfCapital` and `DividendInKind` subtypes. I didn't have
        // these transactions, so can't verify their descriptions.
        if (descriptionLower.includes("qualified")) {
          return ActivitySubtype.QualifiedDividend;
        } else if (descriptionLower.includes("cash")) {
          return ActivitySubtype.OrdinaryDividend;
        }
        return ActivitySubtype.None;
      case ActivityType.Fee:
        // FIXME: Missing `ADRFee` and `ManagementFee` subtypes. I didn't have these transactions,
        // so can't verify their descriptions.
        if (descriptionLower.startsWith("interest collect")) {
          return ActivitySubtype.InterestCharge;
        }
        return ActivitySubtype.None;
      case ActivityType.Tax:
        if (descriptionLower.includes("nra withhold")) {
          return ActivitySubtype.NRAWithholding;
        } else if (descriptionLower.includes("withhold")) {
          return ActivitySubtype.Withholding;
        }
        return ActivitySubtype.None;
      case ActivityType.Credit:
        // FIXME: Missing `Bonus`, `Rebate`, and `Refund` subtypes. I didn't have these
        // transactions, so can't verify their descriptions.
        return ActivitySubtype.None;
      default:
        return ActivitySubtype.None;
    }
  }

  private combineDescriptions(first: string, second: string): string {
    if (first === second) {
      return first.trim();
    } else {
      return `${first.trim()} / ${second.trim()}`;
    }
  }

  private isAssetTransaction(record: WealthfolioRecord): boolean {
    return (
      record.activityType === ActivityType.Buy ||
      record.activityType === ActivityType.Dividend ||
      record.activityType === ActivityType.Sell ||
      record.activityType === ActivityType.Split ||
      (!!record.symbol &&
        (record.activityType === ActivityType.Adjustment ||
          record.activityType === ActivityType.TransferIn ||
          record.activityType === ActivityType.TransferOut))
    );
  }

  private updateSymbol(record: WealthfolioRecord, symbolDataService: SymbolDataService) {
    if (!this.isAssetTransaction(record)) {
      record.symbol = "";
      record.isin = "";
      return;
    }

    const { symbol, isin } = record;
    let name: string | undefined;
    if (!symbol && record.activityType === ActivityType.Dividend) {
      // Just in case, allow any printable ASCII characters in the name. So far I've only seen
      // uppercase letters, numbers, spaces, dots and percent signs.
      const matches = record.comment.match(/dividend ([\x20-\x7E]+) (\d+)/i);
      if (matches && matches.length >= 3) {
        name = matches[1].trim();
        record.quantity = Number.parseInt(matches[2], 10);
        record.unitPrice = record.quantity > 0 ? record.amount / record.quantity : Number.NaN;
      }
    }

    if (!symbol && !name) {
      return;
    }

    const result = symbolDataService.querySymbolWithFallback({
      symbol,
      isin,
      name,
    });

    if (result.symbol) {
      record.symbol = result.symbol;
    }
    if (result.isin) {
      record.isin = result.isin;
    }
  }

  getExpectedSchema(): ColumnSchema[] {
    return [
      { name: "Date", optional: false },
      { name: "Description", optional: false },
      { name: "Symbol", optional: false },
      { name: "Direction", optional: false },
      { name: "Quantity", optional: false },
      { name: "Price", optional: false },
      { name: "Fees", optional: false },
      { name: "Amount", optional: false },
    ];
  }

  getParseOptions(): OptionsWithColumns<Record<string, unknown>> {
    return {
      delimiter: ";",
      trim: true,
      from_line: 2, // Skip "sep=;" row
      columns: (header: string[]) => header.map((column) => column.trim().toLowerCase()),
      cast: (value, context) => {
        switch (context.column) {
          case "date":
            // All timestamps have 00:00:00 time and don't include a timezone, so we assume the US
            // stock markets closing time of 16:00 US Eastern Time
            return dayjs.tz(value, "US/Eastern").add(16, "h").toDate();
          case "symbol":
            return value.trim().toUpperCase();
          case "direction":
            return value.trim().toLowerCase();
          case "quantity":
          case "price":
          case "fees":
          case "amount":
            return Number.parseFloat(value) || 0;
          default:
            return value.trim();
        }
      },
    };
  }
}
