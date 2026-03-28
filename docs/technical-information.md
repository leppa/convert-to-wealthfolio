<!--
Copyright (c) 2026 Oleksii Serdiuk
SPDX-License-Identifier: BSD-3-Clause
-->

# Technical Information

This document provides technical details about the architecture, design, and implementation of the **Convert to Wealthfolio** project. It is intended for developers who want to understand the inner workings of the codebase or contribute to the project.

## Project Structure

```text
├── .github/                          # GitHub-specific files (workflows, issue templates, etc.)
├── coverage/                         # Test coverage reports (generated)
├── dist/                             # Compiled JavaScript (generated)
├── docs/                             # Documentation and guides
├── examples/                         # Sample files and documentation
├── src/                              # Source code
│   ├── index.ts                      # CLI entry point
│   ├── core/                         # Core framework
│   │   data-providers/               # Symbol resolution providers
│   └── formats/                      # Format plugin implementations
├── tests/                            # Jest unit and integration tests (mirrors src/ structure)
├── ChangeLog.md                      # Version release and change history
├── CODE_OF_CONDUCT.md                # Code of conduct for contributors
├── CONTRIBUTING.md                   # Contribution guidelines
├── LICENSE                           # BSD 3-Clause License
├── NOTICE.md                         # OSS Notices for third-party runtime dependencies
├── README.md                         # Project README
└── ROADMAP.md                        # Roadmap and future plans
```

## Architecture

### Core Components

**BaseFormat** (`src/core/BaseFormat.ts`)

- Abstract base class for all format converters
- Defines interface: `validate()`, `convert()`, `getExpectedSchema()`, etc.
- Includes `WealthfolioRecord` interface, `InstrumentType` enum, `ActivityType` enum, and `ActivitySubtype` enum for type-safe output
- Supports custom CSV parsing options per format

**Converter** (`src/core/Converter.ts`)

- Main orchestrator class
- Handles CSV parsing and writing
- Detects input format using registered plugins
- Manages format plugin registration
- Validates and filters records before writing output

**Field Requirements** (`src/core/FieldRequirements.ts`)

- Validates records against activity type-specific field requirements
- Automatically clears ignored fields based on activity type
- Filters out invalid records with detailed error reporting

**Logger** (`src/core/Logger.ts`)

- Centralized logging with colorized output and configurable verbosity levels
- Supports `FATAL`, `ERROR`, `WARN`, `INFO`, `DEBUG`, and `TRACE` log levels
- Logs go to `stderr`, while user-facing messages go to `stdout`
- Log verbosity is configurable via CLI options: `--log-level`, `--debug`, and `--trace` (`ERROR` is the lowest possible verbosity, `TRACE` is the highest)

**SymbolDataService** (`src/core/SymbolDataService.ts`)

- Orchestrates symbol resolution across registered data providers
- Queries providers in registration order and returns the first match
- Falls back to the original identifier when no provider can resolve a symbol
- Exposes registered provider info for diagnostics and logging

**DataProvider** (`src/core/DataProvider.ts`)

- Abstract base class for symbol data provider plugins
- Defines `query()` and optional `canHandle()` for lookup filtering
- Includes `SymbolQuery` and `DataProviderInfo` interfaces

### Format Plugins

Format plugins extend `BaseFormat` and implement:

- `validate(records)` - Detects if input matches this format
- `convert(records, defaultCurrency, symbolDataService)` - Converts records to **Wealthfolio** format
- `getExpectedSchema()` - Returns expected input columns with optional flags and descriptions
- `getParseOptions()` (optional) - Provides custom CSV parsing options (e.g., delimiter, casting column values to specific types)
- `getValidationLineCount()` (optional) - Specifies how many rows to parse for format detection

The format name is configured through the base class constructor (`super("YourFormatName")`) and exposed through `getName()` inherited from `BaseFormat`.

### Data Providers

Data providers extend `DataProvider` and implement:

- `query(query)` - Resolves symbol identifiers to a ticker or returns `null`
- `canHandle(query)` (optional) - Returns `true` if the provider can handle the query, `false` otherwise

The provider name is configured through the base class constructor (`super("YourProviderName", ...)`) and exposed through `getName()` inherited from `DataProvider`.

Providers are registered in `SymbolDataService` and queried in order until a match is found. If no provider resolves the symbol, the service falls back to the original identifier.

## Output Format

All converters produce CSV with these columns:

- **date** - Transaction date (ISO format)
- **instrumentType** - Asset category (see [Instrument Types](#instrument-types) below)
- **symbol** - Asset symbol/ticker
- **quantity** - Number of shares/units
- **activityType** - Transaction type (see [Activity Types](#activity-types) below)
- **unitPrice** - Price per unit
- **currency** - Currency code (e.g., EUR, GBP, USD)
- **fee** - Transaction fee
- **amount** - Total transaction amount
- **fxRate** - Currency exchange rate to base currency (if applicable)
- **subtype** - Activity subtype (see [Activity Subtypes](#activity-subtypes) below)
- **comment** - Additional notes or transaction details
- **metadata** - Optional structured metadata serialized as JSON (see the [Activity Types Reference](https://github.com/afadil/wealthfolio/blob/main/docs/activities/activity-types.md) from **Wealthfolio** documentation)

### Instrument Types

Supported instrument types:

- **EQUITY** - Stocks, ETFs, and funds
- **CRYPTO** - Cryptocurrencies
- **FX** - Currency and forex instruments
- **OPTION** - Options contracts
- **METAL** - Precious metals and commodity spot instruments
- **BOND** - Fixed-income instruments

**Note:** Leave the value empty for unknown or unspecified instrument types, as **Wealthfolio** will attempt to infer the type based on the symbol and other available data.

### Activity Types

Supported activity types:

- **BUY** - Purchase of an asset
- **SELL** - Sale of an asset
- **DIVIDEND** - Dividend payment
- **INTEREST** - Interest earned
- **DEPOSIT** - Cash deposit
- **WITHDRAWAL** - Cash withdrawal
- **TRANSFER_IN** - Asset or cash transfer in
- **TRANSFER_OUT** - Asset or cash transfer out
- **FEE** - Account or transaction fee
- **TAX** - Tax withholding or payment
- **SPLIT** - Stock split or reverse split
- **CREDIT** - Credit or bonus (cash only)
- **ADJUSTMENT** - Share or cash adjustment

**Note:** The information above was taken from the **Wealthfolio** documentation and may be subject to change as v3.x is still in beta. Always refer to the latest **Wealthfolio** documentation for the most up-to-date information on supported activity types and subtypes.

### Activity Subtypes

Some activity types can have optional subtypes for more detailed categorization. See the **Wealthfolio** documentation for the latest list of supported subtypes.

## Creating a New Format Plugin

See the [Format Plugin Development Guide](format-plugin-development-guide.md) for detailed instructions.

## Testing

Run unit tests with Jest:

```bash
npm test              # Run all tests once
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Generate coverage report
```

Tests are located in `tests/` and include:

- Format plugin validation and conversion tests
- Converter integration tests
- Utility function tests

Coverage reports are generated in the `coverage/` directory.

## Code Style and Conventions

- Use TypeScript with strict type checking
- Follow standard JavaScript / TypeScript coding conventions
- Use ESLint and Prettier for code linting and formatting
- Include JSDoc comments for all public methods and classes

After implementing and testing your changes, make sure to run linting and formatting checks:

```bash
npm run lint:check # or: npm run lint
npm run format:check
```

You can also automatically fix linting and formatting issues with:

```bash
npm run lint:fix
npm run format:fix # or: npm run format
```

## Dependencies

### Runtime Dependencies

These dependencies are required for the converter to run:

- **[Colorette](https://github.com/jorgebucaran/colorette)**: Colorized console output
- **[Commander.js](https://github.com/tj/commander.js)**: CLI argument parsing
- **[NodeCSV](https://csv.js.org/)** (**csv-parse** & **csv-stringify**): CSV operations
- **[ini](https://github.com/npm/ini)**: INI file parsing

I try to keep runtime dependencies lean, with no or minimal transitive dependencies, to ensure that the converter remains lightweight and easy to maintain.

### Dev Dependencies

These dependencies are only required for building, development, and testing:

- **[TypeScript](https://www.typescriptlang.org/)**: Type-safe development
- **[Jest](https://jestjs.io/)**: Testing framework
- **[ESLint](https://eslint.org/)**: Code linting
  - **[eslint-plugin-header](https://github.com/tonyganchev/eslint-plugin-header)**: Enforce license header in source files
  - **[prettier-plugin-organize-imports](https://github.com/simonhaenisch/prettier-plugin-organize-imports)**: Automatically organize imports in a consistent order
  - **[eslint-plugin-yml](https://ota-meshi.github.io/eslint-plugin-yml/)**: Lint YAML files
- **[Prettier](https://prettier.io/)**: Code formatting
