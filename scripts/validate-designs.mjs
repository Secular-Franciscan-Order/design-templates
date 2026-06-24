import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const manifestPath = join(root, "src/data/reviews.json");
const publicRoot = join(root, "public");
const designsRoot = join(publicRoot, "designs");
const thumbsRoot = join(publicRoot, "thumbs");
const failures = [];

const assertExists = async (path, label) => {
  try {
    await access(path);
  } catch {
    failures.push(`${label} is missing: ${path}`);
  }
};

const readJson = async (path) => {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    failures.push(`${path} is not valid JSON: ${error.message}`);
    return null;
  }
};

const listHtmlFiles = async (directory) => {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) {
        files.push(...(await listHtmlFiles(path)));
      } else if (entry.isFile() && entry.name.endsWith(".html")) {
        files.push(path);
      }
    }

    return files;
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
};

await assertExists(join(publicRoot, "_headers"), "Cloudflare Pages headers");

const manifest = await readJson(manifestPath);

if (manifest && !Array.isArray(manifest.reviews)) {
  failures.push(`${manifestPath}: expected a top-level reviews array.`);
}

for (const review of manifest?.reviews ?? []) {
  if (!Array.isArray(review.designs)) {
    failures.push(`Review ${review.slug ?? "(missing slug)"} has no designs array.`);
    continue;
  }

  for (const design of review.designs) {
    const name = `${review.slug}/${design.slug}`;

    if (design.thumb) {
      await assertExists(join(thumbsRoot, design.thumb), `${name} thumbnail`);
    }

    for (const device of ["desktop", "mobile"]) {
      const file = design[device]?.src;

      if (!file) {
        failures.push(`${name} is missing ${device}.src in reviews.json.`);
        continue;
      }

      await assertExists(join(publicRoot, file.replace(/^\//, "")), `${name} ${device} page`);
    }
  }
}

for (const file of await listHtmlFiles(designsRoot)) {
  const html = await readFile(file, "utf8");

  for (const pattern of ["support.js", "<x-dc", "design_doc_mode", "data-drags-parent", "data-screen-label"]) {
    if (html.includes(pattern)) {
      failures.push(`${file}: leftover design-runtime marker "${pattern}".`);
    }
  }

  if (html.includes('href="#"')) {
    failures.push(`${file}: leftover dead anchor href="#".`);
  }

  if (/left:\s*1(?:3[89]|4[0-2])0px/.test(html)) {
    failures.push(`${file}: mobile artboard still appears parked off-screen.`);
  }

  if (!html.includes('name="robots"') || !html.includes("noindex")) {
    failures.push(`${file}: missing noindex robots meta tag.`);
  }
}

if (failures.length > 0) {
  console.error("Design validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Design validation passed.");
