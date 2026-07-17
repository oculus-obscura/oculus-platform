# Oculus Obscura — Design System

Single source of truth for the visual language. If you're generating or editing UI, read this first and pull values from the tokens below rather than inventing them. Companion file: `RESPONSIVE.md` (fluid layout + resize behavior).

## The one idea to hold onto

There are **two color worlds** and they must not bleed into each other.

1. **Shell** — the frame of the whole site: opening animation, the rotating 3D model, nav, buttons, modals, the game UI. This is a calm, premium, Apple-glass **teal monochrome** on near-black. It stays quiet ~90% of the time.
2. **Data encoding** — three **vivid, high-visibility** channels that appear *only inside visualizations* (dashboard, output screen, mismatch view, heatmaps). Each channel is a fixed meaning, not decoration:
   - **teal = measured / existing** (data we have)
   - **amber = uncertain / edge** (proxied, interpolated, contested — e.g. tourist-vs-commuter)
   - **plum/magenta = missing / interior void** (the withheld commercial data the game invents)

The shell is restrained *so that* when amber and plum show up, they read as meaning. Never use a data-encoding color for shell chrome, and never render decorative UI in amber or plum. If a color is popping and it isn't inside a chart, that's a bug.

---

## Token architecture (this is your flexibility mechanism)

Three tiers. Components should reference **semantic** tokens, never raw primitives. To retheme, change the primitive or the mapping — components don't move.

```
primitive   raw values         --tp-teal-500: #1A8787
   ↓
semantic    roles              --color-accent: var(--tp-teal-500)
   ↓
component   local (optional)   --btn-bg: var(--color-accent)
```

Rule of thumb: **prose and layout reference semantic tokens; only the semantic layer references primitives.** That keeps swaps to one place.

---

## Primitives

Drop this block into your global stylesheet (`:root`). These are raw values — don't reference them directly from components.

```css
:root {
  /* ---- SHELL PALETTE (from brand spec) ---- */
  --tp-space-black:      #0A0A0A;  /* primary background */
  --tp-smoked-titanium:  #505556;  /* smoked glass / metallic surfaces */
  --tp-titanium-pearl:   #E8E8E3;  /* primary light / structural ribs */
  --tp-teal-500:         #1A8787;  /* signature accent */

  /* shell surface tints (lifted planes on black — see Elevation) */
  --tp-surface-1:        #111314;
  --tp-surface-2:        #16191A;
  --tp-surface-3:        #1C2021;

  /* flurry gradient stops (ambient motion, glow, particles) */
  --tp-flurry-1: #0B4546;
  --tp-flurry-2: #1A8787;
  --tp-flurry-3: #3CCFCF;
  --tp-flurry-4: #8DE8E0;

  /* ---- DATA ENCODING PALETTE (vivid, viz-only) ---- */
  /* Tuned to pop on Space Black. These are meant to be loud. */
  --tp-data-teal:   #2CE0D2;  /* MEASURED / existing        */
  --tp-data-amber:  #FFB020;  /* UNCERTAIN / edge           */
  --tp-data-plum:   #E24FD1;  /* MISSING / interior void    */

  /* dim companions — for interpolated / secondary series
     (measured-dim intentionally = shell teal, so "solid bright vs
     dim" reads as "measured vs interpolated") */
  --tp-data-teal-dim:  #1A8787;
  --tp-data-amber-dim: #8A6412;
  --tp-data-plum-dim:  #7A2B72;

  /* optional extra categorical hues when a chart needs >3 series
     (harmonized to the world; use sparingly, after the 3 above) */
  --tp-data-blue:  #4D9DFF;
  --tp-data-green: #4DE08A;

  /* heat ramp for idle-time clips (low → high). Cross-hue so heat
     literally reads as "cooler = calm, hotter = alert". */
  --tp-heat-0: #0B4546;
  --tp-heat-1: #1A8787;
  --tp-heat-2: #3CCFCF;
  --tp-heat-3: #FFB020;
  --tp-heat-4: #E24FD1;
}
```

Alt heat ramp if you want the idle clips calmer/more restrained — single-hue teal, no amber/plum: `#08302F → #0B4546 → #1A8787 → #3CCFCF → #8DE8E0`. Pick one per surface; don't mix on the same clip.

---

## Semantic tokens

This is the layer components actually use. Reassign these to retheme.

```css
:root {
  /* backgrounds & surfaces */
  --color-bg:            var(--tp-space-black);
  --color-surface-1:     var(--tp-surface-1);
  --color-surface-2:     var(--tp-surface-2);
  --color-surface-3:     var(--tp-surface-3);

  /* text */
  --color-text:          var(--tp-titanium-pearl);
  --color-text-muted:    #9DA3A3;   /* pearl dimmed for secondary copy */
  --color-text-faint:    #6B7070;   /* captions, disabled labels       */

  /* accent (shell) */
  --color-accent:        var(--tp-teal-500);
  --color-accent-hover:  #23A3A3;
  --color-on-accent:     var(--tp-space-black);

  /* lines & borders */
  --color-border:        rgba(232, 232, 227, 0.12); /* titanium hairline */
  --color-border-strong: rgba(232, 232, 227, 0.22);
  --color-divider:       rgba(232, 232, 227, 0.08);

  /* data channels (semantic names — use THESE in charts) */
  --data-measured:       var(--tp-data-teal);
  --data-edge:           var(--tp-data-amber);
  --data-missing:        var(--tp-data-plum);
  --data-measured-2:     var(--tp-data-teal-dim);
  --data-edge-2:         var(--tp-data-amber-dim);
  --data-missing-2:      var(--tp-data-plum-dim);

  /* feedback (keep subtle; don't collide with data channels) */
  --color-success:       var(--tp-data-green);
  --color-warning:       var(--tp-data-amber);
  --color-danger:        #FF5C6C;

  /* focus ring */
  --color-focus:         var(--tp-data-teal);
}
```

---

## Typography

Two families, both Google Fonts. **Michroma** for display only — it's wide and heavy, it dies at small sizes. **Space Grotesk** for everything else, including all data labels and numbers (turn on tabular figures so numeric readouts don't jitter).

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Michroma&family=Space+Grotesk:wght@400;500;600&display=swap" rel="stylesheet">
```

```css
:root {
  --font-display: "Michroma", system-ui, sans-serif;
  --font-body:    "Space Grotesk", system-ui, sans-serif;

  /* fluid type — scales 360px → 1440px viewport, then clamps.
     H1/H2 use --font-display; everything else --font-body. */
  --fs-display: clamp(2.5rem, 1.35rem + 5.1vw, 7.5rem);  /* 40 → 120 */
  --fs-h2:      clamp(2rem,   1.55rem + 2.0vw, 3.5rem);   /* 32 → 56  */
  --fs-h3:      clamp(1.25rem, 1.1rem + 0.67vw, 1.75rem); /* 20 → 28  */
  --fs-body-lg: clamp(1.125rem, 1.08rem + 0.2vw, 1.25rem);/* 18 → 20  */
  --fs-body:    1rem;                                     /* 16       */
  --fs-caption: 0.8125rem;                                /* 13       */

  /* letter-spacing (brand spec) */
  --ls-display: 0.14em;
  --ls-h2:      0.10em;
  --ls-body:    0.02em;

  /* line-height */
  --lh-display: 1.05;
  --lh-h2:      1.25;
  --lh-body:    1.6;
}

h1, .display {
  font-family: var(--font-display);
  font-size: var(--fs-display);
  letter-spacing: var(--ls-display);
  line-height: var(--lh-display);
  color: var(--color-text);
}
h2 {
  font-family: var(--font-display);
  font-size: var(--fs-h2);
  letter-spacing: var(--ls-h2);
  line-height: var(--lh-h2);
}
body, p {
  font-family: var(--font-body);
  font-size: var(--fs-body);
  letter-spacing: var(--ls-body);
  line-height: var(--lh-body);
  color: var(--color-text);
}
/* numeric / data readouts: tabular figures so digits don't shift */
.tnum, .data-value, [data-numeric] {
  font-family: var(--font-body);
  font-feature-settings: "tnum" 1, "zero" 1;
}
```

Michroma "boldness" comes from **scale and letter-spacing, not weight** (it only ships at 400). Don't fake bold with `font-weight`.

---

## Spacing, radius, layout

```css
:root {
  /* 4px base, 8pt-ish rhythm */
  --space-1: 0.25rem;  --space-2: 0.5rem;  --space-3: 0.75rem;
  --space-4: 1rem;     --space-5: 1.5rem;  --space-6: 2rem;
  --space-7: 3rem;     --space-8: 4rem;    --space-9: 6rem;
  --space-10: 8rem;

  --radius-sm: 8px;  --radius-md: 12px; --radius-lg: 16px;
  --radius-xl: 24px; --radius-full: 999px;

  --container-max: 1440px;
  --content-max:   72ch;   /* readable prose measure */
}
```

---

## Surfaces, glass & elevation

On a black ground, elevation is **not** drop shadows — it's a lighter surface tint + a titanium hairline + (optionally) a soft teal glow. Higher = lighter surface + stronger border.

**Glass** is the single most reused surface (nav, modals, store cards, dashboard panels). Define it once, reuse everywhere:

```css
:root {
  --glass-bg:       rgba(17, 19, 20, 0.55);          /* tinted space black */
  --glass-border:   rgba(232, 232, 227, 0.12);       /* titanium hairline  */
  --glass-blur:     20px;
  --glass-saturate: 120%;
  --glow-accent:    0 0 40px rgba(26, 135, 135, 0.25);
}

.glass {
  background: var(--glass-bg);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
          backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
}

/* elevation without shadows */
.elev-1 { background: var(--color-surface-1); border: 1px solid var(--color-border); }
.elev-2 { background: var(--color-surface-2); border: 1px solid var(--color-border-strong); }
.elev-3 { background: var(--color-surface-3); border: 1px solid var(--color-border-strong); box-shadow: var(--glow-accent); }
```

Always provide a non-blur fallback color (the `--glass-bg` already does this) — some browsers/perf modes drop `backdrop-filter`, and a card with no background over the animated model becomes unreadable.

---

## Motion

Most of this platform *is* motion (converging train-lines, flurry, the timer train, heatmap clips). Centralize timing so nothing feels slightly off from everything else.

```css
:root {
  --dur-fast:   160ms;  /* hovers, small state changes        */
  --dur-base:   240ms;  /* card open/close, transitions       */
  --dur-slow:   400ms;  /* screen transitions                 */
  --dur-slower: 700ms;  /* orchestrated reveals               */
  --dur-ambient: 12s;   /* flurry / idle atmosphere loop       */

  --ease-out:      cubic-bezier(0.16, 1, 0.3, 1);   /* default; Apple-ish glide */
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-in-out:   cubic-bezier(0.65, 0, 0.35, 1);
}
```

- Default to `--ease-out` for anything the user triggers — it feels responsive.
- The **train timer** is the one animation that must be *linear* and non-negotiable: it maps to real time, so `transition-timing-function: linear` over the exact game duration, no easing. It cannot pause, ease, or catch up.
- Flurry / converging lines are ambient: long duration, `--ease-in-out`, looped, and **must** respect reduced motion (see Accessibility).

---

## Data-visualization system

This is the custom heart of the platform and the part no brand doc covers. Rules:

**Channel = meaning.** Every mark's color states its epistemic status. Don't pick chart colors by aesthetics; pick them by what the data *is*.

| Meaning | Token | Use for |
|---|---|---|
| Measured / existing | `--data-measured` (bright teal) | MTA/turnstile counts, PATH ridership, anything we actually have |
| Uncertain / edge | `--data-edge` (amber) | tourist-vs-commuter proxy, interpolated gaps, contested figures |
| Missing / interior void | `--data-missing` (plum) | the withheld commercial data + everything the game generates to fill it |

**Measured vs interpolated** (your solid/dashed convention): same hue, different treatment. Measured = solid fill / solid stroke / full opacity + bright channel color. Interpolated = dashed stroke (`stroke-dasharray`) or hatch fill, and drop to the `-dim` companion. Never represent interpolated data as if it were solid measured data — that distinction is basically the whole project's ethics.

```css
.series--measured     { stroke: var(--data-measured); fill: var(--data-measured); }
.series--interpolated { stroke: var(--data-measured-2); stroke-dasharray: 4 4; fill: none; }
```

**Heatmaps (idle-time clips):** use `--tp-heat-0..4` as the ramp. Interpolate in a perceptual space if your library allows (avoids muddy mid-tones). Provide a legend — a cross-hue ramp is meaningless without one.

**Chart defaults on dark:**
- Gridlines: `--color-divider` (barely-there). Axes: `--color-border`.
- Axis/tick labels: `--color-text-muted`, `--font-body`, `--fs-caption`, tabular figures on.
- No chart backgrounds — let Space Black show through. No 3D bars, no gradient fills on data marks (gradients are shell-only, for atmosphere).
- Direct-label series where you can instead of relying on legends.

---

## Component patterns

Short specs; derive exact values from tokens above.

**Buttons.** Primary = teal accent fill (`--color-accent`) with `--color-on-accent` text; hover → `--color-accent-hover`; radius `--radius-md`. Secondary = glass surface + titanium hairline, pearl text. The big game buttons (Shop / Grab a Bite / Restroom / Go Outside) are large glass panels with generous `--space-6` padding and a teal glow on hover.

**Disabled / locked** (needed for Restroom after one use): drop to `--color-text-faint`, `opacity: 0.4`, `cursor: not-allowed`, remove hover glow, and set `aria-disabled="true"`. Locked ≠ hidden — the user should see it's used up.

**Store card (Monopoly card).** Glass surface, `--radius-lg`. Store name in `--fs-h3` display or body-display. 3–4 bullets in body. Three price tags side by side as tappable chips (teal outline, fill teal on select). "I wouldn't shop/stop here" as a distinct low-emphasis option beneath — muted text, not a data color. Card can't close without a logged choice: the close affordance only appears after selection, or the price chips *are* the close action.

**Nav / modal.** `.glass`, hairline border, blur. Modal over the animated model needs the glass fallback background or text won't read.

---

## Accessibility (the quality floor — non-negotiable)

- **Contrast:** `--color-text` (Titanium Pearl) on Space Black ≈ 15:1, great. **Shell teal `#1A8787` fails AA for small body text (~4.3:1)** — use it for large text, icons, and accents only; never for small paragraph copy. The bright *data* teal is fine. Verify amber/plum labels if you ever set them at caption size.
- **Focus:** every interactive element gets a visible `:focus-visible` ring in `--color-focus`, 2px, offset. Don't remove outlines.
- **Reduced motion:** wrap flurry, converging lines, and ambient loops so they hold a static frame under `prefers-reduced-motion: reduce`. The **train timer still runs** (it's function, not decoration) but can lose its easing/particles.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  /* re-enable only the timer's functional progression in JS if needed */
}
```

---

## Rules — do / never

**Do**
- Reference semantic tokens from components; primitives only from the semantic layer.
- Keep the shell teal-monochrome and quiet; spend all the color in the data layer.
- Make every data mark's color state what the data *is* (measured / edge / missing).
- Distinguish interpolated from measured every single time (dim + dashed/hatch).
- Provide a glass fallback background and a reduced-motion path.

**Never**
- Neon / cyberpunk glow, oversaturated cyan, or gaming-style visuals (brand spec, and it'll cheapen the argument).
- Hard-edged gradients — flurry is soft, layered, translucent only.
- Data-encoding colors (amber/plum especially) used as decorative UI chrome.
- Fake Michroma bold via font-weight; it's 400 only.
- Small body text in shell teal.
- Drop shadows for elevation — use surface tint + hairline + glow.
- Ranges in code. This file resolves the brand doc's ranges into fixed steps; use the steps.
