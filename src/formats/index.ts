/*!
 * Copyright (c) 2026 Oleksii Serdiuk
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * Format plugins registry
 *
 * Imports and creates all available format converters, then exports them as a single array.
 */

import { BaseFormat } from "../core/BaseFormat";
import { GenericFormat } from "./GenericFormat";
import { LimeCoFormat } from "./LimeCoFormat";

const formats: BaseFormat[] = [
  new LimeCoFormat(),
  new GenericFormat(), // Keep this last - it's the most generic and may match other formats
];

export default formats;
