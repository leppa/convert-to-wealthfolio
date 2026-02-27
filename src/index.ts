#!/usr/bin/env node
/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { bold, dim, red } from "colorette";
import { InvalidArgumentError, Option, program } from "commander";
import { readFileSync } from "fs";
import { join } from "path";

import { Converter } from "./core/Converter";
import { Logger } from "./core/Logger";
import formats from "./formats";

const DEFAULT_CURRENCY = "EUR";

// Get package version
const packageJson = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));

const converter = new Converter(formats);

const logger = Logger.getInstance();

program.configureOutput({
  writeErr: (str) => logger.message(str),
  outputError: (str, write) => {
    write(`Invalid arguments: ${red(str)}`);
  },
});

program
  .name("convert-to-wealthfolio")
  .description("Convert various CSV formats for import to Wealthfolio")
  .version(packageJson.version, "-V, --version", "Show version number and exit")
  .helpOption("-h, --help", "Show this help message and exit")
  .helpCommand("help <command>", "Show help for a specific command")
  .addOption(
    new Option("-l, --log-level <level>", "Set log verbosity level")
      // The lowest log level is ERROR, as ERROR and FATAL messages should always be shown
      .choices(["ERROR", "WARN", "INFO", "DEBUG", "TRACE"])
      .default("INFO"),
  )
  .addOption(
    new Option("-v, --debug", "Set log verbosity to DEBUG, overrides --log-level")
      .implies({ logLevel: "DEBUG" })
      .conflicts("trace"),
  )
  .addOption(
    new Option("--trace", "Set log verbosity to TRACE, overrides --log-level")
      .implies({ logLevel: "TRACE" })
      .conflicts("debug"),
  );

program
  .command("convert")
  .argument("<input>", "Input CSV file path")
  .argument("<output>", "Output CSV file path")
  .description("Convert input CSV for import to Wealthfolio")
  .addOption(
    new Option(
      "-f, --format <format>",
      "Format to use for conversion (skip autodetection)",
    ).choices(formats.map((f) => f.getName())),
  )
  .addOption(
    new Option(
      "-c, --default-currency <currency>",
      "3-letter ISO 4217 currency code to use when input CSV doesn't specify one",
    )
      .argParser((currency) => {
        if (!currency.match(/^[A-Za-z]{3}$/)) {
          throw new InvalidArgumentError(
            `Invalid currency: ${currency}. Use a 3-letter ISO 4217 currency code.`,
          );
        }
        return currency.toUpperCase();
      })
      .default(DEFAULT_CURRENCY),
  )
  .action(
    async (
      input: string,
      output: string,
      options: { format?: string; defaultCurrency: string },
    ) => {
      configureLogger();

      logger.info(`Using default currency: ${bold(options.defaultCurrency)}`);
      try {
        await converter.convert(input, output, options.defaultCurrency, options.format);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.message(`Conversion failed: ${red(message)}`);
        process.exit(1);
      }
      logger.message(`Successfully converted: ${bold(input)}`);
    },
  );

program
  .command("list")
  .description("List supported CSV formats in order of auto-detection")
  .action(() => {
    configureLogger();

    logger.message("Supported formats (in order of auto-detection):");
    formats.forEach((format, index) => {
      logger.message(`  ${index + 1}. ${bold(format.getName())}`);
    });
  });

program
  .command("info")
  .argument("<format>", "Format name (use 'list' command to see available formats)")
  .description("Show information about a specific format")
  .action((formatName: string) => {
    configureLogger();

    const format = formats.find((f) => f.getName() === formatName);
    if (!format) {
      logger.message(red(`Format '${bold(formatName)}' not found`));
      process.exit(1);
    }

    const schema = format.getExpectedSchema();
    logger.message(`Format: ${bold(format.getName())}`);
    logger.message("Expected schema:");
    schema.forEach((col) => {
      const required = col.optional ? ` ${dim("[optional]")}` : "";
      const desc = col.description ? ` - ${col.description}` : "";
      logger.message(`  ${bold(col.name)}${required}${desc}`);
    });
  });

/**
 * Configure the logger with the specified log level
 */
function configureLogger() {
  try {
    const logLevel = Logger.parseLogLevel(program.opts().logLevel);
    Logger.setLogLevel(logLevel);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Error setting the log level: ${message}`);
  }
}

program.parse(process.argv);
