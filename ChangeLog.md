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

### Added

- **Support for ISIN field** (was added to **Wealthfolio** in v3.2.0):
  - The converter now supports an `isin` field in the output CSV, which can be
    used to provide ISIN as an alternative or a supplement to a ticker symbol.
  - The Generic format plugin has been updated to copy the `ISIN` column from
    the input CSV into the `isin` column of the output CSV, in addition to using
    it for symbol resolution. If not present or empty, the `ISIN` column will be
    converted to an empty value in the output CSV.

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

- **Symbol normalization** - before querying providers or looking up the cache,
  the converter now normalizes query fields: symbol, ISIN, and CUSIP are trimmed
  and converted to uppercase; company name is only trimmed. As a result,
  identifier values that differ only in whitespace or casing (e.g.,
  `" us0378331005 "` and `"US0378331005"`) are treated the same and share a
  single cache entry.

- As a consequence of the symbol resolution caching and normalization, there are
  also changes to the way symbol resolution is logged:
  - When symbol is queried for the first time and resolution _succeeds_, it will
    be logged with the `INFO` level.
  - When symbol is queried for the first time and resolution _fails_, it will be
    logged with the `WARN` level.
  - All subsequent queries (cache hits) will be logged with the `TRACE` level to
    reduce noise in the logs.

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
  https://github.com/leppa/convert-to-wealthfolio/compare/0.2.0...HEAD
[0.2.0]: https://github.com/leppa/convert-to-wealthfolio/compare/0.1.0...0.2.0
[0.1.0]: https://github.com/leppa/convert-to-wealthfolio/commits/0.1.0
