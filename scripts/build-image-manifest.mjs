/**
 * Scans assets/img/ and writes assets/data/images.json.
 *
 * Static hosting cannot list a directory, so this manifest is how the browser
 * learns which photos exist. Run by .github/workflows/image-manifest.yml on
 * every push that touches assets/img/, and runnable locally:
 *
 *   node scripts/build-image-manifest.mjs
 */

import { readdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CANOES_DIR = "assets/img/canoes";
const OUT = "assets/data/images.json";

// Extensions are mixed case in this repo (.JPG, .jpg, .jpeg). GitHub Pages is
// case-sensitive, so the manifest must record names exactly as they are stored.
const IMAGE_RE = /\.(jpe?g|png|webp|gif|avif)$/i;

// Natural sort so 2.jpg, 10.jpg order correctly rather than 10 before 2.
function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

async function listDir(path) {
  try {
    return await readdir(join(ROOT, path), { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

const years = {};
const unsorted = [];
let total = 0;

for (const entry of await listDir(CANOES_DIR)) {
  // Loose images sitting directly in assets/img/canoes/ belong to no year.
  // The admin panel uploads here, because an upload folder is fixed per
  // collection and cannot be derived from the year being edited. Collect them
  // so they are reported rather than silently ignored.
  if (entry.isFile() && IMAGE_RE.test(entry.name)) {
    unsorted.push(`${CANOES_DIR}/${entry.name}`);
    continue;
  }

  if (!entry.isDirectory() || !/^\d{4}$/.test(entry.name)) continue;

  const files = (await listDir(`${CANOES_DIR}/${entry.name}`))
    .filter((f) => f.isFile() && IMAGE_RE.test(f.name))
    .map((f) => `${CANOES_DIR}/${entry.name}/${f.name}`)
    .sort(naturalSort);

  if (files.length) {
    years[entry.name] = files;
    total += files.length;
  }
}

unsorted.sort(naturalSort);

const manifest = {
  _comment:
    "GENERATED FILE - do not edit by hand. Rebuilt by .github/workflows/image-manifest.yml whenever files under assets/img/ change. To add photos, add the files; this updates itself.",
  canoes: years,
  // Images uploaded through the admin panel land here until someone moves them
  // into the right year folder. They are listed so they are visible rather
  // than lost; the site does not display them.
  unsorted,
};

// Preserve byte-identical output when nothing changed, so the workflow's
// git diff check does not produce empty commits.
const next = JSON.stringify(manifest, null, 2) + "\n";
let prev = null;
try {
  prev = await readFile(join(ROOT, OUT), "utf8");
} catch {
  /* first run */
}

if (prev !== next) {
  await writeFile(join(ROOT, OUT), next);
  console.log(
    `Wrote ${OUT}: ${Object.keys(years).length} years, ${total} images.`,
  );
} else {
  console.log("Manifest unchanged.");
}

if (unsorted.length) {
  console.warn(
    `\n${unsorted.length} image(s) are sitting loose in ${CANOES_DIR} and are ` +
      `not shown on the site. Move them into the folder for their year:\n` +
      unsorted.map((f) => `  ${f}`).join("\n"),
  );
}
