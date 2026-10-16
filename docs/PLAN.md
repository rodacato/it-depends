# It Depends: build plan

Half a page, as asked. Decisions behind it are in [docs/adr](adr/).

## Content and topology schema

Zod schemas in `src/engine/schema.ts` are the single source.

- **Company**: initial context (team, orders/day, runway, regulation), initial forces (relative 0–100), initial topology, background *drifts* (growth per quarter), seeded demand noise and the congestion rule. Each of those carries an assumption key and source ids.
- **Topology**: districts (module boundaries), components (`service | module | database | queue | vendor`, with load share and capacity) and connections (`road` = sync API, `rail` = queue, `pipe` = DB access). `add*` ops are upserts, so a chapter works whatever was built before it; the validator walks every reachable site.
- **Chapter** (one JSON file per sheet): quarter, time-lapse length, dilemma with 2–4 options, events (scheduled or threshold), site inspections, three review-board questions mapped to rubric criteria, read-next sources, optional context variants.
- **Option**: topology changes plus effects. **Effect**: target (force or context), delta, optional per-variant delta, timing `immediate | delayed(N) | conditional(eventId)`, anchor component, assumption key, ≥1 source id. An effect without an assumption or a source fails the build.
- **Text** never lives in content: every string is a key in `src/i18n/locales/<locale>/*.json`.

## Course manifest and HostBridge

Follows Dojo's scroll protocol v0 (`docs/scrolls/PROTOCOL.md` in Dojo). `scroll.json` is generated from the content: id, version, `protocol: 0`, entry, locales, titles and descriptions per locale, units = chapter ids with titles per locale, capabilities `progress` (required) and `llm` (optional, still reserved by Dojo).

`HostBridge` port, two adapters. **Standalone** (default): localStorage, sends nothing. **Embedded** (only when framed with `?host=<origin>`): `hello {scroll, nonce, capabilities}` → `init {nonce, session, locale, theme, progress, capabilities}`; then `progress` (unit started / completed + state ≤ 64 KiB), `complete` (unit or course), `error`; host sends `setLocale`, `setTheme`. Exact origin + parent-window + schema checks both ways; 3 s fallback to standalone. ADR evaluation is a proposed `llm` request/`llmResult` response, sent only if the host grants `llm`.

## Folders

`src/engine` pure simulation and queries (lint forbids DOM and UI imports) · `src/city` layout + PixiJS renderer, fed only engine-derived models · `src/content` company, sources, chapters as JSON + validator · `src/i18n` locales (one folder per locale, any number of files) · `src/host` manifest, protocol, bridges · `src/ui` React screens and vellum overlays · `scripts` content validation, i18n check, manifest · `e2e` Playwright · `docs/adr` decisions.

## Phases

1. **Vertical slice** (done): engine, Chapter 1 in EN/ES, city, preview, time-lapse, clouds, title block, gauges and tags, ADR + rubric, rewind side by side, persistence, HostBridge, Playwright.
2. **Campaign content**: Chapters 2–8 as data, cross-chapter events (Black Friday, a key engineer leaves, vendor price change, audit, licence) wired to earlier decisions through conditional and delayed effects.
3. **Depth**: semantic zoom (building opens into a section drawing of the service), finale case, end-of-campaign sheet set.
4. **Ship**: manifest build, CI (typecheck, lint, unit, i18n, content, e2e), GitHub Pages deploy with relative base, README with a time-lapse GIF.
