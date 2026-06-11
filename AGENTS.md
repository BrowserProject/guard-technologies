# AGENTS.md - guard-technologies

This repo is the source of truth for [guard.ch](https://guard.ch) technology
detection and enrichment. It serves two layers (see [`README.md`](README.md)):
the webappanalyzer fingerprints used to detect technologies, and the guard.ch
enrichment used to explain and score them.

`scripts/build.mjs` compiles the corpus into one JSON file per technology per
language and publishes them to a public bucket; the guard.ch `/replay` page
fetches `<bucket>/<lang>/<techSlug(name)>.json` at render time and renders it.
This is how the replay report stays localised without re-capturing sessions.

Most of this file is about the **one job you are most likely here to do:
writing translations.**

## Translating the corpus

The English enrichment lives in `src/` and is the source of truth. A
translation is an **overlay** under `i18n/<lang>/` that carries only the
translatable prose, keyed by the exact technology name / category id. The build
lays the overlay over the English record and **falls back to English** for
anything you have not translated, so partial progress always ships safely and no
field is ever blank.

Today only `i18n/de/` (German) exists and it is empty. Filling it is the task.

### What to translate

Translate ONLY these free-prose fields. Everything else (scores, enums,
booleans, dates, vendor facts, license ids, pricing tags) is locale-independent
and is rendered by the frontend's own message catalogue, so leave it alone.

| Record | Fields |
|--------|--------|
| technology (`src/technologies/*.json`) | `description`, `history`, `summary_abuse` |
| category (`src/categories.json`)       | `description` |

### Where the German goes

Mirror the source layout. Key technologies by their **exact** name (the same
key as in `src/technologies/`), categories by their **id** string.

```
i18n/de/
  technologies/
    a.json    { "<technology name>": { "description": "...", "history": "...", "summary_abuse": "..." } }
    b.json
    ...                                   (one file per first letter, like src/technologies/)
  categories.json
            { "<category id>": { "description": "..." } }
```

Include only the fields you actually translated for a given record; omit the
rest (they fall back to English). A field you leave out, leave empty, or set to
whitespace is treated as "not translated" and falls back. Never invent content:
if the English `history` is absent for a technology, there is nothing to
translate there.

### House style (guard.ch German)

This is non-negotiable and differs from generic machine translation:

- **du-form**, never Sie.
- Write **from scratch against the English meaning**, not sentence-by-sentence
  mirroring. Read the English, understand what it says about the technology,
  then write the natural German a Swiss reader would expect. Reorder, merge, or
  split sentences as German wants.
- **Swiss spelling**: `ss`, never `ß`.
- The brand is always **Guard.ch** (never "guard.ch session"; a recorded
  session is an *Untersuchung* / investigation, not a "Guard-Session").
- **No em dashes** anywhere (`-`, comma, colon, or parentheses instead). This is
  a hard rule across the whole project.
- Keep proper nouns, product names, protocol names, and standards in their
  original form (React, OAuth, GDPR, TLS). Translate the prose around them.
- Match the register of the English: factual and concise for `description`,
  narrative for `history`, risk-focused and sober for `summary_abuse`.

### How to work

1. Pick a tractable batch. Good first batches: the technologies most users
   actually hit, i.e. records with `popularity_tier` of `dominant` or
   `mainstream`, and all 108 categories (small, high-leverage, shown on almost
   every report). You can also just go letter by letter.
2. For each record, read the English fields from `src/`, write the German into
   the matching `i18n/de/` file. Do not edit `src/` (that is the English source
   of truth).
3. Keep the JSON tidy: keys sorted, UTF-8, two-space indent, no trailing commas.
4. Build and eyeball the result:
   ```bash
   node scripts/build.mjs
   # the report prints "de: N files (M with a German prose override)"
   cat dist/de/<slug>.json   # confirm your prose landed, English fell back elsewhere
   ```
   `techSlug(name)` is defined in `scripts/slug.mjs`; for most names it is just
   the lowercased name with non-alphanumeric runs turned into `-`
   (`Google Analytics` -> `google-analytics`).
5. Commit the `i18n/de/` files only (`dist/` is generated and gitignored). The
   Publish workflow rebuilds and syncs the bucket on merge to `main`.

### Adding another language

Add the two-letter code to `LANGS` in `scripts/build.mjs`, create
`i18n/<lang>/` with the same layout, and the build will emit `<lang>/<slug>.json`
(English fallback until translated). Add the language to the frontend's locale
list so it requests that path.

## Editing detection / enrichment (not translation)

If you are changing the English corpus itself (fingerprints, scores, prose),
see [`README.md`](README.md) for the field reference and ordering rules, and run
`python3 scripts/validate.py` before committing. The enrichment shape emitted by
`scripts/build.mjs` must stay byte-compatible with the consumer
(`browser_webrtc/.../chrome_guard/techlookup.js` in the `browser` repo, and the
`GuardTechEnrichment` type in `frontend_guard`); if you change the shape, update
all three together.

## Project-wide rules

- **No em dashes** (`-`, U+2014) anywhere: prose, JSON, comments, commit
  messages. Use `-`, a comma, a colon, or parentheses.
- Do not run `git push` or `docker push`; open a PR / let CI publish.
