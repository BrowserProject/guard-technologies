# guard-technologies

The source of truth for [guard.ch](https://guard.ch) technology detection.

This repository holds **both** layers of the detection corpus in one place:

- the **webappanalyzer / Wappalyzer fingerprint and basic fields** used to detect
  which technologies are present (`cats`, `website`, `icon`, `js`, `dom`,
  `scriptSrc`, `description`, `pricing`, …), and
- the **guard.ch enrichment layer** used to explain and score what was detected:
  trust / privacy / abuse scoring, vendor and ownership facts, compliance
  posture, pricing model, popularity, and prose summaries.

Each technology record carries both kinds of fields. The data is consumed by the
`chrome_guard` session-replay capture and baked directly into the capture
container.

> **History:** detection used to be split across two repositories: fingerprints
> in [`BrowserProject/webdetector`](https://github.com/BrowserProject/webdetector)
> and enrichment here, joined by technology name and category id. Those have
> been **consolidated into this repository**, which is now the single source of
> truth; `webdetector` is being retired.

## Layout

```
src/
  technologies/        one file per first letter (a.json .. z.json, _.json for non-alpha)
                       { "<technology name>": { ...fingerprint + enrichment... } }
  categories.json      { "<category id>": { ...fingerprint + enrichment... } }
  groups.json          { "<group id>": { "name": ... } }   category groupings
  images/icons/        technology icons (<name>.svg / <name>.png), referenced by `icon`
i18n/
  de/                  German prose overlay (description / history / summaries only);
                       same layout as src/, English fallback for anything untranslated
schema.json            JSON Schema for technology / category / group records
scripts/validate.py    structure / ordering / schema / referential validator (run in CI)
scripts/build.mjs      compile src/ (+ i18n overlays) into dist/<lang>/<slug>.json
scripts/slug.mjs       canonical technology-name -> file/URL slug (shared with the frontend)
```

- Technology records are keyed by the **exact** technology name (case-sensitive
  key, matched case-insensitively by consumers).
- Category and group records are keyed by their integer **id** (as a string).
- Within each file, keys are sorted alphabetically (case-insensitive); within
  each record, fields are sorted alphabetically.
- Absent data is omitted rather than written as `null`.

## Field reference

### Technology (`src/technologies/*.json`)

Scores are integers `0-10`.

#### Detection / basic fields (webappanalyzer)

| Field | Type | Notes |
|-------|------|-------|
| `cats` | number[] | category ids (required); must exist in `categories.json` |
| `website` | string | vendor/project site (required) |
| `description` | string | short description (≤ 550 chars) |
| `icon` | string | filename in `src/images/icons/` (e.g. `Playwire.png`) |
| `cpe` | string | CPE 2.3 identifier |
| `oss`, `saas` | boolean | |
| `pricing` | string[] | `low` / `mid` / `high` / `freemium` / `poa` / `payg` / `onetime` / `recurring` |
| `implies`, `requires`, `excludes` | string[] | relationships to other technologies |
| `requiresCategory` | number[] | required category ids |
| `cookies`, `headers`, `meta`, `dns`, `js`, `dom`, `probe` | object | fingerprint patterns |
| `scriptSrc`, `scripts`, `url`, `xhr`, `html`, `text`, `css`, `robots` | string[] | fingerprint patterns |
| `certIssuer` | string | TLS certificate issuer pattern |

#### Enrichment fields (guard.ch)

| Field | Type | Notes |
|-------|------|-------|
| `kind` | enum | `language` / `standard` / `protocol` / `oss-library` / `oss-project` / `commercial-saas` / `commercial-product` / `infrastructure` |
| `technical_depth_score`, `privacy_score`, `vendor_stability_score`, `overall_trust_score` | score | core trust signals |
| `abuse_score`, `ai_generated_likelihood`, `white_label_wrapper_likelihood`, `dark_pattern_likelihood` | score | risk signals |
| `pricing_transparency_score` | score | |
| `confidence` | score | rater confidence; re-rate rows where this is low |
| `founded_year` | integer | |
| `headquarters_country` | string | ISO 3166-1 alpha-2 |
| `company_size_bucket` | enum | `solo` / `startup` / `smb` / `midmarket` / `enterprise` / `mega` |
| `parent_company` | string | |
| `ownership_type` | enum | `foundation` / `independent` / `public` / `subsidiary` / `vc-backed` |
| `license_type` | string | SPDX-ish; casing not normalized |
| `maintenance_status` | enum | `active` / `maintained` / `dormant` / `deprecated` / `abandoned` |
| `pricing_model` | enum | `free` / `freemium` / `subscription` / `usage-based` / `one-time` / `dual-license` / `enterprise-only` |
| `has_free_tier`, `has_self_hosted_option`, `enterprise_pricing_only` | boolean | |
| `starting_price_usd_monthly` | number | `>= 0` |
| `soc2_type2`, `iso27001`, `gdpr_compliant`, `hipaa_compliant`, `pci_dss`, `has_bug_bounty`, `has_responsible_disclosure_policy` | boolean | compliance posture |
| `tracker_density` | enum | `none` / `light` / `moderate` / `heavy` |
| `popularity_tier` | enum | `niche` / `growing` / `mainstream` / `dominant` |
| `enterprise_adoption` | enum | `none` / `limited` / `common` / `widespread` |
| `summary_abuse`, `history` | string | prose |
| `source_urls` | string[] | |

### Category (`src/categories.json`)

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | category display name (webappanalyzer) |
| `priority` | integer | webappanalyzer ordering priority |
| `groups` | number[] | group ids; must exist in `groups.json` |
| `description` | string | |
| `placement` | enum | `client` / `server` / `mixed` / `infrastructure` |
| `business_function` | enum | `analytics` / `commerce` / `communication` / `content` / `developer-tool` / `identity` / `infrastructure` / `media` / `payment` / `productivity` / `security` |
| `inherent_attack_surface_score`, `inherent_privacy_risk_score`, `inherent_third_party_data_sharing_score`, `inherent_pii_exposure_score`, `tracker_likelihood_score` | score | inherent risk for the category |
| `regulatory_relevance` | string[] | `gdpr` / `ccpa` / `pci-dss` / `hipaa` / `coppa` / `ferpa` / `glba` / `soc2` / `cookie-law` / `pii-handling` |
| `recommended_scrutiny_level` | enum | `low` / `moderate` / `high` / `critical` |
| `confidence` | score | |
| `source_urls` | string[] | |

### Group (`src/groups.json`)

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | group display name |

## Distribution: build and publish

`scripts/build.mjs` compiles the corpus into one small JSON file per technology
per language and the [`Publish`](.github/workflows/publish.yml) workflow syncs
them to a public Hetzner Object Storage bucket on merge to `main`:

```
dist/
  en/<slug>.json      one enrichment record per technology (English)
  de/<slug>.json      same record, German prose where translated, English fallback
  index.json          { count, langs, technologies:[{ name, slug }] }
```

The guard.ch `/replay` page builds the URL from a detected technology name and
fetches the record in the active locale at render time:

```
<endpoint>/<bucket>/<lang>/<techSlug(name)>.json
e.g. https://hel1.your-objectstorage.com/guard-technologies/de/cloudflare.json
```

`techSlug()` (in `scripts/slug.mjs`) is the single source of truth for that
mapping and is re-implemented verbatim in the frontend so no index lookup is
needed. Each `en/<slug>.json` is byte-compatible with the enrichment object the
`chrome_guard` capture used to bake into `metadata.json` (the
`GuardTechEnrichment` shape), so moving enrichment out of the session metadata
and fetching it live is a drop-in: it also lets the corpus be corrected and
localised without re-capturing sessions.

Run it locally with `node scripts/build.mjs` (Node >= 18, no dependencies); the
workflow needs the `GUARD_TECH_S3_ACCESS_KEY` / `GUARD_TECH_S3_SECRET_KEY`
secrets (endpoint / bucket / region default to Hetzner `hel1` /
`guard-technologies`).

## Localisation

Translations live under `i18n/<lang>/` as prose-only overlays and are merged
over English by the build, with English fallback for anything untranslated.
German (`i18n/de/`) is scaffolded but not yet written. The full translation
workflow and house style are in [`AGENTS.md`](AGENTS.md) and
[`i18n/README.md`](i18n/README.md).

## Editing

1. Edit the relevant `src/technologies/<letter>.json`, `src/categories.json`, or
   `src/groups.json`. To add or change an icon, drop the file in
   `src/images/icons/` and set the record's `icon` to its filename.
2. Keep keys alphabetical (both the tech-name keys and the fields within a record).
3. Run the validator: `python3 scripts/validate.py` (needs `pip install jsonschema`).
4. Open a PR. CI runs the same validator.
