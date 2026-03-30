<!--
Copyright (c) 2026 Oleksii Serdiuk
SPDX-License-Identifier: BSD-3-Clause
-->

## Description

<!-- Provide a clear and detailed description of the changes in this pull request -->

## Related Issue

<!-- Link to the related issue (e.g., Fixes #123, Closes #456, Related to #789) -->

## Type of Change

<!-- Mark the relevant option with an "x". You may mark multiple options if applicable. -->

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] New format plugin (adds support for a new CSV format)
- [ ] New data provider (adds support for a new data source for looking up symbols, etc.)
- [ ] Improvement or enhancement to existing functionality (non-breaking change)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Code refactoring (no functional changes)
- [ ] Test improvements
- [ ] Chore (project maintenance, build configuration, etc.)
- [ ] Other (please describe):

## Checklist

<!-- Mark completed items with an "x". Not all items may be applicable to your change. -->

- [ ] I have read the [Code of Conduct](https://github.com/leppa/convert-to-wealthfolio/blob/dev/CODE_OF_CONDUCT.md) and agree to abide by it
- [ ] I agree that my contributions will be licensed under the **BSD 3-Clause License**
- [ ] My code follows the project's [coding style and conventions](https://github.com/leppa/convert-to-wealthfolio/blob/dev/CONTRIBUTING.md#contributing)
- [ ] I have added [JSDoc](https://jsdoc.app/) documentation for any new functions, classes, or methods
- [ ] I have updated relevant documentation (README, ChangeLog, docs/, etc.)
- [ ] I have written tests for my changes
- [ ] All new code has adequate test coverage
- [ ] All existing tests pass locally
- [ ] My commits have clear and descriptive commit messages
- [ ] My commits are atomic, i.e. complete and self-contained units of change (else, meld the commits before submitting the PR)

## New Feature

<!-- If this PR adds a new feature or format plugin, complete this section. Else, remove it completely. -->

- [ ] I agree that I will maintain this feature and fix any bugs that may arise in the future
  - [ ] I updated the CODEOWNERS file to include myself as a maintainer for this feature
- [ ] I won't be able to maintain this feature and agree that it may be removed in the future if it becomes unmaintained or causes issues

## New Format Plugin

<!-- If this PR adds a new format plugin, complete this section and the section above. Else, remove it completely. -->

- [ ] I have followed the [Format Plugin Development Guide](https://github.com/leppa/convert-to-wealthfolio/blob/dev/docs/format-plugin-development-guide.md)
- [ ] I have added a format user guide to the `docs/` directory
  - [ ] I have documented the format's structure and known quirks in the user guide
- [ ] I have added a sample CSV file to the `examples/` directory
  - [ ] The file contains all transaction types and variations supported by the format
- [ ] I have tested all transaction types supported by the format

## New Data Provider

<!-- If this PR adds a new data provider, complete this section and New Features section above. Else, remove it completely. -->

- [ ] I have followed the [Data Provider Development Guide](https://github.com/leppa/convert-to-wealthfolio/blob/dev/docs/data-provider-development-guide.md)
- [ ] I have added documentation for the data provider to the `docs/` directory
  - [ ] I have documented how the data provider works and how to use it in the user guide
- [ ] I have tested the data provider with all relevant formats and edge cases

## Additional Notes

<!-- Any additional information or context about this pull request -->

---

By submitting this pull request, I confirm that I have read and understood the [contribution guidelines](https://github.com/leppa/convert-to-wealthfolio/blob/dev/CONTRIBUTING.md) and that my contributions are my own work.
