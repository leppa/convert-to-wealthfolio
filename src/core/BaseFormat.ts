/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { OptionsWithColumns } from "csv-parse";

import { SymbolDataService } from "./SymbolDataService";

/**
 * Base class for CSV format plugins
 *
 * All format converters should extend this class.
 */
export abstract class BaseFormat {
  protected name: string;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Validate if the input data matches this format
   *
   * @param records - Parsed CSV records
   * @returns true if records match this format
   */
  abstract validate(records: Record<string, unknown>[]): boolean;

  /**
   * Convert input records to Wealthfolio format
   *
   * @param records - Parsed CSV records
   * @param defaultCurrency - Default currency to use when not specified in records
   * @param symbolDataService - API for symbol lookup to assist conversion
   * @returns Converted records in Wealthfolio format
   */
  abstract convert(
    records: Record<string, unknown>[],
    defaultCurrency: string,
    symbolDataService: SymbolDataService,
  ): WealthfolioRecord[];

  /**
   * Get the expected schema for this format
   *
   * @returns Expected columns with optional flags
   */
  abstract getExpectedSchema(): ColumnSchema[];

  /**
   * Get the format name
   *
   * @returns Format name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Get custom CSV parse options for this format
   *
   * Columns can be overriden, but they **must** be enabled (not set to `false` or `undefined`).
   *
   * @returns CSV parse options
   */
  getParseOptions(): OptionsWithColumns<Record<string, unknown>> {
    return {
      columns: true,
    };
  }

  /**
   * Get the number of data rows to parse for format validation
   *
   * @returns Number of data rows to parse (including header)
   */
  getValidationLineCount(): number {
    return 2; // Header and first data row by default
  }
}

/**
 * Standard Wealthfolio output format
 */
export interface WealthfolioRecord {
  date: Date;
  instrumentType: InstrumentType;
  symbol: string;
  isin: string;
  quantity: number;
  activityType: ActivityType;
  unitPrice: number;
  currency: string;
  fee: number;
  amount: number;
  fxRate: number;
  subtype: ActivitySubtype;
  comment: string;
  // Mentioned in the documentation but doesn't seem to be supported by UI / import yet. Should be
  // exported as serialized JSON.
  metadata: WealthfolioRecordMetadata;
}

export enum InstrumentType {
  Unknown = "",
  // Stocks, ETFs, funds
  Equity = "EQUITY",
  // Cryptocurrencies
  Crypto = "CRYPTO",
  // Currency exchange rates
  Fx = "FX",
  // Options contracts
  Option = "OPTION",
  // Precious metal spot prices (XAU, XAG)
  Metal = "METAL",
  // Fixed-income instruments (bonds, T-bills, notes)
  Bond = "BOND",
}

export enum ActivityType {
  Unknown = "UNKNOWN",
  // Assets only
  Buy = "BUY",
  // Assets only
  Sell = "SELL",
  // Assets only
  Dividend = "DIVIDEND",
  // Both assets and cash
  Interest = "INTEREST",
  // Cash only
  Deposit = "DEPOSIT",
  // Cash only
  Withdrawal = "WITHDRAWAL",
  // Both assets and cash
  TransferIn = "TRANSFER_IN",
  // Both assets and cash
  TransferOut = "TRANSFER_OUT",
  // Both assets and cash
  Fee = "FEE",
  // Both assets and cash
  Tax = "TAX",
  // Assets only
  Split = "SPLIT",
  // Cash only
  Credit = "CREDIT", // Can import, but can't add / edit in the UI yet
  // Assets only
  // NOTE: Documentation mentions that asset is optional, but import UI seems to require it
  Adjustment = "ADJUSTMENT", // Can import, but can't add / edit in the UI yet
}

export enum ActivitySubtype {
  None = "",

  // Dividend subtypes
  DRIP = "DRIP",
  QualifiedDividend = "QUALIFIED",
  OrdinaryDividend = "ORDINARY",
  ReturnOfCapital = "RETURN_OF_CAPITAL",
  DividendInKind = "DIVIDEND_IN_KIND",

  // Interest subtypes
  StakingReward = "STAKING_REWARD",
  LendingInterest = "LENDING_INTEREST",
  Coupon = "COUPON",

  // Fee subtypes
  ManagementFee = "MANAGEMENT_FEE",
  ADRFee = "ADR_FEE",
  InterestCharge = "INTEREST_CHARGE",

  // Tax subtypes
  Withholding = "WITHHOLDING",
  NRAWithholding = "NRA_WITHHOLDING",

  // Credit subtypes
  Bonus = "BONUS",
  Rebate = "REBATE",
  Refund = "REFUND",
}

export interface WealthfolioRecordMetadata {
  // Transfer In/Out specific
  flow?: {
    /// Marks transfer as crossing portfolio boundary
    is_external: boolean;
  };
  // Dividend in kind specific
  /// Asset ID received (different from paying asset)
  received_asset_id?: string;
  // Split specific
  /// Human-readable split ratio (e.g., "2:1")
  split_ratio?: string;
  // Common field
  source?: {
    /// Original broker name
    broker?: "Schwab";
    /// Raw activity type from provider
    original_type?: "REI";
  };
}

/**
 * Schema definition for a column in the expected input format
 */
export interface ColumnSchema {
  name: string;
  optional?: boolean;
  description?: string;
}
