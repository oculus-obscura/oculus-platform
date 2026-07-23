/**
 * View 2 — Synthesis (aggregate). Part B1 of the UI overhaul: the view is
 * restructured into FIVE TIERS, read top-down —
 *
 *   T1 HERO      — SYNTHESIS + the session count as the anchor number (the
 *                  size of the ledger; it frames every percentage below)
 *   T2 MAP       — the Store Response Map, rebuilt: two floor bands (2ND
 *                  upper / 1ST lower, echoing the Simulation's floor
 *                  scatter), deterministic seeded collision-avoided layout
 *                  (synthesisMapLayout — the gameScatter kernel reused),
 *                  DOT SIZE = times opened, COLOUR = the behaviour metric
 *                  (refusal -> amber intensity, opens -> teal ramp), hollow
 *                  hairline rings for never-opened stores, a stated legend
 *                  with a size scale, top-8 labels always visible, and a
 *                  hover/focus detail card with raw counts + audited prices
 *   T3 SUPPORT   — the ranking (real rows, value bars, counts under every
 *                  figure) and the Store Pricing ranked list, beside the map
 *   T4 BEHAVIOUR — the three panels under one "WHAT COMMUTERS DID" band
 *   T5 CLOSE     — key takeaways + the stats strip
 *
 * Small-sample honesty: every percentage carries its raw count; statistics
 * with a denominator under 10 carry a provisional amber marker (tooltip);
 * the average-time tile gates behind 10+ qualifying sessions; MIN_OPENS = 4
 * keeps ruling the refusal ranking. Reveal order IS the hierarchy — marked
 * groups 1..6 for Part A's utility. Colour semantics: TEAL = audited prices
 * (measured), AMBER = simulated behaviour (estimated), PLUM = reserved.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  MIN_OPENS,
  NA,
  catLabel,
  floorLabel,
  floorLong,
  fmtMoney,
  fmtPct,
  mmss,
  type StoreStat,
  type SynthesisModel,
} from "./synthesisModel";
import { Donut, Icon, SegmentedControl } from "./synthesisUi";
import { estimateLabelWidth, layoutMapBand } from "./synthesisMapLayout";

type Behaviour = "refusalRate" | "timesOpened";
type Pricing = "entryPrice" | "highPrice";

const BEHAVIOUR_DESC: Record<Behaviour, string> = {
  refusalRate: `Refusal rate, highest first — stores under ${MIN_OPENS} opens excluded.`,
  timesOpened: "Times opened, most first.",
};

/** DOT SIZE = times opened (stated in the legend; saturates past ~9 opens —
 *  the cap keeps a full 26-store band layable at n=500). Never-opened rings
 *  are small and faint: a substrate of absence, not competition (Fix 2). */
const dotR = (opens: number) => (opens <= 0 ? 5.5 : Math.min(19, 8 + 4.0 * Math.sqrt(opens)));

/** Map band geometry (stage px inside the bands container). */
const BAND_GUTTER_L = 128; // floor-label gutter at the left edge
const BAND_PAD_R = 18;
const BAND_PAD_T = 24; // clears the band's floor label line
const BAND_PAD_B = 12;

const TUT_STEPS = [
  { target: "syn-metric-toggle", body: "Switch the behaviour metric to re-colour the map and re-rank the list beside it.", pos: "below" as const },
  { target: "syn-floor-toggle", body: "Compare the two retail floors, or view them together.", pos: "below" as const },
  { target: "syn-rank-panel", body: "The top stores under the current metric — with the raw counts behind every figure.", pos: "left" as const },
  { target: "syn-map-points", body: "Dot size = times opened; hollow rings were never opened. Hover or focus any point for the full store record.", pos: "right" as const },
];

/** Provisional marker — any statistic with a denominator under 10 carries it. */
function Prov({ d, unit = "sessions" }: { d: number; unit?: string }) {
  if (d <= 0 || d >= 10) return null;
  return (
    <span className="syn-prov" tabIndex={0} role="note" aria-label={`Provisional — based on only ${d} ${unit}, fewer than 10.`}>
      <span className="tip">
        Small sample: based on {d} {unit}. Treat as provisional until there are 10+.
      </span>
    </span>
  );
}

interface View2Props {
  M: SynthesisModel;
  active: boolean;
  hasSession: boolean;
  onPlaySimulation: () => void;
}

export default function View2Synthesis({ M, active, hasSession, onPlaySimulation }: View2Props) {
  // Fix 1: the behaviour DEFAULT is derived, not stored. Refusal rate needs a
  // sample floor (MIN_OPENS); times opened does not — so until any store
  // qualifies, the untouched default falls back to TIMES OPENED and the
  // ranking panel stays populated. An explicit selection (chosen != null)
  // always wins: picking Refusal Rate with nothing qualifying shows the
  // explanation, never a silently different ranking. Once data qualifies,
  // refusal becomes the default again automatically.
  const [chosen, setChosen] = useState<Behaviour | null>(null);
  const refusalQualifies = useMemo(() => M.storeStats.some((s) => s.timesOpened >= MIN_OPENS), [M]);
  const behaviour: Behaviour = chosen ?? (refusalQualifies ? "refusalRate" : "timesOpened");
  const autoFallback = chosen === null && !refusalQualifies;
  const [pricing, setPricing] = useState<Pricing>("entryPrice");
  const [floor, setFloor] = useState<1 | 2 | "BOTH">("BOTH");
  const [barsOn, setBarsOn] = useState(false);
  const [tip, setTip] = useState<string | null>(null); // hovered/focused store slug
  const [tutIdx, setTutIdx] = useState<number | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const bandsRef = useRef<HTMLDivElement>(null);
  const [bandsSize, setBandsSize] = useState({ w: 0, h: 0 });

  // bars animate on first activation (prototype: animateBars on view-2 enter)
  useEffect(() => {
    if (active) setBarsOn(true);
  }, [active]);

  // tutorial: first View-2 activation per session; starts ~700ms in so the
  // spotlight measures a layout the reveal choreography has already settled
  useEffect(() => {
    if (!active) return;
    try {
      if (sessionStorage.getItem("oculus_tutorial_done")) return;
    } catch {
      return; /* storage unavailable — skip the tutorial */
    }
    const t = window.setTimeout(() => setTutIdx(0), 700);
    return () => clearTimeout(t);
  }, [active]);
  const endTutorial = () => {
    setTutIdx(null);
    try {
      sessionStorage.setItem("oculus_tutorial_done", "1");
    } catch {
      /* ignore */
    }
  };

  // ---- bands container size (stage px — views stay mounted, so this holds) ----
  useLayoutEffect(() => {
    const el = bandsRef.current;
    if (!el) return;
    const measure = () =>
      setBandsSize((s) => (s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const inScope = floor === "BOTH" ? M.storeStats : M.storeStats.filter((s) => Number(s.floor) === Number(floor));
  const maxOpens = Math.max(1, ...M.storeStats.map((s) => s.timesOpened));

  // ---- top ~8 labels by the active metric (always visible, ≥ the size floor);
  //      refusal eligibility respects MIN_OPENS, padded with most-opened so the
  //      map is never nameless at tiny n. Ordered — density shedding trims
  //      from the bottom of this ranking, never the top. ----
  const labelRank = useMemo(() => {
    let ranked: StoreStat[];
    if (behaviour === "refusalRate") {
      const eligible = inScope.filter((s) => s.timesOpened >= MIN_OPENS).sort((a, b) => b.refusalRate - a.refusalRate);
      const pad = inScope.filter((s) => s.timesOpened > 0 && s.timesOpened < MIN_OPENS).sort((a, b) => b.timesOpened - a.timesOpened);
      ranked = [...eligible, ...pad];
    } else {
      ranked = inScope.filter((s) => s.timesOpened > 0).sort((a, b) => b.timesOpened - a.timesOpened);
    }
    return ranked.slice(0, 8).map((s) => s.slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [M, floor, behaviour]);

  // ---- band geometry: 2ND upper / 1ST lower, heights PROPORTIONATE to each
  //      floor's store count so neither band carries dead space ----
  const bandGeom = useMemo(() => {
    const fls: (1 | 2)[] = floor === "BOTH" ? [2, 1] : [floor];
    const counts = fls.map((fl) => M.storeStats.filter((s) => Number(s.floor) === fl).length);
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    let acc = 0;
    return fls.map((fl, i) => {
      const h = (bandsSize.h * counts[i]) / total;
      const g = { fl, top: acc, h };
      acc += h;
      return g;
    });
  }, [M, floor, bandsSize.h]);

  // ---- deterministic band layout (seeded relax — synthesisMapLayout).
  //      Labels sit BESIDE dots; when a band is too crowded to guarantee
  //      non-overlap (dense data), the lowest-ranked labels shed to
  //      hover-only until the band fits — at least 2 stay. ----
  const { layout, labeledSet } = useMemo(() => {
    const out: Record<string, { x: number; y: number; r: number }> = {};
    const labeled = new Set<string>();
    if (!bandsSize.w || !bandsSize.h) return { layout: out, labeledSet: labeled };
    bandGeom.forEach(({ fl, top, h }) => {
      const stores = M.storeStats.filter((s) => Number(s.floor) === fl);
      const W = bandsSize.w - BAND_PAD_R - BAND_GUTTER_L;
      const bandLabs = labelRank.filter((slug) => stores.some((s) => s.slug === slug));
      const maxH = Math.max(...stores.map((s) => 2 * dotR(s.timesOpened) + 8), 1);
      const bandInner = h - BAND_PAD_T - BAND_PAD_B;
      const tiers = Math.max(1, Math.min(5, Math.floor(bandInner / (maxH * 0.98))));
      const width = (labs: Set<string>) =>
        stores.reduce((sum, s) => {
          const base = 2 * dotR(s.timesOpened) + 8;
          return sum + (labs.has(s.slug) ? base + 6 + estimateLabelWidth(s.name) : base) + 10;
        }, 0);
      const labs = new Set(bandLabs);
      while (labs.size > 2 && width(labs) > W * tiers * 0.78) labs.delete(bandLabs[labs.size - 1]);
      const items = stores.map((s) => {
        const r = dotR(s.timesOpened);
        const base = 2 * r + 8;
        return { key: s.slug, w: labs.has(s.slug) ? base + 6 + estimateLabelWidth(s.name) : base, h: base };
      });
      const pos = layoutMapBand(
        items,
        { x0: BAND_GUTTER_L, x1: bandsSize.w - BAND_PAD_R, y0: top + BAND_PAD_T, y1: top + h - BAND_PAD_B },
        `synmap-${fl}`,
      );
      for (const s of stores) {
        const p = pos[s.slug];
        if (p) out[s.slug] = { x: p.x, y: p.y, r: dotR(s.timesOpened) };
      }
      labs.forEach((slug) => labeled.add(slug));
    });
    return { layout: out, labeledSet: labeled };
  }, [M, bandGeom, labelRank, bandsSize]);

  // render largest-first: reveal pops biggest dots first, small dots paint on top
  const nodes = useMemo(
    () =>
      inScope
        .filter((s) => layout[s.slug])
        .map((s) => ({ s, ...layout[s.slug] }))
        .sort((a, b) => b.r - a.r),
    [inScope, layout],
  );

  /** COLOUR = behaviour metric. Hollow = never opened (dim hairline, NO glow
   *  — styled by the .hollow class). Every dot WITH opens carries a soft glow
   *  in the metric colour (the platform's glow treatment) so data pops
   *  against the substrate of absence. Faint = under MIN_OPENS in refusal
   *  mode (a 1-of-1 refusal must not blaze like a real signal). */
  const dotStyle = (s: StoreStat, r: number): CSSProperties => {
    const d = 2 * r;
    if (!s.timesOpened) return { width: d, height: d };
    if (behaviour === "refusalRate") {
      if (s.timesOpened < MIN_OPENS)
        return {
          width: d,
          height: d,
          background: "rgba(255,176,32,.2)",
          border: "1px solid rgba(255,176,32,.42)",
          boxShadow: "0 0 8px rgba(255,176,32,.22)",
        };
      const a = 0.34 + 0.58 * s.refusalRate;
      return {
        width: d,
        height: d,
        background: `rgba(255,176,32,${a.toFixed(2)})`,
        border: `1px solid rgba(255,176,32,${(0.5 + 0.5 * s.refusalRate).toFixed(2)})`,
        boxShadow: `0 0 ${Math.round(10 + 18 * s.refusalRate)}px rgba(255,176,32,${(0.3 + 0.42 * s.refusalRate).toFixed(2)})`,
      };
    }
    const t = Math.sqrt(s.timesOpened / maxOpens);
    const a = 0.32 + 0.58 * t;
    return {
      width: d,
      height: d,
      background: `rgba(60,207,207,${a.toFixed(2)})`,
      border: `1px solid rgba(60,207,207,${(0.45 + 0.55 * t).toFixed(2)})`,
      boxShadow: `0 0 ${Math.round(10 + 16 * t)}px rgba(60,207,207,${(0.28 + 0.4 * t).toFixed(2)})`,
    };
  };

  // ---- T3: ranking rows + price rows ----
  const rankRows = useMemo(
    () =>
      behaviour === "refusalRate"
        ? inScope.filter((s) => s.timesOpened >= MIN_OPENS).sort((a, b) => b.refusalRate - a.refusalRate).slice(0, 3)
        : inScope.filter((s) => s.timesOpened > 0).sort((a, b) => b.timesOpened - a.timesOpened).slice(0, 3),
    [inScope, behaviour],
  );
  // BOTH: count Apple once (both entries share one audited price list)
  const priceRanked = useMemo(() => {
    const base = floor === "BOTH" ? M.storeStats.filter((s) => s.slug !== "apple-2nd") : inScope;
    return [...base]
      .sort((a, b) => (pricing === "entryPrice" ? a.entryPrice - b.entryPrice : b.highPrice - a.highPrice))
      .slice(0, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [M, floor, pricing]);

  // ---- tutorial geometry (stage-space rects, unchanged mechanism) ----
  const [tutRect, setTutRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  useEffect(() => {
    if (tutIdx === null) {
      setTutRect(null);
      return;
    }
    const root = rootRef.current;
    const stage = root?.closest<HTMLElement>(".syn-stage");
    const target = root?.querySelector<HTMLElement>("." + TUT_STEPS[tutIdx].target);
    if (!root || !stage || !target) return;
    const sr = stage.getBoundingClientRect(),
      tr = target.getBoundingClientRect();
    const scale = sr.width / 1920;
    setTutRect({ x: (tr.left - sr.left) / scale, y: (tr.top - sr.top) / scale, w: tr.width / scale, h: tr.height / scale });
  }, [tutIdx, active]);

  const step = tutIdx !== null ? TUT_STEPS[tutIdx] : null;
  const pad = 10;
  let cardX = 0,
    cardY = 0;
  if (step && tutRect) {
    if (step.pos === "below") {
      cardX = tutRect.x;
      cardY = tutRect.y + tutRect.h + 40;
    } else if (step.pos === "right") {
      cardX = tutRect.x + tutRect.w + 40;
      cardY = tutRect.y + 20;
    } else {
      cardX = tutRect.x - 380;
      cardY = tutRect.y + 30;
    }
    cardX = Math.max(20, Math.min(cardX, 1920 - 360));
    cardY = Math.max(20, Math.min(cardY, 1080 - 220));
  }

  // Fix 3: never-opened list — a ~two-line preview (character-budgeted so it
  // never cuts mid-sentence), then an explicit "+N more" expander
  const [neverExpanded, setNeverExpanded] = useState(false);
  const neverPreview = useMemo(() => {
    const names = M.neverOpened.map((s) => s.name);
    const out: string[] = [];
    let chars = 0;
    for (const n of names) {
      if (out.length && chars + n.length > 150) break;
      out.push(n);
      chars += n.length + 3;
    }
    return { names: out, hidden: names.length - out.length };
  }, [M]);

  // takeaways — refusal ranking guarded for tiny n (global, not floor-scoped)
  const rankedByRefusal = [...M.storeStats].filter((s) => s.timesOpened >= MIN_OPENS).sort((a, b) => b.refusalRate - a.refusalRate);
  const t1 = M.activities.reduce((a, b) => (b.count > a.count ? b : a));
  const tipStat = tip ? M.byIdStat[tip] : null;
  const tipPos = tip ? layout[tip] : null;

  // detail card placement (clamped inside the bands container)
  let cardLeft = 0,
    cardTop = 0;
  if (tipPos && bandsSize.w) {
    cardLeft = tipPos.x + tipPos.r + 16;
    if (cardLeft + 260 > bandsSize.w - 8) cardLeft = tipPos.x - tipPos.r - 276;
    cardTop = Math.min(Math.max(tipPos.y - 80, 10), Math.max(10, bandsSize.h - 220));
  }

  return (
    <section ref={rootRef} className={"view" + (active ? " active" : "")} id="view2">
      {/* ── T1 · HERO — the size of the ledger ── */}
      <div className="syn-hero">
        <div className="syn-hero__title" data-reveal="1">
          <h1 className="mich">SYNTHESIS</h1>
          <div className="lbl syn-hero__sub">Results across all user sessions</div>
          {!hasSession && (
            <button type="button" className="syn-play-invite" onClick={onPlaySimulation}>
              Play the simulation to see your own round measured against this. →
            </button>
          )}
        </div>
        <div className="syn-hero__ledger">
          <div className="syn-hero__nblock" data-reveal="1">
            <span className="syn-hero__n mich num">{M.N}</span>
            <span className="syn-hero__ncap">
              SESSION{M.N === 1 ? "" : "S"}
              <br />
              RECORDED
            </span>
          </div>
          <div className="syn-hero__period muted" data-reveal="1">
            {M.period}
          </div>
        </div>
      </div>

      {/* ── T2 · THE STORE RESPONSE MAP ── */}
      <div className="syn-map-wrap" id="map-wrap">
        <div className="syn-phead">
          <div className="syn-phead__title">
            <div style={{ minWidth: 0 }}>
              <div className="panel-t" style={{ fontSize: 15 }}>
                Store Response Map
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
                Every store, laid out by floor. How commuters responded to each.
              </div>
            </div>
          </div>
          <div className="syn-phead__ctls">
            <SegmentedControl<Behaviour>
              className="syn-metric-toggle"
              label="Commuter Behaviour"
              options={[
                { value: "refusalRate", label: "Refusal Rate" },
                { value: "timesOpened", label: "Times Opened" },
              ]}
              value={behaviour}
              onChange={setChosen}
            />
            <SegmentedControl<1 | 2 | "BOTH">
              className="syn-floor-toggle"
              label="Floor View"
              options={[
                { value: 1, label: "1st Floor" },
                { value: 2, label: "2nd Floor" },
                { value: "BOTH", label: "Both" },
              ]}
              value={floor}
              onChange={setFloor}
            />
            <button type="button" className="map-ico-info" aria-label="About these metrics — what refusal rate means and how the filters work">
              i
              <span className="tip" role="tooltip">
                Refusal rate = “wouldn’t shop here” ÷ times the store was opened. It only counts people who already opened the
                card, so store size on screen cannot influence it. Use the behaviour and floor controls to filter — the map and
                the ranking update together.
              </span>
            </button>
          </div>
        </div>
        <div className="syn-map-body">
          <div className="syn-map-ground" aria-hidden="true" />
          <div className="syn-map-bands" ref={bandsRef}>
            {bandGeom.map(({ fl, top, h }, bi) => (
              <div key={fl} className="syn-band" style={{ top, height: h || undefined }}>
                <span className="syn-band__lab" data-reveal="2">
                  {fl === 2 ? "2ND FLOOR" : "1ST FLOOR"}
                </span>
                {bi > 0 && <span className="syn-band__div" data-reveal="2" data-reveal-draw aria-hidden="true" />}
              </div>
            ))}
            <div className="syn-map-points" id="map-points">
              {nodes.map(({ s, x, y, r }) => (
                <div
                  key={s.slug}
                  className="mpt"
                  style={{ left: x, top: y }}
                  tabIndex={0}
                  aria-label={
                    `${s.name} — ${floorLong(s.floor)}, ` +
                    (s.timesOpened === 0 ? "never opened" : `opened ${s.timesOpened} time${s.timesOpened === 1 ? "" : "s"}`) +
                    (behaviour === "refusalRate" && s.timesOpened ? `, refusal ${fmtPct(s.refusalRate)}` : "")
                  }
                  onMouseEnter={() => setTip(s.slug)}
                  onMouseLeave={() => setTip(null)}
                  onFocus={() => setTip(s.slug)}
                  onBlur={() => setTip(null)}
                >
                  <span
                    className={"mpt-dot" + (s.timesOpened === 0 ? " hollow" : "")}
                    data-reveal="2"
                    data-reveal-pop
                    style={dotStyle(s, r)}
                  />
                  {labeledSet.has(s.slug) && (
                    <span className="mpt-name" data-reveal="2">
                      {s.name.toUpperCase()}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {tipStat && tipPos && (
              <div className="syn-map-card" style={{ left: cardLeft, top: cardTop }}>
                <div className="tt-n">{tipStat.name}</div>
                <div className="tt-r">
                  <span>Floor</span>
                  <b>{floorLong(tipStat.floor)}</b>
                </div>
                <div className="tt-r">
                  <span>Type</span>
                  <b>{catLabel(tipStat.type)}</b>
                </div>
                <div className="tt-r">
                  <span>Times opened</span>
                  <b>{tipStat.timesOpened}</b>
                </div>
                <div className="tt-r">
                  <span>Refusal rate</span>
                  <b>
                    {tipStat.timesOpened
                      ? `${fmtPct(tipStat.refusalRate)} (${tipStat.wontShopHere} of ${tipStat.timesOpened} opens)`
                      : "— never opened"}
                  </b>
                </div>
                <div className="tt-prices">
                  {(
                    [
                      ["LOW", tipStat.entryPrice],
                      ["MID", tipStat.typicalPrice],
                      ["HIGH", tipStat.highPrice],
                    ] as const
                  ).map(([lab, v]) => (
                    <span key={lab} className="tt-price">
                      <i>{lab}</i>
                      {fmtMoney(v)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* the encoding, stated in words — never implied */}
          <div className="syn-map-legend" data-reveal="2">
            <span className="lg-item">
              <b>Dot size</b> — times opened
              <span className="lg-scale">
                {[1, 5, 10].map((o, i) => (
                  <span key={o} className="lg-refwrap">
                    <span className="lg-ref" style={{ width: 2 * dotR(o), height: 2 * dotR(o) }} />
                    <i>{i === 2 ? "10+" : o}</i>
                  </span>
                ))}
              </span>
            </span>
            <span className="lg-item">
              <b>Colour</b> —{" "}
              {behaviour === "refusalRate" ? (
                <>
                  refusal rate <span className="lg-amber">(amber = estimated)</span>
                </>
              ) : (
                "times opened (teal ramp)"
              )}
            </span>
            <span className="lg-item">
              <span className="lg-ref hollow" /> never opened
            </span>
            {behaviour === "refusalRate" && (
              <span className="lg-item">faint — under {MIN_OPENS} opens</span>
            )}
            <span className="lg-hint">Hover or focus a point for its record</span>
          </div>
        </div>
      </div>

      {/* ── T3 · SUPPORT — ranking + audited pricing, beside the map ── */}
      <div className="syn-side">
        <div className="panel syn-rank-panel" id="rank-panel">
          <div className="syn-phead">
            <div className="syn-phead__title">
              <div style={{ minWidth: 0 }}>
                <div className="panel-t" style={{ fontSize: 14 }}>
                  Store Response Ranking
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
                  {autoFallback
                    ? `Ranked by times opened — refusal rate needs ${MIN_OPENS}+ opens per store.`
                    : BEHAVIOUR_DESC[behaviour]}
                </div>
              </div>
            </div>
          </div>
          <div className="rk-list">
            {rankRows.length === 0 ? (
              <div className="rk-empty muted">
                {behaviour === "refusalRate"
                  ? `No store has enough opens yet to rank refusal reliably. A store needs at least ${MIN_OPENS} opens before its rate is treated as signal.`
                  : "No store opens recorded yet."}
              </div>
            ) : (
              rankRows.map((s, i) => (
                <div className="rk-row" data-reveal="3" key={s.slug}>
                  <span className="rk-rank num">{i + 1}</span>
                  <div className="rk-main">
                    <div className="rk-line">
                      <span className="rk-name">{s.name.toUpperCase()}</span>
                      <span className={"rk-val num " + (behaviour === "refusalRate" ? "amber" : "teal")}>
                        {behaviour === "refusalRate" ? fmtPct(s.refusalRate) : s.timesOpened}
                        {behaviour === "refusalRate" && <Prov d={s.timesOpened} unit="opens" />}
                      </span>
                    </div>
                    <div className="rk-line2">
                      <span className="rk-sub muted">
                        {behaviour === "refusalRate"
                          ? `${s.wontShopHere} of ${s.timesOpened} opens`
                          : `${s.timesOpened} of ${M.totalDecisions} store opens`}
                      </span>
                      <span className="rk-bar" aria-hidden="true">
                        <span
                          className={behaviour === "refusalRate" ? "amber" : "teal"}
                          style={{ width: (behaviour === "refusalRate" ? s.refusalRate * 100 : (s.timesOpened / maxOpens) * 100).toFixed(1) + "%" }}
                        />
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="panel syn-price-panel">
          <div className="syn-phead">
            <div className="syn-phead__title">
              <div style={{ minWidth: 0 }}>
                <div className="panel-t" style={{ fontSize: 14 }}>
                  Store Pricing
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
                  Audited prices — measured.
                </div>
              </div>
            </div>
            <div className="syn-phead__ctls">
              <SegmentedControl<Pricing>
                label="Pricing"
                labelHidden
                options={[
                  { value: "entryPrice", label: "Most Affordable" },
                  { value: "highPrice", label: "Most Expensive" },
                ]}
                value={pricing}
                onChange={setPricing}
              />
            </div>
          </div>
          <div className="pr-list">
            {priceRanked.map((s, i) => (
              <div className="pr-row" data-reveal="3" key={s.slug}>
                <span className="pr-rank num">{i + 1}</span>
                <span className="pr-name">{s.name.toUpperCase()}</span>
                <span className="pr-fl muted">{floorLabel(s.floor)}</span>
                <span className="pr-val num">{fmtMoney(pricing === "entryPrice" ? s.entryPrice : s.highPrice)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── T4 · WHAT COMMUTERS DID — one band, three unified panels ── */}
      <div className="syn-tier4">
        <div className="syn-tier4__head" data-reveal="4">
          <span className="syn-tier4__t">What Commuters Did</span>
          <span className="syn-tier4__note muted">Simulated behaviour — recorded choices, not observed spending.</span>
        </div>
        <div className="syn-tier4__grid">
          <div className="panel syn-b-panel" data-reveal="4">
            <div className="panel-t">Activities Chosen</div>
            <div className="syn-b-body">
              {M.activities.map((p) => (
                <div key={p.key} className="choice-row">
                  <span className="ci">
                    <Icon name={p.icon} sz={24} sw={1.8} />
                  </span>
                  <span className="cn">{p.label}</span>
                  <span className="bar-track">
                    <span className="bar-fill" style={{ width: barsOn && M.activitiesMax ? ((p.count / M.activitiesMax) * 100).toFixed(1) + "%" : 0 }} />
                  </span>
                  <span className="cc num">{p.count}</span>
                  <span className="cp num">{fmtPct(p.pct, 1)}</span>
                </div>
              ))}
            </div>
            <div className="syn-b-foot muted">
              Not exclusive — counts can exceed the {M.N} session{M.N === 1 ? "" : "s"}. {fmtPct(M.multiPct, 1)} chose several ({M.multiCount} of {M.N}).
              <Prov d={M.N} />
            </div>
          </div>

          <div className="panel syn-b-panel" data-reveal="4">
            <div className="panel-t">Price Decisions</div>
            <div className="syn-b-body syn-donut-row">
              <Donut
                segs={[
                  { value: M.entrySel, color: "var(--teal)" },
                  { value: M.typSel, color: "var(--teal-deep)" },
                  { value: M.highSel, color: "var(--titanium-pearl)" },
                  { value: M.wontSel, color: "var(--amber)" },
                ]}
                size={100}
                thick={18}
                centerTop="DECISIONS"
                centerVal={String(M.totalDecisions)}
              />
              <div className="donut-legend">
                {[
                  { c: "var(--teal)", t: "Low point selected", n: M.entrySel },
                  { c: "var(--teal-deep)", t: "Mid point selected", n: M.typSel },
                  { c: "var(--titanium-pearl)", t: "High point selected", n: M.highSel },
                  { c: "var(--amber)", t: "Won't shop here", n: M.wontSel, amber: true },
                ].map((r, i) => (
                  <div key={i} className="dl-row">
                    <span className="sw" style={{ background: r.c }} />
                    <span className="dt" style={r.amber ? { color: "var(--amber)" } : undefined}>
                      {r.t}
                    </span>
                    <span className="dd">
                      {r.n} of {M.totalDecisions} · {fmtPct(M.totalDecisions ? r.n / M.totalDecisions : NaN)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="syn-b-foot syn-price-split">
              <div>
                <span className="num">{fmtPct(M.totalDecisions ? M.entrySel / M.totalDecisions : NaN)}</span>
                <Prov d={M.totalDecisions} unit="decisions" />
                <div className="lbl">
                  Took the lowest price{" "}
                  <span className="muted" style={{ textTransform: "none", letterSpacing: ".02em" }}>
                    ({M.entrySel} of {M.totalDecisions})
                  </span>
                </div>
              </div>
              <div>
                <span className="num">{fmtPct(M.totalDecisions ? M.wontSel / M.totalDecisions : NaN)}</span>
                <Prov d={M.totalDecisions} unit="decisions" />
                <div className="lbl">
                  Rejected the store{" "}
                  <span className="muted" style={{ textTransform: "none", letterSpacing: ".02em" }}>
                    ({M.wontSel} of {M.totalDecisions})
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="panel syn-b-panel" data-reveal="4">
            <div className="panel-t">Go Outside</div>
            <div className="syn-b-body syn-out-row">
              <div className="syn-outside-big">
                <div className="syn-out-pct">
                  <span className="num">{fmtPct(M.goOutsidePct, 1)}</span>
                  <Prov d={M.N} />
                </div>
                <div className="lbl" style={{ lineHeight: 1.4, marginTop: 6 }}>
                  Chose to leave the Oculus
                </div>
                <div className="syn-out-count muted">
                  {M.goOutsideCount} of {M.N} session{M.N === 1 ? "" : "s"}
                </div>
              </div>
              <div className="syn-out-dests">
                <div className="lbl" style={{ marginBottom: 7 }}>
                  Destinations (of {M.goOutsideCount})
                </div>
                {(() => {
                  const omax = Math.max(...M.outside.map((o) => o.count), 1);
                  return M.outside.map((o) => (
                    <div key={o.key} className="dest-row">
                      <span className="di">
                        <Icon name={o.icon} sz={20} sw={1.5} />
                      </span>
                      <span style={{ letterSpacing: ".04em" }}>{o.label}</span>
                      <span className="bar-track" style={{ height: 10 }}>
                        <span className="bar-fill" style={{ width: ((o.count / omax) * 100).toFixed(0) + "%" }} />
                      </span>
                      <span className="num" style={{ textAlign: "right" }}>
                        {o.count} {o.count === 1 ? "user" : "users"}
                      </span>
                      <span className="num muted" style={{ textAlign: "right" }}>
                        {fmtPct(o.pct)}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── T5 · CLOSING SUMMARY ── */}
      <div className="syn-tier5">
        <div className="panel" id="takeaways" data-reveal="5">
          <div className="tk">
            <div className="tkico">
              <Icon name="bulb" sz={24} sw={2.6} />
            </div>
            <span className="panel-t" style={{ fontSize: 16 }}>
              Key Takeaways
            </span>
          </div>
          {[
            {
              ic: "bag",
              t: (
                <>
                  <b>{t1.label}</b> was the most commonly chosen activity, selected in <b>{fmtPct(t1.pct, 1)}</b> of sessions ({t1.count} of {M.N}).
                  <Prov d={M.N} />
                </>
              ),
            },
            {
              ic: "star",
              t:
                rankedByRefusal.length === 0 ? (
                  <>No store has enough opens yet to rank refusal reliably (minimum {MIN_OPENS}).</>
                ) : rankedByRefusal.length === 1 ? (
                  <>
                    <b>{rankedByRefusal[0].name}</b> had the highest refusal rate (<b>{fmtPct(rankedByRefusal[0].refusalRate)}</b>, {rankedByRefusal[0].timesOpened} opens).
                    <Prov d={rankedByRefusal[0].timesOpened} unit="opens" />
                  </>
                ) : (
                  <>
                    <b>{rankedByRefusal[0].name}</b> had the highest refusal rate (<b>{fmtPct(rankedByRefusal[0].refusalRate)}</b>), followed by {rankedByRefusal[1].name} ({fmtPct(rankedByRefusal[1].refusalRate)}).
                    <Prov d={rankedByRefusal[0].timesOpened} unit="opens" />
                  </>
                ),
            },
            {
              ic: "tag",
              t: (
                <>
                  <b>{fmtPct(M.totalDecisions ? M.entrySel / M.totalDecisions : NaN)}</b> of all store interactions resolved to the lowest price point ({M.entrySel} of {M.totalDecisions}).
                  <Prov d={M.totalDecisions} unit="decisions" />
                </>
              ),
            },
            {
              ic: "exit",
              t: (
                <>
                  <b>{fmtPct(M.goOutsidePct, 1)}</b> of users chose to leave the Oculus ({M.goOutsideCount} of {M.N}).
                  <Prov d={M.N} />
                </>
              ),
            },
          ].map((k, i) => (
            <div key={i} className="tk">
              <div className="tkico">
                <Icon name={k.ic} sz={24} sw={2.6} />
              </div>
              <div className="tkt">{k.t}</div>
            </div>
          ))}
        </div>

        <div className="panel" id="schema-stats">
          <div className="ss" data-reveal="6">
            <div className="ssv">
              {fmtPct(M.zeroSpendPct)}
              <Prov d={M.N} />
            </div>
            <div className="ssl">Of sessions spent nothing at all</div>
            <div className="ssn">
              {M.zeroSpendCount} of {M.N} sessions
            </div>
          </div>
          <div className="ss never" data-reveal="6">
            <div className="ssv">{M.neverOpenedCount}</div>
            <div className="ssl">Stores no one ever opened</div>
            {M.neverOpened.length === 0 ? (
              <div className="names">Every store was opened at least once.</div>
            ) : (
              <div className="names">
                {/* the toggle is ONE persistent element so keyboard focus
                    survives the expand/collapse re-render */}
                {neverExpanded ? (
                  <div className="names-full">{M.neverOpened.map((s) => s.name).join(" · ")}</div>
                ) : (
                  <span>{neverPreview.names.join(" · ")}{neverPreview.hidden > 0 ? " · " : ""}</span>
                )}
                {neverPreview.hidden > 0 && (
                  <button
                    type="button"
                    className="names-more"
                    aria-expanded={neverExpanded}
                    onClick={() => setNeverExpanded((v) => !v)}
                  >
                    {neverExpanded ? "Show less" : `+${neverPreview.hidden} more`}
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="ss" data-reveal="6">
            {/* an average of 2 walk-outs is noise — gate behind 10+ qualifying sessions */}
            <div className="ssv">{M.wentOutsideCount >= 10 ? mmss(M.avgLeaveSeconds) : NA}</div>
            <div className="ssl">Average time inside before walking out</div>
            <div className="ssn">
              {M.wentOutsideCount} of {M.N} sessions left the building
              {M.wentOutsideCount < 10 ? " · needs 10+ sessions" : ""}
            </div>
          </div>
        </div>
      </div>

      {/* tutorial (first View-2 visit per session) */}
      {step && tutRect && (
        <div className="syn-tutorial" data-reveal-skip>
          <div className="tut-mask" />
          <div className="tut-hole" style={{ left: tutRect.x - pad, top: tutRect.y - pad, width: tutRect.w + pad * 2, height: tutRect.h + pad * 2 }} />
          {step.pos === "below" && <div className="tut-arrow" style={{ left: tutRect.x + tutRect.w / 2 - 10, top: tutRect.y + tutRect.h + 6 }}>▲</div>}
          <div className="tut-card" style={{ left: cardX, top: cardY }}>
            <div className="tc-step">
              Step {tutIdx! + 1} of {TUT_STEPS.length}
            </div>
            <div className="tc-body">{step.body}</div>
            <div className="tc-btns">
              <button type="button" className="tc-skip" onClick={endTutorial}>
                Skip
              </button>
              <button
                type="button"
                className="tc-next"
                onClick={() => (tutIdx === TUT_STEPS.length - 1 ? endTutorial() : setTutIdx(tutIdx! + 1))}
              >
                {tutIdx === TUT_STEPS.length - 1 ? "Got it" : "Next"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
