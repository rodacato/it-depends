# 3. PixiJS for the city, React and SVG for everything with words

Status: accepted · 2026-10-15

## Context
The time-lapse needs thousands of moving traffic particles and linework redrawn every frame at 60 fps. Labels, vellum overlays, forms and the title block need crisp text, accessibility and test selectors.

## Decision
The city is drawn by `CityRenderer` (PixiJS 8, WebGL) from `CityModel`s produced by a pure layout function. Traffic uses a `ParticleContainer` pool capped at 3,000 that sheds particles when frames drop and wins them back when there is headroom. Everything with text (component lettering, gauges, title block, vellum panels, tags) is SVG or HTML in the same 1440×900 sheet coordinate space, so overlays line up with the canvas at any scale. Framer Motion animates only overlays.

## Consequences
Labels are selectable, translatable and testable, and the canvas never renders text. Two sheets can run side by side (two renderers) for the rewind view. If WebGL is unavailable the sheet says so in the drafting voice and the rest of the course keeps working.
