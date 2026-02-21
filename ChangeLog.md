<!--
Copyright (c) 2026 Oleksii Serdiuk
SPDX-License-Identifier: BSD-3-Clause
-->

# Convert to Wealthfolio Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Initial release.

### Added

- Core functionality for the converter:
  - Command-line interface (CLI) for conversion and format information.
  - Plugin system for adding custom format converters.
  - Field validation and error handling to ensure data integrity during
    conversion.
- Generic format plugin with flexible column arrangement and activity names.
  Mainly as an example, because Wealthfolio's import system is very flexible and
  can handle many formats without needing a custom converter.
- Project documentation and user guides.

[Unreleased]: https://github.com/leppa/convert-to-wealthfolio/commits/main/
