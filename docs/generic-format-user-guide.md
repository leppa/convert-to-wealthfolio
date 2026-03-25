<!--
Copyright (c) 2026 Oleksii Serdiuk
SPDX-License-Identifier: BSD-3-Clause
-->

# Generic Format User Guide

## Overview<!-- omit from toc -->

The Generic format is a flexible CSV format designed to handle a wide variety of financial transactions. It can be used to convert your investment and account activity into Wealthfolio format when no specific format plugin is available for your data source.

This format supports standard transaction types such as buys, sells, dividends, interest, deposits, withdrawals, transfers, fees, taxes, and more. It also allows for optional fields like currency, fees, and comments to provide additional context.

**Note:** The Wealthfolio's import system is very flexible and can handle many formats without needing a custom converter. The Generic format is mainly provided as an example of how to create a custom format plugin.

## Table of Contents<!-- omit from toc -->

- [CSV Structure](#csv-structure)
  - [Required Columns](#required-columns)
  - [Optional Columns](#optional-columns)
  - [Column Ordering](#column-ordering)
  - [Header Row](#header-row)
- [Transaction Types](#transaction-types)
  - [Buy Transactions](#buy-transactions)
  - [Sell Transactions](#sell-transactions)
  - [Dividend Income](#dividend-income)
  - [Interest Income](#interest-income)
  - [Deposit](#deposit)
  - [Withdrawal](#withdrawal)
  - [Transfer In](#transfer-in)
  - [Transfer Out](#transfer-out)
  - [Fee](#fee)
  - [Tax](#tax)
  - [Stock Split](#stock-split)
  - [Credit](#credit)
  - [Adjustment](#adjustment)
- [Value Formatting](#value-formatting)
  - [Date and Time](#date-and-time)
  - [Quantities and Prices](#quantities-and-prices)
  - [Currency Codes](#currency-codes)
- [Complete Example File](#complete-example-file)
- [Tips and Best Practices](#tips-and-best-practices)
- [Field Validation](#field-validation)
- [Common Issues](#common-issues)
  - [Missing Required Columns](#missing-required-columns)
  - [Unknown Transaction Type](#unknown-transaction-type)
  - [Invalid Date Format](#invalid-date-format)
  - [Symbol Required](#symbol-required)
- [Getting Format Information](#getting-format-information)
- [See Also](#see-also)

## CSV Structure

### Required Columns

The following columns **must** be present in your CSV file:

| Column | Description | Example |
| --- | --- | --- |
| `Date` | Transaction date and, optionally, time (see [Date and Time](#date-and-time) below) | `2024-03-10 13:25:10`, `2024-01-15` |
| `TransactionType` | Type of transaction (see [Transaction Types](#transaction-types) below) | `BUY`, `SELL`, `DIVIDEND` |
| `Symbol` | Ticker symbol (empty for cash transactions) | `AAPL`, `MSFT`, `GOOGL` |
| `Quantity` | Number of shares / units (see [Quantities and Prices](#quantities-and-prices) below) | `100`, `50.5` |
| `UnitPrice` | Price per share / unit (see [Quantities and Prices](#quantities-and-prices) below) | `150.25`, `1380.50` |

### Optional Columns

These columns enhance your data, but can be omitted:

| Column | Description | Default |
| --- | --- | --- |
| `Fee` | Transaction fee or commission (see [Quantities and Prices](#quantities-and-prices) below) | Not set |
| `Total` | Total transaction amount (see [Quantities and Prices](#quantities-and-prices) below) | Calculated from `Quantity` × `UnitPrice` |
| `Currency` | 3-letter currency code (see [Currency Codes](#currency-codes) below) | either `--default-currency` command line option, or `EUR` |
| `TransactionSubtype` | More specific transaction classification, varies by transaction type (see [Transaction Types](#transaction-types) below) | Not set |
| `FXRate` | Foreign exchange rate | Not set |
| `Comment` | Notes or description | Empty |

### Column Ordering

Columns can appear in any order in your CSV file. The converter automatically detects and maps them by name (case-insensitive).

### Header Row

The first row must contain column names. Column names are case-insensitive and whitespace is trimmed.

## Transaction Types

The `TransactionType` column supports the following values (case-insensitive):

### Buy Transactions

**Supported values:** `BUY`, `PURCHASE`, `ACQUISITION`

Used when purchasing securities.

**Example:**

```csv
Date,TransactionType,Symbol,Quantity,UnitPrice,Fee,Currency
2024-01-15,BUY,AAPL,100,150.25,9.99,EUR
```

### Sell Transactions

**Supported values:** `SELL`, `SALE`, `DISPOSAL`

Used when selling securities.

**Example:**

```csv
Date,TransactionType,Symbol,Quantity,UnitPrice,Fee,Currency
2024-02-20,SELL,MSFT,50,380.50,9.99,EUR
```

### Dividend Income

**Supported values:** `DIVIDEND`, `DIVIDENDS`

Used for dividend payments received. `Quantity` and `UnitPrice` can be used to specify the number of shares and dividend per share, or they can be left empty and `Total` can be used for the total dividend amount.

**Example:**

```csv
Date,TransactionType,Symbol,Quantity,UnitPrice,Total,Currency,TransactionSubtype
2024-03-10,DIVIDEND,GOOGL,100,,250.00,EUR,
2024-03-11,DIVIDEND,AAPL,50,1.25,62.50,EUR,DRIP
```

**Note:** For `DRIP` transactions, `Quantity` and `UnitPrice` **must** be provided as they will be used by Wealthfolio for cost basis calculation.

**Supported Subtypes:**

- `DRIP` - Dividend Reinvestment Plan
- `QUALIFIED_DIVIDEND`, `QUALIFIED DIVIDEND`, or `QUALIFIED` - Qualified dividend (tax advantaged)
- `ORDINARY_DIVIDEND`, `ORDINARY DIVIDEND`, or `ORDINARY` - Ordinary dividend income
- `RETURN_OF_CAPITAL`, `RETURN OF CAPITAL`, or `RETURN` - Return of capital distribution
- `DIVIDEND_IN_KIND`, `DIVIDEND IN KIND`, `IN_KIND`, or `IN KIND` - Dividend paid in shares (not yet supported)

### Interest Income

**Supported values:** `INTEREST`

Used for interest earned on cash balances, bonds, or crypto staking.

**Example:**

```csv
Date,TransactionType,Symbol,Quantity,UnitPrice,Total,Currency,TransactionSubtype
2024-04-10,INTEREST,,,,12.50,EUR,
2024-04-11,INTEREST,ETH,0.003498,3400,11.8932,EUR,STAKING_REWARD
```

**Supported Subtypes:**

- `STAKING_REWARD`, `STAKING REWARD`, or `STAKING` - Cryptocurrency staking rewards
- `LENDING_INTEREST`, `LENDING INTEREST`, or `LENDING` - Interest from lending activities
- `COUPON` - Bond coupon payment

### Deposit

**Supported values:** `DEPOSIT`

Used when depositing cash into the account.

**Example:**

```csv
Date,TransactionType,Symbol,Quantity,UnitPrice,Total,Currency,Comment
2024-03-20,DEPOSIT,,,,5000.00,EUR,Initial funding
```

### Withdrawal

**Supported values:** `WITHDRAWAL`

Used when withdrawing cash from the account.

**Example:**

```csv
Date,TransactionType,Symbol,Quantity,UnitPrice,Total,Currency,Comment
2024-03-25,WITHDRAWAL,,,,2000.00,EUR,Living expenses
```

### Transfer In

**Supported values:** `IN`, `TRANSFER IN`, `TRANSFER_IN`, `ADD`

Used when transferring securities or cash into the account from another broker or account.

**Example:**

```csv
Date,TransactionType,Symbol,Quantity,UnitPrice,Total,Currency,Comment
2024-04-01,TRANSFER_IN,AMZN,100,175.50,17550.00,EUR,From previous broker
2024-04-02,TRANSFER_IN,,,,5000.00,EUR,Cash transfer from other account
```

**Note:** Transfers are marked as external (coming from outside sources).

### Transfer Out

**Supported values:** `OUT`, `TRANSFER OUT`, `TRANSFER_OUT`, `REMOVE`

Used when transferring securities out of the account to another broker or account.

**Example:**

```csv
Date,TransactionType,Symbol,Quantity,UnitPrice,Total,Currency,Comment
2024-04-05,TRANSFER_OUT,AMZN,50,175.50,8775.00,EUR,To other broker
2024-04-06,TRANSFER_OUT,,,,2000.00,EUR,Cash transfer to other account
```

**Note:** Transfers are marked as external (going to outside sources).

### Fee

**Supported values:** `FEE`

Used for account fees, management fees, or other charges.

**Example:**

```csv
Date,TransactionType,Symbol,Quantity,UnitPrice,Total,Fee,Currency,TransactionSubtype
2024-04-15,FEE,,,,25.00,,EUR,
2024-04-16,FEE,,,,,10.00,EUR,MANAGEMENT_FEE
```

**Note:** If `Total` value is not provided, the converter will try to use `Fee` value as the fee amount. If both are provided, `Total` takes precedence and `Fee` is ignored.

**Supported Subtypes:**

- `MANAGEMENT_FEE`, `MANAGEMENT FEE`, or `MANAGEMENT` - Investment management fee
- `ADR_FEE`, `ADR FEE`, or `ADR` - American Depositary Receipt fee
- `INTEREST_CHARGE`, `INTEREST CHARGE`, or `INTEREST` - Margin interest or other interest charges

### Tax

**Supported values:** `TAX`

Used for tax withholding or tax payments.

**Example:**

```csv
Date,TransactionType,Symbol,Quantity,UnitPrice,Total,Currency,TransactionSubtype
2024-04-19,TAX,,,,1.25,EUR,
2024-04-19,TAX,,,,3.75,EUR,WITHHOLDING
```

**Supported Subtypes:**

- `WITHHOLDING` - Tax withholding
- `NRA_WITHHOLDING` or `NRA` - Non-Resident Alien tax withholding

### Stock Split

**Supported values:** `SPLIT`

Used to record stock splits or reverse splits. `Total` field specifies the split ratio (e.g., 2 for a 2:1 forward split, 0.5 for a 1:2 reverse split).

**Example:**

```csv
Date,TransactionType,Symbol,Quantity,UnitPrice,Total,Currency,Comment
2024-04-25,SPLIT,NVDA,,,2,,2:1 forward stock split
```

### Credit

**Supported values:** `CREDIT`

Used for account credits, bonuses, or refunds.

**Example:**

```csv
Date,TransactionType,Symbol,Quantity,UnitPrice,Total,Currency,TransactionSubtype
2024-04-30,CREDIT,,,,50.00,EUR,BONUS
2024-05-01,CREDIT,,,,25.00,EUR,REBATE
```

**Supported Subtypes:**

- `BONUS` - Broker bonus or promotional credit
- `REBATE` - Promotional rebate
- `REFUND` - Fee or other refund

### Adjustment

**Supported values:** `ADJUSTMENT`

Used for balance corrections or adjustments. Unlike other activities, adjustments can have negative quantities to indicate reductions.

**Example:**

```csv
Date,TransactionType,Symbol,Quantity,UnitPrice,Total,Currency,Comment
2024-05-05,ADJUSTMENT,AAPL,-50,,,,Share amount adjustment
```

## Value Formatting

### Date and Time

The `Date` column accepts any standard date format that [JavaScript's `Date`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date) constructor can parse. Common formats include:

- ISO 8601: `2024-01-15`, `2024-03-10T14:30:00`
- European format: `15.01.2024`, `10.03.2024 14:30`
- US format: `01/15/2024`, `3/10/2024 2:30 PM`

**Recommendation:** Use the [ISO 8601 format](https://en.wikipedia.org/wiki/ISO_8601) for consistency and to avoid ambiguity: date as `YYYY-MM-DD`, or date and time as `YYYY-MM-DDThh:mm:ss` (with the optional `±hh:mm` suffix for specifying time zone). Dates like `01/02/2024` can be interpreted as February 1st or January 2nd, depending on the locale.

**Note:** If you don't explicitly specify the time zone, the converter assumes that the date is in the local time zone of the machine running the conversion. This might lead to date shifts if your data is in a different time zone. To avoid this, either use ISO format with time zone or ensure that the machine's local time matches the time zone of your data.

### Quantities and Prices

- Use decimal notation (e.g., `150.25`, `3750.5`), don't use thousand separators (e.g., `1,000` and `1 000` should be written as `1000`)
- Most transaction types automatically convert to absolute values (signs are ignored)
- For `ADJUSTMENT` activities, sign matters: negative values indicate reductions

### Currency Codes

Use standard 3-letter [ISO 4217 currency code](https://en.wikipedia.org/wiki/ISO_4217). Common examples include:

- `EUR` - Euro
- `GBP` - British Pound
- `CAD` - Canadian Dollar
- `USD` - US Dollar

## Complete Example File

Here's a complete example CSV file demonstrating various transaction types:

```csv
Date,TransactionType,Symbol,Quantity,UnitPrice,Fee,Total,Currency,TransactionSubtype,FxRate,Comment
2024-01-15,BUY,AAPL,100,150.25,9.99,15034.99,EUR,,,Initial purchase
2024-02-20,SELL,MSFT,50,380.50,9.99,19015.01,EUR,,,Partial sale
2024-03-10,DIVIDEND,GOOGL,100,2.50,0,250.00,EUR,,,Quarterly dividend
2024-03-11,DIVIDEND,AAPL,50,1.25,0,62.50,EUR,DRIP,,Dividend reinvestment
2024-03-13,DIVIDEND,TSLA,75,0.90,0,67.50,EUR,QUALIFIED,,Qualified dividend
2024-04-10,INTEREST,,,,,12.50,EUR,,,Interest on cash
2024-04-11,INTEREST,ETH,0.003498,3400,,11.8932,EUR,STAKING_REWARD,,ETH staking
2024-03-20,DEPOSIT,,,,,5000.00,EUR,,,Cash deposit
2024-03-25,WITHDRAWAL,,,,,2000.00,EUR,,,Cash withdrawal
2024-04-01,TRANSFER_IN,AMZN,100,175.50,0,17550.00,EUR,,,From other broker
2024-04-05,TRANSFER_OUT,AMZN,50,175.50,0,8775.00,EUR,,,To other account
2024-04-15,FEE,,,,,25.00,EUR,,,Monthly account fee
2024-04-16,FEE,,,,,10.00,EUR,MANAGEMENT_FEE,,Management fee
2024-04-19,TAX,,,,,3.75,EUR,WITHHOLDING,,Dividend withholding
2024-04-25,SPLIT,NVDA,,,,0.5,,,,2:1 reverse split
2024-04-30,CREDIT,,,,,50.00,EUR,BONUS,,Sign-up bonus
2024-05-05,ADJUSTMENT,AAPL,-50,,,,,,,Share correction
```

## Tips and Best Practices

### 1. Start with a small sample<!-- omit from toc -->

Before converting your entire transaction history, create a small sample file with a few transactions to test the conversion process.

### 2. Verify required fields<!-- omit from toc -->

Ensure every row has values for:

- Date
- TransactionType
- Symbol (except for cash-only transactions)
- Quantity
- UnitPrice

### 3. Use comments<!-- omit from toc -->

The `Comment` field is useful for adding context to transactions that might be confusing later.

### 4. Use Total for cash transactions<!-- omit from toc -->

For transactions without securities (deposits, withdrawals, interest on cash), leave `Symbol`, `Quantity`, and `UnitPrice` empty, and use `Total` for the amount.

### 5. Specify currency<!-- omit from toc -->

If your CSV file doesn't include a `Currency` column, the converter will use EUR as the default currency. You can specify a different default currency using the `--default-currency` option:

```bash
npm start convert input.csv output.csv -- --default-currency GBP
```

This is useful when all your transactions are in the same currency and you don't want to add a `Currency` column to your CSV file.

### 6. Use FXRate for foreign currency transactions<!-- omit from toc -->

When dealing with foreign currency transactions:

- Set the `Currency` field to the foreign currency code
- Provide `FXRate` for the exchange rate
- Wealthfolio will handle currency conversion

### 7. Use Fee column for transaction fees<!-- omit from toc -->

Transaction fees can be specified in the `Fee` column. Don't include fees in the `Total` amount - Wealthfolio applies the fees separately. If `Total` is not provided, it will be calculated automatically as `Quantity` × `UnitPrice`.

### 8. Test your CSV<!-- omit from toc -->

Before importing:

1. Run the conversion: `npm start convert your-file.csv test-output.csv`
2. Review the output for any errors or warnings
3. Check that the converted data looks correct
4. Import the test output into Wealthfolio to verify

## Field Validation

The converter automatically validates all records based on transaction type-specific field requirements. This means:

- **Required fields** for each transaction type are checked (e.g., `Symbol` is required for `BUY` but not for `DEPOSIT`)
- **Ignored fields** are automatically cleared (e.g., `Symbol` is cleared for cash-only activities)
- **Invalid records** with missing required fields are filtered out and not included in the output
- **Warnings** are logged for any validation failures, including the record number and specific field errors

When a record fails validation, you'll see a warning message like:

```text
Skipping record 42 due to field errors:
  - unitPrice - Invalid value, value: NaN
```

This helps you identify and fix data issues in your source CSV file.

If you need more details for troubleshooting, increase log verbosity by setting its level to `DEBUG` or `TRACE`. See the [Log Verbosity](user-manual.md#log-verbosity) section in the [User Manual](user-manual.md) for instructions on how to set verbosity levels.

## Common Issues

### Missing Required Columns

**Error:** Validation fails with missing column error.

**Solution:** Ensure your CSV has all required columns: `Date`, `TransactionType`, `Symbol`, `Quantity`, and `UnitPrice`.

### Unknown Transaction Type

**Error:** `Unknown transaction type: XYZ`

**Solution:** Check the [Transaction Types](#transaction-types) section for supported values. Transaction type names are flexible but must match one of the documented options.

### Invalid Date Format

**Error:** Invalid date warnings or incorrect dates.

**Solution:** See the [Date and Time](#date-and-time) section with recommendations on how to avoid ambiguity.

### Symbol Required

Some transaction types require a symbol (ticker):

- `BUY`, `SELL`: Always required
- `DIVIDEND`, `TRANSFER_IN`, `TRANSFER_OUT`: Usually required
- `DEPOSIT`, `WITHDRAWAL`, `FEE`, `TAX`, `CREDIT`: Not required

## Getting Format Information

To see the complete schema for the Generic format:

```bash
npm start info Generic
```

This displays all expected columns and their requirements.

## See Also

- [Wealthfolio Documentation](https://wealthfolio.app/docs/introduction/) - For information about Wealthfolio import
- [src/formats/GenericFormat.ts](../src/formats/GenericFormat.ts) - Source code for the Generic format plugin
- [examples/sample-generic.csv](../examples/sample-generic.csv) - Sample file with various transaction types
- [Format Plugin Development Guide](format-plugin-development-guide.md) - A guide for creating custom format plugins
