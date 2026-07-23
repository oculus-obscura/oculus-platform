/**
 * gameScatter — the Simulation's deterministic word-cloud layout, extracted
 * verbatim from the approved mockup (design-reference/Oculus Obscura
 * Commuter.dc.html). Do not tune numbers here: every constant (gap 1.7, the
 * 7000-iteration relax, band counts, jitter ranges, seed strings) is part of
 * the approved composition. The seed strings still say 'bite' because they
 * hash into the frozen layout — renaming them would reshuffle every floor.
 *
 * Two entry points:
 *   buildAllScatter()      — seeded pre-measure positions (rendered invisible;
 *                            they exist so the buttons can be measured)
 *   measureScatterLayout() — the real layout from measured text rects: tier
 *                            seeding, relax, escape passes, full-width spread.
 *
 * The ONE intentional deviation from the mockup: floor 2's top bound/keep-out
 * accepts a `topClearPct` so names clear the platform chrome + the offset
 * timer (mockup timer sat at top:0; ours sits below the nav bar).
 */

export type GameCat = "shop" | "bite";
export type GameSize = "big" | "medium" | "small";

export interface ScatterStore {
  name: string;
  floor: 1 | 2;
  cat: GameCat;
  size: GameSize;
}

export interface ScatterPos {
  x: number; // % of viewport width (centre)
  y: number; // % of viewport height (centre)
  size: GameSize;
}

export type PosMap = Record<string, ScatterPos>;

/** The scatter key a store renders under (also the DOM data-key). */
export const scatterKey = (st: { floor: number; name: string }) => st.floor + ":" + st.name;

// ---------------- deterministic PRNG (FNV-1a hash -> mulberry32) ----------------
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

interface Bounds {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}
interface Keepout {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Placed {
  st?: ScatterStore;
  key?: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

// half bounds + chrome keep-outs. 1st Floor = LOWER half, 2nd Floor = UPPER half.
// topClearPct (deviation, see header): how far down the chrome + offset timer
// reach, as % of viewport height. Defaults to the mockup's own values.
function half(floor: 1 | 2, topClearPct?: number): { b: Bounds; k: Keepout[] } {
  if (floor === 1) {
    // halves are kept clearly separated in y so the two floors never collide across the midline
    return {
      b: { x0: 2, x1: 98, y0: 47.5, y1: 82.5 },
      k: [
        { x: 50, y: 99, w: 64, h: 24 },
        { x: 8, y: 97, w: 22, h: 14 },
      ],
    };
  }
  if (topClearPct === undefined) {
    return { b: { x0: 2, x1: 98, y0: 12.5, y1: 49.5 }, k: [{ x: 50, y: 5.5, w: 100, h: 12 }] };
  }
  const clear = Math.max(12.5, topClearPct);
  return {
    b: { x0: 2, x1: 98, y0: clear, y1: 49.5 },
    k: [{ x: 50, y: clear / 2, w: 100, h: clear + 1 }],
  };
}

// rough footprint used only to SEED the layout; final sizes are measured from real text
function fp(st: ScatterStore): { w: number; h: number } {
  const cw = { big: 2.0, medium: 1.18, small: 0.8 };
  const hh = { big: 9, medium: 7, small: 5 };
  return { w: Math.max(st.size === "small" ? 8 : 12, st.name.length * cw[st.size] + 4), h: hh[st.size] };
}

// deterministic relaxation: push overlapping pairs (and chrome keep-outs) apart until clean
function relax(P: Placed[], b: Bounds, keepouts: Keepout[]) {
  const g = 1.7;
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
        const bb = a.st && c.st && a.st.size === "big" && c.st.size === "big"; // BIGs get a keep-apart buffer
        const ox = (a.w + c.w) / 2 + (bb ? g + 5 : g) - Math.abs(a.x - c.x),
          oy = (a.h + c.h) / 2 + (bb ? g + 2 : g) - Math.abs(a.y - c.y);
        if (ox > 0 && oy > 0) {
          moved = true;
          if (ox <= oy) {
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
    for (const p of P)
      for (const k of keepouts) {
        const ox = (p.w + k.w) / 2 + g - Math.abs(p.x - k.x),
          oy = (p.h + k.h) / 2 + g - Math.abs(p.y - k.y);
        if (ox > 0 && oy > 0) {
          moved = true;
          if (oy <= ox) {
            p.y += (p.y <= k.y ? -1 : 1) * oy;
          } else {
            p.x += (p.x <= k.x ? -1 : 1) * ox;
          }
        }
      }
    for (const p of P) clamp(p);
    if (!moved) break;
  }
}

function packInto(list: ScatterStore[], floor: 1 | 2, rng: () => number, pos: PosMap) {
  const { b, k } = half(floor);
  const n = list.length,
    bands = n > 12 ? 4 : n > 6 ? 3 : n > 2 ? 2 : 1,
    bandH = (b.y1 - b.y0) / bands;
  const order = list
    .slice()
    .sort((a, c) => ({ big: 0, medium: 1, small: 2 })[a.size] - { big: 0, medium: 1, small: 2 }[c.size]);
  const P: Placed[] = order.map((st, i) => {
    const f = fp(st),
      band = i % bands,
      yc = b.y0 + (band + 0.5) * bandH;
    return {
      st,
      w: f.w,
      h: f.h,
      x: b.x0 + f.w / 2 + rng() * Math.max(0.1, b.x1 - b.x0 - f.w),
      y: Math.min(b.y1 - f.h / 2, Math.max(b.y0 + f.h / 2, yc + (rng() - 0.5) * bandH * 0.4)),
    };
  });
  relax(P, b, k);
  for (const p of P) pos[scatterKey(p.st!)] = { x: p.x, y: p.y, size: p.st!.size };
}

/** Seeded, frozen pre-measure layout for both categories (both floors each). */
export function buildAllScatter(stores: ScatterStore[]): Record<GameCat, PosMap> {
  const out = {} as Record<GameCat, PosMap>;
  for (const cat of ["shop", "bite"] as GameCat[]) {
    const rng = mulberry32(hash("oculus-" + cat));
    const pos: PosMap = {};
    packInto(stores.filter((x) => x.cat === cat && x.floor === 1), 1, rng, pos);
    packInto(stores.filter((x) => x.cat === cat && x.floor === 2), 2, rng, pos);
    out[cat] = pos;
  }
  return out;
}

export interface MeasuredButton {
  key: string; // "<floor>:<name>" (the DOM data-key)
  width: number; // px
  height: number; // px
}

interface MeasuredPlaced extends Placed {
  st: ScatterStore;
  key: string;
}

/**
 * The real layout, from the ACTUAL rendered text widths: guaranteed
 * collision-free, deterministic per (category, floor). The component measures
 * the DOM buttons and passes rects in; the result is frozen by the caller.
 */
export function measureScatterLayout(args: {
  cat: GameCat;
  stores: ScatterStore[];
  buttons: MeasuredButton[];
  vw: number;
  vh: number;
  topClearPct?: number;
}): PosMap {
  const { cat, stores, buttons, vw, vh, topClearPct } = args;
  const groups: Record<1 | 2, MeasuredPlaced[]> = { 1: [], 2: [] };
  for (const bn of buttons) {
    const i = bn.key.indexOf(":");
    const fl = +bn.key.slice(0, i) as 1 | 2,
      name = bn.key.slice(i + 1);
    const st = stores.find((x) => x.cat === cat && x.floor === fl && x.name === name);
    if (!st) continue;
    groups[fl].push({ st, key: bn.key, x: 0, y: 0, w: (bn.width / vw) * 100 + 1.7, h: (bn.height / vh) * 100 + 2.4 });
  }
  const pos: PosMap = {};
  try {
    ([1, 2] as const).forEach((fl) => {
      const arr = groups[fl];
      if (!arr.length) return;
      const { b, k } = half(fl, fl === 2 ? topClearPct : undefined);
      // GRAB A BITE: too few names for the word-cloud -> a single horizontal ROW across the width,
      // each name nudged slightly up/down so it reads composed, not a flat straight line.
      if (cat === "bite") {
        const Wb = b.x1 - b.x0,
          yc = (b.y0 + b.y1) / 2,
          rng = mulberry32(hash("biterow-" + fl));
        arr.sort((a, c) => a.st.name.localeCompare(c.st.name));
        const totalW = arr.reduce((s, p) => s + p.w, 0),
          slack = Math.max(0, Wb - totalW);
        const gaps = arr.length + 1;
        let ws = 0;
        const wts: number[] = [];
        for (let g = 0; g < gaps; g++) {
          const w = 0.75 + rng() * 0.5;
          wts.push(w);
          ws += w;
        }
        let x = b.x0;
        arr.forEach((p, i) => {
          x += slack * (wts[i] / ws);
          p.x = Math.min(b.x1 - p.w / 2, Math.max(b.x0 + p.w / 2, x + p.w / 2));
          x += p.w;
          const off = (i % 2 ? 1 : -1) * (1.8 + rng() * 1.6);
          p.y = Math.min(b.y1 - p.h / 2, Math.max(b.y0 + p.h / 2, yc + off));
        });
        relax(arr, b, k);
        arr.forEach((p) => (pos[p.key] = { x: p.x, y: p.y, size: p.st.size }));
        return;
      }
      // clean tier seed (big first, spread across bands), THEN relax -> reliable convergence
      // composed word-cloud: balance names into loose tiers by width, randomized gaps + Y stagger (no grid), then relax to clear residual
      const rng = mulberry32(hash("scatter-" + cat + "-" + fl));
      const H = b.y1 - b.y0,
        W = b.x1 - b.x0,
        maxH = Math.max(...arr.map((p) => p.h));
      const tiers = Math.max(2, Math.min(7, Math.floor(H / (maxH * 0.98))));
      // ---- loose horizontal bands: width-balanced tiers, full-width fill, Y stagger (NO adjacency rule) ----
      const items0 = arr.slice();
      for (let i = items0.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const t = items0[i];
        items0[i] = items0[j];
        items0[j] = t;
      }
      const T: MeasuredPlaced[][] = Array.from({ length: tiers }, () => []);
      const tw = new Array(tiers).fill(0);
      // deal each name to the currently-narrowest tier -> loose bands balanced by width (bigs spread naturally)
      items0.forEach((p) => {
        let m = 0;
        for (let t = 1; t < tiers; t++) if (tw[t] < tw[m]) m = t;
        T[m].push(p);
        tw[m] += p.w;
      });
      const tierGap = H / tiers;
      T.forEach((items, t) => {
        const count = items.length;
        if (!count) return;
        const yc = b.y0 + (t + 0.5) * tierGap;
        const totalW = items.reduce((s, p) => s + p.w, 0),
          slack = Math.max(0, W - totalW);
        // distribute slack across gaps (lead / between / trail) with random weights -> full-width loose band
        const gaps = count + 1;
        let ws = 0;
        const wts: number[] = [];
        for (let g = 0; g < gaps; g++) {
          const w = 0.5 + rng();
          wts.push(w);
          ws += w;
        }
        let x = b.x0;
        items.forEach((p, i) => {
          x += slack * (wts[i] / ws);
          p.x = x + p.w / 2;
          x += p.w;
        });
        items.forEach((p) => {
          const jr = Math.max(0, (tierGap - p.h) / 2 - 0.6);
          p.y = Math.min(b.y1 - p.h / 2, Math.max(b.y0 + p.h / 2, yc + (rng() - 0.5) * 2 * jr));
        });
      });
      relax(arr, b, k);
      // escape pass: nudge any still-overlapping pair off its local minimum, then relax again
      for (let esc = 0; esc < 40; esc++) {
        let bad: [MeasuredPlaced, MeasuredPlaced] | null = null;
        for (let i = 0; i < arr.length && !bad; i++)
          for (let j = i + 1; j < arr.length; j++) {
            const a = arr[i],
              c = arr[j];
            if ((a.w + c.w) / 2 + 1.3 > Math.abs(a.x - c.x) && (a.h + c.h) / 2 + 1.3 > Math.abs(a.y - c.y)) {
              bad = [a, c];
              break;
            }
          }
        if (!bad) break;
        const sm = bad[0].w * bad[0].h <= bad[1].w * bad[1].h ? bad[0] : bad[1]; // move the smaller one
        sm.y += (sm.y < (b.y0 + b.y1) / 2 ? 1 : -1) * (1.2 + esc * 0.25);
        sm.x += (esc % 2 ? 1 : -1) * 0.8;
        relax(arr, b, k);
      }
      // ---- FINAL FULL-WIDTH SPREAD (both floors, edge to edge, even gaps, no side gutters) ----
      // relax only pushes apart, so a tier can end up bunched; re-fill each tier across the whole
      // width: hug both edges (tiny end margins) with near-uniform interior gaps, then a gentle relax.
      T.forEach((items) => {
        if (!items.length) return;
        items.sort((p, q) => p.x - q.x);
        const totalW = items.reduce((s, p) => s + p.w, 0),
          n2 = items.length;
        const slack = Math.max(0, W - totalW);
        if (n2 === 1) {
          items[0].x = b.x0 + W / 2;
        } else if (fl === 2) {
          // 2nd floor ONLY: loose staggered fill (lead+trail gaps, high variance) so tiers never
          // align into vertical columns; each tier gets its own random left inset + gap pattern.
          const gN = n2 + 1;
          let ws3 = 0;
          const wts3: number[] = [];
          for (let g = 0; g < gN; g++) {
            const w = 0.35 + rng() * 1.7;
            wts3.push(w);
            ws3 += w;
          }
          let x3 = b.x0;
          items.forEach((p, i) => {
            x3 += slack * (wts3[i] / ws3);
            p.x = Math.min(b.x1 - p.w / 2, Math.max(b.x0 + p.w / 2, x3 + p.w / 2));
            x3 += p.w;
          });
        } else {
          const edge = Math.min(slack * 0.14, 2.5),
            gaps = n2 - 1,
            mid = Math.max(0, slack - 2 * edge);
          let ws2 = 0;
          const wts2: number[] = [];
          for (let g = 0; g < gaps; g++) {
            const w = 0.85 + 0.3 * rng();
            wts2.push(w);
            ws2 += w;
          }
          let x2 = b.x0 + edge;
          items.forEach((p, i) => {
            p.x = Math.min(b.x1 - p.w / 2, Math.max(b.x0 + p.w / 2, x2 + p.w / 2));
            x2 += p.w;
            if (i < gaps) x2 += mid * (wts2[i] / ws2);
          });
        }
      });
      relax(arr, b, k);
      arr.forEach((p) => (pos[p.key] = { x: p.x, y: p.y, size: p.st.size }));
    });
  } catch (e) {
    console.error("[measureScatterLayout error]", e instanceof Error ? e.message : e);
  }
  return pos;
}
