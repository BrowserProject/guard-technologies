/*
 * Compile the guard-technologies corpus into the per-technology JSON files
 * that guard.ch /replay fetches at render time.
 *
 *   node scripts/build.mjs            # writes ./dist
 *   node scripts/build.mjs --out X    # writes ./X
 *
 * Output layout (mirrors what gets synced to the public Hetzner bucket):
 *
 *   dist/
 *     en/<slug>.json      one English enrichment record per technology
 *     de/<slug>.json      same record with German prose swapped in where a
 *                         translation exists, English everywhere else
 *     index.json          { generatedAt: null, count, langs, technologies:[{name,slug}] }
 *
 * Each en/<slug>.json is byte-compatible with the object the (now-removed)
 * chrome_guard techlookup.js used to bake into metadata.json
 * (GuardTechEnrichment + denormalised GuardTechCategoryEnrichment[]), so the
 * frontend can assign it straight to `tech.enriched` with no shape changes.
 *
 * The German layer is an OVERLAY: i18n/de/ carries only the translatable prose
 * fields keyed by the exact technology name / category id. Anything missing
 * falls back to the English text, so a row is never blank. See AGENTS.md for
 * the translation workflow and the overlay format.
 *
 * Dependency-free (Node >= 18, fs/path only). Mirrors techlookup.js so the two
 * must be kept in sync by hand if the enrichment shape ever changes.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { techSlug } from "./slug.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SRC = path.join(ROOT, "src");
const I18N = path.join(ROOT, "i18n");

/** Prose fields a translation overlay may localise. Everything else (scores,
 *  enums, booleans, dates, vendor facts) is locale-independent and is rendered
 *  by the frontend through its own next-intl message catalogue. */
export const TECH_PROSE_FIELDS = ["description", "history", "summary_abuse"];
export const CATEGORY_PROSE_FIELDS = ["description"];

/** Languages we publish. "en" is the source; every other entry is an overlay
 *  directory under i18n/<lang>/ that may be partial or absent. */
const LANGS = ["en", "de"];

// --- io helpers -------------------------------------------------------------

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return fallback; }
}

function readMergedDir(dir) {
  // Merge every *.json in a directory into one flat object (src/technologies
  // is split a.json..z.json; an overlay dir follows the same convention).
  const out = {};
  let files;
  try { files = fs.readdirSync(dir); }
  catch { return out; }
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    const obj = readJson(path.join(dir, f), null);
    if (obj && typeof obj === "object") Object.assign(out, obj);
  }
  return out;
}

function rmrf(dir) { fs.rmSync(dir, { recursive: true, force: true }); }
function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function writeJson(file, value) { fs.writeFileSync(file, JSON.stringify(value)); }

// --- enrichment shape (ported verbatim from chrome_guard techlookup.js) ------

function toArrayOrNull(v) {
  if (v == null) return null;
  return Array.isArray(v) ? v : [v];
}
function bareNames(v) {
  const arr = toArrayOrNull(v);
  if (!arr) return null;
  return arr.map((s) => String(s).split(/\\;/)[0]);
}
function toNumberArrayOrNull(v) {
  const arr = toArrayOrNull(v);
  if (!arr) return null;
  return arr.map((n) => Number(n)).filter((n) => Number.isFinite(n));
}

function buildCategoryRow(id, cats) {
  const c = cats[id] || cats[String(id)] || {};
  return {
    id: Number(id),
    name: c.name != null ? c.name : null,
    priority: c.priority != null ? c.priority : null,
    description: c.description != null ? c.description : null,
    placement: c.placement != null ? c.placement : null,
    business_function: c.business_function != null ? c.business_function : null,
    inherent_attack_surface_score: c.inherent_attack_surface_score != null ? c.inherent_attack_surface_score : null,
    inherent_privacy_risk_score: c.inherent_privacy_risk_score != null ? c.inherent_privacy_risk_score : null,
    inherent_third_party_data_sharing_score: c.inherent_third_party_data_sharing_score != null ? c.inherent_third_party_data_sharing_score : null,
    inherent_pii_exposure_score: c.inherent_pii_exposure_score != null ? c.inherent_pii_exposure_score : null,
    tracker_likelihood_score: c.tracker_likelihood_score != null ? c.tracker_likelihood_score : null,
    regulatory_relevance: c.regulatory_relevance != null ? c.regulatory_relevance : null,
    recommended_scrutiny_level: c.recommended_scrutiny_level != null ? c.recommended_scrutiny_level : null,
    ai_confidence: c.confidence != null ? c.confidence : null,
    source_urls: c.source_urls != null ? c.source_urls : null,
  };
}

function buildEnrichment(name, def, categoryRowById) {
  const g = def; // fingerprint and enrichment share the same record
  const catIds = Array.isArray(def.cats) ? def.cats : [];
  const categories = catIds
    .map((id) => categoryRowById.get(Number(id)))
    .filter(Boolean);

  return {
    name,
    description: def.description != null ? def.description : null,
    website: def.website != null ? def.website : null,
    icon: def.icon != null ? def.icon : null,
    cpe: def.cpe != null ? def.cpe : null,
    oss: def.oss != null ? def.oss : null,
    saas: def.saas != null ? def.saas : null,
    pricing: toArrayOrNull(def.pricing),
    implies: bareNames(def.implies),
    requires: bareNames(def.requires),
    requires_category: toNumberArrayOrNull(def.requiresCategory),
    excludes: bareNames(def.excludes),
    kind: g.kind != null ? g.kind : null,
    popularity_tier: g.popularity_tier != null ? g.popularity_tier : null,
    enterprise_adoption: g.enterprise_adoption != null ? g.enterprise_adoption : null,
    overall_trust_score: g.overall_trust_score != null ? g.overall_trust_score : null,
    technical_depth_score: g.technical_depth_score != null ? g.technical_depth_score : null,
    privacy_score: g.privacy_score != null ? g.privacy_score : null,
    vendor_stability_score: g.vendor_stability_score != null ? g.vendor_stability_score : null,
    abuse_score: g.abuse_score != null ? g.abuse_score : null,
    ai_generated_likelihood: g.ai_generated_likelihood != null ? g.ai_generated_likelihood : null,
    white_label_wrapper_likelihood: g.white_label_wrapper_likelihood != null ? g.white_label_wrapper_likelihood : null,
    dark_pattern_likelihood: g.dark_pattern_likelihood != null ? g.dark_pattern_likelihood : null,
    tracker_density: g.tracker_density != null ? g.tracker_density : null,
    pricing_model: g.pricing_model != null ? g.pricing_model : null,
    has_free_tier: g.has_free_tier != null ? g.has_free_tier : null,
    has_self_hosted_option: g.has_self_hosted_option != null ? g.has_self_hosted_option : null,
    starting_price_usd_monthly: g.starting_price_usd_monthly != null ? g.starting_price_usd_monthly : null,
    enterprise_pricing_only: g.enterprise_pricing_only != null ? g.enterprise_pricing_only : null,
    pricing_transparency_score: g.pricing_transparency_score != null ? g.pricing_transparency_score : null,
    license_type: g.license_type != null ? g.license_type : null,
    maintenance_status: g.maintenance_status != null ? g.maintenance_status : null,
    founded_year: g.founded_year != null ? g.founded_year : null,
    headquarters_country: g.headquarters_country != null ? g.headquarters_country : null,
    company_size_bucket: g.company_size_bucket != null ? g.company_size_bucket : null,
    parent_company: g.parent_company != null ? g.parent_company : null,
    ownership_type: g.ownership_type != null ? g.ownership_type : null,
    soc2_type2: g.soc2_type2 != null ? g.soc2_type2 : null,
    iso27001: g.iso27001 != null ? g.iso27001 : null,
    gdpr_compliant: g.gdpr_compliant != null ? g.gdpr_compliant : null,
    hipaa_compliant: g.hipaa_compliant != null ? g.hipaa_compliant : null,
    pci_dss: g.pci_dss != null ? g.pci_dss : null,
    has_bug_bounty: g.has_bug_bounty != null ? g.has_bug_bounty : null,
    has_responsible_disclosure_policy: g.has_responsible_disclosure_policy != null ? g.has_responsible_disclosure_policy : null,
    history: g.history != null ? g.history : null,
    summary_abuse: g.summary_abuse != null ? g.summary_abuse : null,
    ai_confidence: g.confidence != null ? g.confidence : null,
    source_urls: g.source_urls != null ? g.source_urls : null,
    categories,
  };
}

// --- localisation -----------------------------------------------------------

/** Apply a German (or other) prose overlay onto an English enrichment record.
 *  Returns a NEW object; the English record is never mutated. Only non-empty
 *  overlay strings win, so a partial / absent overlay degrades to English. */
function localise(enEnrichment, techOverlay, catOverlayById) {
  const out = { ...enEnrichment };

  const techT = techOverlay[enEnrichment.name] || techOverlay[enEnrichment.name.toLowerCase()] || null;
  if (techT) {
    for (const f of TECH_PROSE_FIELDS) {
      const v = techT[f];
      if (typeof v === "string" && v.trim()) out[f] = v;
    }
  }

  // Categories are denormalised into each record, so localise the copies here.
  if (Array.isArray(enEnrichment.categories) && catOverlayById.size) {
    out.categories = enEnrichment.categories.map((cat) => {
      const ct = catOverlayById.get(Number(cat.id));
      if (!ct) return cat;
      const localised = { ...cat };
      for (const f of CATEGORY_PROSE_FIELDS) {
        const v = ct[f];
        if (typeof v === "string" && v.trim()) localised[f] = v;
      }
      return localised;
    });
  }

  return out;
}

function loadOverlay(lang) {
  if (lang === "en") return { tech: {}, catById: new Map() };
  const tech = readMergedDir(path.join(I18N, lang, "technologies"));
  const catsRaw = readJson(path.join(I18N, lang, "categories.json"), {}) || {};
  const catById = new Map();
  for (const [id, v] of Object.entries(catsRaw)) catById.set(Number(id), v || {});
  return { tech, catById };
}

// --- main -------------------------------------------------------------------

function main() {
  const outArgIdx = process.argv.indexOf("--out");
  const OUT = path.resolve(ROOT, outArgIdx > -1 ? process.argv[outArgIdx + 1] : "dist");

  const techRaw = readMergedDir(path.join(SRC, "technologies"));
  const catsRaw = readJson(path.join(SRC, "categories.json"), {}) || {};
  const names = Object.keys(techRaw);
  if (!names.length) {
    console.error("[build] no technologies found under src/technologies - aborting");
    process.exit(1);
  }

  const categoryRowById = new Map();
  for (const id of Object.keys(catsRaw)) categoryRowById.set(Number(id), buildCategoryRow(id, catsRaw));

  // Resolve every name to a slug; merge same-slug case variants onto one
  // record (prefer the more complete one, tie-break by name) so the published
  // file is deterministic regardless of corpus key order.
  const bySlug = new Map(); // slug -> { name, enrichment }
  const collisions = [];
  for (const name of names) {
    const slug = techSlug(name);
    const enrichment = buildEnrichment(name, techRaw[name] || {}, categoryRowById);
    const prev = bySlug.get(slug);
    if (!prev) { bySlug.set(slug, { name, enrichment }); continue; }
    collisions.push([slug, prev.name, name]);
    const score = (o) => Object.values(o).filter((v) => v != null && v !== "").length;
    const keep = score(enrichment) > score(prev.enrichment)
      || (score(enrichment) === score(prev.enrichment) && name.localeCompare(prev.name) < 0)
      ? { name, enrichment } : prev;
    bySlug.set(slug, keep);
  }

  rmrf(OUT);
  ensureDir(OUT);

  const index = { generatedAt: null, count: bySlug.size, langs: LANGS, technologies: [] };
  for (const [slug, { name }] of [...bySlug].sort((a, b) => a[0].localeCompare(b[0]))) {
    index.technologies.push({ name, slug });
  }

  let total = 0;
  for (const lang of LANGS) {
    const dir = path.join(OUT, lang);
    ensureDir(dir);
    const overlay = loadOverlay(lang);
    let written = 0;
    let translated = 0;
    for (const [slug, { enrichment }] of bySlug) {
      if (lang === "en") {
        writeJson(path.join(dir, `${slug}.json`), enrichment);
      } else {
        const localised = localise(enrichment, overlay.tech, overlay.catById);
        if (localised !== enrichment) {
          // cheap "did anything change" probe for reporting only
          if (TECH_PROSE_FIELDS.some((f) => localised[f] !== enrichment[f])) translated++;
        }
        writeJson(path.join(dir, `${slug}.json`), localised);
      }
      written++;
    }
    total += written;
    const note = lang === "en" ? "" : ` (${translated} with a German prose override)`;
    console.log(`[build] ${lang}: ${written} files${note}`);
  }

  writeJson(path.join(OUT, "index.json"), index);

  console.log(`[build] ${bySlug.size} technologies, ${categoryRowById.size} categories`);
  if (collisions.length) {
    console.log(`[build] ${collisions.length} case-variant slug merges (expected; consumers match case-insensitively):`);
    for (const [slug, a, b] of collisions.slice(0, 20)) console.log(`         ${slug}: "${a}" + "${b}"`);
  }
  console.log(`[build] wrote ${total} files + index.json to ${path.relative(ROOT, OUT)}/`);
}

main();
