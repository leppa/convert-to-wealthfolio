<!--
Copyright (c) 2026 Oleksii Serdiuk
SPDX-License-Identifier: BSD-3-Clause
-->

# Convert to Wealthfolio Changelog

All notable changes to this project will be documented in this file.

This changelog is tailored to end users and, as such, contains only user-facing
changes. For more technical details and internal changes, please refer to the
commit history linked in the version header.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Upcoming release.

## [0.3.0] - 2026-05-01

This release adds support for the new ISIN field that was added to
**Wealthfolio** in v3.2.0, as well as support for ISIN overrides and mapping in
the overrides INI file. It also brings input and output data validation
improvements, including validation of ISINs, CUSIPs, and currency codes.
Additionally, it introduces symbol resolution caching to improve performance
when processing large CSV files with many transactions. Finally, it adds
environment variables to control their respective CLI options for easier
configuration.

The release also includes a fix for the Generic format plugin to no longer abort
on unknown activity types, allowing the rest of transactions to be processed.

**BREAKING**: The format of the overrides INI file has been changed and is not
compatible with the previous format. This change was made to allow providing
ISIN and symbol overrides and mapping in a consistent way. Please refer to the
**Changed** section below for more details on how to update your existing
overrides file.

### Added

- **Support for ISIN field** (was added to **Wealthfolio** in v3.2.0):
  - The converter now supports an `isin` field in the output CSV, which can be
    used to provide ISIN as an alternative or a supplement to a ticker symbol.
  - The Generic format plugin has been updated to copy the `ISIN` column from
    the input CSV into the `isin` column of the output CSV, in addition to using
    it for symbol resolution. If not present or empty, the `ISIN` column will be
    converted to an empty value in the output CSV.
  - Symbol resolution providers can now also resolve ISINs and return them as
    part of the symbol resolution result. ISIN can be returned together with the
    symbol or on its own if the symbol cannot be resolved.

- **ISIN overrides and mapping** - the overrides INI file can now also contain
  ISIN overrides and mapping sections, which allow you to override ISIN values
  and map symbols, CUSIPs, and company names to ISINs. This allows you to
  provide a custom ISIN for a transaction that has an incorrect or missing ISIN
  in the input CSV. The following sections were added:
  - `[ISIN.ISIN]` - contains ISIN overrides;
  - `[ISIN.Symbol]` - maps symbols to ISINs;
  - `[ISIN.CUSIP]` - maps CUSIPs to ISINs;
  - `[ISIN.Name]` - maps company names to ISINs.

  ISIN lookups are performed before symbol lookups, which means that symbol
  lookups are performed with an already resolved ISIN.

  **Note:** The names of the symbol mapping sections were also renamed to be
  consistent with ISIN section naming, see the breaking change in the
  **Changed** section below for more details.

- **Symbol resolution caching** - once a symbol is resolved, it will be cached
  in-memory for the duration of the converter's execution. This means that if
  the same symbol appears multiple times in the input CSV, it will only be
  resolved once, and all subsequent occurrences will use the cached value. The
  cache is based on the combination of symbol, ISIN, CUSIP, and company name
  (after normalization - see below), which means that if one transaction
  contains only ISIN and another transaction contains a combination of ISIN and
  CUSIP, the resolution will be performed separately for each of them.

- **Environment variables** to control their respective CLI options:
  - `CTW_LOG_LEVEL` - Sets the log level (equivalent to `--log-level`).
  - `CTW_FORMAT` - Sets the format plugin name (equivalent to `--format`).
  - `CTW_DEFAULT_CURRENCY` - Sets the default currency (equivalent to
    `--default-currency`).
  - `CTW_OVERRIDES` - Sets the path to the overrides file (equivalent to
    `--overrides`).

  CLI options take precedence over environment variables when both are set.

### Changed

- **BREAKING**: **Overrides INI file format** - The flat top-level sections
  (`[Symbol]`, `[ISIN]`, `[CUSIP]`, `[Name]`) are no longer supported. They are
  replaced by nested sections that explicitly declare both the output type and
  the key type:

  | Old section | New section       | Meaning                       |
  | ----------- | ----------------- | ----------------------------- |
  | `[Symbol]`  | `[Symbol.Symbol]` | Contains symbol overrides     |
  | `[ISIN]`    | `[Symbol.ISIN]`   | Maps ISINs to symbols         |
  | `[CUSIP]`   | `[Symbol.CUSIP]`  | Maps CUSIPs to symbols        |
  | `[Name]`    | `[Symbol.Name]`   | Maps company names to symbols |

  One mnemonic way to remember the new section name meaning is that `.` means
  _from_ (e.g., `[ISIN.CUSIP]` means "**ISIN** _from_ **CUSIP**").

  To update your existing overrides file, you can simply rename the sections as
  shown in the table above. The content of the sections remains the same, so you
  don't need to change the key-value pairs.

- **Fallback symbol resolution** - The fallback for symbol resolution will no
  longer copy ISIN value from the query into the symbol field when symbol cannot
  be resolved. Instead, it will return the ISIN and leave the symbol unset. The
  output CSV will then contain the ISIN value in the `isin` column and an empty
  value in the `symbol` column.

- **Symbol normalization** - before querying providers or looking up the cache,
  the converter now normalizes query fields: symbol, ISIN, and CUSIP are trimmed
  and converted to uppercase; company name is only trimmed. As a result,
  identifier values that differ only in whitespace or casing (e.g.,
  `" us0378331005 "` and `"US0378331005"`) are treated the same and share a
  single cache entry.

- **Symbol resolution logging** - As a consequence of the symbol resolution
  caching and normalization, the symbol resolution logging has also changed:
  - When symbol is queried for the first time and resolution _succeeds_, it will
    be logged with the `INFO` level.
  - When symbol is queried for the first time and resolution _fails_, it will be
    logged with the `WARN` level.
  - All subsequent queries (cache hits) will be logged with the `TRACE` level to
    reduce noise in the logs.

- **Data validation** - The input and output data validation logic has been
  refactored and improved to be more consistent. It will now also validate
  non-empty fields that can be validated (e.g., currency, ISIN):
  - Currency codes provided to the `--default-currency` CLI option are now
    validated against the [ISO 4217][] standard. If an invalid currency code is
    provided, the converter will abort with an error message.
  - ISINs from the symbol resolution results are now validated including
    calculation of the check digit. If a provider returns an invalid ISIN, it
    will be treated as not resolved with a warning logged.
  - ISIN _values_ (right side of `=`) in the overrides file are now validated as
    well. If an invalid ISIN value is provided, it will be ignored with a
    warning. ISIN _keys_ (left side of `=`) are not validated to allow fixing
    invalid ISINs in the input data.
  - Output field validation now also validates optional fields. If an optional
    field is invalid, it will be cleared with a warning.
  - The Generic format plugin now validates ISINs and CUSIPs in the input CSV.
    Invalid values are logged with a warning but are still used. If an invalid
    ISIN is not corrected using overrides or symbol resolution, it will fail
    output field validation and cause the respective transaction to be skipped
    from the output CSV.
  - The Generic format plugin now also validates currency codes in the input CSV
    against the [ISO 4217][] standard. If an invalid currency code is
    encountered, a warning will be logged and it will be replaced with the
    default currency.

  As a consequence, some validation log messages have also changed.

### Fixed

- **The Generic format plugin no longer aborts on unknown activity types** -
  Previously, if the Generic format plugin encountered an unknown activity type
  in the input CSV, it would throw an error which would abort the whole
  conversion process. Now, it will log a warning and skip the transaction,
  allowing the rest of the transactions to be processed.

[ISO 4217]: https://www.iso.org/iso-4217-currency-codes.html

## [0.2.0] - 2026-04-09

This release adds support for transaction history exported from the
[**Lime Trading** brokerage](https://lime.co/). It also adds support for the new
`instrumentType` field in the output CSV and a new optional `InstrumentType`
column in the **Generic** format plugin. Additionally, it introduces the ability
to explicitly disable or force colored output via CLI options or environment
variables.

### Added

- **Lime.co** format plugin - supports CSV files exported from the
  [**Lime Trading** brokerage](https://lime.co/).
- Support for the new `instrumentType` field that was added to **Wealthfolio**
  in March 2026.
- New optional `InstrumentType` column in the **Generic** format plugin. If not
  present or empty, it will be converted to an empty value in the output CSV.
- Ability to explicitly disable or force colored output via CLI options
  (`--no-color` and `--color`) or environment variables (`NO_COLOR` and
  `FORCE_COLOR`).

### Fixed

- Add `subtype` field as optional for dividend and interest transaction types.
  Previously the requirement was not set, which defaulted to ignoring the field
  and caused the converter to clear it for these activities.

## [0.1.0] - 2026-03-26

Initial release.

### Added

- Core functionality for the converter:
  - Command-line interface (CLI) for conversion and format information.
  - Plugin system for adding custom format converters.
  - Plugin system for symbol resolution using ISINs, CUSIPs, and company names.
  - Field validation and error handling to ensure data integrity during
    conversion.
  - Logging system with colorized output and possibility to set log verbosity
    via CLI.
- Ability to specify the default currency to use when it's not present in the
  input CSV.
- Ability to override symbols using an INI file.
- Ability to map ISINs, CUSIPs, and company names to symbols using an INI file.
- Generic format plugin with flexible column arrangement and activity names.
  Mainly as an example, because Wealthfolio's import system is very flexible and
  should be able to handle same formats without the need for a custom converter.
- Project documentation and user guides.

[Unreleased]:
  https://github.com/leppa/convert-to-wealthfolio/compare/0.3.0...HEAD
[0.3.0]: https://github.com/leppa/convert-to-wealthfolio/compare/0.2.0...0.3.0
[0.2.0]: https://github.com/leppa/convert-to-wealthfolio/compare/0.1.0...0.2.0
[0.1.0]: https://github.com/leppa/convert-to-wealthfolio/commits/0.1.0
