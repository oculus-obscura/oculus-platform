/**
 * SynthesisBackdrop — the generated data substrate behind the Synthesis
 * section (Part A of the UI overhaul, replacing the interior photograph on
 * the aggregate views). Synthesis is the only section not inside the
 * building: it is the record, so the ground is a DATA SUBSTRATE, not
 * architecture — CSS/SVG only, full bleed, fluid at any viewport, no image
 * and no fixed aspect ratio.
 *
 * Layers (bottom → top): Space Black base (on .syn) → ruled LEDGER GRID that
 * draws itself in (stroke-dashoffset, the IntroSequence approach) → drifting
 * DATA FRAGMENTS → slow scan sweep → radial vignette → film grain. The
 * grain / vignette / drifting-text / scan treatments are lifted from
 * IntroSequence so this reads as the same platform. Teal only — no amber or
 * plum in chrome. Under prefers-reduced-motion everything renders static
 * (grid drawn, fragments at rest, no sweep) — see synthesisView.css.
 *
 * Fragment TEXT is real data only: store slugs and audited price figures
 * from the catalog, plus truncated session ids / timestamps / elapsed clocks
 * handed in via `extra` (collected from live rows by synthesisData). The
 * background is literally made of the record; nothing is invented.
 */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { STORE_CATALOG } from "../../data/storeCatalog";

/** Deterministic PRNG (mulberry32) — the layout is stable across renders and
 *  does not reshuffle when React re-renders or the data refetch resolves to
 *  the same values. */
function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Real measured values from the catalog: slugs + audited price displays. */
const CATALOG_FRAGS: string[] = STORE_CATALOG.flatMap((s) => [s.slug, ...s.prices.map((p) => p.display)]);

/** Ruled register: tight horizontals, sparser verticals (px). */
const GRID_ROW = 64;
const GRID_COL = 256;
const CATALOG_PICKS = 20;
const EXTRA_MAX = 16;

interface Frag {
  text: string;
  left: number; // %
  top: number; // %
  rem: number;
  color: string;
  dur: number; // s
  delay: number; // s
}

function SynthesisBackdrop({ extra }: { extra: string[] | null }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () =>
      setSize((s) => (s.w === root.clientWidth && s.h === root.clientHeight ? s : { w: root.clientWidth, h: root.clientHeight }));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  // identical values -> identical key -> no relayout (the Amendment-B refetch
  // usually resolves to the same rows)
  const extraKey = extra ? extra.join("|") : "";
  const frags = useMemo<Frag[]>(() => {
    const pickRnd = mulberry32(0x0c31a5);
    const pool = [...CATALOG_FRAGS];
    const picked: string[] = [];
    for (let i = 0; i < CATALOG_PICKS && pool.length; i++) {
      picked.push(pool.splice(Math.floor(pickRnd() * pool.length), 1)[0]);
    }
    const texts = [...picked, ...(extraKey ? extraKey.split("|").slice(0, EXTRA_MAX) : [])];
    return texts.map((text, i) => {
      // per-index stream: catalog fragments keep their spot when live-row
      // fragments arrive and append after them
      const r = mulberry32(0x0c31a5 ^ Math.imul(i + 1, 0x9e3779b9));
      return {
        text,
        left: 2 + r() * 90,
        top: 3 + r() * 90,
        rem: 0.66 + r() * 0.32,
        color: r() > 0.5 ? "rgba(60,207,207,0.13)" : "rgba(26,135,135,0.17)",
        dur: 8 + r() * 5,
        delay: r() * 8,
      };
    });
  }, [extraKey]);

  const rows: number[] = [];
  for (let y = GRID_ROW; y < size.h; y += GRID_ROW) rows.push(y);
  const cols: number[] = [];
  for (let x = GRID_COL; x < size.w; x += GRID_COL) cols.push(x);

  return (
    <div ref={rootRef} className="syn-substrate" aria-hidden="true">
      <svg className="syn-sub-grid" width="100%" height="100%">
        {rows.map((y, i) => (
          <line
            key={"h" + i}
            className={"syn-sub-line h" + (i % 4 === 3 ? " major" : "")}
            pathLength={1}
            x1={0}
            y1={y}
            x2={size.w}
            y2={y}
            style={{ animationDelay: `${i * 45}ms` }}
          />
        ))}
        {cols.map((x, i) => (
          <line
            key={"v" + i}
            className="syn-sub-line v"
            pathLength={1}
            x1={x}
            y1={0}
            x2={x}
            y2={size.h}
            style={{ animationDelay: `${300 + i * 60}ms` }}
          />
        ))}
      </svg>
      <div className="syn-sub-frags">
        {frags.map((f, i) => (
          <span
            key={i}
            className="syn-sub-frag"
            style={{
              left: f.left + "%",
              top: f.top + "%",
              fontSize: f.rem + "rem",
              color: f.color,
              animationDuration: f.dur + "s",
              animationDelay: f.delay + "s",
            }}
          >
            {f.text}
          </span>
        ))}
      </div>
      <div className="syn-sub-scan" />
      <div className="syn-sub-vig" />
      <div className="syn-sub-grain" />
    </div>
  );
}

export default memo(SynthesisBackdrop);
