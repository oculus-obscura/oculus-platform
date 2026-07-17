# CLAUDE.md

Auto-loaded context for Claude Code. Keep this file short and high-signal — it's read every session. Detailed specs live in the referenced files; this file points to them and hoists the rules that must never be forgotten.

## What we're building

**Oculus Obscura** — a web platform about the Oculus / Westfield WTC transit hub. The hub is publicly owned (Port Authority, ~$4B federal money) but privately programmed as luxury retail by Unibail-Rodamco-Westfield, and its commercial data (foot traffic, retail performance, vacancy, spending) is withheld. The platform surfaces that missing data through two linked parts:

1. **Dashboard** — visualizes existing flow data (MTA ridership / turnstile, PATH, ACS income) as the Oculus's "activation field."
2. **Simulation game** — a commuter gets 15 min (5 real min) and makes retail choices; every choice generates a counter-dataset that feeds back into the dashboard.

The platform is an argument, not a product. It sits at the research/diagnosis stage and aims its evidence at URW and the Port Authority. Deadline-driven, 3-person student team.

## Read these before touching UI

- **`DESIGN.md`** — the visual system: color, type, tokens, glass surfaces, motion, and the data-visualization conventions. Pull values from its tokens; do not invent colors, type sizes, or spacing.
- **`RESPONSIVE.md`** — fluid layout and resize resilience, especially the hard cases (3D model, SVG scenes, game view, canvas charts).

If a task involves any visual output, load the relevant file and follow it. When something isn't covered, ask rather than guessing a new value.

## Non-negotiable rules (the ones that break the project if ignored)

1. **Two color worlds, never mixed.** The shell (nav, buttons, model, game UI, all chrome) is calm **teal-monochrome on near-black**. The three vivid data colors — **teal = measured/existing, amber = uncertain/edge, plum = missing/interior void** — appear *only inside visualizations*. A color popping outside a chart is a bug.
2. **Data color = meaning.** Every data mark's color states its epistemic status. Pick chart colors by what the data *is*, never by aesthetics.
3. **Always distinguish interpolated from measured.** Interpolated/proxied data renders dim + dashed/hatched; measured renders bright + solid. Representing a guess as a solid measured value undercuts the whole thesis. Non-optional.
4. **Reference semantic tokens, not raw primitives.** Components use `--color-*` / `--data-*` roles; only the semantic layer touches raw hex. This is what keeps retheming to one place.
5. **Never:** neon / cyberpunk glow, oversaturated cyan, gaming-style visuals, hard-edged gradients, drop-shadow elevation (use surface tint + hairline + glow), or faking Michroma bold via font-weight (it's 400 only).
6. **Quality floor, always:** visible `:focus-visible` rings, `prefers-reduced-motion` respected (the train timer still runs — it's function, not decoration), and a non-blur fallback background on every glass panel.

## Fonts

Michroma (display / H1–H2 only — it's 400-weight, sized big) + Space Grotesk (everything else, tabular figures on for numeric readouts). Loaded from Google Fonts; see `DESIGN.md` for the import.

## Tech stack

- Build: Vite + React + TypeScript (strict)
- 3D: three.js  |  Charts: D3  |  Maps/flow: deck.gl
- Backend/data: Supabase (`@supabase/supabase-js`) — env vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (see `.env.example`; real `.env` is gitignored)
- Styling: plain CSS + CSS custom properties (no Tailwind — design tokens are CSS variables per `DESIGN.md`)
- Package manager: npm

## Working conventions

- Run dev: `npm run dev`  |  Build: `npm run build`  |  Typecheck: `npm run typecheck`  |  Preview build: `npm run preview`
- Source in `/src`; app entry `src/main.tsx` → `src/App.tsx`
- Styles in `src/styles/`: `index.css` imports `tokens.css` (primitives → semantic, from `DESIGN.md`), then `base.css` (reset + element/a11y defaults), then `utilities.css` (`.glass`, `.elev-*`, layout primitives from `RESPONSIVE.md`). Design tokens live in `src/styles/tokens.css`.
- Never commit secrets: `.env` is gitignored; keep `.env.example` in sync when adding `VITE_` vars.
- Prefer small, reviewable changes; don't refactor unrelated code in a task.
