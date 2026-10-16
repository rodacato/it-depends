# 2. Content as data, text as locale keys, validated at build time

Status: accepted · 2026-10-15

## Context
The brief asks that adding a chapter is adding a content file, that every visible string is translatable, and that an effect without an assumption or source fails the build.

## Decision
Company, sources and chapters are JSON files validated by the Zod schemas in `src/engine/schema.ts`. Content holds stable English ids and text keys, never prose. `scripts/validate-content.ts` (run before every build and in CI) checks the schema, that every source id exists, that every assumption and every chapter string exists in every locale, that anchors, events and variants referenced by effects exist, and that every option is valid on every site reachable from earlier choices. `scripts/check-i18n.ts` fails on missing, extra, empty or placeholder-mismatched keys.

## Consequences
Chapters can be written without touching the engine or the UI. Topology `add*` operations are upserts so later chapters do not depend on which earlier option was taken (see ADR 5). The cost is a two-step authoring loop (JSON plus locale files), eased by the validator naming each missing key.
