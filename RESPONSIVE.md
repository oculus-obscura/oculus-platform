# Oculus Obscura — Responsive & Resize Behavior

How the platform stays intact across screen sizes and while a desktop user drags the window bigger and smaller. Companion to `DESIGN.md` (tokens live there; this file is layout + resize logic). The hard problems here are **not** CSS — they're the animated 3D model, the SVG data-scenes, the game view, and the canvas charts. Those get most of this document.

## Principle: fluid first, break points second

Design so content *stretches and reflows continuously*, not so it snaps between a few fixed layouts. The type and space tokens in `DESIGN.md` already scale with `clamp()`, so most text and spacing adapt on their own with zero media queries. Breakpoints are for **structural** changes only (a two-column dashboard becoming one column), not for resizing text.

The failure mode to design against: a user drags the window narrower and something **overflows, clips, overlaps, or letterboxes wrong**. Every component should survive continuous resize from ~320px to ~2560px without a broken frame.

## Breakpoints (structural only)

Prefer **container queries** over viewport media queries wherever a component's layout depends on *its own* width, not the screen's — a dashboard panel should reflow based on the space it's in, so it works the same docked or full-width.

```css
:root {
  --bp-sm: 640px;   /* phone → large phone      */
  --bp-md: 768px;   /* tablet                    */
  --bp-lg: 1024px;  /* small laptop              */
  --bp-xl: 1280px;  /* desktop                   */
}
```

```css
/* container-query pattern (preferred) */
.panel { container-type: inline-size; }
@container (min-width: 480px) {
  .panel__grid { grid-template-columns: 1fr 1fr; }
}
```

## Layout primitives that don't break

Reach for intrinsic layout before media queries:

```css
/* auto-reflowing card grid — no breakpoints needed */
.auto-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr));
  gap: var(--space-5);
}

/* content column that never overflows on small screens */
.container {
  width: min(100% - 2 * var(--space-4), var(--container-max));
  margin-inline: auto;
}

/* prose measure caps line length but shrinks freely */
.prose { max-width: min(100%, var(--content-max)); }
```

- `min()` / `max()` / `clamp()` and `minmax(min(…, 100%), 1fr)` are how you stop overflow at narrow widths — the `min(…, 100%)` guard is what prevents a fixed min-column from blowing past the viewport.
- Use `flex-wrap: wrap` + `min-width: 0` on flex children (flex items refuse to shrink below content size without `min-width: 0` — this is the #1 cause of horizontal overflow).
- Never set fixed pixel `width`/`height` on layout containers. Fixed sizes belong only to the canvas/SVG stages below, and even those are handled by observers.

---

## The hard cases (this platform specifically)

### 1. The rotating 3D Oculus model (canvas / WebGL)

The single most resize-sensitive element. A raw WebGL canvas will stretch, blur, or clip on resize if you don't drive it from an observer.

- Watch the **container**, not `window`, with a `ResizeObserver`. On change, resize the drawing buffer to `clientWidth/Height × devicePixelRatio`, update the renderer, and **update the camera aspect ratio** (`camera.aspect = w/h; camera.updateProjectionMatrix()` in three.js). Skipping the camera update is what stretches the model.
- Account for **DPR** so it's sharp on Retina but doesn't render 4× pixels on a 4K panel (cap DPR at ~2). `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`.
- **Debounce** heavy resizes (a `requestAnimationFrame` gate or ~100ms debounce) so dragging the window doesn't thrash the GPU.
- Decide the model's behavior when the container aspect changes: **letterbox** (preserve aspect, bars top/bottom) or **cover** (fill, crop edges). Pick one intentionally — uncontrolled stretch is never acceptable. For a hero model, `cover` usually reads better; give it a min-height so it never collapses to a sliver.
- On very small screens, consider a **static rendered still** instead of live WebGL (perf + battery). Gate on width and/or `prefers-reduced-motion`.

```js
const ro = new ResizeObserver(([entry]) => {
  const { width, height } = entry.contentRect;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);   // false = don't touch CSS size
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
});
ro.observe(modelContainer);
```

### 2. SVG data-scenes (branching data-lines, converging train-lines, side-view game stage)

SVG is your friend here — it scales cleanly if you let it.

- Author every SVG with a **`viewBox`** and no hard-coded width/height; size the wrapper with CSS. It then scales to any container automatically.
- Set `preserveAspectRatio` deliberately: default `xMidYMid meet` keeps everything visible (letterbox); `slice` fills and crops. For the converging-train-lines opener you likely want `slice` so lines run off-edge; for annotated diagrams you want `meet` so no label gets cut.
- Keep **label/text sizes readable at small scale** — text inside an SVG shrinks with the viewBox, so past a point, either swap to HTML-overlaid labels positioned over the SVG, or bump a `font-size` via CSS at small container widths. Annotations that vanish at phone width defeat the diagram.
- The **branching annotation lines** pointing at the Oculus: anchor them in viewBox coordinates so they track the model as it scales, rather than absolute pixels.

### 3. The game view + train timer

- The **side-view interior** is an SVG/canvas stage: give it a fixed aspect via `aspect-ratio` on the wrapper and let it scale within that. Below a min width, allow horizontal reflow of the store cards rather than shrinking the stage into unreadability.
- The **train timer track** spans the top full-width. Its animation maps to *real time*, so on resize the train's *position* must be recomputed from `elapsed / duration`, **not** re-tweened from its current pixel spot — otherwise resizing mid-run visually jumps the train. Drive position as a percentage of track width, recalculated each frame or on resize.
- **Store cards / Monopoly cards:** cap width (`min(92vw, 420px)`), center, and let the floor of cards behind them reflow with `.auto-grid`. On phones the card is near-fullscreen; on desktop it floats.
- **Four primary choice buttons:** 2×2 grid on wide, single column stacked on narrow — one container query, nothing fancy.

### 4. Heatmap idle-time clips

- Wrap each clip in a fixed-`aspect-ratio` box and use `object-fit: cover` so the video fills without distorting. Never let raw `<video>` dimensions drive layout.
- Provide a poster frame so a slow load doesn't collapse the box height.

### 5. Dashboard charts (D3 / deck.gl / canvas)

- Charts must **redraw on container resize**, not just CSS-scale (scaling a canvas chart blurs it and mangles text). `ResizeObserver` on the chart container → recompute scales → re-render. Debounce ~100–150ms.
- Recompute D3 scale ranges from the new measured width/height each redraw; don't cache pixel ranges.
- At narrow widths, **thin the data density** rather than cramming: fewer ticks, rotated or dropped labels, direct labels over legends. A chart that's correct but unreadable at 360px is still broken.
- deck.gl / map layers: let the deck instance own its canvas sizing (it has its own resize handling) but still observe the container to trigger `deck.setProps` if you manage dimensions manually.

---

## Touch & input (even though desktop-first)

- Tap targets ≥ 44×44px (price chips, choice buttons, destination cards). The Monopoly price tags are the easiest to under-size — check them.
- Don't rely on `:hover` to reveal anything essential (the teal glow is fine as enhancement; a *required* action must be visible without hover). Provide `:active`/tap feedback.
- Hover-only affordances should have a tap/focus equivalent so the game is fully playable on a phone.

---

## Zoom & OS text scaling

- Size type in `rem`, not `px`, so browser zoom and OS font scaling work (the tokens already do this). Avoid `px` line-heights.
- Test at 200% browser zoom — WCAG expects reflow with no loss of content or horizontal scroll. The intrinsic-layout primitives above give you this mostly for free.

---

## Resize test checklist

Before calling any screen done, drag-resize it slowly across the full range and confirm none of these happen:

- [ ] Horizontal scrollbar appears at any width (usual culprit: a flex/grid child missing `min-width: 0`, or a fixed-px element).
- [ ] 3D model stretches, blurs, or letterboxes with uneven bars; camera aspect not updating.
- [ ] SVG labels clip, overlap, or shrink to illegible.
- [ ] Train timer jumps position when resized mid-run.
- [ ] A chart scales-and-blurs instead of redrawing; axis labels collide.
- [ ] Glass panels lose their background (no `backdrop-filter` fallback) and text becomes unreadable over the model.
- [ ] Modal/store card exceeds viewport height with no internal scroll.
- [ ] Anything jumps or reflows badly at the container-query thresholds.
- [ ] Tap targets fall below ~44px on the narrowest layout.
- [ ] Test at 200% zoom and in both portrait/landscape on a phone.

If all clear across a continuous drag from ~320px to your largest target, it's resize-safe.
