# Writing a chapter

A chapter is one JSON file in `src/content/chapters/` plus its text in every locale. The engine and UI never change. Read `src/engine/schema.ts` (the contract) and `src/content/chapters/01-reversibility.json` (the reference chapter) first.

## Files

- `src/content/chapters/0N-<id>.json`: the chapter data. No prose, only ids and text keys.
- `src/i18n/locales/en/ch0N-<id>.json` and `src/i18n/locales/es-MX/ch0N-<id>.json`: its text. Each locale folder may hold any number of files; they are merged. The two files must have exactly the same keys.

## Text keys the validator requires

Under `chapters.<id>`: `title`, `short` (one or two words, uppercase, for the sheet kicker), `concept`, `voice` (one dry line), `briefing` (two or three sentences), `dilemma` (the question), `disagreement` (where experts disagree, naming both sides), `readNext` (one or two sentences pointing at the sources), `options.<optionId>.title|optimizes|costs`, `events.<eventId>` (a site-log line), `inspections.<inspectionId>`, `review.<questionId>`, `rubric.<criterionId>`, `variants.<variantId>` if any.

Assumptions live under `assumptions.<chapterId>.<camelCaseKey>` and are referenced from each effect's `assumption`. New component lettering goes under `components.<componentId>.name|role`, new districts under `districts.<districtId>`. Rubric term lists (`terms.*`) are comma-separated; reuse `terms.context`, `terms.forces`, `terms.reversibility` or add `terms.<chapterId>.<name>`.

## Rules

- Options never imply a right answer. Each states what it **optimizes** and what it **costs**, in plain words. Every option must hurt somewhere.
- 3 options (4 only in the finale). Each option has 4–8 effects. Use all three timings across the chapter: at least one `delayed` effect and at least one `conditional` effect tied to a campaign event.
- Deltas on forces are relative (0–100 scale): small effects ±1–4, medium ±5–10, large ±12–25. Context effects: `runwayMonths` in months, `ordersPerDay` in orders, `teamSize` in people.
- Every effect: an assumption written as a falsifiable claim, and at least one source id from `src/content/sources.json`. Use `model` honestly when the number is ours. Paraphrase sources, never quote them.
- Topology ops must be valid on **every** site reachable from earlier chapters. `addDistrict`/`addComponent`/`addConnection` are upserts, so "ensure it exists" is always safe. `updateComponent` only on `mercadito-app` or `shared-postgres` (they always exist) or on something the same option adds first. Effect `anchor`s must name a component that the option adds or that always exists.
- Layout limits per district: 4 services/modules in `storefront` (2 elsewhere), 3 databases, 2 queues. At most 6 districts and 5 vendors in any run. Only use the ids below.
- Voice: dry, precise, a little wry, like margin notes from a senior architect. Real software names in labels. Spanish is Mexican Spanish, natural, not a word-for-word copy; keep technical terms people actually use (runway, rollback, lock-in, sharding).

## The campaign arc and its ids

Quarter 0 is Q1 of Year 1. `snapshots[q]` is the start of quarter q; a decision at quarter q shows from q+1. Always present: district `storefront`, `mercadito-app` (service), `shared-postgres` (database), road `public-api` from `clients`, pipe `app-db`.

| # | id | quarter → end | concept | component ids it may add | events it owns |
|---|---|---|---|---|---|
| 1 | `reversibility` | 0 → 2 | one-way / two-way doors | `hosted-checkout`, `card-processor`, `card-network` (vendors); `payments-module`; district `payments` with `payments-service`, `ledger-db`, `payment-events` | `processor-outage` (q2), `first-friday-rush` (orders ≥ 140) |
| 2 | `complexity` | 2 → 3 | essential vs accidental complexity | `pricing-engine` or `catalog-module` (modules in storefront); `catalog-saas` (vendor) | `seed-round` (q3, runway +18) |
| 3 | `technology` | 3 → 5 | innovation tokens, boring tech | `search-cluster` (database in storefront); district `discovery` with `discovery-service`, `graph-db` | `black-friday` (q4, orders up, monolith congests) |
| 4 | `services` | 5 → 6 | modular monolith vs services, Conway | `orders-module` (storefront); district `orders` with `orders-service`, `orders-queue`; district `catalog` with `catalog-service`, `notifications-service` | `key-engineer-leaves` (q6) |
| 5 | `data` | 6 → 8 | shared DB vs DB per service, consistency vs availability | `postgres-replica` (storefront database); in district `orders`: `orders-db`, `domain-events` (queue), `tx-coordinator` (service) | `series-a` (q7, runway +24), `reservoir-dry` (orders ≥ 2600) |
| 6 | `build-vs-buy` | 8 → 9 | build vs buy | district `risk` with `fraud-service`, `risk-db`, `fraud-rules` (module); `fraud-vendor` (vendor) | `vendor-price-change` (q9), `audit-requirement` (q9, regulation → audited) |
| 7 | `tech-debt` | 9 → 11 | deliberate debt with a repayment plan | none required; may `updateComponent` `mercadito-app` | `colombia-launch` (q10), `regulator-licence` (q11, regulation → licensed) |
| 8 | `finale` | 11 → 12 | an open case, full ADR | district `payments` again (upserts), `payments-service`, `ledger-db`; no new vendors | `series-b` (q12, runway +24) |

An event never fires before the quarter after its own chapter's decision, even when its threshold is met earlier, so the chapter's conditional effects always get the chance to react. A scheduled event at or before its chapter's quarter fails validation.

Cross-chapter consequences to wire in (conditional effects on earlier options reacting to later events) are part of each chapter's events: when you own an event, mention in your report which earlier options should react to it, and the integrator adds those conditionals.

## Checking your work

```bash
npm run validate:content -- --lenient
```

```bash
npm run check:i18n
```

```bash
npm test
```
