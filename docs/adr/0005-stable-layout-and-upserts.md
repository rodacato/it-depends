# 5. Stable city layout and order-independent topology changes

Status: accepted · 2026-10-15

## Context
Revision clouds only read if nothing moves except what changed. Chapters are authored independently, but each one runs on whatever site the learner's earlier choices produced.

## Decision
Layout assigns districts, pads, reservoirs and vendor lots by first appearance across the run being viewed (and across both runs in the rewind view), so a building keeps its lot when something else is added or removed. Topology `add*` operations are upserts that keep list order; `update*` fails on a missing component. The content validator applies every option to every reachable topology.

## Consequences
Cities from different decisions align lot for lot in the side-by-side view. Authors write "ensure this exists" rather than "add this", and must only anchor effects to components the option itself adds or that always exist.
