#!/usr/bin/env node
/**
 * Site checks for NYU Concrete Canoe.
 *
 *   node scripts/test.mjs           run everything
 *   node scripts/test.mjs --quiet   only show failures
 *
 * No dependencies, on purpose. This repo is deliberately plain HTML/CSS/JS and
 * should stay runnable with nothing but Node installed.
 *
 * Exit code is non-zero if any check fails, so it can gate a deploy.
 * Warnings do not fail the run; they are things to look at, not stop for.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname, relative, dirname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const QUIET = process.argv.includes("--quiet");

/* ------------------------------------------------------------------ *
 * Tiny harness
 * ------------------------------------------------------------------ */

let failures = 0, warnings = 0, checks = 0, group = "";

const rel = (p) => relative(ROOT, p) || p;

function section(name) {
  group = name;
  if (!QUIET) console.log(`\n${name}`);
}
function ok(msg) {
  checks++;
  if (!QUIET) console.log(`  \x1b[32mok\x1b[0m   ${msg}`);
}
function fail(msg, detail) {
  checks++; failures++;
  console.log(`  \x1b[31mFAIL\x1b[0m ${group ? group + ": " : ""}${msg}`);
  if (detail) String(detail).split("\n").forEach((l) => console.log(`         ${l}`));
}
function warn(msg, detail) {
  warnings++;
  if (!QUIET) console.log(`  \x1b[33mwarn\x1b[0m ${msg}`);
  if (detail && !QUIET) String(detail).split("\n").forEach((l) => console.log(`         ${l}`));
}
/** Assert with a list of offenders; keeps output short when many fail. */
function expectEmpty(msg, offenders, { asWarning = false, limit = 12 } = {}) {
  if (!offenders.length) return ok(msg);
  const shown = offenders.slice(0, limit);
  const extra = offenders.length > limit ? `\n... and ${offenders.length - limit} more` : "";
  (asWarning ? warn : fail)(`${msg} (${offenders.length})`, shown.join("\n") + extra);
}

/* ------------------------------------------------------------------ *
 * Filesystem helpers
 * ------------------------------------------------------------------ */

const IGNORED_DIRS = new Set([".git", "node_modules", ".vscode"]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

const ALL_FILES = walk(ROOT);
const byExt = (...exts) => ALL_FILES.filter((f) => exts.includes(extname(f).toLowerCase()));
// admin/index.html is a mount point for the CMS, not a page of the site. It
// intentionally has no <main>, <h1> or navigation, so page-level checks skip it
// while security and syntax checks still cover it.
const ALL_HTML = byExt(".html");
const HTML = ALL_HTML.filter((f) => !rel(f).startsWith("admin/"));
const JS = byExt(".js", ".mjs");
const CSS = byExt(".css");
const JSON_FILES = byExt(".json");
const IMAGES = byExt(".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".svg");

const read = (f) => readFileSync(f, "utf8");
const readBytes = (f, n = 32) => {
  const b = readFileSync(f);
  return b.subarray(0, Math.min(n, b.length));
};

/* ================================================================== *
 * 1. SECURITY
 * ================================================================== */

section("Security: file types");

// Anything executable or server-side has no business in a static Pages repo.
// A .php or .cgi file would simply be served as text, but its presence usually
// means something was committed by mistake.
const DANGEROUS_EXT = new Set([
  ".php", ".phtml", ".php5", ".asp", ".aspx", ".jsp", ".cgi", ".pl",
  ".exe", ".dll", ".so", ".dylib", ".bat", ".cmd", ".com", ".scr",
  ".msi", ".app", ".jar", ".apk", ".deb", ".rpm", ".dmg", ".pkg",
  ".vbs", ".ps1", ".psm1", ".wsf", ".hta", ".reg", ".lnk",
]);
expectEmpty(
  "no executable or server-side files committed",
  ALL_FILES.filter((f) => DANGEROUS_EXT.has(extname(f).toLowerCase())).map(rel),
);

// A file whose bytes do not match its extension is the classic way to smuggle
// something past a naive uploader. Every image must actually be that image.
const MAGIC = {
  ".jpg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  ".jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  ".png": (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  ".gif": (b) => b.subarray(0, 6).toString("latin1").match(/^GIF8[79]a$/),
  ".webp": (b) => b.subarray(0, 4).toString("latin1") === "RIFF" &&
                  b.subarray(8, 12).toString("latin1") === "WEBP",
  ".pdf": (b) => b.subarray(0, 5).toString("latin1") === "%PDF-",
  ".mp4": (b) => b.subarray(4, 8).toString("latin1") === "ftyp",
  ".zip": (b) => b[0] === 0x50 && b[1] === 0x4b,
};
const mismatched = [];
for (const f of byExt(...Object.keys(MAGIC))) {
  const check = MAGIC[extname(f).toLowerCase()];
  if (check && !check(readBytes(f, 16))) mismatched.push(`${rel(f)} does not match its extension`);
}
expectEmpty("image, video and document bytes match their extensions", mismatched);

// SVGs can carry script. None are expected here; if one appears, it must be inert.
const svgWithScript = IMAGES.filter((f) => extname(f) === ".svg")
  .filter((f) => /<script|onload=|javascript:/i.test(read(f)))
  .map(rel);
expectEmpty("no SVG contains script or event handlers", svgWithScript);

section("Security: Git LFS");

// GitHub Pages does not resolve LFS pointers; it serves the ~130 byte pointer
// file instead of the real binary. This shipped broken once already.
const lfsPointers = ALL_FILES.filter((f) => {
  const s = statSync(f);
  if (s.size > 300) return false;
  try { return read(f).startsWith("version https://git-lfs.github.com/spec/v1"); }
  catch { return false; }
}).map(rel);
expectEmpty("no Git LFS pointer files (Pages cannot resolve them)", lfsPointers);

if (existsSync(join(ROOT, ".gitattributes"))) {
  const attrs = read(join(ROOT, ".gitattributes"));
  if (/filter=lfs/.test(attrs)) {
    fail("'.gitattributes' enables Git LFS, which breaks downloads on Pages");
  } else ok(".gitattributes does not enable Git LFS");
} else ok("no .gitattributes enabling Git LFS");

section("Security: secrets");

// Deliberately narrow patterns. Broad ones produce false alarms and get ignored.
const SECRET_PATTERNS = [
  [/-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/, "private key"],
  [/gh[pousr]_[A-Za-z0-9]{36,}/, "GitHub token"],
  [/github_pat_[A-Za-z0-9_]{50,}/, "GitHub fine-grained PAT"],
  [/AKIA[0-9A-Z]{16}/, "AWS access key id"],
  [/sk-[A-Za-z0-9]{32,}/, "API secret key"],
  [/xox[baprs]-[A-Za-z0-9-]{10,}/, "Slack token"],
  [/AIza[0-9A-Za-z_-]{35}/, "Google API key"],
  [/\bclient_secret\s*[:=]\s*["'][^"']{8,}/i, "client secret"],
];
const secrets = [];
for (const f of ALL_FILES) {
  if (statSync(f).size > 2_000_000) continue;
  let text;
  try { text = read(f); } catch { continue; }
  for (const [re, label] of SECRET_PATTERNS) {
    const m = text.match(re);
    if (m) secrets.push(`${rel(f)}: possible ${label}`);
  }
}
expectEmpty("no credentials or private keys committed", secrets);

// The Web3Forms access key is public by design, but a placeholder left in
// place means the contact form silently does not work.
const contact = HTML.find((f) => f.endsWith("contact.html"));
if (contact) {
  const t = read(contact);
  if (/REPLACE-WITH-WEB3FORMS-ACCESS-KEY/.test(t)) {
    warn("contact form access key is still the placeholder, so submissions will fail");
  } else ok("contact form has a real access key");
}

section("Security: links and embeds");

// An href or src that executes script is the main injection risk in data that
// non-developers can edit.
const badUrls = [];
for (const f of [...ALL_HTML, ...JSON_FILES]) {
  const text = read(f);
  for (const m of text.matchAll(/(?:href|src|action)\s*[:=]\s*["']?\s*(javascript:|data:text\/html|vbscript:)/gi)) {
    badUrls.push(`${rel(f)}: ${m[1]}`);
  }
}
expectEmpty("no javascript:, vbscript: or data:text/html URLs", badUrls);

// Only these may be framed. Kept in step with the allowlist in announcements.js.
const EMBED_ALLOW = [
  "linkedin.com", "www.linkedin.com",
  "instagram.com", "www.instagram.com",
  "youtube.com", "www.youtube.com", "youtu.be",
  "youtube-nocookie.com", "www.youtube-nocookie.com",
  "concrete-canoe-paddling.vercel.app",
];
const badEmbeds = [];
for (const f of [...ALL_HTML, ...JSON_FILES]) {
  const text = read(f);
  for (const m of text.matchAll(/<iframe[^>]*\ssrc=["']([^"']+)["']/gi)) {
    try {
      const host = new URL(m[1], "https://example.test").hostname;
      if (!EMBED_ALLOW.includes(host)) badEmbeds.push(`${rel(f)}: iframe from ${host}`);
    } catch { badEmbeds.push(`${rel(f)}: unparseable iframe src ${m[1]}`); }
  }
  for (const m of text.matchAll(/"embed"\s*:\s*"([^"]+)"/g)) {
    if (!m[1]) continue;
    try {
      const host = new URL(m[1]).hostname;
      if (!EMBED_ALLOW.includes(host)) badEmbeds.push(`${rel(f)}: embed host ${host} not allowed`);
    } catch { badEmbeds.push(`${rel(f)}: unparseable embed URL`); }
  }
}
expectEmpty("all iframes and embeds use allowlisted hosts", badEmbeds);

// The allowlist in code must stay strict; a wildcard would defeat it.
const annJs = JS.find((f) => f.endsWith("announcements.js"));
if (annJs) {
  const t = read(annJs);
  if (!/EMBED_HOSTS/.test(t)) fail("announcements.js no longer has an embed host allowlist");
  else if (/EMBED_HOSTS\s*=\s*\{\s*\}/.test(t) || /return\s*\{\s*url:\s*raw/.test(t)) {
    fail("embed allowlist looks bypassed");
  } else ok("embed host allowlist is present in announcements.js");
}

// Framed third-party content should be sandboxed.
const unsandboxed = [];
for (const f of JS) {
  const t = read(f);
  if (/<iframe/.test(t) && !/sandbox=/.test(t)) unsandboxed.push(rel(f));
}
expectEmpty("iframes built in JS declare a sandbox", unsandboxed, { asWarning: true });

// Data files are edited through a CMS; a path escaping the repo is a red flag.
const traversal = [];
for (const f of JSON_FILES) {
  for (const m of read(f).matchAll(/"(?:image|logo|src|images)"\s*:\s*"([^"]*\.\.[^"]*)"/g)) {
    traversal.push(`${rel(f)}: ${m[1]}`);
  }
}
expectEmpty("no '..' path traversal in data files", traversal);

section("Security: repository hygiene");

const junk = ALL_FILES.filter((f) => /(^|\/)(\.DS_Store|Thumbs\.db|\._.*)$/.test(rel(f))).map(rel);
expectEmpty("no .DS_Store or OS junk files", junk, { asWarning: true });

const envFiles = ALL_FILES.filter((f) => /(^|\/)\.env(\..+)?$/.test(rel(f))).map(rel);
expectEmpty("no .env files", envFiles);

/* ================================================================== *
 * 2. BUDGET  (GitHub Pages publishes at most 1 GB)
 * ================================================================== */

section("Budget");

const MB = 1024 * 1024;
const totalBytes = ALL_FILES.reduce((n, f) => n + statSync(f).size, 0);
const totalMB = totalBytes / MB;
if (totalMB > 1024) fail(`site is ${totalMB.toFixed(0)} MB, over the 1 GB Pages limit`);
else if (totalMB > 700) warn(`site is ${totalMB.toFixed(0)} MB, approaching the 1 GB Pages limit`);
else ok(`site is ${totalMB.toFixed(0)} MB, within the 1 GB Pages limit`);

// GitHub refuses any single file over 100 MB on push.
expectEmpty(
  "no file over 100 MB (GitHub blocks these on push)",
  ALL_FILES.filter((f) => statSync(f).size > 100 * MB).map((f) => `${rel(f)} ${(statSync(f).size / MB).toFixed(0)} MB`),
);

// Oversized photos are the usual cause of a slow first paint.
expectEmpty(
  "no image over 2 MB",
  IMAGES.filter((f) => statSync(f).size > 2 * MB)
    .map((f) => `${rel(f)} ${(statSync(f).size / MB).toFixed(1)} MB`),
  { asWarning: true },
);

/* ================================================================== *
 * 3. DATA INTEGRITY
 * ================================================================== */

section("Data: JSON");

const data = {};
for (const f of JSON_FILES) {
  try {
    data[rel(f)] = JSON.parse(read(f));
    ok(`${rel(f)} parses`);
  } catch (e) {
    fail(`${rel(f)} is not valid JSON`, e.message);
  }
}

/** Shape checks. Keeps a bad CMS edit from silently blanking a section. */
function requireFields(fileKey, listPath, required) {
  const doc = data[fileKey];
  if (!doc) return;
  const list = listPath.split(".").reduce((o, k) => (o ? o[k] : undefined), doc);
  if (!Array.isArray(list)) return fail(`${fileKey}: ${listPath} is missing or not a list`);
  const bad = [];
  list.forEach((item, i) => {
    for (const key of required) {
      const v = item[key];
      if (v === undefined || v === null || v === "" ||
          (Array.isArray(v) && v.length === 0)) {
        bad.push(`${fileKey}[${i}] missing "${key}"`);
      }
    }
  });
  expectEmpty(`${fileKey}: every entry in ${listPath} has ${required.join(", ")}`, bad);
}

requireFields("assets/data/canoes.json", "canoes", ["year", "name", "description", "tags"]);
requireFields("assets/data/team.json", "leadership", ["name", "role"]);
requireFields("assets/data/sponsors.json", "sponsors", ["name", "tier", "logo"]);

// Announcements are either a text post or an embed; one of the two must exist.
const ann = data["assets/data/announcements.json"];
if (ann?.announcements) {
  const bad = [];
  ann.announcements.forEach((p, i) => {
    if (!p.id) bad.push(`announcement[${i}] has no id`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date || "")) bad.push(`announcement[${i}] date is not YYYY-MM-DD`);
    if (!p.title && !p.embed) bad.push(`announcement[${i}] has neither a title nor an embed`);
    if (!p.embed && !p.body) bad.push(`announcement[${i}] is a text post with no body`);
  });
  expectEmpty("announcements are well formed", bad);

  const ids = ann.announcements.map((p) => p.id);
  expectEmpty("announcement ids are unique",
    ids.filter((id, i) => ids.indexOf(id) !== i).map((id) => `duplicate id: ${id}`));
}

// Duplicate years would render two stops for the same canoe.
const canoes = data["assets/data/canoes.json"]?.canoes;
if (canoes) {
  const years = canoes.map((c) => c.year);
  expectEmpty("canoe years are unique",
    years.filter((y, i) => years.indexOf(y) !== i).map((y) => `duplicate year: ${y}`));
  expectEmpty("canoe years are plausible",
    years.filter((y) => !(Number.isInteger(y) && y >= 1990 && y <= new Date().getFullYear() + 1))
      .map((y) => `implausible year: ${y}`));
}

section("Data: referenced assets exist");

// Every path a data file points at must be on disk, or the page renders a
// broken image.
const missing = [];
for (const [key, doc] of Object.entries(data)) {
  JSON.stringify(doc).replace(/"(assets\/[^"]+)"/g, (_, p) => {
    if (!existsSync(join(ROOT, p))) missing.push(`${key} -> ${p}`);
    return _;
  });
}
expectEmpty("every asset path in data files exists on disk", missing);

// Same for the HTML.
const missingHtml = [];
for (const f of HTML) {
  for (const m of read(f).matchAll(/(?:src|href)=["'](assets\/[^"'#?]+)["']/g)) {
    if (!existsSync(join(ROOT, m[1]))) missingHtml.push(`${rel(f)} -> ${m[1]}`);
  }
}
expectEmpty("every asset referenced in HTML exists on disk", missingHtml);

section("Data: image manifest");

// The manifest is generated. If it drifts from the filesystem, photos silently
// disappear from the timeline.
const manifest = data["assets/data/images.json"];
const canoeDir = join(ROOT, "assets/img/canoes");
if (manifest && existsSync(canoeDir)) {
  const IMG_RE = /\.(jpe?g|png|webp|gif|avif)$/i;
  const onDisk = {};
  for (const entry of readdirSync(canoeDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^\d{4}$/.test(entry.name)) continue;
    onDisk[entry.name] = readdirSync(join(canoeDir, entry.name))
      .filter((n) => IMG_RE.test(n))
      .map((n) => `assets/img/canoes/${entry.name}/${n}`)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }
  const drift = [];
  for (const year of new Set([...Object.keys(onDisk), ...Object.keys(manifest.canoes || {})])) {
    const a = (onDisk[year] || []).join("|");
    const b = (manifest.canoes?.[year] || []).join("|");
    if (a !== b) drift.push(`${year}: disk has ${onDisk[year]?.length ?? 0}, manifest has ${manifest.canoes?.[year]?.length ?? 0}`);
  }
  expectEmpty("image manifest matches the filesystem (run scripts/build-image-manifest.mjs)", drift);

  expectEmpty("no photos sitting outside a year folder",
    (manifest.unsorted || []).map((f) => `${f} is not in a year folder, so it is not shown`),
    { asWarning: true });

  // A canoe with no photos renders a placeholder. Worth knowing, not failing.
  if (canoes) {
    expectEmpty("every canoe year has photos",
      canoes.filter((c) => !(manifest.canoes?.[String(c.year)]?.length))
        .map((c) => `${c.year} ${c.name} has no photos`),
      { asWarning: true });
  }
}

section("Data: internal links");

const pageNames = new Set(HTML.map((f) => rel(f)));
const brokenLinks = [];
for (const f of HTML) {
  for (const m of read(f).matchAll(/href=["']([^"'#][^"']*)["']/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|tel:|#|\/\/)/.test(href)) continue;
    const target = normalize(href.split(/[?#]/)[0]);
    if (!target) continue;
    if (!existsSync(join(ROOT, target)) && !pageNames.has(target)) {
      brokenLinks.push(`${rel(f)} -> ${href}`);
    }
  }
}
expectEmpty("all internal links resolve", brokenLinks);

/* ================================================================== *
 * 4. SYNTAX
 * ================================================================== */

section("Syntax");

// Parses the file the way a browser would, without running it.
const jsErrors = [];
for (const f of JS) {
  try { new Function(read(f)); }
  catch (e) {
    // Module syntax is legal but not valid inside a Function body.
    if (!/import|export/.test(read(f))) jsErrors.push(`${rel(f)}: ${e.message}`);
  }
}
expectEmpty("all JavaScript parses", jsErrors);

const cssErrors = [];
for (const f of CSS) {
  const text = read(f).replace(/\/\*[\s\S]*?\*\//g, "");
  const open = (text.match(/\{/g) || []).length;
  const close = (text.match(/\}/g) || []).length;
  if (open !== close) cssErrors.push(`${rel(f)}: ${open} '{' vs ${close} '}'`);
}
expectEmpty("all CSS has balanced braces", cssErrors);

// A custom property used but never defined renders as nothing.
const definedVars = new Set();
for (const f of CSS) for (const m of read(f).matchAll(/(--[\w-]+)\s*:/g)) definedVars.add(m[1]);
const undefinedVars = [];
for (const f of CSS) {
  for (const m of read(f).matchAll(/var\(\s*(--[\w-]+)/g)) {
    if (!definedVars.has(m[1])) undefinedVars.push(`${rel(f)}: ${m[1]} is used but never defined`);
  }
}
expectEmpty("all CSS custom properties are defined", [...new Set(undefinedVars)]);

/* ================================================================== *
 * 5. HTML STRUCTURE
 * ================================================================== */

section("HTML structure");

const structural = { main: [], h1: [], ids: [], lang: [], title: [], viewport: [], favicon: [], charset: [] };
for (const f of HTML) {
  const t = read(f), name = rel(f);
  const count = (re) => (t.match(re) || []).length;

  if (count(/<main[\s>]/g) !== 1) structural.main.push(`${name} has ${count(/<main[\s>]/g)} <main> elements, expected 1`);
  if (count(/<h1[\s>]/g) !== 1) structural.h1.push(`${name} has ${count(/<h1[\s>]/g)} <h1> elements, expected 1`);
  if (!/<html[^>]+lang=/.test(t)) structural.lang.push(`${name} <html> has no lang attribute`);
  if (!/<title>[^<]+<\/title>/.test(t)) structural.title.push(`${name} has no non-empty <title>`);
  if (!/name=["']viewport["']/.test(t)) structural.viewport.push(`${name} has no viewport meta`);
  if (!/rel=["'](?:shortcut )?icon["']/.test(t)) structural.favicon.push(`${name} has no favicon`);
  if (!/<meta[^>]+charset=/i.test(t)) structural.charset.push(`${name} has no charset meta`);

  const ids = [...t.matchAll(/\sid=["']([^"']+)["']/g)].map((m) => m[1]);
  ids.filter((id, i) => ids.indexOf(id) !== i)
    .forEach((id) => structural.ids.push(`${name} has duplicate id "${id}"`));

  // Unclosed tags are the usual cause of a section vanishing.
  for (const tag of ["div", "section", "main", "article", "nav", "footer"]) {
    const o = count(new RegExp(`<${tag}[\\s>]`, "g"));
    const c = count(new RegExp(`</${tag}>`, "g"));
    if (o !== c) structural.main.push(`${name}: <${tag}> opened ${o} times, closed ${c}`);
  }
}
expectEmpty("each page has exactly one <main> and balanced structural tags", structural.main);
expectEmpty("each page has exactly one <h1>", structural.h1);
expectEmpty("no duplicate element ids", structural.ids);
expectEmpty("every page declares a language", structural.lang);
expectEmpty("every page has a title", structural.title);
expectEmpty("every page has a charset", structural.charset);
expectEmpty("every page has a viewport meta", structural.viewport);
expectEmpty("every page has a favicon", structural.favicon);

// The nav is copy-pasted across pages; drift means a missing or stale link.
const navs = HTML.map((f) => {
  const m = read(f).match(/<nav[\s\S]*?<\/nav>/);
  return { file: rel(f), links: m ? [...m[0].matchAll(/href=["']([^"']+)["']/g)].map((x) => x[1]).sort().join(",") : null };
});
const navSets = new Set(navs.filter((n) => n.links).map((n) => n.links));
if (navSets.size > 1) {
  fail("navigation links differ between pages", navs.map((n) => `${n.file}: ${n.links}`).join("\n"));
} else ok("navigation is consistent across all pages");

// Every page should mark its own nav entry as current.
expectEmpty("every page marks its current nav item",
  HTML.filter((f) => !/aria-current=["']page["']/.test(read(f))).map(rel));

/* ================================================================== *
 * 6. ACCESSIBILITY
 * ================================================================== */

section("Accessibility");

const a11y = { alt: [], label: [], iframe: [], link: [], skip: [], btn: [] };
for (const f of HTML) {
  const t = read(f), name = rel(f);

  for (const m of t.matchAll(/<img\b(?![^>]*\balt=)[^>]*>/g)) {
    a11y.alt.push(`${name}: <img> without alt: ${m[0].slice(0, 70)}`);
  }
  for (const m of t.matchAll(/<iframe\b(?![^>]*\btitle=)[^>]*>/g)) {
    a11y.iframe.push(`${name}: <iframe> without title`);
  }
  // Inputs need a label pointing at them, or their own accessible name.
  for (const m of t.matchAll(/<(input|textarea|select)\b[^>]*\bid=["']([^"']+)["'][^>]*>/g)) {
    if (/type=["'](hidden|submit|button)["']/.test(m[0])) continue;
    if (!new RegExp(`<label[^>]+for=["']${m[2]}["']`).test(t) &&
        !/aria-label|aria-labelledby/.test(m[0])) {
      a11y.label.push(`${name}: <${m[1]} id="${m[2]}"> has no associated label`);
    }
  }
  // Icon-only links and buttons announce as empty without a name.
  for (const m of t.matchAll(/<a\b([^>]*)>([\s\S]{0,120}?)<\/a>/g)) {
    const inner = m[2].replace(/<[^>]+>/g, "").trim();
    if (!inner && !/aria-label|aria-labelledby|title=/.test(m[1])) {
      a11y.link.push(`${name}: link with no accessible name`);
    }
  }
  if (!/class=["'][^"']*skip-link/.test(t)) a11y.skip.push(`${name} has no skip-to-content link`);
}
expectEmpty("every image has an alt attribute", a11y.alt);
expectEmpty("every iframe has a title", a11y.iframe);
expectEmpty("every form field has a label", a11y.label);
expectEmpty("no link is missing an accessible name", a11y.link);
expectEmpty("every page has a skip-to-content link", a11y.skip, { asWarning: true });

// Buttons generated in JS should carry aria-label when they hold only an icon.
const jsIconButtons = [];
for (const f of JS) {
  const t = read(f);
  for (const m of t.matchAll(/<button(?![^>]*aria-label)[^>]*>\s*(?:'\s*\+[^+]*)?<i class=/g)) {
    jsIconButtons.push(`${rel(f)}: icon-only button without aria-label`);
  }
}
expectEmpty("icon-only buttons built in JS have aria-labels", jsIconButtons);

/* ================================================================== *
 * 7. RENDERING CONTRACT
 * ================================================================== */

section("Rendering contract");

// Each renderer needs its mount point to exist, or the section silently
// disappears. These pairings are easy to break when editing HTML.
const MOUNTS = [
  ["index.html", "announcements", "assets/js/announcements.js"],
  ["timeline.html", "panel-canoes", "assets/js/timeline.js"],
  ["about.html", "team-container", "assets/js/team.js"],
  ["sponsors.html", "sponsor-grid", "assets/js/sponsors.js"],
];
const mountProblems = [];
for (const [page, id, script] of MOUNTS) {
  const p = join(ROOT, page);
  if (!existsSync(p)) { mountProblems.push(`${page} is missing`); continue; }
  const t = read(p);
  if (!new RegExp(`id=["']${id}["']`).test(t)) mountProblems.push(`${page} has no #${id} for ${script}`);
  if (!t.includes(script)) mountProblems.push(`${page} does not load ${script}`);
}
expectEmpty("every renderer has its mount point and script", mountProblems);

// Rails depend on the shared drag helper.
for (const [page, , script] of MOUNTS) {
  const p = join(ROOT, page);
  if (!existsSync(p)) continue;
  const t = read(p);
  const needsDrag = /announcements\.js|timeline\.js/.test(script);
  if (needsDrag && t.includes(script) && !t.includes("drag-scroll.js")) {
    fail(`${page} loads ${script} but not drag-scroll.js, so its rail will not drag`);
  }
}
ok("pages with rails also load drag-scroll.js");

// User-authored text must be escaped, since editors are non-developers.
for (const f of JS.filter((f) => /announcements|timeline|sponsors|team/.test(f))) {
  const t = read(f);
  if (!/function esc\(/.test(t)) fail(`${rel(f)} has no escaping helper`);
}
ok("renderers define an escaping helper for authored text");

/* ------------------------------------------------------------------ *
 * Summary
 * ------------------------------------------------------------------ */

const line = "-".repeat(64);
console.log(`\n${line}`);
if (failures) {
  console.log(`\x1b[31m${failures} failed\x1b[0m, ${checks - failures} passed, ${warnings} warning(s)`);
  console.log("Deploy should be blocked.");
} else {
  console.log(`\x1b[32mAll ${checks} checks passed\x1b[0m${warnings ? `, ${warnings} warning(s)` : ""}`);
}
console.log(line);
process.exit(failures ? 1 : 0);
