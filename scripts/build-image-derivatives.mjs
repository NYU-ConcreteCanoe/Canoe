/**
 * Generates small, web-friendly WebP copies of every canoe photo.
 *
 * The originals in assets/img/canoes/ are full-resolution camera files - some
 * are 5-7 MB each, over 200 MB in total. Serving those directly is what makes
 * the site feel slow to load. This script writes a resized, compressed WebP for
 * each one under assets/img/derived/, mirroring the folder layout:
 *
 *   assets/img/canoes/2019/1.JPG  ->  assets/img/derived/canoes/2019/1.webp
 *
 * The timeline thumbnails and the homepage background load these light copies;
 * the full-screen viewer still loads the original for full quality. If a
 * derivative is ever missing, the pages fall back to the original, so nothing
 * breaks - it just loads heavier until the derivative is built.
 *
 * Run by .github/workflows/image-manifest.yml whenever files under assets/img/
 * change, and runnable locally (needs `npm install` first for sharp):
 *
 *   node scripts/build-image-derivatives.mjs
 *
 * Incremental: a derivative is only rebuilt when it is missing or older than its
 * source, and derivatives whose source has been deleted are pruned.
 */

import { readdir, mkdir, stat, rm } from "node:fs/promises";
import { join, dirname, relative } from "node:path";
import sharp from "sharp";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC_DIR = "assets/img/canoes";
const OUT_DIR = "assets/img/derived/canoes";

// Only downscale; a photo already smaller than this is left at its size.
const MAX_WIDTH = 1600;
const WEBP_QUALITY = 80;

const IMAGE_RE = /\.(jpe?g|png|webp|gif|avif)$/i;

// Walk a directory tree and yield every image file, path relative to SRC_DIR.
async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(join(ROOT, dir), { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return;
    throw err;
  }
  for (const entry of entries) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      yield* walk(rel);
    } else if (entry.isFile() && IMAGE_RE.test(entry.name)) {
      yield rel;
    }
  }
}

// assets/img/canoes/2019/1.JPG -> assets/img/derived/canoes/2019/1.webp
function derivedPath(srcRel) {
  const tail = relative(SRC_DIR, srcRel).replace(/\.[^.]+$/, ".webp");
  return join(OUT_DIR, tail);
}

async function mtime(path) {
  try {
    return (await stat(join(ROOT, path))).mtimeMs;
  } catch {
    return null;
  }
}

async function build() {
  const wanted = new Set();
  let built = 0;
  let skipped = 0;

  for await (const srcRel of walk(SRC_DIR)) {
    const outRel = derivedPath(srcRel);
    wanted.add(outRel);

    const srcTime = await mtime(srcRel);
    const outTime = await mtime(outRel);
    // Rebuild only when the derivative is missing or the source is newer.
    if (outTime !== null && srcTime !== null && outTime >= srcTime) {
      skipped++;
      continue;
    }

    await mkdir(join(ROOT, dirname(outRel)), { recursive: true });
    await sharp(join(ROOT, srcRel))
      .rotate() // respect EXIF orientation before dropping the metadata
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toFile(join(ROOT, outRel));
    built++;
    console.log(`  ${srcRel} -> ${outRel}`);
  }

  // Prune derivatives whose source is gone, so deletes propagate.
  let pruned = 0;
  for await (const outRel of walk(OUT_DIR)) {
    if (!wanted.has(outRel)) {
      await rm(join(ROOT, outRel));
      pruned++;
      console.log(`  pruned ${outRel}`);
    }
  }

  console.log(
    `Derivatives: ${built} built, ${skipped} up to date, ${pruned} pruned ` +
      `(${wanted.size} total).`,
  );
}

// Fail loudly in CI; a half-built derivatives tree should not be committed.
build().catch((err) => {
  console.error("Failed to build image derivatives:", err);
  process.exit(1);
});
