/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import js from "@eslint/js";
import markdown from "@eslint/markdown";
import header from "@tony.ganchev/eslint-plugin-header";
import tsParser from "@typescript-eslint/parser";
import yaml from "eslint-plugin-yml";
import globals from "globals";
import typescript from "typescript-eslint";

import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist/**", "node_modules/**", "**/*.d.ts"]),
  {
    files: ["**/*.js", "**/*.mjs", "**/*.ts"],
    extends: [js.configs.recommended],
    plugins: {
      "@tony.ganchev": header,
    },

    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.commonjs,
      },
    },

    rules: {
      "array-bracket-spacing": ["error", "never"],
      curly: ["error", "all"],
      eqeqeq: ["error", "always"],
      "linebreak-style": ["error", "unix"],
      "no-console": "error",
      "no-trailing-spaces": "error",
      "object-curly-spacing": ["error", "always"],
      "prefer-const": "error",
      semi: ["error", "always"],

      "@tony.ganchev/header": [
        "error",
        {
          header: {
            commentType: "block",
            lines: [
              "!",
              {
                // Allow author names to be in any language and include extra characters like dots,
                // spaces, apostrophes, and hyphens. Other characters can be added as needed later.
                pattern: /^ \* Copyright \(c\) \d{4} Oleksii Serdiuk(, [\p{L}\p{M}. '-]+)*$/u,
                template: ` * Copyright (c) ${new Date().getFullYear()} Oleksii Serdiuk`,
              },
              " * SPDX-License-Identifier: BSD-3-Clause",
              " ",
            ],
          },
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
    files: ["**/*.ts"],
    extends: [typescript.configs.recommendedTypeChecked],

    languageOptions: {
      parser: tsParser,
      sourceType: "module",
      parserOptions: {
        projectService: true,
      },
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/prefer-readonly": "error",

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["**/*.test.ts", "**/*.spec.ts"],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: "./tsconfig.test.json",
      },
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      // Relax some rules for tests
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
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
                pattern: /^Copyright \(c\) \d{4} Oleksii Serdiuk(, [\p{L}\p{M}. '-]+)*$/u,
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
  {
    files: [".github/**/*.md"],
    language: "markdown/gfm",
  },
  {
    files: ["**/*.yaml", "**/*.yml"],
    plugins: {
      yml: yaml,
    },
    extends: [yaml.configs.recommended],
  },
  {
    // Relax some rules for GitHub workflow YAML files
    files: [".github/workflows/**/*.yml"],
    rules: {
      "yml/no-empty-mapping-value": "off",
    },
  },
]);
