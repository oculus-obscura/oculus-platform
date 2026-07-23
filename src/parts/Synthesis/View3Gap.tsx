/**
 * View 3 — The Gap. Part B2 of the UI overhaul: a CONFRONTATION, not a
 * comparison. The page argues —
 *
 *   HERO       — the thesis in one line: median typical price OFFERED (teal,
 *                measured) against median simulated spending CHOSEN (amber,
 *                estimated), with the live multiple between them
 *   COMPARISON — offer panel (teal hairlines) | THE GAP divider (a real
 *                vertical rule with opposing arrows animating outward) |
 *                behaviour panel (amber hairlines, keeps the disclaimer)
 *   CHART      — the payoff, rebuilt large: clean y-axis (0/25/50/75/100),
 *                alternating band zones, both lines DRAWING left to right on
 *                reveal (clip-rect draw — dash-pattern safe), every point
 *                labelled with its value AND raw counts, empty bands render
 *                as GAPS marked "no data yet", plain-words legend beneath
 *   FOOT       — example stores chosen dynamically (low-entry vs high-entry
 *                with real opens; audited-prices-only fallback so cards are
 *                never empty) + key observations (finding bold, counts
 *                muted beneath, honest pending states with the provisional
 *                marker)
 *
 * Colour semantics: TEAL = measured (audited prices, the offer side),
 * AMBER = estimated (all behaviour, the choice side), PLUM only in the
 * inherited headline. Reveal groups 1–8 sequence the argument (~3.5s),
 * re-trigger on return, and collapse to the final state under
 * prefers-reduced-motion (clip rects ship at full width in markup).
 */
import type { ReactNode } from "react";
import { floorLong, fmtMoney, fmtPct, type StoreStat, type SynthesisModel } from "./synthesisModel";
import { Donut, Icon, Prov } from "./synthesisUi";

/* ---------------- the price-vs-response chart ---------------- */

const CW = 1804,
  CH = 188,
  C_PADL = 74,
  C_PADR = 26,
  C_PADT = 30, // the axis title sits above the 100% tick — never colliding
  C_PADB = 40;
const C_IW = CW - C_PADL - C_PADR,
  C_IH = CH - C_PADT - C_PADB;
const ZONE_W = C_IW / 4;

interface ChartPt {
  i: number;
  x: number;
  y: number;
  v: number;
  count: string;
}

/** consecutive valid runs of length ≥ 2 become line segments; isolated valid
 *  points still render as dots — invalid bands are GAPS, never 0% */
function runsOf(pts: (ChartPt | null)[]): ChartPt[][] {
  const out: ChartPt[][] = [];
  let cur: ChartPt[] = [];
  for (const p of pts) {
    if (p) cur.push(p);
    else {
      if (cur.length >= 2) out.push(cur);
      cur = [];
    }
  }
  if (cur.length >= 2) out.push(cur);
  return out;
}

function GapChart({ M }: { M: SynthesisModel }) {
  const xs = (i: number) => C_PADL + (i + 0.5) * ZONE_W;
  const y = (v: number) => C_PADT + C_IH - Math.min(Math.max(v, 0), 1) * C_IH;
  const bands = M.lineBands.map((b) => ({
    ...b,
    won: Math.round(b.reject * b.opened),
    lowN: Math.round(b.lowShare * b.bought),
  }));
  const solid: (ChartPt | null)[] = bands.map((b, i) =>
    b.opened > 0 ? { i, x: xs(i), y: y(b.reject), v: b.reject, count: `${b.won} of ${b.opened}` } : null,
  );
  const dashed: (ChartPt | null)[] = bands.map((b, i) =>
    b.bought > 0 ? { i, x: xs(i), y: y(b.lowShare), v: b.lowShare, count: `${b.lowN} of ${b.bought}` } : null,
  );
  // solid labels live above their dots, dashed below; when a label must flip
  // at a plot edge, its offset clears the OTHER series' label at the same
  // band (identical values would otherwise superimpose)
  const ptLabel = (p: ChartPt, solidSeries: boolean) => {
    const ly = solidSeries
      ? p.y - 24 >= C_PADT
        ? p.y - 13
        : p.y + 40
      : p.y + 28 <= C_PADT + C_IH
        ? p.y + 24
        : p.y - 28;
    return (
      <text key={p.i} x={p.x} y={ly} textAnchor="middle" className="gc-ptlabel">
        <tspan className="gc-val">{fmtPct(p.v)}</tspan>
        <tspan className="gc-cnt" dx="7">
          · {p.count}
        </tspan>
      </text>
    );
  };
  return (
    <svg className="gap-chart" viewBox={`0 0 ${CW} ${CH}`} width="100%" role="img" aria-label="Refusal and cheapest-tier share per typical-price band">
      <defs>
        {/* the lines DRAW left to right: the reveal utility tweens these clip
            widths 0 → full (markup ships full width for reduced motion) */}
        <clipPath id="gapClipSolid" clipPathUnits="userSpaceOnUse">
          <rect x={C_PADL} y={0} height={CH} width={C_IW} data-reveal="6" data-reveal-dash={String(C_IW)} data-reveal-delay="0.3" />
        </clipPath>
        <clipPath id="gapClipDash" clipPathUnits="userSpaceOnUse">
          <rect x={C_PADL} y={0} height={CH} width={C_IW} data-reveal="6" data-reveal-dash={String(C_IW)} data-reveal-delay="0.85" />
        </clipPath>
      </defs>
      <g data-reveal="6">
        {/* alternating band zones — each price band is a legible region */}
        {bands.map((_, i) => (
          <rect
            key={"z" + i}
            x={C_PADL + i * ZONE_W}
            y={C_PADT}
            width={ZONE_W}
            height={C_IH}
            fill={i % 2 ? "rgba(232,232,227,0.05)" : "rgba(232,232,227,0.02)"}
          />
        ))}
        {/* y-axis: room for every tick label, title clear of the plot */}
        <text x={8} y={14} className="gc-axis-t">
          SHARE (%)
        </text>
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={C_PADL} y1={y(t / 100)} x2={CW - C_PADR} y2={y(t / 100)} stroke={t === 0 ? "rgba(80,85,86,0.5)" : "rgba(80,85,86,0.24)"} strokeWidth={1} />
            <text x={C_PADL - 12} y={y(t / 100) + 5} textAnchor="end" className="gc-tick">
              {t}%
            </text>
          </g>
        ))}
        {/* band labels + explicit no-data markers */}
        {bands.map((b, i) => (
          <text key={"b" + i} x={xs(i)} y={CH - 12} textAnchor="middle" className="gc-band">
            {b.label}
          </text>
        ))}
        {bands.map((b, i) =>
          b.opened === 0 ? (
            <text key={"nd" + i} x={xs(i)} y={C_PADT + C_IH - 12} textAnchor="middle" className="gc-nodata">
              no data yet
            </text>
          ) : null,
        )}
      </g>
      {/* SOLID — refusal share (draws first) */}
      <g clipPath="url(#gapClipSolid)">
        {runsOf(solid).map((run, k) => (
          <polyline key={k} points={run.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="var(--amber)" strokeWidth={3} />
        ))}
        {solid.map((p) => p && <circle key={p.i} cx={p.x} cy={p.y} r={5.5} fill="var(--amber)" />)}
        {solid.map((p) => p && ptLabel(p, true))}
      </g>
      {/* DASHED — cheapest-tier share of buyers (draws second) */}
      <g clipPath="url(#gapClipDash)">
        {runsOf(dashed).map((run, k) => (
          <polyline key={k} points={run.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="var(--amber)" strokeWidth={2.6} strokeDasharray="10 7" />
        ))}
        {dashed.map((p) => p && <circle key={p.i} cx={p.x} cy={p.y} r={5.5} fill="#0a0a0a" stroke="var(--amber)" strokeWidth={2} />)}
        {dashed.map((p) => p && ptLabel(p, false))}
      </g>
    </svg>
  );
}

/* ---------------- example store card ---------------- */

function ExCard({ s, tone, response }: { s: StoreStat; tone: "low" | "high"; response: boolean }) {
  return (
    <div className={"gap-ex-card " + tone}>
      <div className="gap-ex-tag">{tone === "low" ? "The affordable end" : "The expensive end"}</div>
      <div className="gap-ex-name">{s.name.toUpperCase()}</div>
      <div className="gap-ex-floor muted">{floorLong(s.floor)}</div>
      {response ? (
        <>
          <div className="gap-ex-stat">
            <span className="gap-ex-val num">{fmtPct(s.refusalRate)}</span>
            <Prov d={s.timesOpened} unit="opens" />
            <div className="gap-ex-sub muted">
              refused · {s.wontShopHere} of {s.timesOpened} opens
            </div>
          </div>
          <div className="gap-ex-price">
            <i>ENTRY</i>
            <span>{fmtMoney(s.entryPrice)}</span>
          </div>
        </>
      ) : (
        <div className="gap-ex-prices">
          {(
            [
              ["LOW", s.entryPrice],
              ["MID", s.typicalPrice],
              ["HIGH", s.highPrice],
            ] as const
          ).map(([l, v]) => (
            <span key={l} className="gap-ex-price">
              <i>{l}</i>
              <span>{fmtMoney(v)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- the view ---------------- */

export default function View3Gap({ M, active }: { M: SynthesisModel; active: boolean }) {
  // hero: the sharpest expression of the mismatch, guarded. The multiple is
  // derived STRICTLY from the corrected figures (median typical / median
  // spent) — no minimum is enforced on how large it may be; whatever the
  // honest ratio is, that ships.
  const multiple =
    M.medianTypical != null && M.medianSpend != null && M.medianSpend > 0 ? M.medianTypical / M.medianSpend : null;
  const multipleLabel =
    multiple != null && isFinite(multiple) && multiple >= 1.05
      ? `~${multiple >= 10 ? Math.round(multiple) : multiple.toFixed(1)}×`
      : null;

  // example stores: low-entry vs high-entry WITH real opens; audited-prices
  // fallback when volumes can't support a response comparison (cards always
  // carry real content — prices are always available)
  const opened = M.storeStats.filter((s) => s.timesOpened > 0);
  let exLo = M.storeStats.reduce((a, b) => (b.entryPrice < a.entryPrice ? b : a));
  let exHi = M.storeStats.reduce((a, b) => (b.entryPrice > a.entryPrice ? b : a));
  let responseMode = false;
  if (opened.length >= 2) {
    const lo = opened.reduce((a, b) => (b.entryPrice < a.entryPrice ? b : a));
    const hi = opened.reduce((a, b) => (b.entryPrice > a.entryPrice ? b : a));
    if (lo.slug !== hi.slug) {
      exLo = lo;
      exHi = hi;
      responseMode = true;
    }
  }

  // chart narrative — DERIVED from the live bands, never a fixed conclusion.
  // Below the sample floor (≥10 sessions AND ≥3 bands with opens) it states
  // the sample is too small rather than asserting a trend the plot contradicts.
  const bandsOpen = M.lineBands.filter((b) => b.opened > 0);
  const boughtTotal = M.entrySel + M.typSel + M.highSel;
  let chartNote: ReactNode;
  if (M.N < 10 || bandsOpen.length < 3) {
    chartNote = (
      <>
        Not enough interactions yet to describe a pattern across price bands.
        <Prov d={M.N} unit="sessions" zero />
      </>
    );
  } else {
    const rejects = bandsOpen.map((b) => b.reject);
    const minR = Math.min(...rejects),
      maxR = Math.max(...rejects);
    const peak = bandsOpen.reduce((a, b) => (b.reject > a.reject ? b : a));
    const refusalClause =
      maxR <= 0
        ? "No store refusals were recorded in any price band"
        : maxR - minR < 0.08
          ? `Refusal held near ${fmtPct(maxR)} across every band`
          : `Refusal ranged ${fmtPct(minR)}–${fmtPct(maxR)}, highest in the ${peak.label} band`;
    const cheapClause =
      boughtTotal > 0
        ? `of ${boughtTotal} purchases, ${fmtPct(M.entrySel / boughtTotal)} took the cheapest tier`
        : "no purchases yet to compare tiers";
    chartNote = (
      <>
        {refusalClause}; {cheapClause}.
      </>
    );
  }

  // key observations: finding bold, counts beneath; honest pending states
  const obs = [
    M.rejectAbove500.c > 0
      ? {
          ic: "xcircle",
          color: "var(--amber)",
          pending: false,
          find: `${fmtPct(M.rejectAbove500.rate)} rejection at $500+ stores`,
          sup: `${M.rejectAbove500.w} of ${M.rejectAbove500.c} interactions at stores with entry prices above $500 chose “Won't Shop Here”.`,
          d: M.rejectAbove500.c,
          unit: "interactions",
        }
      : {
          ic: "xcircle",
          color: "var(--amber)",
          pending: true,
          find: "High-price rejection — pending more data",
          sup: "No interactions recorded yet at stores with entry prices above $500.",
          d: 0,
          unit: "interactions",
        },
    M.refusalMultiple > 0
      ? {
          ic: "trend",
          color: "var(--amber)",
          pending: false,
          find: `${M.refusalMultiple.toFixed(1)}× more refusals at $500+ entry`,
          sup: `Stores whose cheapest item is over $500 were refused ${M.refusalMultiple.toFixed(1)}× as often as stores under $100.`,
          d: M.rejectAbove500.c,
          unit: "interactions",
        }
      : {
          ic: "trend",
          color: "var(--amber)",
          pending: true,
          find: "Refusal multiple — pending more data",
          sup: "Not enough interactions yet to compare refusal across price bands.",
          d: 0,
          unit: "interactions",
        },
    {
      ic: "exit",
      color: "var(--teal-bright)",
      pending: false,
      find: `${fmtPct(M.goOutsidePct, 1)} left the Oculus`,
      sup: `${M.goOutsideCount} of ${M.N} users chose to spend their remaining time outside the building.`,
      d: M.N,
      unit: "sessions",
    },
  ];

  return (
    <section className={"view" + (active ? " active" : "")} id="view3">
      {/* 1 · title + subtitle */}
      <div className="gap-head" data-reveal="1">
        <h1 className="mich">
          <span style={{ color: "var(--teal-bright)" }}>A TRANSIT HUB.</span>{" "}
          <span style={{ color: "var(--plum)" }}>A DESTINATION-RETAIL OFFERING.</span>
        </h1>
        <div className="muted gap-head__sub">Comparing what the Oculus offers with what daily commuters actually chose.</div>
      </div>

      {/* 2 · the thesis: one opposed pair + the live multiple */}
      <div className="gap-hero">
        <div className="gap-hero__side offer" data-reveal="2">
          <div className="gap-hero__lab">Median typical price — offered</div>
          <div className="gap-hero__fig mich num">{fmtMoney(M.medianTypical)}</div>
          <div className="gap-hero__cap muted">audited across {M.totalStores} stores</div>
        </div>
        <div className="gap-hero__mid" data-reveal="2" data-reveal-delay="0.95">
          <div className="gap-hero__vs">vs</div>
          {multipleLabel && (
            <div className="gap-hero__xlab">
              the building asks <b>{multipleLabel}</b> what commuters chose
            </div>
          )}
        </div>
        <div className="gap-hero__side chose" data-reveal="2" data-reveal-delay="0.45">
          <div className="gap-hero__lab">Median simulated spending — chosen</div>
          <div className="gap-hero__fig mich num">{fmtMoney(M.medianSpend)}</div>
          <div className="gap-hero__cap muted">
            {M.medianSpend != null ? (
              <>
                across {M.purchaseCount} purchase{M.purchaseCount === 1 ? "" : "s"} · {M.N} session{M.N === 1 ? "" : "s"}
              </>
            ) : (
              <>needs at least one purchase</>
            )}
            <Prov d={M.N} />
          </div>
        </div>
      </div>

      {/* 3–5 · the confrontation: offer | THE GAP | behaviour */}
      <div className="gap-compare">
        <div className="offer-panel" data-reveal="4">
          <div className="panel-t" style={{ color: "var(--teal-bright)", fontSize: 16, letterSpacing: ".1em" }}>
            What the Oculus offers
          </div>
          <div className="fig-row divided" style={{ margin: "8px 0 10px" }}>
            {[
              { v: String(M.totalStores), l: "Stores surveyed" },
              { v: fmtPct(M.typicalOver100Pct), l: "Typical price above $100" },
              { v: fmtMoney(M.medianTypical), l: "Median typical price" },
              { v: String(M.typicalOver500), l: "Typical price ≥ $500" },
            ].map((f, i) => (
              <div key={i} className="fig">
                <div className="fv num" style={{ color: "var(--teal-bright)" }}>
                  {f.v}
                </div>
                <div className="fl">{f.l}</div>
              </div>
            ))}
          </div>
          <div className="lbl" style={{ color: "var(--teal-bright)", marginBottom: 6 }}>
            Typical price distribution{" "}
            <span className="muted" style={{ textTransform: "none", letterSpacing: ".02em" }}>
              (mid-range price)
            </span>
          </div>
          <div className="fig-row" style={{ gap: 10, marginTop: 6 }}>
            {M.typicalBands.map((b, i) => {
              const op = 0.05 + i * 0.07;
              return (
                <div
                  key={b.label}
                  className="dist-cell"
                  data-reveal="4"
                  data-reveal-pop
                  data-reveal-delay={String(0.25 + i * 0.08)}
                  style={{
                    background: `linear-gradient(180deg,rgba(44,224,210,${op * 0.5}),rgba(44,224,210,${op + 0.06}))`,
                    borderColor: `rgba(44,224,210,${0.28 + i * 0.1})`,
                  }}
                >
                  <div className="dband">{b.label}</div>
                  <div className="dpct num">{fmtPct(b.pct)}</div>
                  <div className="dcnt">{b.count} stores</div>
                </div>
              );
            })}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.4 }}>
            Typical price is the mid-range item observed in each store. Most of the retail program sits well above everyday
            commuter price points — that mismatch is the argument.
          </div>
        </div>

        <div className="gap-divider">
          <span className="gap-divider__line" data-reveal="3" data-reveal-draw="y" aria-hidden="true" />
          <div className="gap-divider__chip">
            <div className="gap-divider__t mich" data-reveal="3">
              THE GAP
            </div>
            <div className="gap-divider__arrows" aria-hidden="true">
              <svg data-reveal="3" data-reveal-out="left" data-reveal-delay="0.2" viewBox="0 0 24 24">
                <path d="M19 12H5M11 6l-6 6 6 6" />
              </svg>
              <svg data-reveal="3" data-reveal-out="right" data-reveal-delay="0.2" viewBox="0 0 24 24">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </div>
            <div className="gap-divider__sub" data-reveal="3" data-reveal-delay="0.3">
              SUPPLY DOES NOT MATCH COMMUTER BEHAVIOUR.
            </div>
          </div>
        </div>

        <div className="chose-panel" data-reveal="5">
          <div className="panel-t" style={{ color: "var(--amber)", fontSize: 16, letterSpacing: ".1em" }}>
            What daily commuters chose
          </div>
          <div className="muted" style={{ fontSize: 12, fontStyle: "italic", marginTop: 2 }}>
            Simulated behaviour — recorded choices, not observed spending.
          </div>
          <div className="fig-row divided-t" style={{ margin: "8px 0 8px" }}>
            {[
              { v: fmtPct(M.choseShopPct), l: "Chose to shop", n: M.activities.find((a) => a.key === "shop")!.count },
              { v: fmtPct(M.openedRetailPct), l: "Opened a retail store", n: M.userMetrics.openedRetail },
              { v: fmtPct(M.purchasePct), l: "Completed a purchase", n: M.userMetrics.completedPurchase },
              { v: fmtPct(M.rejectedAnyPct), l: "Selected “won't shop here”", n: M.userMetrics.rejectedAny },
              { v: fmtPct(M.goOutsidePct, 1), l: "Left the Oculus", n: M.goOutsideCount },
            ].map((f, i) => (
              <div key={i} className="fig">
                <div className="fv num" style={{ color: "var(--amber)", fontSize: 24 }}>
                  {f.v}
                </div>
                <div className="fl">{f.l}</div>
                <div className="fn">
                  {f.n} of {M.N}
                  <Prov d={M.N} />
                </div>
              </div>
            ))}
          </div>
          <div className="gap-chose-donut">
            <div className="gap-chose-donut__ring" data-reveal="5" data-reveal-pop data-reveal-delay="0.25">
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
            </div>
            <div className="donut-legend">
              {[
                { c: "var(--teal)", p: M.entrySel, t: "Low point selected" },
                { c: "var(--teal-deep)", p: M.typSel, t: "Mid point selected" },
                { c: "var(--titanium-pearl)", p: M.highSel, t: "High point selected" },
                { c: "var(--amber)", p: M.wontSel, t: "Won't shop here", amber: true },
              ].map((r, i) => (
                <div key={i} className="dl-row">
                  <span className="sw" style={{ background: r.c }} />
                  <span className="dt" style={r.amber ? { color: "var(--amber)" } : undefined}>
                    {r.t}
                  </span>
                  <span className="dd">
                    {r.p} of {M.totalDecisions} · {fmtPct(M.totalDecisions ? r.p / M.totalDecisions : NaN)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 6 · the payoff chart */}
      <div className="panel gap-chart-panel">
        <div className="syn-phead" data-reveal="6">
          <div className="syn-phead__title">
            <div style={{ minWidth: 0 }}>
              <div className="panel-t" style={{ fontSize: 15, color: "var(--amber)" }}>
                Typical price vs. commuter response
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
                Share of commuters per typical-price band. Simulated behaviour.
              </div>
            </div>
          </div>
          <div className="gap-chart-note muted">{chartNote}</div>
        </div>
        <GapChart M={M} />
        <div className="gap-legend" data-reveal="6" data-reveal-delay="0.15">
          <span>
            <i className="gl-solid" />
            <b>Solid</b> — of everyone who opened a store in this band, the share who walked away.
          </span>
          <span>
            <i className="gl-dash" />
            <b>Dashed</b> — of those who did buy, the share who took the cheapest of the three tiers.
          </span>
        </div>
      </div>

      {/* 7 · example stores + key observations */}
      <div className="gap-foot">
        <div className="panel gap-ex-panel" data-reveal="7">
          <div className="panel-t" style={{ fontSize: 14 }}>
            Example stores
          </div>
          {!responseMode && (
            <div className="gap-ex-note muted">Response data needs more sessions — the prices below are audited.</div>
          )}
          <div className="gap-ex-row">
            <ExCard s={exLo} tone="low" response={responseMode} />
            <div className="gap-ex-vs mich" aria-hidden="true">
              VS
            </div>
            <ExCard s={exHi} tone="high" response={responseMode} />
          </div>
        </div>
        <div className="panel gap-obs-panel" data-reveal="7">
          <div className="panel-t" style={{ fontSize: 14 }}>
            Key observations
          </div>
          <div className="gap-obs-list">
            {obs.map((o, i) => (
              <div key={i} className="obs-row">
                <div className="oi" style={{ borderColor: o.color, color: o.color }}>
                  <Icon name={o.ic} sz={20} sw={2.4} />
                </div>
                <div className="obs-main">
                  <div className={"obs-find" + (o.pending ? " pending" : "")} style={o.pending ? undefined : { color: o.color }}>
                    {o.find}
                    <Prov d={o.d} unit={o.unit} zero={o.pending} />
                  </div>
                  <div className="obs-sup muted">{o.sup}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 8 · closing statement */}
      <div className="panel gap-close" data-reveal="8">
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div className="gap-close__ico">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="var(--teal-bright)" strokeWidth="2">
              <circle cx="12" cy="5" r="2.4" />
              <path d="M12 8v7M8 21l4-6 4 6M7 11l5 1 5-1" />
            </svg>
          </div>
          <div className="mich" style={{ fontSize: 16, letterSpacing: ".05em", lineHeight: 1.45 }}>
            <div style={{ color: "var(--titanium-pearl)" }}>THE OCULUS IS BUILT FOR MOVEMENT.</div>
            <div style={{ color: "var(--teal-bright)" }}>THE RETAIL PROGRAM INSIDE IS DESIGNED FOR A DIFFERENT KIND OF CUSTOMER.</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 26, flex: "0 0 auto" }}>
          <div style={{ width: 1, height: 48, background: "var(--border)" }} />
          <div className="muted" style={{ fontSize: 13, lineHeight: 1.5, maxWidth: 380 }}>
            Daily commuters have limited time, different price expectations, and different needs — and that shows in their
            choices.
          </div>
        </div>
      </div>
    </section>
  );
}
