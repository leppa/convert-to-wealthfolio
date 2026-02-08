<!--
Copyright (c) 2026 Oleksii Serdiuk
SPDX-License-Identifier: BSD-3-Clause
-->

# Plugin Development Guide

To create a new format plugin:

## 1. Create a new file in `src/formats/` directory

Example: `src/formats/MyCustomFormat.ts`

```typescript
/*!
 * Copyright (c) 2026 Oleksii Serdiuk, Your Name
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { ActivityType, BaseFormat, ColumnSchema, WealthfolioRecord } from "../core/BaseFormat";

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

  convert(records: Record<string, string>[]): WealthfolioRecord[] {
    // Note: All CSV values are strings - convert types as needed during processing. You can also
    // define a more convenient data structure and convert to it by overriding `getParseOptions()`.
    return records.map((record) => ({
      date: new Date(record.date),
      symbol: record.ticker.toUpperCase(),
      quantity: Math.abs(parseFloat(record.shares)),
      activityType: this.mapActivityType(record.action),
      unitPrice: Math.abs(parseFloat(record.price)),
      currency: record.currency || "EUR",
      fee: Math.abs(parseFloat(record.fee)),
      amount: Math.abs(parseFloat(record.total)),
      fxRate: NaN,
      subtype: ActivitySubtype.None,
      comment: record.notes || "",
      metadata: {},
    }));
  }

  private mapActivityType(action: string): ActivityType {
    switch (action.toLowerCase().trim()) {
      case "buy":
        return ActivityType.Buy;
      case "sell":
        return ActivityType.Sell;
      case "add_holding":
        return ActivityType.AddHolding;
      case "remove_holding":
        return ActivityType.RemoveHolding;
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
npm run lint:fix
npm start convert examples/my-input.csv output.csv
```

## Wealthfolio Output Format

All converters must output records matching the `WealthfolioRecord` interface:

```typescript
interface WealthfolioRecord {
  date: Date; // Transaction date as Date object
  symbol: string; // Asset symbol / ticker (uppercase)
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

## Best Practices

- **Add copyright header**: All files must include the BSD 3-Clause copyright header
- **Type safety**: Use `Record<string, string>` or a custom type derived from it for parsed CSV records - all values from CSV are strings by default
- **Type conversion**: Convert string values to appropriate types (numbers, dates, etc.) during parsing (see [Customizing CSV parse options](#customizing-csv-parse-options))
- **Format detection**: Make your `validate()` method robust to detect only your CSV format. In other words, try to avoid false positives for other formats.
- **Error handling**: Provide clear error messages for invalid input
- **Documentation**: Document your format requirements and any assumptions
- **Testing**: Test with sample CSV files before submitting
- **Null safety**: Always check for empty or whitespace strings before converting values

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

- [Technical Information](technical-information.md) - Architecture overview
- [src/core/BaseFormat.ts](../src/core/BaseFormat.ts) - `BaseFormat` source code
- [src/formats/GenericFormat.ts](../src/formats/GenericFormat.ts) - An example of a format plugin
