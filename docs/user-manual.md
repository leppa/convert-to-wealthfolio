<!--
Copyright (c) 2026 Oleksii Serdiuk
SPDX-License-Identifier: BSD-3-Clause
-->

# User Manual

## Table of Contents<!-- omit from toc -->

- [Installation](#installation)
  - [Prerequisites](#prerequisites)
  - [Install From Source](#install-from-source)
  - [Build the Project](#build-the-project)
- [Usage](#usage)
  - [Convert a CSV File](#convert-a-csv-file)
    - [Format Auto-detection (default)](#format-auto-detection-default)
    - [Specify the Format Manually](#specify-the-format-manually)
    - [Specify the Default Currency](#specify-the-default-currency)
    - [Override Symbols and Resolve Identifiers](#override-symbols-and-resolve-identifiers)
  - [List Supported Formats](#list-supported-formats)
  - [Get Format Information](#get-format-information)
  - [Get Help](#get-help)
  - [Global Options](#global-options)
    - [Log Verbosity](#log-verbosity)

## Installation

### Prerequisites

- [**Node.js**](https://nodejs.org/) and **npm** must be installed on your system
- If you need to install or switch **Node.js** versions, you can use [nvm](https://github.com/nvm-sh/nvm)
- This project is tested on the currently officially supported **Node.js** versions (both _LTS_ and _Current_ branches)

### Install From Source

Checkout the repository and install the dependencies:

```bash
git clone https://github.com/leppa/convert-to-wealthfolio.git
cd convert-to-wealthfolio
npm install
```

### Build the Project

If you haven't already built the project, run:

```bash
npm run build
```

**Note:** `npm start` will automatically build the project before executing any command, so you can skip this step if you use `npm start`.

## Usage

### Convert a CSV File

Use the `convert` command and provide the input and output file paths to convert a CSV file.

Using npm scripts (recommended):

```bash
npm start convert <input.csv> <output.csv> -- [options]
```

Or directly with node:

```bash
node dist/index.js convert <input.csv> <output.csv> [options]
```

#### Format Auto-detection (default)

By default, the converter tries to automatically detect the format based on the input file structure.

Convert a generic CSV file:

```bash
npm start convert examples/sample-generic.csv output.csv
```

Convert a generic CSV with ISINs, CUSIPs, and company names:

```bash
npm start convert examples/sample-generic-isin-cusip-name.csv output.csv
```

You will get ISIN, CUSIP, or sanitized company name as a symbol. See [Override Symbols and Resolve Identifiers](#override-symbols-and-resolve-identifiers) section for information on how to resolve identifiers into symbols by using an INI file.

#### Specify the Format Manually

You can skip auto-detection by specifying a format explicitly with the `--format` option:

```bash
npm start convert <input.csv> <output.csv> -- --format <FormatName>
```

E.g., specify format as _Generic_:

```bash
npm start convert examples/sample-generic.csv output.csv -- --format Generic
```

#### Specify the Default Currency

You can specify a default currency code to use when the input CSV doesn't specify a currency for a record by using the `--default-currency` option:

```bash
npm start convert <input.csv> <output.csv> -- --default-currency <ISO-4217-currency-code>
```

The currency should be a 3-letter [ISO 4217 currency code](https://en.wikipedia.org/wiki/ISO_4217). The default is EUR.

E.g., use British Pound as default currency:

```bash
npm start convert examples/sample-generic.csv output.csv -- --default-currency GBP
```

**Note:** Some formats may ignore the default currency option and always use their own. Always refer to the documentation for the specific format you're using.

#### Override Symbols and Resolve Identifiers

You can override symbols and resolve ISINs, CUSIPs, and company names by passing an INI file to the `--overrides` option:

```bash
npm start convert <input.csv> <output.csv> -- --overrides <overrides.ini>
```

E.g., convert a generic CSV file with overrides:

```bash
npm start convert examples/sample-generic-isin-cusip-name.csv output.csv -- --overrides examples/overrides.ini
```

You will get resolved identifiers, as long as they're present in the override file.

The overrides file format:

```ini
[Symbol]
FB = META

[ISIN]
US0378331005 = AAPL

[CUSIP]
594918104 = MSFT

[Name]
Volkswagen AG Preferred = VOW3.DE
```

This option is useful for:

- Correcting ticker symbol changes after mergers or rebranding
- Fixing incorrect identifiers in the source data
- Standardizing symbol naming across different data sources
- Mapping ISIN, CUSIP, or company name to a symbol when the original symbol is missing in the source data

See [examples/overrides.ini](../examples/overrides.ini) for a template.

**Note**: ISIN, CUSIP, and company name lookups are handled by plugins during conversion. Symbol overrides, on the other hand, are done automatically _after_ the conversion. So if you have an ISIN that resolves to a symbol, and that symbol is in the overrides, the override will be applied to the resolved symbol.

### List Supported Formats

Use the `list` command to see all available formats that can be passed to the `--format` option:

```bash
npm start list
```

### Get Format Information

Use the `info` command together with a specific format name to see information about that format:

```bash
npm start info <FormatName>
```

E.g., get information about the "Generic" format:

```bash
npm start info Generic
```

### Get Help

Use the `help` command to see general help information about the CLI:

```bash
npm start help
```

You will also get this information when you run the CLI without any command.

Prepend `help` to any command to see help information about that command:

```bash
npm start help <command>
```

E.g., see help for the `convert` command:

```bash
npm start help convert
```

Alternatively, you can use `--help` option to get the same information:

```bash
# Get general help:
npm start -- --help
# Get help for the `convert` command:
npm start convert -- --help
```

### Global Options

#### Log Verbosity

The CLI supports configurable log verbosity levels by using the `--log-level` option:

```bash
npm start <command-and-arguments> -- --log-level <LEVEL>
```

The supported levels are, in increasing order of verbosity: `ERROR`, `WARN`, `INFO`, `DEBUG`, and `TRACE`. The default one is `INFO`.

E.g., set log verbosity to the warning level:

```bash
npm start convert examples/sample-generic.csv output.csv -- --log-level WARN
```

There are also two shorthand options: `--debug` and `--trace`. They will set the log verbosity to `DEBUG` and `TRACE`, respectively.

```bash
# Set log verbosity to DEBUG:
npm start <command-and-arguments> -- --debug
# Set log verbosity to TRACE:
npm start <command-and-arguments> -- --trace
```

**Note:** Log messages go to `stderr` to separate them from user-facing output, which goes to `stdout`. This allows you to redirect logs and output independently if needed.

E.g., you can redirect logs to a file while keeping user-facing output in the console:

```bash
npm start convert examples/sample-generic.csv output.csv -- --log-level DEBUG 2> converter.log
```
