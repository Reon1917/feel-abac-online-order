import { promises as fs } from "node:fs";
import { join, relative } from "node:path";

const LOCALES = ["en", "my"];
const BASE_DIR = join(process.cwd(), "dictionaries");
const PRIMARY_LOCALE = LOCALES[0];
const SECONDARY_LOCALE = LOCALES[1];

async function readJson(path) {
  const file = await fs.readFile(path, "utf8");
  return JSON.parse(file);
}

function collectKeys(value, prefix = "") {
  if (value === null || typeof value !== "object") {
    return [prefix];
  }

  if (Array.isArray(value)) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, nested]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    return collectKeys(nested, nextPrefix);
  });
}

async function getLocaleFiles(locale) {
  const localeDir = join(BASE_DIR, locale);
  const entries = await fs.readdir(localeDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => join(localeDir, entry.name));
}

async function main() {
  const primaryFiles = await getLocaleFiles(PRIMARY_LOCALE);
  const secondaryFiles = await getLocaleFiles(SECONDARY_LOCALE);

  const secondarySet = new Set(
    secondaryFiles.map((file) =>
      relative(join(BASE_DIR, SECONDARY_LOCALE), file)
    )
  );

  const missingFiles = [];
  const missingKeys = [];

  for (const primaryFile of primaryFiles) {
    const relativeName = relative(join(BASE_DIR, PRIMARY_LOCALE), primaryFile);
    const secondaryFile = join(BASE_DIR, SECONDARY_LOCALE, relativeName);

    if (!secondarySet.has(relativeName)) {
      missingFiles.push(relativeName);
      continue;
    }

    const [primaryJson, secondaryJson] = await Promise.all([
      readJson(primaryFile),
      readJson(secondaryFile),
    ]);

    const primaryKeys = collectKeys(primaryJson);
    const secondaryKeys = new Set(collectKeys(secondaryJson));

    const missing = primaryKeys.filter((key) => !secondaryKeys.has(key));
    if (missing.length > 0) {
      missingKeys.push({ file: relativeName, keys: missing });
    }
  }

  if (missingFiles.length === 0 && missingKeys.length === 0) {
    console.log(
      "✅ Burmese translations are up to date with English dictionaries."
    );
    return;
  }

  if (missingFiles.length > 0) {
    console.error("❌ Missing Burmese dictionary files:");
    for (const file of missingFiles) {
      console.error(`  - ${file}`);
    }
  }

  if (missingKeys.length > 0) {
    console.error("❌ Burmese dictionaries are missing keys:");
    for (const entry of missingKeys) {
      console.error(`  - ${entry.file}`);
      for (const key of entry.keys) {
        console.error(`      • ${key}`);
      }
    }
  }

  process.exitCode = 1;
}

main().catch((error) => {
  console.error("Failed to validate dictionaries:", error);
  process.exitCode = 1;
});

