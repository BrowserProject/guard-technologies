# i18n - translation overlays

Localised prose for the published technology records. Each language is an
**overlay**: it carries only the translatable text fields, keyed by the exact
technology name (or category id). The build (`scripts/build.mjs`) lays each
overlay on top of the English record and falls back to English for anything the
overlay does not provide, so a published file is never partially blank.

```
i18n/
  de/
    technologies/   a.json .. z.json (+ _.json), mirroring src/technologies/
                    { "<technology name>": { description, history, summary_abuse } }
    categories.json { "<category id>": { description, summary_security, summary_privacy } }
```

Only these fields are translatable (everything else: scores, enums, vendor
facts, dates, is locale-independent and rendered by the frontend's own message
catalogue):

- **technology**: `description`, `history`, `summary_abuse`
- **category**: `description`, `summary_security`, `summary_privacy`

English (`src/`) is the source of truth. To add or extend a translation, follow
[`../AGENTS.md`](../AGENTS.md). German is not written yet; the `de/` overlay is
empty, so `de/<slug>.json` is currently identical to `en/<slug>.json`.
