# guard-technologies

The enrichment layer for [guard.ch](https://guard.ch) technology detection.

This repository holds the **advanced metadata** for the technologies that the
`chrome_guard` session-replay capture detects: trust / privacy / abuse scoring,
vendor and ownership facts, compliance posture, pricing model, popularity, and
prose summaries. It is the source of truth for that data, migrated out of the
`guard_v6` Postgres database so it can be version-controlled, reviewed, and
baked directly into the capture container.

## Relationship to webdetector

Detection is split across two repositories, joined by the technology name and
the category id:

| Repository | Holds | Used for |
|------------|-------|----------|
| [`BrowserProject/webdetector`](https://github.com/BrowserProject/webdetector) | Wappalyzer fingerprints + the basic webappanalyzer fields (`name`, `description`, `icon`, `cpe`, `oss`, `saas`, `pricing`, `cats`, `implies`, `requires`, `requiresCategory`, `excludes`, `website`; category `name` / `priority` / `groups`) | Detecting which technologies are present |
| **`guard-technologies`** (this repo) | Everything beyond those basic fields: scores, company facts, compliance, summaries, etc. | Explaining/scoring what was detected |

**There is no duplication.** Any field that already exists in webdetector is
intentionally absent here. If you need a technology's description or icon, read
it from webdetector; this repo only adds what webdetector does not have.

## Layout

```
src/
  technologies/        one file per first letter (a.json .. z.json, _.json for non-alpha)
                       { "<webappanalyzer tech name>": { ...enrichment... } }
  categories.json      { "<webappanalyzer category id>": { ...enrichment... } }
schema.json            JSON Schema for both record shapes (technology + category)
scripts/validate.py    structure / ordering / schema validator (run in CI)
```

- Technology records are keyed by the **exact** webappanalyzer technology name
  (case-sensitive key, matched case-insensitively by consumers).
- Category records are keyed by the **webappanalyzer category id** (string).
- Within each file, keys are sorted alphabetically (case-insensitive); within
  each record, fields are sorted alphabetically.
- Absent data is omitted rather than written as `null`.

## Field reference

### Technology (`src/technologies/*.json`)

Scores are integers `0-10`.

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
| `description` | string | |
| `placement` | enum | `client` / `server` / `mixed` / `infrastructure` |
| `business_function` | enum | `analytics` / `commerce` / `communication` / `content` / `developer-tool` / `identity` / `infrastructure` / `media` / `payment` / `productivity` / `security` |
| `inherent_attack_surface_score`, `inherent_privacy_risk_score`, `inherent_third_party_data_sharing_score`, `inherent_pii_exposure_score`, `tracker_likelihood_score` | score | inherent risk for the category |
| `regulatory_relevance` | string[] | `gdpr` / `ccpa` / `pci-dss` / `hipaa` / `coppa` / `ferpa` / `glba` / `soc2` / `cookie-law` / `pii-handling` |
| `recommended_scrutiny_level` | enum | `low` / `moderate` / `high` / `critical` |
| `summary_security`, `summary_privacy` | string | |
| `confidence` | score | |
| `source_urls` | string[] | |

## Editing

1. Edit the relevant `src/technologies/<letter>.json` or `src/categories.json`.
2. Keep keys alphabetical (both the tech-name keys and the fields within a record).
3. Run the validator: `python3 scripts/validate.py` (needs `pip install jsonschema`).
4. Open a PR. CI runs the same validator.
