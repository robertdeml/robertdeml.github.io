#!/usr/bin/env node
// bump-version — Increment the PATCH number in src/version.ts.
//
// Usage:
//   node scripts/bump-version.mjs
//
// The file must contain a line matching:
//   export const VERSION = "MAJOR.MINOR.PATCH";

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const versionFile = join(__dirname, "..", "src", "version.ts");

const content = readFileSync(versionFile, "utf-8");
const match = content.match(/export const VERSION = "(\d+)\.(\d+)\.(\d+)";/);

if (!match) {
  console.error(`Could not parse version line in ${versionFile}`);
  process.exit(1);
}

const [, major, minor, patch] = match;
const newVer = `${major}.${minor}.${Number(patch) + 1}`;

const newContent = content.replace(
  /export const VERSION = "\d+\.\d+\.\d+";/,
  `export const VERSION = "${newVer}";`,
);

writeFileSync(versionFile, newContent, "utf-8");
console.log(newVer);
