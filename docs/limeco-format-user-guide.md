<!--
Copyright (c) 2026 Oleksii Serdiuk
SPDX-License-Identifier: BSD-3-Clause
-->

# Lime.co Format User Guide

## Overview

This plugin handles semicolon-delimited CSV files exported by the **[Lime Trading](https://lime.co)** brokerage. The export structure is fixed - you cannot control how records are produced in the source CSV, so this plugin applies the best-effort rules to map those records into **Wealthfolio** transactions.

**Note:** Because some records are ambiguous, always review the original CSV and fix odd records before conversion. If converted / imported data looks wrong, start by checking the original **Lime Trading** export around the problematic transactions. Pay special attention to the [format quirks](#format-quirks) documented below, as they are the most likely source of inconsistencies.

## Table of Contents<!-- omit from toc -->

- [Overview](#overview)
- [Format Description](#format-description)
  - [Getting the CSV Export](#getting-the-csv-export)
  - [Header](#header)
  - [Record Structure](#record-structure)
- [Mapping Rules](#mapping-rules)
  - [Directly Mapped Records](#directly-mapped-records)
  - [Combined Records](#combined-records)
  - [Ignored Records](#ignored-records)
- [Special Handling](#special-handling)
  - [Transaction Time](#transaction-time)
  - [Transaction Currency](#transaction-currency)
  - [Transfer In / Out Transactions](#transfer-in--out-transactions)
  - [Ignored Transactions](#ignored-transactions)
- [Format Quirks](#format-quirks)
- [Known Limitations](#known-limitations)
- [Validation Advice](#validation-advice)
- [Usage](#usage)
  - [File Sample](#file-sample)
  - [Format Information](#format-information)
- [Testing](#testing)
- [See Also](#see-also)

## Format Description

### Getting the CSV Export

To get a CSV export from **Lime Trading**:

1. [Sign in](https://myaccount.lime.co/) to your account.
2. Go to the _Overview_ page.
3. Expand the _Transaction History_ section.
4. Select the dates you're interested in.
5. Click the _Excel_ icon.

### Header

The first line of the export is a delimiter hint (`sep=;`) which the plugin skips automatically. The second line is the column header:

```csv
sep=;
Date;Description;Symbol;Direction;Quantity;Price;Fees;Amount
```

### Record Structure

Each subsequent line represents a transaction record with the following fields:

- `Date` - transaction date in `YYYY-MM-DD HH:mm:ss` format (time is always `00:00:00`, see also [Transaction Time](#transaction-time) section)
- `Description` - text describing the transaction
- `Symbol` - ticker symbol of the security (empty for cash transactions and dividends)
- `Direction` - one of `buy`, `sell`, `deposit`, `withdrawal`, `in`, or `out`
- `Quantity` - number of shares (positive for `buy` and `in`, negative for `sell` and `out`, zero for cash transactions)
- `Price` - price per share (zero for dividends, empty for cash transactions)
- `Fees` - total fees (always negative or zero)
- `Amount` - total amount of the transaction (positive for cash inflows, negative for cash outflows, zero for corporate actions like splits)

The records are sorted in the reverse chronological order (newest first). The plugin will output the transactions in the chronological order (oldest first).

All numerical fields use dot (`.`) as the decimal separator and don't include thousand separators. They're also prepended by a space character which will be trimmed during conversion.

`Description` field is used to determine the transaction type and its subtype, as well as to extract company name, quantity, and unit price for certain transaction types. See [Mapping Rules](#mapping-rules) and [Format Quirks](#format-quirks) sections for details. The description is also copied verbatim to the `comment` field of the resulting transaction.

## Mapping Rules

### Directly Mapped Records

I.e., **one** source record -> **one** Wealthfolio transaction.

The following records are converted directly, one line at a time:

- `buy` -> `BUY`
- `sell` -> `SELL`
- `deposit` mapping:
  - starting with `rounding of` or containing `fix` in the description -> `ADJUSTMENT`
  - with `tax` in the description -> `TAX`
  - with `dividend` in the description -> `DIVIDEND`
  - starting with `interest` or containing `fee` in the description -> `INTEREST`
  - starting with `cash journal cil` in the description -> `CREDIT`
  - otherwise -> `DEPOSIT`
- `withdrawal` mapping:
  - starting with `rounding of` or containing `fix` in the description -> `ADJUSTMENT`
  - with `tax` in the description -> `TAX`
  - starting with `interest` or containing `fee` in the description -> `FEE`
  - otherwise -> `WITHDRAWAL`
- `in` mapping:
  - with `conversion` or `merger` in the description -> `BUY`
  - without split / conversion marker -> `TRANSFER_IN`
- `out` mapping:
  - with `conversion` or `merger` in the description -> `SELL`
  - without split / conversion marker -> `TRANSFER_OUT`

For non-asset activity types (`DEPOSIT`, `WITHDRAWAL`, `FEE`, `TAX`, etc.), symbol is left empty.

### Combined Records

I.e., **multiple** source records -> **one** Wealthfolio transaction.

- Forward and reverse splits are built from two records: one `in` and one `out`, both containing the same symbol.

  The plugin detects splits from the description text containing `split` and calculates the split ratio from `in` and `out` quantities.

### Ignored Records

Internal cash transfers and ticker symbol renames are ignored. See the [Ignored Transactions](#ignored-transactions) section for more details.

## Special Handling

### Transaction Time

The time of transaction is not included in the **Lime Trading** export (always set to `00:00:00`). The plugin will assume the US stock markets closing time of **16:00 US Eastern time zone** (respecting the daylight saving time).

### Transaction Currency

The **Lime Trading** export doesn't include a currency field. All transactions are assumed to be in **USD**, as it's the only currency supported by **Lime Trading**. The converter will automatically set the `currency` field to `USD` for all transactions and will ignore the `--default-currency` option.

### Transfer In / Out Transactions

The plugin marks all `TRANSFER_IN` and `TRANSFER_OUT` transactions as external (i.e., actual cash movements in or out of your brokerage account).

### Ignored Transactions

#### Internal cash transfers<!-- omit from toc -->

Records with the following text in the description are ignored: `*FROM MARGIN*`, `*TO CASH*`, `cash journal move` (star symbols are literal `*`s in the text, not wildcards).

These are internal cash transfers that don't represent actual cash movements.

#### Ticker symbol renames (use overrides instead)<!-- omit from toc -->

Rename records have prices that don't match (e.g., old symbol `quantity * price` != new symbol `quantity * price`). As such, they are ignored by the plugin.

The preferred approach is to map the old symbol to the current one via overrides. This way, the rename is effectively ignored and the new symbol is used for all transactions (including the historical ones).

Example:

```csv
2022-06-09 00:00:00;FB->META;META;in; 100; 5.9; 0; 0
2022-06-09 00:00:00;FB->META;FB;out; -100; 4.03; 0; 0
```

Recommended mapping:

1. Old symbol: `FB`.
2. Current symbol: `META`.
3. Add symbol override: `FB -> META`.

See [Override and Resolve Symbols and ISINs](./user-manual.md#override-and-resolve-symbols-and-isins) for information on how to set up symbol overrides.

## Format Quirks

Unfortunately, some records in the **Lime Trading** export are ambiguous or missing critical information. The plugin applies best-effort rules to handle those cases, but it is recommended to review the source CSV and fix any odd records before conversion.

### Dividends are missing symbol and quantity<!-- omit from toc -->

Dividend rows have empty `Symbol` and `Quantity` fields.

How plugin handles it:

1. Detects dividend record when `Direction` is `deposit` and `Description` contains `dividend`.
2. Tries to extract company name and quantity from the description.
3. Uses extracted company name for symbol lookup (including overrides).
4. If no mapping is found, falls back to a symbol based on the sanitized company name.

This parsing depends on description wording and may be unreliable.

Example:

```csv
2019-02-27 00:00:00;Qualified Dividend APPLE INC 100;;deposit; 0; 0; 0; 25.00
```

Typical interpretation:

1. Extracted name: `APPLE INC`.
2. Extracted quantity: `100`.
3. Calculated unit price: `25.00 / 100 = 0.25`.
4. Recommended symbol mapping: `APPLE INC` -> `AAPL`. Without this mapping, dividend symbol will become `APPLE-INC` and a warning will be logged.

See [Override and Resolve Symbols and ISINs](./user-manual.md#override-and-resolve-symbols-and-isins) for information on how to set up company name to symbol mappings.

### Forward and reverse splits are calculated from paired `in` and `out` records<!-- omit from toc -->

**Lime Trading** exports split events as two records (old quantity `out`, new quantity `in`), and the plugin combines them into one `SPLIT` transaction.

How plugin handles it:

1. Detects split transaction from the description text containing `split`.
2. Remembers one side until matching `in`/`out` pair is found.
3. Computes split ratio as `abs(in.quantity) / abs(out.quantity)`.

This can be unreliable if description text is inconsistent or if fractional-share handling (forfeiture or cash-in-lieu) distorts quantities. It is recommended to review split records in the source CSV and correct any oddities before conversion.

Example:

```csv
2020-08-31 00:00:00;Split SPLITSPLIT;AAPL;in; 400; 124.81; 0; 0
2020-08-31 00:00:00;Split SPLITSPLIT;AAPL;out; -100; 499.23; 0; 0
```

Computed split ratio: `400/100 = 4` (4:1 forward split).

#### Reverse splits that result in fractional shares can lead to incorrect split ratio calculation<!-- omit from toc -->

Be especially wary of reverse splits that would result in your share amount becoming fractional. **Lime Trading** pays out the fractional shares in cash or forfeits them when the payout is too low. In this case, the plugin will still try to compute the split ratio, but it will be incorrect. E.g., if you had 75 shares before a 1:4 reverse split and received 18 shares after it (0.75 shares paid in lieu), the plugin will calculate the split ratio as `18/75 = 0.24` (instead of the correct `1/4 = 0.25`). This is because the plugin doesn't know how many shares were forfeited and assumes that all shares were converted at the same ratio. To avoid this issue, you might want to change the `out` transaction to the amount of shares that were not paid out and manually add a `sell` record just before the split records for the cash amount that was paid in lieu of the fractional shares.

For example, change these lines:

```csv
2020-08-31 00:00:00;Reverse Split REVERSE SPLITREVERSE SPLIT;AAPL;in; 18; 499.23; 0; 0
2020-08-31 00:00:00;Reverse Split REVERSE SPLITREVERSE SPLIT;AAPL;out; -75; 124.81; 0; 0
```

Into these:

```csv
2020-08-31 00:00:00;Reverse Split REVERSE SPLITREVERSE SPLIT;AAPL;in; 18; 499.23; 0; 0
2020-08-31 00:00:00;Reverse Split REVERSE SPLITREVERSE SPLIT;AAPL;out; -72; 124.81; 0; 0
2020-08-31 00:00:00;Cash in lieu of fractional shares;AAPL;sell; 3; 124.81; 0; 374.43
```

**Note:** Due to the reverse chronological order of records in the **Lime Trading** export, the `sell` line for fractional shares should be placed immediately _after_ the split `in`/`out` lines. This way it will be imported _before_ the split transaction, which is important for correct share quantity calculation.

### Dividend tax records cannot be reliably linked to dividends<!-- omit from toc -->

Dividend tax withholding rows do not include a security symbol in the **Lime Trading** export.

Why this is tricky:

1. Tax records are exported as `withdrawal` transactions and have empty symbol.
2. There is no reliable transaction-level link between a tax record and the corresponding dividend record.
3. Matching by date is unreliable because timestamps are always `00:00:00`.
4. A single day can contain multiple dividend payments and multiple withholding records.

Example:

```csv
2021-03-01 00:00:00;Qualified Dividend APPLE INC 100;;deposit; 0; 0; 0; 12.50
2021-03-01 00:00:00;Qualified Dividend MICROSOFT CORP 80;;deposit; 0; 0; 0; 9.20
2021-03-01 00:00:00;Foreign Tax Withholding NRA WITHHOLD: DIVIDEND;;withdrawal; 0; 0; 0; -1.88
2021-03-01 00:00:00;Foreign Tax Withholding NRA WITHHOLD: DIVIDEND;;withdrawal; 0; 0; 0; -1.38
```

In this case, there is no deterministic way to map each withholding line to a specific dividend line. If we assume the same tax rate for both dividends, we can try matching the records by amount, but this may not always be reliable. If you really need to match the records accurately, the best approach is to review the source CSV and add symbols manually based on your knowledge of the tax rates and dividend amounts. Else, leave the tax rows with empty symbols and they will be imported as generic tax transactions without a link to specific dividends.

## Known Limitations

The following activity types and subtypes are not fully verified or supported due to the absence of real sample data. If you encounter records that fall into these categories, please [report an issue](../CONTRIBUTING.md#reporting-issues) with an anonymized example so support can be improved.

### Instrument type is always set to `Unknown`<!-- omit from toc -->

While **Lime Trading** supports options trading, only equity transactions were available in the sample data. The plugin always sets `instrumentType` to `Unknown` and cannot distinguish between equities, options, or other instruments.

### Share transfer directions are assumed<!-- omit from toc -->

`in` records without `split`, `conversion`, or `merger` in the description are mapped to `TRANSFER_IN`, and `out` records to `TRANSFER_OUT`. This assumption was not verified against real share transfer data.

### Missing dividend subtypes<!-- omit from toc -->

Only `QualifiedDividend` and `OrdinaryDividend` subtypes are currently mapped. The following subtypes are not handled because no sample data was available:

- `DRIP` - dividend reinvestment plan.
- `ReturnOfCapital` - return of capital (non-taxable dividend).
- `DividendInKind` - dividend paid in securities instead of cash.

These will fall back to no subtype.

### Missing fee subtypes<!-- omit from toc -->

Only `InterestCharge` is currently mapped. The `ADRFee` and `ManagementFee` subtypes are not handled because no sample data was available and the description wording is unknown. These records will fall back to no subtype.

### Missing credit subtypes<!-- omit from toc -->

None of the `Bonus`, `Rebate`, or `Refund` records were present in the sample data, so no credit subtypes are mapped. All `CREDIT` transactions will have no subtype.

## Validation Advice

Before conversion:

- Scan dividend records with missing symbol / quantity.
- Scan forward / reverse split pairs for clean `in`/`out` quantities.
- Confirm ticker symbol rename history is covered by overrides.
- Check the dividend tax records and, when feasible, add symbols manually. Don't assume one-to-one mapping with the same-day dividend records. Theoretically, if you know the tax rate, you can try matching the records by amount, but this may not always be reliable.

After conversion/import:

- If holdings, cost basis, or cash amount look wrong, inspect the source records first.
- Pay close attention to quirky records as they are the most probable source of inconsistencies.
- If you find any issues with the converter, please [report a bug](../CONTRIBUTING.md#reporting-issues).

## Usage

Convert a **Lime Trading** export with automatic format detection:

```bash
convert-to-wealthfolio convert path/to/limeco-export.csv output.csv
```

Convert a **Lime Trading** export with explicit format specification:

```bash
convert-to-wealthfolio convert --format Lime.co path/to/limeco-export.csv output.csv
```

### File Sample

See the sample input in `examples/sample-limeco.csv`.

Convert it with:

```bash
convert-to-wealthfolio convert examples/sample-limeco.csv lime-output.csv
```

### Format Information

See the format information and expected schema:

```bash
convert-to-wealthfolio info Lime.co
```

## Testing

First, you need to [get the source](../README.md#building-and-running-from-source). Then, run the test suite to verify the converter:

```bash
npm test tests/formats/LimeCoFormat.test.ts
```

All **Lime.co** format tests are located in `tests/formats/LimeCoFormat.test.ts`.

## See Also

- [Wealthfolio Documentation](https://wealthfolio.app/docs/guide/activities/#csv-import) - Information about **Wealthfolio** CSV import.
- [examples/sample-limeco.csv](../examples/sample-limeco.csv) - Sample **Lime Trading** export file (synthetic data).
- [src/formats/LimeCoFormat.ts](../src/formats/LimeCoFormat.ts) - Source code of the **Lime.co** format plugin.
- [tests/formats/LimeCoFormat.test.ts](../tests/formats/LimeCoFormat.test.ts) - Unit tests for the **Lime.co** format plugin.
