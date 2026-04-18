<!--
Copyright (c) 2026 Oleksii Serdiuk
SPDX-License-Identifier: BSD-3-Clause
-->

# User Manual

## Table of Contents<!-- omit from toc -->

- [Installation](#installation)
  - [Prerequisites](#prerequisites)
  - [Install From npmjs.com](#install-from-npmjscom)
  - [Install From Source](#install-from-source)
- [Usage](#usage)
  - [Convert a CSV File](#convert-a-csv-file)
    - [Format Auto-detection (default)](#format-auto-detection-default)
    - [Specify the Format Manually](#specify-the-format-manually)
    - [Specify the Default Currency](#specify-the-default-currency)
    - [Override and Resolve Symbols and ISINs](#override-and-resolve-symbols-and-isins)
  - [List Supported Formats](#list-supported-formats)
  - [Get Format Information](#get-format-information)
  - [Get Help](#get-help)
  - [Global Options](#global-options)
    - [Set Log Verbosity](#set-log-verbosity)
    - [Control Colored Output](#control-colored-output)
- [Update](#update)
  - [Update From npmjs.com](#update-from-npmjscom)
  - [Update From Source](#update-from-source)
- [Uninstallation](#uninstallation)
  - [Uninstall When Installed Globally](#uninstall-when-installed-globally)
  - [Uninstall When Ran From Source](#uninstall-when-ran-from-source)

## Installation

### Prerequisites

- [**Node.js**](https://nodejs.org/) and **npm** must be installed on your system
- If you need to install or switch **Node.js** versions, you can use [nvm](https://github.com/nvm-sh/nvm)
- This project is tested on the currently officially supported **Node.js** versions (both _LTS_ and _Current_ branches)

### Install From npmjs.com

**Convert to Wealthfolio** is [published on npmjs.com](https://www.npmjs.com/package/@leppa/convert-to-wealthfolio). You can install it globally using `npm`:

```bash
npm install --global @leppa/convert-to-wealthfolio
```

This should make the `convert-to-wealthfolio` command available in your terminal.

### Install From Source

You can also install the converter from source by cloning the repository, installing the dependencies, and building the project:

```bash
git clone https://github.com/leppa/convert-to-wealthfolio.git
cd convert-to-wealthfolio
git checkout main # latest stable code
npm install
npm run build
```

**Note:** If you want to install a specific version, checkout the corresponding tag instead of the `main` branch (e.g., `git checkout 0.1.0`). If you want to install the latest development version, checkout the `dev` branch (skipping `git checkout` will default to `dev`).

After building, you can install the package globally:

```bash
npm install --global .
```

Or you can run the converter directly from the directory by using `npm start`:

```bash
npm start -- --help
```

**Note:** You **must** put `--` before the options when using `npm start` to pass them to the converter instead of `npm`. All options before `--` will be consumed by the `npm` itself.

You can also run the converter directly with `node`:

```bash
node dist/index.js --help
```

**Note:** `npm start` automatically builds the project before running, so you don't need to build it first. However, if you prefer to use `node dist/index.js` directly, don't forget to build the project first by running `npm run build`. You'll also need to rebuild the project whenever you pull updates or make changes to the source code.

## Usage

After installing globally using either npmjs.com or from source, the converter should become available in your terminal. You can verify the installation by running:

```bash
convert-to-wealthfolio help
```

This command should display the help information about the CLI, its commands, and options. You can also get help for specific commands or options. See [Get Help](#get-help) section below for details.

**Note:** The instructions below assume that you installed the converter globally. If you're running from source without installing globally, remember to use `npm start` or `node dist/index.js` instead of `convert-to-wealthfolio` in the commands below.

### Convert a CSV File

Use the `convert` command and provide the input and output file paths to convert a CSV file:

```bash
convert-to-wealthfolio [global-options] convert [convert-options] <input.csv> <output.csv>
```

**Note:** You can download the example CSV and INI files from the GitHub repository: <https://github.com/leppa/convert-to-wealthfolio/tree/main/examples>.

#### Format Auto-detection (default)

By default, the converter tries to automatically detect the format based on the input file structure.

Convert a generic CSV file:

```bash
convert-to-wealthfolio convert examples/sample-generic.csv output.csv
```

Convert a generic CSV with ISINs, CUSIPs, and company names:

```bash
convert-to-wealthfolio convert examples/sample-generic-isin-cusip-name.csv output.csv
```

When both no ticker symbol and no ISIN are present, the converter tries to synthesize a symbol from the following data (in the priority order): CUSIP → sanitized company name → empty symbol. When only ISIN is present, it will be copied to the `isin` column and the `symbol` column will be left empty. To get a proper symbol when it is missing, see [Override and Resolve Symbols and ISINs](#override-and-resolve-symbols-and-isins) section for information on how to resolve identifiers into symbols by using an INI file.

#### Specify the Format Manually

You can skip auto-detection by specifying the format explicitly with the `--format` option:

```bash
convert-to-wealthfolio convert --format <FormatName> <input.csv> <output.csv>
```

E.g., specify format as _Generic_:

```bash
convert-to-wealthfolio convert --format Generic examples/sample-generic.csv output.csv
```

You can also set the format using the `CTW_FORMAT` environment variable:

```bash
CTW_FORMAT=Generic convert-to-wealthfolio convert examples/sample-generic.csv output.csv
```

**Note:** The CLI option takes precedence over the environment variable if both are set.

#### Specify the Default Currency

You can specify a default currency code to use when the input CSV doesn't specify a currency for a record by using the `--default-currency` option:

```bash
convert-to-wealthfolio convert --default-currency <ISO-4217-currency-code> <input.csv> <output.csv>
```

The currency should be a 3-letter [ISO 4217 currency code](https://en.wikipedia.org/wiki/ISO_4217). The default is EUR.

E.g., use British Pound as default currency:

```bash
convert-to-wealthfolio convert --default-currency GBP examples/sample-generic.csv output.csv
```

You can also set the default currency using the `CTW_DEFAULT_CURRENCY` environment variable:

```bash
CTW_DEFAULT_CURRENCY=GBP convert-to-wealthfolio convert examples/sample-generic.csv output.csv
```

**Note:** The CLI option takes precedence over the environment variable if both are set.

**Note:** Some formats may ignore the default currency option and always use their own. Always refer to the documentation of the specific format you're using.

#### Override and Resolve Symbols and ISINs

You can override symbols and ISINs; resolve symbols from ISINs, CUSIPs, and company names; resolve ISINs from symbols, CUSIPs, and company names. To do this, pass an INI file to the `--overrides` option:

```bash
convert-to-wealthfolio convert --overrides <overrides.ini> <input.csv> <output.csv>
```

E.g., convert a generic CSV file with overrides:

```bash
convert-to-wealthfolio convert --overrides examples/overrides.ini examples/sample-generic-isin-cusip-name.csv output.csv
```

You will get resolved identifiers, as long as they're present in the override file.

The overrides file format:

```ini
# Override ISIN
[ISIN.ISIN]
US38259P5089 = US02079K3059

# Map symbol to ISIN
[ISIN.Symbol]
AAPL = US0378331005

# Map CUSIP to ISIN
[ISIN.CUSIP]
38259P508 = US38259P5089

# Map company name to ISIN
[ISIN.Name]
Alphabet Inc. = US02079K3059

# Override symbol
[Symbol.Symbol]
FB = META

# Map ISIN to symbol
[Symbol.ISIN]
US02079K3059 = GOOGL

# Map CUSIP to symbol
[Symbol.CUSIP]
594918104 = MSFT

# Map company name to symbol
[Symbol.Name]
Volkswagen AG Preferred = VOW3.DE
```

ISIN lookups are performed before symbol lookups, which means that symbol lookups are performed with an already resolved ISIN.

This option is useful for:

- Correcting ticker symbol and ISIN changes after mergers or rebranding.
- Fixing incorrect identifiers in the source data.
- Standardizing symbol naming across different data sources.
- Mapping ISIN, CUSIP, or company name to a symbol when the original symbol is missing in the source data.
- Mapping symbol, CUSIP, or company name to an ISIN to complement a symbol.

See [examples/overrides.ini](../examples/overrides.ini) for a template.

**Note**: ISIN, CUSIP, and company name lookups are handled by plugins during conversion. Symbol and ISIN overrides, on the other hand, are done automatically _after_ the conversion. E.g., if you have an ISIN that resolves to a symbol, and that symbol is in the overrides, the override will be applied to the resolved symbol.

**Note**: Symbol resolution results are cached in memory for the duration of the conversion. If the same combination of symbol, ISIN, CUSIP, and company name appears multiple times in the input CSV, the identifier is resolved only once and the result is reused for all matching rows. Cache hits are logged at the `TRACE` level; use `--trace` to see them.

You can also set the path to the overrides file using the `CTW_OVERRIDES` environment variable:

```bash
CTW_OVERRIDES="examples/overrides.ini" convert-to-wealthfolio convert examples/sample-generic-isin-cusip-name.csv output.csv
```

**Note:** The CLI option takes precedence over the environment variable if both are set.

### List Supported Formats

Use the `list` command to see all available formats that can be passed to the `--format` option:

```bash
convert-to-wealthfolio list
```

### Get Format Information

Use the `info` command together with a specific format name to see information about that format:

```bash
convert-to-wealthfolio info <FormatName>
```

E.g., get information about the "Generic" format:

```bash
convert-to-wealthfolio info Generic
```

### Get Help

Use the `help` command to see general help information about the CLI:

```bash
convert-to-wealthfolio help
```

You will also get this information when you run the CLI without any command.

Prepend `help` to any command to see help information about that command:

```bash
convert-to-wealthfolio help <command>
```

E.g., see help for the `convert` command:

```bash
convert-to-wealthfolio help convert
```

Alternatively, you can use `--help` option to get the same information:

```bash
# Get general help:
convert-to-wealthfolio --help
# Get help for the `convert` command:
convert-to-wealthfolio convert --help
```

### Global Options

#### Set Log Verbosity

The CLI supports configurable log verbosity levels by using the `--log-level` option:

```bash
convert-to-wealthfolio --log-level <LEVEL> <command-and-arguments>
```

The supported levels are, in increasing order of verbosity: `ERROR`, `WARN`, `INFO`, `DEBUG`, and `TRACE`. The default one is `INFO`.

E.g., set log verbosity to the warning level:

```bash
convert-to-wealthfolio --log-level WARN convert examples/sample-generic.csv output.csv
```

There are also two shorthand options: `--debug` and `--trace`. They will set the log verbosity to `DEBUG` and `TRACE`, respectively.

```bash
# Set log verbosity to DEBUG:
convert-to-wealthfolio --debug <command-and-arguments>
# Set log verbosity to TRACE:
convert-to-wealthfolio --trace <command-and-arguments>
```

You can also set the log verbosity using the `CTW_LOG_LEVEL` environment variable, which accepts the same values as `--log-level`.

E.g., set log verbosity using an environment variable:

```bash
CTW_LOG_LEVEL=DEBUG convert-to-wealthfolio convert examples/sample-generic.csv output.csv
```

**Note:** The CLI option takes precedence over the environment variable if both are set.

**Note:** Log messages go to `stderr` to separate them from user-facing output, which goes to `stdout`. This allows you to redirect logs and output independently if needed.

E.g., you can redirect logs to a file while keeping user-facing output in the console:

```bash
convert-to-wealthfolio convert examples/sample-generic.csv output.csv -- --log-level DEBUG 2> converter.log
```

#### Control Colored Output

By default, the converter outputs colorized text when run in an interactive shell and it supports color output. You can explicitly disable or force colored output using the `--no-color` and `--color` options:

Disable colored output:

```bash
convert-to-wealthfolio --no-color <command-and-arguments>
```

Force colored output (e.g., when piping output):

```bash
convert-to-wealthfolio --color <command-and-arguments>
```

You can also control colored output using environment variables:

- `NO_COLOR` - Set to any non-empty value to disable colored output (equivalent to `--no-color`). This follows the [no-color.org](https://no-color.org) convention.
- `FORCE_COLOR` - Set to any non-empty value to force colored output (equivalent to `--color`). This may be useful when color support was not detected automatically.

E.g., disable color using an environment variable:

```bash
NO_COLOR=1 convert-to-wealthfolio convert examples/sample-generic.csv output.csv
```

**Note:** The `NO_COLOR` environment variable takes precedence over _all_ other color options, as per the convention. The `--no-color` CLI option takes precedence over both the `FORCE_COLOR` environment variable and the `--color` CLI option. The `FORCE_COLOR` environment variable only takes precedence over the `--color` CLI option.

## Update

### Update From npmjs.com

If you installed the converter from npmjs.com, you can update it to the latest version the same way you installed it:

```bash
npm install --global @leppa/convert-to-wealthfolio
```

### Update From Source

If you installed the converter from source, you can update it by pulling the latest changes from the repository.

If you checked out a specific branch, simply pull the latest changes for that branch:

```bash
git pull
```

If you checked out a specific tag, you'll need to check out the new tag of the latest version:

```bash
git fetch --tags
git checkout <new-version>
```

After pulling the latest changes, you need to rebuild and reinstall the converter:

```bash
npm run build
npm install --global .
```

If you didn't install it globally, you don't need to run the `npm install` step.

## Uninstallation

### Uninstall When Installed Globally

Whether you installed the converter from npmjs.com or from source, you can uninstall it using `npm`:

```bash
npm uninstall --global @leppa/convert-to-wealthfolio
```

### Uninstall When Ran From Source

If you ran the converter directly from the source directory without installing it globally, you can simply delete the cloned repository from your system to "uninstall" it. There are no additional steps required since it doesn't store any files outside the source directory.
