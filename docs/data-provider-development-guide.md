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

import { DataProvider, SymbolQuery } from "../core/DataProvider";

export class MyCustomProvider extends DataProvider {
  constructor() {
    super("MyCustomProvider", "Description of what this provider does");
  }

  /**
   * Resolve a symbol from a query
   *
   * @param query - Contains optional: symbol, isin, cusip, name
   * @returns Resolved symbol string if found, `null` otherwise
   */
  query(query: SymbolQuery): string | null {
    // Try different resolution strategies
    if (query.isin) {
      const symbol = this.lookupIsin(query.isin);
      if (symbol) {
        return symbol;
      }
    }

    if (query.cusip) {
      const symbol = this.lookupCusip(query.cusip);
      if (symbol) {
        return symbol;
      }
    }

    // Not found
    return null;
  }

  /**
   * Optional: Indicate which query types this provider handles
   * Returning false skips querying this provider
   */
  canHandle(query: SymbolQuery): boolean {
    return query.isin !== undefined || query.cusip !== undefined;
  }

  private lookupIsin(isin: string): string | null {
    // Your lookup logic here
    return null;
  }

  private lookupCusip(cusip: string): string | null {
    // Your lookup logic here
    return null;
  }
}
```

## 2. Register the provider

Add your provider to `src/data-providers/index.ts`:

```typescript
export { OverridesDataProvider, parseOverridesFile } from "./OverridesDataProvider";
export { MyCustomProvider } from "./MyCustomProvider";
```

Then import it in `src/core/Converter.ts`:

```typescript
import { OverridesDataProvider, parseOverridesFile } from "../data-providers/OverridesDataProvider";
import { MyCustomProvider } from "../data-providers/MyCustomProvider";
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
      this.symbolDataService.registerProvider(new OverridesDataProvider(overrides));
    }
    // Register your data provider after the overrides provider
    this.symbolDataService.registerProvider(new MyCustomProvider());
    // [...]
  }
```

Now, whenever a symbol query is made by the format plugin, your provider will be called in the order it was registered. If your provider returns `null`, the system will continue to the next provider until a match is found or all providers are exhausted.

## 3. Build and test

```bash
npm run build
npm run lint:fix
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

- At least one field will be present (never all empty)
- All fields are optional - check which ones are available before using
- Values may have whitespace and varying case - normalize them (uppercase, trim)
- Company names may be partial or have variations (e.g., "Apple Inc", "Apple, Inc.")

**Common query patterns:**

- Direct symbol lookup (e.g., overrides, finding new ticker after rename): `{ symbol: "AAPL" }`
- ISIN to symbol: `{ isin: "US0378331005" }`
- CUSIP to symbol: `{ cusip: "037833100" }`
- Company name to symbol: `{ name: "Apple Inc" }`
- Multiple identifiers: `{ isin: "US0378331005", name: "Apple Inc" }`

### Return Value

Return a resolved symbol string when your provider finds a match:

```typescript
return "AAPL";
```

Return `null`, _not_ an empty string, when your provider cannot resolve the symbol:

```typescript
return null;
```

**Important details:**

- Return a non-empty string when resolution succeeds (uppercase recommended)
- Returning `null` allows the system to try other registered providers or fall back to the original value
- The `SymbolDataService` tracks which provider returned the result

## Example

File-based Provider that loads symbol mappings from a JSON file specified by the `SYMBOL_DATA_FILE` environment variable:

```typescript
import fs from "fs";
import path from "path";

import { DataProvider, SymbolQuery } from "../core/DataProvider";

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

  query(query: SymbolQuery): string | null {
    if (query.isin) {
      const symbol = this.cache.get(`ISIN:${query.isin.toUpperCase()}`);
      if (symbol) {
        return symbol;
      }
    }

    if (query.cusip) {
      const symbol = this.cache.get(`CUSIP:${query.cusip.toUpperCase()}`);
      if (symbol) {
        return symbol;
      }
    }

    return null;
  }
}
```

## Best Practices

- **Normalize inputs**: Convert to uppercase and trim whitespace consistently
- **Return `null` on failure**: Don't throw errors, return `null` if symbol cannot be resolved
- **Cache results**: For external lookups, cache to improve the performance, consider persistent cache to retain data across runs
- **Use `canHandle()`**: Implement `canHandle()` so that converter can skip your provider when it can't handle specific query types
- **Add tests**: Create tests in `tests/data-providers/` to verify your provider

## Code Quality

After creating your plugin, run the linting tools to ensure code quality:

```bash
npm run lint        # Check for linting issues
npm run lint:fix    # Auto-fix issues
npm run format      # Format code with Prettier
npm test            # Run tests
```

## See Also

- [Technical Information](technical-information.md) - Architecture overview
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guidelines
- [src/core/DataProvider API](../src/core/DataProvider.ts) - `DataProvider` source code
- [src/data-providers/OverridesDataProvider.ts](../src/data-providers/OverridesDataProvider.ts) - An example of a data provider that loads symbol overrides from an INI file
