/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { bold, italic, red } from "colorette";
import { OptionsWithColumns } from "csv-parse";
import { isISIN, isISO4217 } from "validator";

import {
  ActivitySubtype,
  ActivityType,
  BaseFormat,
  ColumnSchema,
  InstrumentType,
  WealthfolioRecord,
  WealthfolioRecordMetadata,
} from "../core/BaseFormat";
import { canHaveActivitySubtype, requiresCurrency } from "../core/FieldRequirements";
import { Logger } from "../core/Logger";
import { SymbolDataService } from "../core/SymbolDataService";
import { isCUSIP } from "../core/Utils";

interface ParsedRecord extends Record<string, unknown> {
  date: Date;
  transactiontype: string;
  transactionsubtype?: string;
  instrumenttype?: string;
  symbol?: string;
  isin?: string;
  cusip?: string;
  companyname?: string;
  quantity: number;
  unitprice: number;
  fee?: number;
  total?: number;
  currency?: string;
  fxrate?: number;
  comment?: string;
}

/**
 * Generic CSV format plugin
 *
 * Handles generic CSV files with basic column mapping.
 */
export class GenericFormat extends BaseFormat {
  constructor() {
    super("Generic");
  }

  // `validate()` method will be called with "foreign" records, so we cannot assume any specific
  // column names or formats. Thus, we leave `Record<string, unknown>` as the type here.
  validate(records: Record<string, unknown>[]): boolean {
    if (records.length === 0) {
      return false;
    }

    const columns = Object.keys(records[0]);

    // Check for all required columns, can be in an arbitrary order
    const hasRequiredColumns = this.getExpectedSchema()
      .filter((column) => !column.optional)
      .every((requiredColumn) =>
        columns.some((column) => column.toLowerCase() === requiredColumn.name.toLowerCase()),
      );

    // Although marked as optional, either symbol, ISIN, CUSIP, or CompanyName must be present
    return (
      hasRequiredColumns && columns.some((column) => /symbol|isin|cusip|companyname/i.test(column))
    );
  }

  convert(
    records: ParsedRecord[],
    defaultCurrency: string,
    symbolDataService: SymbolDataService,
  ): WealthfolioRecord[] {
    const result: WealthfolioRecord[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      let activityType: ActivityType;
      try {
        activityType = this.mapActivityType(record.transactiontype);
      } catch (error) {
        Logger.getInstance().warn(
          `${bold("Skipping")} record ${italic(i + 1)} due to error: ${red((error as Error).message)}`,
        );
        continue;
      }
      const subtype = this.mapActivitySubtype(record, activityType);
      let quantity = record.quantity;
      let unitPrice = record.unitprice;
      let fee = record.fee ?? Number.NaN;
      let amount = record.total ?? Number.NaN;
      if (activityType !== ActivityType.Adjustment) {
        // Adjustment seems to be the only activity that can have negative quantity or amount and
        // its sign defines the direction. Other activities should always have positive sign, and
        // the direction is defined by the activity itself.
        quantity = Math.abs(quantity);
        unitPrice = Math.abs(unitPrice);
        fee = Math.abs(fee);
        amount = Math.abs(amount);
      }
      if (Number.isNaN(amount) && Number.isFinite(quantity) && Number.isFinite(unitPrice)) {
        amount = quantity * unitPrice;
      }

      const metadata: WealthfolioRecordMetadata = {};
      if (activityType === ActivityType.TransferIn || activityType === ActivityType.TransferOut) {
        // Transfers are internal by default in Wealthfolio
        metadata.flow = { is_external: true };
      } else if (activityType === ActivityType.Dividend) {
        if (subtype === ActivitySubtype.DividendInKind) {
          // TODO: Not supported yet, needs `metadata.received_asset_id`
          Logger.getInstance().warn(
            `Skipping record ${bold(i + 1)}: ${bold(subtype)} subtype is not supported yet`,
          );
          continue;
        }
      } else if (activityType === ActivityType.Fee) {
        // If fee amount is not provided, we can try to get the value from the fee field
        if (!Number.isFinite(amount)) {
          amount = fee;
          fee = Number.NaN;
        }
      }

      let symbol = record.symbol ?? "";
      let isin = record.isin ?? "";
      // If symbol or ISIN are empty, try to resolve from other fields using the symbol data service
      if (
        (!symbol && (record.isin || record.cusip || record.companyname)) ||
        (!isin && (record.symbol || record.cusip || record.companyname))
      ) {
        ({ symbol, isin } = symbolDataService.querySymbolWithFallback({
          symbol: record.symbol,
          isin: record.isin,
          cusip: record.cusip,
          name: record.companyname,
        }));
      }

      let { currency } = record;
      if (!currency && requiresCurrency(activityType)) {
        Logger.getInstance().info(
          `${bold("Missing currency")} in record ${bold(i + 1)}, using default: ${bold(defaultCurrency)}`,
        );
        currency = defaultCurrency;
      }

      result.push({
        date: record.date,
        instrumentType: this.mapInstrumentType(record.instrumenttype),
        symbol,
        isin,
        quantity,
        activityType,
        unitPrice,
        currency: currency || "",
        fee,
        amount,
        fxRate: record.fxrate ?? Number.NaN,
        subtype,
        comment: record.comment ?? "",
        metadata,
      });
    }

    return result;
  }

  private mapInstrumentType(type?: string): InstrumentType {
    if (!type) {
      return InstrumentType.Unknown;
    }
    switch (type.toLowerCase()) {
      case "equity":
      case "stock":
      case "etf":
      case "mutualfund":
      case "mutual_fund":
      case "mutual fund":
      case "index":
        return InstrumentType.Equity;
      case "crypto":
      case "cryptocurrency":
      case "crypto_currency":
      case "crypto currency":
        return InstrumentType.Crypto;
      case "fx":
      case "forex":
      case "currency":
        return InstrumentType.Fx;
      case "option":
      case "opt":
        return InstrumentType.Option;
      case "metal":
      case "commodity":
        return InstrumentType.Metal;
      case "bond":
      case "fixedincome":
      case "fixed_income":
      case "fixed income":
      case "debt":
        return InstrumentType.Bond;
      default:
        return InstrumentType.Unknown;
    }
  }

  private mapActivityType(type: string): ActivityType {
    if (!type) {
      throw new Error("No activity type");
    }
    switch (type.toLowerCase()) {
      case "buy":
      case "purchase":
      case "acquisition":
        return ActivityType.Buy;
      case "sell":
      case "sale":
      case "disposal":
        return ActivityType.Sell;
      case "dividend":
      case "dividends":
        return ActivityType.Dividend;
      case "interest":
        return ActivityType.Interest;
      case "deposit":
        return ActivityType.Deposit;
      case "withdrawal":
        return ActivityType.Withdrawal;
      case "in":
      case "transfer in":
      case "transfer_in":
      case "add":
        return ActivityType.TransferIn;
      case "out":
      case "transfer out":
      case "transfer_out":
      case "remove":
        return ActivityType.TransferOut;
      case "fee":
        return ActivityType.Fee;
      case "tax":
        return ActivityType.Tax;
      case "split":
        return ActivityType.Split;
      case "credit":
        return ActivityType.Credit;
      case "adjustment":
        return ActivityType.Adjustment;
      default:
        throw new Error(`Unknown activity type: ${type}`);
    }
  }

  private mapActivitySubtype(record: ParsedRecord, activityType: ActivityType): ActivitySubtype {
    if (!record.transactionsubtype || !canHaveActivitySubtype(activityType)) {
      return ActivitySubtype.None;
    }

    const activitySubtype = record.transactionsubtype.toLowerCase();
    if (activityType === ActivityType.Dividend) {
      switch (activitySubtype) {
        case "drip":
          return ActivitySubtype.DRIP;
        case "qualified_dividend":
        case "qualified dividend":
        case "qualified":
          return ActivitySubtype.QualifiedDividend;
        case "ordinary_dividend":
        case "ordinary dividend":
        case "ordinary":
          return ActivitySubtype.OrdinaryDividend;
        case "return_of_capital":
        case "return of capital":
          return ActivitySubtype.ReturnOfCapital;
        case "dividend_in_kind":
        case "dividend in kind":
        case "in_kind":
        case "in kind":
          return ActivitySubtype.DividendInKind;
        default:
          return ActivitySubtype.None;
      }
    } else if (activityType === ActivityType.Interest) {
      switch (activitySubtype) {
        case "staking_reward":
        case "staking reward":
        case "staking":
          return ActivitySubtype.StakingReward;
        case "lending_interest":
        case "lending interest":
        case "lending":
          return ActivitySubtype.LendingInterest;
        case "coupon":
          return ActivitySubtype.Coupon;
        default:
          return ActivitySubtype.None;
      }
    } else if (activityType === ActivityType.Fee) {
      switch (activitySubtype) {
        case "management_fee":
        case "management fee":
        case "management":
          return ActivitySubtype.ManagementFee;
        case "adr_fee":
        case "adr fee":
        case "adr":
          return ActivitySubtype.ADRFee;
        case "interest_charge":
        case "interest charge":
        case "interest":
          return ActivitySubtype.InterestCharge;
        default:
          return ActivitySubtype.None;
      }
    } else if (activityType === ActivityType.Tax) {
      switch (activitySubtype) {
        case "withholding":
          return ActivitySubtype.Withholding;
        case "nra_withholding":
        case "nra withholding":
        case "nra":
          return ActivitySubtype.NRAWithholding;
        default:
          return ActivitySubtype.None;
      }
    } else if (activityType === ActivityType.Credit) {
      switch (activitySubtype) {
        case "bonus":
          return ActivitySubtype.Bonus;
        case "rebate":
          return ActivitySubtype.Rebate;
        case "refund":
          return ActivitySubtype.Refund;
        default:
          return ActivitySubtype.None;
      }
    }

    return ActivitySubtype.None;
  }

  getExpectedSchema(): ColumnSchema[] {
    return [
      {
        name: "Date",
        description: "date of the transaction, can include time",
      },
      {
        name: "TransactionType",
        description: "see the Generic Format User Guide for more information",
      },
      {
        name: "TransactionSubtype",
        optional: true,
        description:
          "subtype depends on the transaction type, see the Generic Format User Guide for more details",
      },
      {
        name: "InstrumentType",
        optional: true,
        description:
          "type of the financial instrument, see the Generic Format User Guide for more details",
      },
      {
        name: "Symbol",
        optional: true,
        description:
          "ticker symbol or asset name, empty for cash transactions (requires ISIN, CUSIP, or CompanyName column if not present)",
      },
      {
        name: "ISIN",
        optional: true,
        description: "International Securities Identification Number",
      },
      {
        name: "CUSIP",
        optional: true,
        description:
          "Committee on Uniform Securities Identification Procedures (requires override file)",
      },
      {
        name: "CompanyName",
        optional: true,
        description: "company or asset name (requires override file)",
      },
      {
        name: "Quantity",
        description: "amount of security or asset",
      },
      {
        name: "UnitPrice",
        description: "price per unit of the security or asset",
      },
      {
        name: "Fee",
        optional: true,
        description: "transaction fee, if applicable",
      },
      {
        name: "Total",
        optional: true,
        description:
          "transaction total, excluding fee; calculated from Quantity and UnitPrice if not provided",
      },
      {
        name: "Currency",
        optional: true,
        description: "defaults to currency specified on the command line or EUR if not provided",
      },
      {
        name: "FXRate",
        optional: true,
        description: "foreign currency exchange rate",
      },
      {
        name: "Comment",
        optional: true,
        description: "additional information or notes about the transaction",
      },
    ];
  }

  getParseOptions(): OptionsWithColumns<Record<string, unknown>> {
    return {
      // Trim whitespaces and convert column names to lowercase
      columns: (header: string[]) => header.map((column) => column.trim().toLowerCase()),
      cast: (value, context) => {
        const logger = Logger.getInstance();
        // csv-parse doesn't trim whitespace inside quoted fields
        const trimmedValue = value.trim();
        switch (context.column) {
          case "date":
            return new Date(trimmedValue);
          case "quantity":
          case "unitprice":
          case "fee":
          case "total":
          case "fxrate":
            return Number.parseFloat(trimmedValue);
          case "symbol":
            return trimmedValue.toUpperCase();
          case "isin": {
            const isin = trimmedValue.toUpperCase();
            if (isin && !isISIN(isin)) {
              logger.warn(
                `${red("Invalid ISIN")} in line ${italic(context.lines)} of input file: ${bold(trimmedValue)} - check the source data or use an override to correct it`,
              );
            }
            return isin;
          }
          case "cusip": {
            const cusip = trimmedValue.toUpperCase();
            if (cusip && !isCUSIP(cusip)) {
              logger.warn(
                `${red("Invalid CUSIP")} in line ${italic(context.lines)} of input file: ${bold(trimmedValue)} - check the source data`,
              );
            }
            return cusip;
          }
          case "currency": {
            const currency = trimmedValue.toUpperCase();
            if (currency && !isISO4217(currency)) {
              logger.warn(
                `${red("Invalid currency code")} in line ${italic(context.lines)} of input file: ${bold(trimmedValue)} - will be replaced with the default currency`,
              );
              return undefined; // Don't set - will be replaced with the default currency later
            }
            return currency;
          }
          default:
            return trimmedValue;
        }
      },
    };
  }
}
