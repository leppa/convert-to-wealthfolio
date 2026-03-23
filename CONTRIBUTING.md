<!--
Copyright (c) 2026 Oleksii Serdiuk
SPDX-License-Identifier: BSD-3-Clause
-->

# Contributing to Convert to Wealthfolio

Thank you for your interest in contributing to the Convert to Wealthfolio project! I welcome contributions of all kinds, including bug reports, feature requests, documentation improvements, and code contributions. This document provides guidelines and instructions for contributing to the project.

## Reporting Issues

If you encounter any bugs or issues, please open an issue and use either the _Bug Report_ or the _Format-Specific Bug Report_ template. When reporting an issue, please provide as much detail as possible, including:

- A clear and descriptive title
- A detailed description of the problem or suggestion
- Steps to reproduce the issue (if applicable)
- Expected and actual behavior
- Any relevant screenshots or error messages
- Your environment details (OS, Node.js version, etc.)
- The version of the converter you are using
- Any relevant CSV files or data samples (if applicable)
- Any additional context that may help in diagnosing the issue

## Requesting Features

Please note that while I welcome feature requests, I may not be able to implement all of them due to time constraints or other priorities. However, I encourage the community to contribute code for new features if they are interested in seeing them implemented.

### Requesting a New Format Plugin

If you would like to see support for a new CSV format, please open an issue and use the _New Format Plugin Request_ template. In your request, please provide as much detail as possible about the format, including:

- The name of the format and the software it comes from
- A sample CSV file (or a link to one) that represents the format and includes all possible transaction types and variations
- A description of the format's structure and any unique characteristics
- Any documentation or resources about the format that may be helpful

If you are able to contribute code for the new format, please see the [Format Plugin Development Guide](docs/format-plugin-development-guide.md) for instructions on how to create and integrate a new format plugin.

### Requesting a New Feature

If you have an idea for a new feature or enhancement, please open an issue and use the _Feature Request_ template. Provide a clear description of the feature, its benefits, and any potential use cases. If possible, include examples to illustrate your idea.

## Contributing

Please note that all contributions must adhere to the project's [Code of Conduct](CODE_OF_CONDUCT.md) and [licensing terms](LICENSE). By contributing, you agree that your contributions will be licensed under the **BSD 3-Clause License**.

### Branch Policy

The repository uses two long-lived branches:

- `main` contains the latest release and may also include unreleased bug fixes that are intended for it.
- `dev` is the mainline branch for ongoing development.

Unless your pull request is a bug fix, target the `dev` branch.

Bug fixes for the latest release should target the `main` branch. Only the latest release is officially supported and will accept bug fix pull requests.

### Contributing Code

If you would like to contribute code, please follow these steps:

1. Fork the repository and create a new branch for your feature or bug fix.
2. Make your changes in the new branch, ensuring that your code follows the project's coding style and conventions. Also, see [LLM Assistance Policy](#llm-assistance-policy) for guidelines on using large language models to assist with contributions.
3. Comment your code where necessary, but avoid overcommenting (i.e., don't comment self-explanatory code). Do provide comments for complex logic, important details, or anything that may not be immediately clear to other developers.
4. Write [JSDoc](https://jsdoc.app/) documentation for any new functions, classes, or methods you add to the codebase.
5. Write documentation for any new features or changes you make, including updates to the README, ChangeLog, and other relevant documentation files. See [Contributing Documentation](#contributing-documentation) section for guidelines.
6. Write tests for your changes to ensure they work correctly and do not break existing functionality. Strive for 100% test coverage for any new code you add.
7. Run all existing tests to make sure they pass.
8. Commit your changes with a clear and descriptive commit message.
9. Push your changes to your forked repository.
10. Open a pull request against the main repository, describing your changes and the problem they solve. Target the appropriate branch, see [Branch Policy](#branch-policy).
11. Be responsive to feedback and make any necessary revisions to your pull request.

Once your pull request is approved and merged, your contribution will be part of the project!

**Note:** Before you start working on a contribution, it might be a good idea to open a feature request and mention that you are working on it. This can help avoid duplicate efforts and allows for early feedback on your proposed changes.

#### Introducing New Dependencies

If your contribution requires introducing new dependencies, please ensure that they are well-maintained, have a permissive license compatible with the BSD 3-Clause License, and do not have excessive transitive dependencies. If you're choosing between several options, that are otherwise similar, prefer the one with fewer dependencies to keep the project lightweight and maintainable.

### Contributing Documentation

Documentation contributions are also welcome! If you find any errors, omissions, or areas for improvement in the documentation, please feel free to submit a pull request with your suggested changes.

When contributing documentation, please ensure that it is well-organized, easy to understand, and follows the project's formatting guidelines. Use examples and clear explanations to help users grasp complex concepts or features. Try to be concise in your writing.

Use [CommonMark](https://commonmark.org/) formatting for all documentation.

### LLM Assistance Policy

I encourage contributors to use any tools at their disposal, including large language models, to assist with writing code, documentation, or other contributions. In fact, I use LLMs myself to help with various aspects of the project and accelerate the development. However, I ask that contributors ensure that all contributions are their own work and that they understand and can explain any code they submit. If you use an LLM to generate code or documentation, please review and test it thoroughly before submitting it as a contribution. I reserve the right to refuse contributions that I believe were generated by an LLM without sufficient human review or understanding, as I want to maintain the quality and integrity of the project.

In short:

- I **encourage** the use of LLM Assistance to _assist_ and _accelerate_ the development process.
- I **discourage** blindly submitting LLM-generated content _without review or understanding_ (so-called "Vibe Coding").

## Final Notes

If you have any questions about contributing, please don't hesitate to ask by opening an issue or reaching out to me directly. I appreciate your interest in contributing to the **Convert to Wealthfolio** project and look forward to seeing your contributions!
