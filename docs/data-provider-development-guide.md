<!--
Copyright (c) 2026 Oleksii Serdiuk
SPDX-License-Identifier: BSD-3-Clause
-->

# Data Provider Development Guide

To create a custom data provider for symbol resolution:

## 1. Create a new file in `src/data-providers/` directory

Example: `src/data-providers/MyCustomProvider.ts`

```typescript
/*!
 * Copyright (c) 2026 Oleksii Serdiuk, Your Name
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { DataProvider, SymbolQuery, SymbolResult } from "../core/DataProvider";

export class MyCustomProvider extends DataProvider {
  constructor() {
    super("MyCustomProvider", "Description of what this provider does");
  }

  /**
   * Resolve a symbol from a query
   *
   * @param query - Contains optional: symbol, isin, cusip, name
   * @returns Resolved symbol result or empty object if cannot resolve
   */
  query(query: SymbolQuery): SymbolResult {
    // Try different resolution strategies
    if (query.isin) {
      const symbol = this.lookupIsin(query.isin);
      if (symbol) {
        return { symbol };
      }
    }

    if (query.cusip) {
      const symbol = this.lookupCusip(query.cusip);
      if (symbol) {
        return { symbol };
      }
    }

    // Not found
    return {};
  }

  /**
   * Optional: Indicate which query types this provider handles
   * Returning false skips querying this provider
   */
  canHandle(query: SymbolQuery): boolean {
    return query.isin !== undefined || query.cusip !== undefined;
  }

  private lookupIsin(isin: string): string | undefined {
    // Your lookup logic here
    return undefined;
  }

  private lookupCusip(cusip: string): string | undefined {
    // Your lookup logic here
    return undefined;
  }
}
```

## 2. Register the provider

Add your provider to `src/data-providers/index.ts`:

```typescript
export {
  Overrides,
  OverridesByType,
  OverridesDataProvider,
  parseOverridesFile,
} from "./OverridesDataProvider";
export { MyCustomProvider } from "./MyCustomProvider";
```

Then import it in `src/core/Converter.ts`:

```typescript
import { MyCustomProvider, OverridesDataProvider, parseOverridesFile } from "../data-providers";
```

And register it inside the `convert()` method:

```typescript
  async convert(
    inputPath: string,
    outputPath: string,
    defaultCurrency: string,
    formatName?: string,
    overridesPath?: string,
  ): Promise<void> {
    // [...]
    if (overridesPath) {
      overrides = parseOverridesFile(overridesPath);
      symbolDataService.registerProvider(new OverridesDataProvider(overrides));
    }
    // Register your data provider after the overrides provider (or unconditionally)
    symbolDataService.registerProvider(new MyCustomProvider());
    // [...]
  }
```

Now, whenever a symbol query is made by the format plugin, your provider will be called in the order it was registered. If your provider returns an empty object (`{}`), the system will continue to the next provider until a match is found or all providers are exhausted.

## 3. Build and test

```bash
npm run build
npm run lint:check
npm run format:check
npm test
npm start convert <your-sample.csv> output.csv
```

## How It Works

### SymbolQuery

The input parameter your `query()` method receives contains optional security identifiers:

```typescript
interface SymbolQuery {
  symbol?: string; // Ticker symbol (e.g., "AAPL")
  isin?: string; // ISIN code (e.g., "US0378331005")
  cusip?: string; // CUSIP identifier (e.g., "037833100")
  name?: string; // Company name (e.g., "Apple Inc")
}
```

**Key points:**

- At least one field will be non-empty (an all-empty query is rejected before providers are called).
- All fields are optional - check which ones are available before using.
- `symbol`, `isin`, and `cusip` are always trimmed and uppercased before your method is called; `name` is always trimmed. Returned `symbol` and `isin` values are also trimmed and uppercased automatically. You do not need to normalize these fields yourself, but it's still a good practice to already return them in a normalized form.
- Company names may be partial or have variations (e.g., "Apple Inc", "Apple, Inc.").

**Common query patterns:**

- Direct symbol lookup (e.g., overrides, finding new ticker after rename): `{ symbol: "AAPL" }`.
- ISIN to symbol: `{ isin: "US0378331005" }`.
- CUSIP to symbol: `{ cusip: "037833100" }`.
- Company name to symbol: `{ name: "Apple Inc" }`.
- Multiple identifiers: `{ isin: "US0378331005", name: "Apple Inc" }`.

### Return Value

Return a `SymbolResult` object. Use `symbol` to provide a resolved ticker symbol and `isin` to carry a newly resolved ISIN code.

When your provider finds a match by symbol:

```typescript
return { symbol: "AAPL" };
```

When your provider resolves an ISIN but cannot determine a ticker symbol:

```typescript
return { isin: "US0378331005" };
```

When your provider resolves both symbol and ISIN:

```typescript
return { symbol: "AAPL", isin: "US0378331005" };
```

When your provider cannot resolve anything, return an empty object:

```typescript
return {};
```

**Important details:**

- Set `symbol` when you have resolved a ticker, `isin` when you have resolved an ISIN, or both when you have resolved both. At least one field must be set for the result to be considered a successful resolution.
- Only set a field when your provider has resolved a value that _differs_ from the corresponding query field. Do not echo `query.symbol` or `query.isin` back — it adds no information and the `SymbolDataService` will strip them anyway.
- Returning empty `SymbolResult` (`{}`) allows the system to try other registered providers or fall back to the original value.
- The `SymbolDataService` tracks which provider returned the result and caches it in memory — your `query()` method is called at most once per unique identifier combination per conversion run.

## Example

File-based Provider that loads symbol mappings from a JSON file specified by the `SYMBOL_DATA_FILE` environment variable:

```typescript
import fs from "fs";
import path from "path";

import { DataProvider, SymbolQuery, SymbolResult } from "../core/DataProvider";

export class JsonFileProvider extends DataProvider {
  private cache = new Map<string, string>();

  constructor() {
    const filePath = process.env.SYMBOL_DATA_FILE;
    if (!filePath) {
      throw new Error("SYMBOL_DATA_FILE environment variable is required");
    }

    super("JsonFile", `Loads symbols from ${path.basename(filePath)}`);
    const content = fs.readFileSync(path.resolve(filePath), "utf-8");
    const mappings: Array<{ isin?: string; cusip?: string; symbol: string }> = JSON.parse(content);

    // Populate cache
    for (const mapping of mappings) {
      if (mapping.isin) {
        this.cache.set(`ISIN:${mapping.isin.toUpperCase()}`, mapping.symbol);
      }
      if (mapping.cusip) {
        this.cache.set(`CUSIP:${mapping.cusip.toUpperCase()}`, mapping.symbol);
      }
    }
  }

  query(query: SymbolQuery): SymbolResult {
    if (query.isin) {
      const symbol = this.cache.get(`ISIN:${query.isin}`);
      if (symbol) {
        return { symbol };
      }
    }

    if (query.cusip) {
      const symbol = this.cache.get(`CUSIP:${query.cusip}`);
      if (symbol) {
        return { symbol };
      }
    }

    return {};
  }
}
```

## Best Practices

- **Return empty object on failure**: Don't throw errors, return empty `SymbolResult` (`{}`) if symbol cannot be resolved.
- **Do not echo query values back as resolution results**: Don't simply copy `query.symbol` or `query.isin` to their respective fields in the result without actual resolution. `SymbolDataService` strips any result field that is identical to the corresponding query field and treats a result with no remaining fields as "no resolution", then continues to the next provider. Only set a field when you have genuinely resolved or enriched it from a data source.
- **Cache data, not queries**: `SymbolDataService` automatically caches resolution results in memory for the duration of the run, so your `query()` method is called at most once per unique identifier combination. However, if your provider loads data from an external source (files, APIs, databases), cache that data internally (as in the `JsonFileProvider` example above) to avoid reloading it on every query call. Consider a persistent cache to retain data across runs for providers that make expensive external lookups.
- **Use `canHandle()`**: Implement `canHandle()` so that converter can skip your provider when it can't handle specific query types.
- **Add tests**: Create tests in `tests/data-providers/` to verify your provider.

## Code Quality

After creating your plugin, run the linting tools to ensure code quality:

```bash
npm run lint:check   # Check for linting issues
npm run lint:fix     # Auto-fix linting issues
npm run format:check # Check formatting
npm run format:fix   # Format code with Prettier
npm test             # Run tests
```

## See Also

- [Technical Information](technical-information.md) - Architecture overview.
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guidelines.
- [src/core/DataProvider.ts](../src/core/DataProvider.ts) - `DataProvider` source code.
- [src/data-providers/OverridesDataProvider.ts](../src/data-providers/OverridesDataProvider.ts) - An example of a data provider that loads symbol mappings and overrides from an INI file.
