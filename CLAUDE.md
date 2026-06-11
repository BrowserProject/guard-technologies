# CLAUDE.md

See [`AGENTS.md`](AGENTS.md) for how to work in this repo. It covers the
translation workflow (the most common task here), the corpus field reference
pointer, and the project-wide rules.

Quick reference:

- **Translating the corpus** (e.g. German): edit overlays under `i18n/<lang>/`,
  never `src/`. Only the prose fields are translatable. See
  [`AGENTS.md`](AGENTS.md#translating-the-corpus) and
  [`i18n/README.md`](i18n/README.md).
- **Editing detection / enrichment**: see [`README.md`](README.md) and run
  `python3 scripts/validate.py`.
- **Build / publish**: `node scripts/build.mjs` compiles `dist/`; the Publish
  workflow syncs it to the public bucket on merge to `main`.
- **No em dashes** anywhere. Do not `git push` / `docker push`.
