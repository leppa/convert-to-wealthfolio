/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

const jestConfig = require("./jest.config");

module.exports = {
  ...jestConfig,
  reporters: [
    "summary",
    [
      "github-actions",
      {
        silent: false,
      },
    ],
    [
      "jest-junit",
      {
        classNameTemplate: "{filepath}",
        outputDirectory: "test-results",
        outputName: "junit.xml",
      },
    ],
  ],
  coverageReporters: ["lcov", "text-summary"],
};
