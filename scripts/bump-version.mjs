#!/usr/bin/env node
// bump-version — Increment version in src/version.ts.
//
// Usage:
//   node scripts/bump-version.mjs        (patch bump, default)
//   node scripts/bump-version.mjs patch
//   node scripts/bump-version.mjs minor
//   node scripts/bump-version.mjs major
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

let [, major, minor, patch] = match.map(Number);
const level = (process.argv[2] || "patch").toLowerCase();

switch (level) {
  case "major":
    major++;
    minor = 0;
    patch = 0;
    break;
  case "minor":
    minor++;
    patch = 0;
    break;
  default:
    patch++;
    break;
}

const newVer = `${major}.${minor}.${patch}`;

const newContent = content.replace(
  /export const VERSION = "\d+\.\d+\.\d+";/,
  `export const VERSION = "${newVer}";`,
);

writeFileSync(versionFile, newContent, "utf-8");
console.log(newVer);
