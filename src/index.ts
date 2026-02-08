#!/usr/bin/env node
/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Option, program } from "commander";
import { readFileSync } from "fs";
import { join } from "path";

import { Converter } from "./core/Converter";
import formats from "./formats";

// Get package version
const packageJson = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));

const converter = new Converter(formats);

program
  .name("convert-to-wealthfolio")
  .description("Convert various CSV formats for import to Wealthfolio")
  .version(packageJson.version, "-V, --version", "Show version number and exit")
  .helpOption("-h, --help", "Show this help message and exit")
  .helpCommand("help <command>", "Show help for a specific command");

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
  .action(async (input: string, output: string, options: { format?: string }) => {
    try {
      await converter.convert(input, output, options.format);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Conversion failed:", message);
      process.exit(1);
    }
    console.log("Successfully converted:", input);
  });

program
  .command("list")
  .description("List supported CSV formats in order of auto-detection")
  .action(() => {
    console.log("Registered formats (in order of auto-detection):");
    formats.forEach((format, index) => {
      console.log(`  ${index + 1}. ${format.getName()}`);
    });
  });

program
  .command("info")
  .argument("<format>", "Format name (use 'list' command to see available formats)")
  .description("Show information about a specific format")
  .action((formatName: string) => {
    const format = formats.find((f) => f.getName() === formatName);
    if (!format) {
      console.error(`Format '${formatName}' not found`);
      process.exit(1);
    }

    const schema = format.getExpectedSchema();
    console.log(`Format: ${format.getName()}`);
    console.log("Expected schema:");
    schema.forEach((col) => {
      const required = col.optional ? " [optional]" : "";
      const desc = col.description ? ` - ${col.description}` : "";
      console.log(`  ${col.name}${required}${desc}`);
    });
  });

program.parse(process.argv);
