# 4. Integrate with Dojo through its scroll protocol v0

Status: accepted · 2026-10-15

## Context
The course must run standalone and embedded as an iframe in Dojo, and follow the course contract shared with Pattern Circuit. Dojo publishes that contract as the scroll protocol v0 (`docs/scrolls/PROTOCOL.md`, ADR 026 and 027 in the Dojo repository). No shared npm package exists; the spec is the contract.

## Decision
A `HostBridge` port with two adapters. The standalone adapter is the default and sends nothing. The embedded adapter activates only when framed and given `?host=<origin>`; it implements `hello`/`init` with a nonce, carries the session on every message, posts only to the host origin, accepts only messages from that origin and the parent window that validate against Zod schemas, and falls back to standalone after 3 s. Units are chapters; `progress` and `complete` report them, with state capped at 64 KiB. The manifest (`scroll.json`) is generated from content. ADR evaluation uses a proposed `llm`/`llmResult` message pair, sent only if the host grants the `llm` capability, which Dojo currently reserves and never grants.

## Consequences
Today, embedded, the review board uses the deterministic rubric just like standalone; when Dojo implements `llm`, the sensei's notes appear without a course change, or with a small one if the final message shape differs. Progress reported to Dojo is self-reported and never feeds belts, as the protocol states.
