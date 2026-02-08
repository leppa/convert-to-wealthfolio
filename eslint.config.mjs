/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import js from "@eslint/js";
import markdown from "@eslint/markdown";
import header from "@tony.ganchev/eslint-plugin-header";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";
import typescript from "typescript-eslint";

import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist/**", "node_modules/**", "**/*.d.ts"]),
  {
    files: ["**/*.js", "**/*.ts"],
    extends: [js.configs.recommended, typescript.configs.recommended],
    plugins: {
      "@tony.ganchev": header,
    },

    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2020,
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },

    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "array-bracket-spacing": ["error", "never"],
      curly: ["error", "all"],
      eqeqeq: ["error", "always"],
      "linebreak-style": ["error", "unix"],
      // TODO: Create logging facility and enforce its usage instead of `console`
      "no-console": "off",
      "no-trailing-spaces": "error",
      "object-curly-spacing": ["error", "always"],
      "prefer-const": "error",
      // `cause` not supported by ES2020
      "preserve-caught-error": "off",
      semi: ["error", "always"],

      "@tony.ganchev/header": [
        "error",
        {
          header: {
            commentType: "block",
            lines: [
              "!",
              {
                pattern: /^ \* Copyright \(c\) \d{4} Oleksii Serdiuk(, .+)*$/,
                template: ` * Copyright (c) ${new Date().getFullYear()} Oleksii Serdiuk`,
              },
              " * SPDX-License-Identifier: BSD-3-Clause",
              " ",
            ],
          },
        },
      ],

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      "comma-dangle": [
        "error",
        {
          arrays: "always-multiline",
          objects: "always-multiline",
          imports: "always-multiline",
          exports: "always-multiline",
          functions: "always-multiline",
        },
      ],

      indent: [
        "error",
        2,
        {
          SwitchCase: 1,
        },
      ],

      quotes: [
        "error",
        "double",
        {
          avoidEscape: true,
        },
      ],
    },
  },
  {
    files: ["**/*.test.ts", "**/*.spec.ts"],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      // Allow `any` in tests for flexibility, but warn to try to minimize its usage
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    files: ["**/*.md"],
    language: "markdown/commonmark",
    plugins: {
      markdown,
      "@tony.ganchev": header,
    },
    extends: [markdown.configs.recommended],
    rules: {
      "markdown/no-bare-urls": "error",

      "@tony.ganchev/header": [
        "error",
        {
          header: {
            commentType: "block",
            lines: [
              "",
              {
                pattern: /^Copyright \(c\) \d{4} Oleksii Serdiuk(, .+)*$/,
                template: `Copyright (c) ${new Date().getFullYear()} Oleksii Serdiuk`,
              },
              "SPDX-License-Identifier: BSD-3-Clause",
              "",
            ],
          },
        },
      ],
    },
  },
]);
