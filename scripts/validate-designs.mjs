import { access, readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const manifestPath = join(root, "src/data/templates.json");
const publicRoot = join(root, "public");
const designsRoot = join(publicRoot, "designs");
const thumbsRoot = join(publicRoot, "thumbs");
const failures = [];
const sourceContractText = [
  "About the Franciscans",
  "About joining",
  "What's expected of me",
  "What if I'm just curious and not ready to commit?",
  "Do I have to wear a habit?"
];
const placeholderText = [
  "demo-map-link-panel",
  "shared table / open hands",
  "shared table / open hands visual",
  "Summer 2025 cover"
];

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

const isExternalReference = (value) =>
  /^(?:[a-z]+:)?\/\//i.test(value) ||
  /^(?:data|mailto|tel|javascript):/i.test(value) ||
  value.startsWith("#");

const cleanAssetReference = (value) => value.split("#")[0].split("?")[0];

const assertLocalReferencesExist = async (file, html) => {
  const references = new Set();
  const patterns = [
    /\b(?:src|href)=["']([^"']+)["']/g,
    /url\(["']?([^"')]+)["']?\)/g
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const value = cleanAssetReference(match[1]);

      if (!value || isExternalReference(value)) {
        continue;
      }

      references.add(value);
    }
  }

  for (const reference of references) {
    const path = reference.startsWith("/")
      ? join(publicRoot, reference.replace(/^\//, ""))
      : join(dirname(file), reference);

    await assertExists(path, `${file} local asset ${reference}`);
  }
};

await assertExists(join(publicRoot, "_headers"), "Cloudflare Pages headers");

const manifest = await readJson(manifestPath);

if (manifest && !Array.isArray(manifest.templates)) {
  failures.push(`${manifestPath}: expected a top-level templates array.`);
}

for (const template of manifest?.templates ?? []) {
  const name = template.slug ?? "(missing slug)";

  if (!template.src) {
    failures.push(`${name} is missing src in templates.json.`);
    continue;
  }

  if (template.thumb) {
    await assertExists(join(thumbsRoot, template.thumb), `${name} thumbnail`);
  }

  await assertExists(join(publicRoot, template.src.replace(/^\//, "")), `${name} page`);
}

for (const file of await listHtmlFiles(designsRoot)) {
  const html = await readFile(file, "utf8");
  const normalizedFile = file.replaceAll("\\", "/");
  const isDirectionTemplate = /\/direction-[abc]\/index\.html$/.test(normalizedFile);
  const isCurrentSiteTemplate = /\/current-site\/index\.html$/.test(normalizedFile);

  await assertLocalReferencesExist(file, html);

  for (const pattern of ["support.js", "<x-dc", "design_doc_mode", "data-drags-parent", "data-screen-label"]) {
    if (html.includes(pattern)) {
      failures.push(`${file}: leftover design-runtime marker "${pattern}".`);
    }
  }

  for (const text of placeholderText) {
    if (html.includes(text)) {
      failures.push(`${file}: leftover placeholder text or component "${text}".`);
    }
  }

  if (html.includes('href="#"')) {
    failures.push(`${file}: leftover dead anchor href="#".`);
  }

  if (/left:\s*1(?:3[89]|4[0-2])0px/.test(html)) {
    failures.push(`${file}: mobile artboard still appears parked off-screen.`);
  }

  if (/width=(?:"|')(?:1320|1280|390)(?:"|')/.test(html)) {
    failures.push(`${file}: fixed artboard viewport width remains.`);
  }

  if (/body\s*\{[^}]*width:\s*(?:1320|1280|390)px/s.test(html)) {
    failures.push(`${file}: fixed artboard body width remains.`);
  }

  if (!html.includes('name="robots"') || !html.includes("noindex")) {
    failures.push(`${file}: missing noindex robots meta tag.`);
  }

  if (
    !html.includes("demo-map-embed") ||
    !html.includes("https://www.google.com/maps/embed") ||
    !html.includes("St.%20Gabriel%20the%20Archangel%20Catholic%20Church") ||
    !html.includes("0x80c8cf8dbd7bbb27%3A0x79aa173c20f43d86")
  ) {
    failures.push(`${file}: missing embedded Google map for St. Gabriel.`);
  }

  if (isDirectionTemplate && !html.includes("data-mobile-cta")) {
    failures.push(`${file}: missing mobile sticky CTA.`);
  }

  if (isDirectionTemplate) {
    for (const text of sourceContractText) {
      if (!html.includes(text)) {
        failures.push(`${file}: missing FAQ source-contract text "${text}".`);
      }
    }
  }

  if (file.includes("direction-b")) {
    if (!html.includes("images.unsplash.com")) {
      failures.push(`${file}: Direction B is missing stock photography URLs.`);
    }

    if (
      !html.includes('class="photo-card"') ||
      !html.includes('alt="People gathered together around a table"') ||
      !/class="photo-card"[\s\S]*<img[^>]+images\.unsplash\.com/.test(html)
    ) {
      failures.push(`${file}: Direction B is missing the shared-table photo slot.`);
    }

    if (!html.includes('class="cover"><img')) {
      failures.push(`${file}: Direction B is missing the newsletter cover image slot.`);
    }
  }

  if (isCurrentSiteTemplate) {
    for (const text of [
      "ST. MARGARET OF CORTONA FRATERNITY",
      "Current Site",
      "View current live site",
      "assets/images/wix-page-background.jpg",
      "assets/images/st-margaret-of-cortona.jpg",
      "assets/fonts/avenir-lt-w05_35-light.woff2",
      "assets/fonts/avenir-lt-w01_35-light1475496.woff2",
      "assets/fonts/questrial.woff2"
    ]) {
      if (!html.includes(text)) {
        failures.push(`${file}: missing current-site template contract text "${text}".`);
      }
    }
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
