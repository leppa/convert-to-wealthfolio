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

- **Lime.co** format plugin. Supports CSV files exported from
  [Lime.co broker](https://lime.co/).
- Support for the new `instrumentType` field that was added to **Wealthfolio**
  in March 2026.
- New optional `InstrumentType` column in the Generic format plugin. If not
  present or empty, it will be converted to an empty value in the output CSV.

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
  https://github.com/leppa/convert-to-wealthfolio/compare/0.1.0...dev
[0.1.0]: https://github.com/leppa/convert-to-wealthfolio/commits/0.1.0
