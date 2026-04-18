<!--
Copyright (c) 2026 Oleksii Serdiuk
SPDX-License-Identifier: BSD-3-Clause
-->

# Format Plugin Development Guide

To create a new format plugin:

## 1. Create a new file in `src/formats/` directory

Example: `src/formats/MyCustomFormat.ts`

```typescript
/*!
 * Copyright (c) 2026 Oleksii Serdiuk, Your Name
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {
  ActivitySubtype,
  ActivityType,
  BaseFormat,
  ColumnSchema,
  InstrumentType,
  WealthfolioRecord,
} from "../core/BaseFormat";
import { SymbolDataService } from "../core/SymbolDataService";

export class MyCustomFormat extends BaseFormat {
  constructor() {
    super("MyFormat");
  }

  // `validate()` method will be called with "foreign" records, so we cannot assume any specific
  // column names or formats. Thus, we leave `Record<string, unknown>` as the type here.
  validate(records: Record<string, unknown>[]): boolean {
    // Check if records match your format. Return true if they do, false otherwise.
    if (records.length === 0) {
      return false;
    }
    const firstRecord = records[0];
    return "mySpecificColumn" in firstRecord;
  }

  convert(
    records: Record<string, string>[],
    defaultCurrency: string,
    symbolDataService: SymbolDataService,
  ): WealthfolioRecord[] {
    // Note: All CSV values are strings - convert types as needed during processing. You can also
    // define a more convenient data structure and convert to it by overriding `getParseOptions()`.
    return records.map((record) => {
      let symbol = record.ticker?.trim().toUpperCase() ?? "";
      let isin = record.isin?.trim().toUpperCase() ?? "";
      // If symbol is empty, try to resolve it from other fields using the symbol data service
      if (!symbol && (record.isin || record.cusip || record.securityName)) {
        const resolved = symbolDataService.querySymbolWithFallback({
          isin: record.isin,
          cusip: record.cusip,
          name: record.securityName,
        });
        if (resolved.symbol) {
          symbol = resolved.symbol;
        }
        if (resolved.isin) {
          isin = resolved.isin;
        }
      }

      return {
        date: new Date(record.date),
        instrumentType: this.mapInstrumentType(record.instrumentType),
        symbol,
        isin,
        quantity: Math.abs(parseFloat(record.shares)),
        activityType: this.mapActivityType(record.action),
        unitPrice: Math.abs(parseFloat(record.price)),
        currency: record.currency || defaultCurrency,
        fee: Math.abs(parseFloat(record.fee)),
        amount: Math.abs(parseFloat(record.total)),
        fxRate: Number.NaN,
        subtype: ActivitySubtype.None,
        comment: record.notes || "",
        metadata: {},
      };
    });
  }

  private mapInstrumentType(type?: string): InstrumentType {
    if (!type) {
      return InstrumentType.Unknown;
    }

    switch (type.trim().toLowerCase()) {
      case "equity":
      case "stock":
      case "etf":
        return InstrumentType.Equity;
      case "crypto":
      case "cryptocurrency":
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
      case "debt":
        return InstrumentType.Bond;
      default:
        return InstrumentType.Unknown;
    }
  }

  private mapActivityType(action: string): ActivityType {
    switch (action.toLowerCase().trim()) {
      case "buy":
        return ActivityType.Buy;
      case "sell":
        return ActivityType.Sell;
      case "add_holding":
        return ActivityType.TransferIn;
      case "remove_holding":
        return ActivityType.TransferOut;
      case "deposit":
        return ActivityType.Deposit;
      case "withdrawal":
        return ActivityType.Withdrawal;
      case "transfer_in":
        return ActivityType.TransferIn;
      case "transfer_out":
        return ActivityType.TransferOut;
      case "dividend":
        return ActivityType.Dividend;
      case "interest":
        return ActivityType.Interest;
      case "tax":
        return ActivityType.Tax;
      case "fee":
        return ActivityType.Fee;
      case "split":
        return ActivityType.Split;
      default:
        return ActivityType.Unknown;
    }
  }

  getExpectedSchema(): ColumnSchema[] {
    return [
      { name: "date", description: "Transaction date" },
      { name: "ticker", description: "Stock ticker symbol" },
      {
        name: "isin",
        optional: true,
        description: "International Securities Identification Number",
      },
      {
        name: "cusip",
        optional: true,
        description: "Committee on Uniform Securities Identification Procedures",
      },
      {
        name: "securityName",
        optional: true,
        description: "Security or asset name",
      },
      {
        name: "instrumentType",
        optional: true,
        description: "Instrument type (equity, crypto, fx, option, metal, bond)",
      },
      { name: "shares", description: "Number of shares" },
      { name: "price", description: "Price per share" },
      { name: "action", description: "Transaction type (BUY, SELL, etc.)" },
      { name: "total", description: "Total transaction amount" },
      {
        name: "currency",
        optional: true,
        description: "ISO currency code, defaults to EUR if not provided",
      },
      { name: "fee", optional: true, description: "Transaction fee" },
      { name: "notes", optional: true, description: "Additional notes" },
    ];
  }
}
```

## 2. Register the plugin

Add your format to `src/formats/index.ts`:

```typescript
/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * Format plugins registry
 *
 * Imports and creates all available format converters, then exports them as a single array.
 */

import { BaseFormat } from "../core/BaseFormat";
import { GenericFormat } from "./GenericFormat";
import { MyCustomFormat } from "./MyCustomFormat";
import { SomeFormat } from "./SomeFormat";
import { SomeOtherFormat } from "./SomeOtherFormat";

const formats: BaseFormat[] = [
  new SomeFormat(),
  new MyCustomFormat(), // <-- Always place your format before Generic. Try to place it between other formats in a way that doesn't cause detection conflicts.
  new SomeOtherFormat(),
  new GenericFormat(), // Keep this last - it's the most generic and may match other formats
];

export default formats;
```

**Note:** The order matters! More specific formats should come before generic ones. The converter tries each format in order until one matches.

## 3. Build and test

```bash
npm run build
npm run lint:check
npm run format:check
npm test
npm start convert examples/my-input.csv output.csv
```

## Wealthfolio Output Format

All converters must output records matching the `WealthfolioRecord` interface:

```typescript
interface WealthfolioRecord {
  date: Date; // Transaction date as Date object
  instrumentType: InstrumentType; // Instrument category enum (optional by activity)
  symbol: string; // Asset symbol / ticker (uppercase)
  isin: string; // ISIN code (optional, can substitute symbol for asset transactions)
  quantity: number; // Number of shares / units
  activityType: ActivityType; // Transaction type enum
  unitPrice: number; // Unit price
  currency: string; // ISO currency code (e.g., "EUR")
  fee: number; // Transaction fee
  amount: number; // Total transaction amount or split ratio for splits
  fxRate: number; // Currency exchange rate to base currency
  subtype: ActivitySubtype; // Optional activity subtype
  comment: string; // Additional notes or transaction details
  metadata: WealthfolioRecordMetadata; // Additional metadata
}

enum InstrumentType {
  Unknown = "",
  Equity = "EQUITY",
  Crypto = "CRYPTO",
  Fx = "FX",
  Option = "OPTION",
  Metal = "METAL",
  Bond = "BOND",
}

enum ActivityType {
  Unknown = "UNKNOWN",
  Buy = "BUY", // Assets only
  Sell = "SELL", // Assets only
  Dividend = "DIVIDEND", // Assets only
  Interest = "INTEREST", // Both assets and cash
  Deposit = "DEPOSIT", // Cash only
  Withdrawal = "WITHDRAWAL", // Cash only
  TransferIn = "TRANSFER_IN", // Both assets and cash
  TransferOut = "TRANSFER_OUT", // Both assets and cash
  Fee = "FEE", // Both assets and cash
  Tax = "TAX", // Both assets and cash
  Split = "SPLIT", // Assets only
  Credit = "CREDIT", // Cash only (can import, but can't add/edit in UI yet)
  Adjustment = "ADJUSTMENT", // Assets only (can import, but can't add/edit in UI yet)
}

enum ActivitySubtype {
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
```

## Field Validation

The converter framework automatically validates all output records using activity type-specific field requirements defined in `src/core/FieldRequirements.ts`. This means:

- **Required fields** are verified for each activity type (e.g., `BUY` requires `symbol`, `quantity`, and `unitPrice`).
- **Ignored fields** are automatically cleared based on activity type (e.g., `symbol` is cleared for `DEPOSIT` activities).
- **Invalid records** are filtered out and not written to the output CSV.
- **Detailed warnings** are logged for any validation failures.

As a plugin developer, you should:

- Focus on converting your CSV format to `WealthfolioRecord` objects.
- Don't worry about implementing field-level validation - the framework handles it.
- Set fields appropriately even if they might be ignored (the framework will clear them).
- Use `NaN` for numeric fields that aren't applicable (e.g., `unitPrice` for deposits).
- Use empty strings for text fields that aren't applicable.

The validation happens automatically after your `convert()` method returns the records, so you can trust that only valid records will be written to the output file.

## Symbol and ISIN Overrides and Resolution

Your plugin can use the `SymbolDataService` passed to the `convert()` method to resolve ISINs, CUSIPs, and company names. This automatically applies user-provided mapping from INI file and enables custom data providers.

Example:

```typescript
import { BaseFormat, InstrumentType, WealthfolioRecord } from "../core/BaseFormat";
import { SymbolDataService } from "../core/SymbolDataService";

export class MyCustomFormat extends BaseFormat {
  convert(
    records: Record<string, string>[],
    defaultCurrency: string,
    symbolDataService: SymbolDataService,
  ): WealthfolioRecord[] {
    return records.map((record) => {
      let symbol = record.symbol || "";
      let isin = record.isin || "";
      // When symbol is empty, use `symbolDataService` to resolve one. It handles ISIN, CUSIP, or
      // company name lookups, and fallbacks.
      if (!symbol && (record.isin || record.cusip || record.name)) {
        const resolved = symbolDataService.querySymbolWithFallback({
          isin: record.isin,
          cusip: record.cusip,
          name: record.name,
        });
        if (resolved.symbol) {
          symbol = resolved.symbol;
        }
        if (resolved.isin) {
          isin = resolved.isin;
        }
      }

      return {
        date: new Date(record.date),
        instrumentType: InstrumentType.Unknown,
        symbol, // Already resolved with overrides applied
        isin,
        quantity: parseFloat(record.shares),
        activityType: this.mapActivityType(record.action),
        unitPrice: parseFloat(record.unitPrice),
        currency: record.currency || defaultCurrency,
        fee: parseFloat(record.fee),
        amount: parseFloat(record.total),
        fxRate: Number.NaN,
        subtype: ActivitySubtype.None,
        comment: record.notes || "",
        metadata: {},
      };
    });
  }
}
```

**Note:** If you don't need symbol resolution, you can ignore the `symbolDataService` parameter. You only need it if you want to resolve ISINs, CUSIPs, or company names to symbols. Resolution results are cached in memory by `SymbolDataService` — calling `querySymbolWithFallback()` multiple times with the same query parameters is efficient and will not repeat provider lookups. Symbol and ISIN overrides from the INI file are applied automatically after conversion, so you don't need to handle symbol override logic manually in your format plugin.

## Best Practices

- **Add copyright header**: All files must include the BSD 3-Clause copyright header.
- **Type safety**: Use `Record<string, string>` or a custom type derived from it for parsed CSV records - all values from CSV are strings by default.
- **Type conversion**: Convert string values to appropriate types (numbers, dates, etc.) during parsing (see [Customizing CSV parse options](#customizing-csv-parse-options)).
- **Format detection**: Make your `validate()` method robust to detect only your CSV format. In other words, try to avoid false positives for other formats.
- **Default currency**: If your format doesn't include a currency column, use the `defaultCurrency` parameter provided to `convert()` method.
- **Symbol and ISIN Resolution**: Use `symbolDataService.querySymbol()` or `symbolDataService.querySymbolWithFallback()` to resolve symbols and ISINs from ISIN, CUSIP, and company name fields (see [Symbol and ISIN Overrides and Resolution](#symbol-and-isin-overrides-and-resolution)).
- **Error handling**: Provide clear error messages for invalid input.
- **Documentation**: Document your format requirements and any assumptions.
- **Testing**: Test with sample CSV files before submitting.
- **Null safety**: Always check for empty or whitespace strings before converting values.

## Customizing CSV Parse Options

You can customize how your CSV is parsed by overriding the `getParseOptions()` method. This is useful for handling different delimiters, quote characters, or other CSV formatting variations.

```typescript
import { Options } from "csv-parse";

export class MyCustomFormat extends BaseFormat {
  getParseOptions(): Options {
    return {
      delimiter: ";", // Use semicolon as delimiter instead of comma
      skip_empty_lines: true,
      skip_records_with_error: true,
      // Note: This will only remove spaces around the delimiters. Use `cast` or `on_record` to trim
      // the cell value itself.
      trim: true,
    };
  }
}
```

For a complete list of available options, see the [csv-parse documentation](https://csv.js.org/parse/options/).

**Example:** Check the [GenericFormat.ts](../src/formats/GenericFormat.ts) to see an example of how to define a more convenient data structure and convert CSV columns to it during parsing.

## Testing Your Plugin

Create a sample CSV file and test your plugin:

```bash
# Build the project
npm run build

# Test your format conversion
npm start convert examples/my-format-sample.csv output.csv

# Verify the output looks correct
cat output.csv

# Test with overrides
npm start convert examples/my-format-sample.csv output.csv -- --overrides examples/overrides.ini
```

## Code Quality

After creating your plugin, run the linting tools to ensure code quality:

```bash
npm run lint        # Check for linting issues
npm run lint:fix    # Auto-fix issues
npm run format      # Format code with Prettier
npm test            # Run tests
```

## See Also

- [Technical Information](technical-information.md) - Architecture overview.
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guidelines.
- [src/core/BaseFormat.ts](../src/core/BaseFormat.ts) - `BaseFormat` source code.
- [src/formats/GenericFormat.ts](../src/formats/GenericFormat.ts) - An example of a format plugin.
