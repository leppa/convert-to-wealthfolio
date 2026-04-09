<!--
Copyright (c) 2026 Oleksii Serdiuk
SPDX-License-Identifier: BSD-3-Clause
-->

# Convert to Wealthfolio Roadmap

This document outlines features and improvements I plan to implement before I release version 1.0 of **Convert to Wealthfolio**. These are the features that I need myself, so I will most likely implement all of them. I will also prioritize these features over other requests.

## Planned Features

### Format Plugins

#### DEGIRO

A transaction history exported from the **DEGIRO** brokerage (_Inbox_ -> _Transactions_ -> _Export_ icon).

This format has a lot of quirks, like transactions being split across multiple rows and a need to extract transaction information from the description. There are also no symbols in the export, only ISINs. Creating manual mappings for all ISINs would be a pain, so I will need to implement a data provider for looking up symbols from some database or third-party API (see [Data Providers](#data-providers) below).

This format is also language-specific, so I will implement it for the **German** language. Will need samples in other languages to add support for them as well, so if you have **DEGIRO** transaction history in a language other than German and need support for it, feel free to reach out.

#### Interactive Brokers (IBKR)

A transaction history exported from the **Interactive Brokers** brokerage. Details TBD: didn't look into it yet.

### Data Providers

#### ISIN, CUSIP, Company Name Lookup

Ability to look up symbol from ISIN, CUSIP, company name, or other identifiers using a third-party API (e.g., OpenFIGI, Yahoo Finance). This will be useful for formats that don't include the symbol directly but have some other identifier that can be used to look it up.

[github.com/JerBouma/FinanceDatabase](https://github.com/JerBouma/FinanceDatabase) also looks interesting as it contains CSV files with mappings for tickers, ISINs, CUSIPs, company names, and other metadata for a large number of equities, ETFs, cryptos, etc. Being able to query locally stored data would be much faster and more reliable than making remote API requests, but users will have to download and keep the files up-to-date manually.

### Other Features

#### NPM Package

Ability to install the converter as an NPM package and use it as a command-line tool that is available globally. This will make it easier to integrate the converter into existing workflows or use it in custom scripts.

#### Docker Container

Ability to run the converter in a Docker container. This will make it easier to use for people who don't want to set up a Node.js environment on their machine.

## Don't See Your Feature?

If there's a feature that you need that is not on this roadmap, feel free to open a feature request (see [Requesting Features](CONTRIBUTING.md#requesting-features)). I can't promise that I will implement it, but I will consider all feature requests and may implement them if they are not too complex and don't require a lot of maintenance.

Contributions are also welcome if you want to implement a feature yourself. See [Contributing](CONTRIBUTING.md#contributing) for more information on how to contribute to the project.
