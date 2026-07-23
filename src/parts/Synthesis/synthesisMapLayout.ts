/**
 * synthesisMapLayout — deterministic seeded layout for the Store Response
 * Map's floor bands (Part B1).
 *
 * The approach is the Simulation's gameScatter kernel, REUSED rather than
 * reinvented: FNV-1a hash -> mulberry32 seeding, rect footprints (dot +
 * always-visible label where present), width-balanced tier seeding, the same
 * pairwise axis-separation relax with clamping, then an escape pass that
 * nudges stubborn pairs off local minima. Differences from gameScatter are
 * mechanical only: coordinates are px inside the bands container (not vw/vh
 * %), items are circles-with-optional-labels (not text buttons), and there
 * are no chrome keep-outs — the floor-label gutter is excluded via bounds.
 *
 * Deterministic per (seed key, item set, bounds): the same data always lands
 * in the same place; no per-render jitter.
 */

export interface MapLayoutItem {
  key: string;
  /** rect footprint, px (dot diameter + padding; labels included) */
  w: number;
  h: number;
}

export interface MapBounds {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

interface Placed extends MapLayoutItem {
  x: number;
  y: number;
}

/** Label metrics for footprint estimation — 12.5px UPPERCASE with 0.1em
 *  tracking runs ~9.7px/char; stay generous so real text never outgrows its
 *  collision rect. */
export const MAP_LABEL_H = 19;
export const estimateLabelWidth = (name: string) => name.length * 9.8 + 16;

// ---------------- deterministic PRNG (FNV-1a hash -> mulberry32), as gameScatter ----------------
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// deterministic relaxation: push overlapping pairs apart until clean (gameScatter's relax, px gap)
function relax(P: Placed[], b: MapBounds) {
  const g = 5;
  const clamp = (p: Placed) => {
    p.x = Math.min(b.x1 - p.w / 2, Math.max(b.x0 + p.w / 2, p.x));
    p.y = Math.min(b.y1 - p.h / 2, Math.max(b.y0 + p.h / 2, p.y));
  };
  for (let it = 0; it < 7000; it++) {
    let moved = false;
    for (let i = 0; i < P.length; i++)
      for (let j = i + 1; j < P.length; j++) {
        const a = P[i],
          c = P[j];
        const ox = (a.w + c.w) / 2 + g - Math.abs(a.x - c.x),
          oy = (a.h + c.h) / 2 + g - Math.abs(a.y - c.y);
        if (ox > 0 && oy > 0) {
          moved = true;
          if (Math.abs(a.x - c.x) < 0.5 && Math.abs(a.y - c.y) < 0.5) {
            // (near-)coincident pair — identical rects clamped to the same
            // spot can oscillate forever in an over-full band; break the tie
            // on BOTH axes, deterministically by key, so two stores can never
            // end the layout stacked on one another
            const s = a.key < c.key ? 1 : -1;
            a.x -= ox / 2;
            c.x += ox / 2;
            a.y -= (s * oy) / 4;
            c.y += (s * oy) / 4;
          } else if (ox <= oy) {
            const s = ((a.x <= c.x ? -1 : 1) * ox) / 2;
            a.x += s;
            c.x -= s;
          } else {
            const s = ((a.y <= c.y ? -1 : 1) * oy) / 2;
            a.y += s;
            c.y -= s;
          }
        }
      }
    for (const p of P) clamp(p);
    if (!moved) break;
  }
}

/**
 * Lay one floor band out. Returns rect centres keyed by item key — the
 * caller renders each store stack (dot + label) centred on its rect.
 */
export function layoutMapBand(items: MapLayoutItem[], b: MapBounds, seedKey: string): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  if (!items.length || b.x1 - b.x0 < 40 || b.y1 - b.y0 < 30) return out;
  // fixed processing order -> determinism regardless of caller order
  const arr: Placed[] = items
    .slice()
    .sort((a, c) => (a.key < c.key ? -1 : 1))
    .map((it) => ({ ...it, x: 0, y: 0 }));
  const rng = mulberry32(hash(seedKey));
  const W = b.x1 - b.x0,
    H = b.y1 - b.y0,
    maxH = Math.max(...arr.map((p) => p.h));
  const tiers = Math.max(1, Math.min(5, Math.floor(H / (maxH * 0.98))));

  // width-balanced loose tiers (gameScatter: shuffle, deal to narrowest tier)
  const items0 = arr.slice();
  for (let i = items0.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = items0[i];
    items0[i] = items0[j];
    items0[j] = t;
  }
  const T: Placed[][] = Array.from({ length: tiers }, () => []);
  const tw = new Array(tiers).fill(0);
  items0.forEach((p) => {
    let m = 0;
    for (let t = 1; t < tiers; t++) if (tw[t] < tw[m]) m = t;
    T[m].push(p);
    tw[m] += p.w;
  });
  const tierGap = H / tiers;
  T.forEach((tierItems, t) => {
    if (!tierItems.length) return;
    const yc = b.y0 + (t + 0.5) * tierGap;
    const totalW = tierItems.reduce((s, p) => s + p.w, 0),
      slack = Math.max(0, W - totalW);
    // random-weighted lead/between/trail gaps -> full-width loose band
    const gaps = tierItems.length + 1;
    let ws = 0;
    const wts: number[] = [];
    for (let g2 = 0; g2 < gaps; g2++) {
      const w = 0.5 + rng();
      wts.push(w);
      ws += w;
    }
    let x = b.x0;
    tierItems.forEach((p, i) => {
      x += slack * (wts[i] / ws);
      p.x = x + p.w / 2;
      x += p.w;
    });
    tierItems.forEach((p) => {
      const jr = Math.max(0, (tierGap - p.h) / 2 - 2);
      p.y = Math.min(b.y1 - p.h / 2, Math.max(b.y0 + p.h / 2, yc + (rng() - 0.5) * 2 * jr));
    });
  });
  relax(arr, b);
  // escape pass: nudge any still-overlapping pair off its local minimum (gameScatter)
  for (let esc = 0; esc < 40; esc++) {
    let bad: [Placed, Placed] | null = null;
    for (let i = 0; i < arr.length && !bad; i++)
      for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i],
          c = arr[j];
        if ((a.w + c.w) / 2 + 4 > Math.abs(a.x - c.x) && (a.h + c.h) / 2 + 4 > Math.abs(a.y - c.y)) {
          bad = [a, c];
          break;
        }
      }
    if (!bad) break;
    const sm = bad[0].w * bad[0].h <= bad[1].w * bad[1].h ? bad[0] : bad[1]; // move the smaller one
    sm.y += (sm.y < (b.y0 + b.y1) / 2 ? 1 : -1) * (5 + esc);
    sm.x += (esc % 2 ? 1 : -1) * 3;
    relax(arr, b);
  }
  arr.forEach((p) => (out[p.key] = { x: p.x, y: p.y }));
  return out;
}
