# 1. A deterministic simulation, no LLM inside

Status: accepted · 2026-10-15

## Context
The course teaches that trade-offs depend on context. If the outcome of a decision varied between runs, a learner could not tell a consequence from noise, could not rewind and compare, and a test could not pin behaviour down.

## Decision
The engine (`src/engine`) is a pure function of company content, chapter content, the decisions taken and a seed. It steps quarter by quarter and returns a timeline of snapshots (context, forces, topology, loads, applied effects, incidents, inspections, revisions). Randomness exists only as seeded, sourced demand noise. The renderer animates between snapshots and never computes outcomes. An LLM is used only to read a written ADR, through a capability the host may grant.

## Consequences
Same inputs give the same city, so rewind and side-by-side comparison are exact and every number on the sheet can be traced to an applied effect. Effects are coarse by design: the model shows direction and rough size, not measurements, and says so in the UI. Anything the model cannot express (a team's mood, a lucky hire) stays out of the numbers and goes into the prose.
