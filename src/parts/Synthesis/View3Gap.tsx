/**
 * View 3 — The Gap. Ported from renderView3()/renderLineChart(). Teal =
 * audited store prices (measured); amber = simulated commuter behaviour
 * (proxied). Every percentage keeps its underlying count beside it.
 */
import { MIN_OPENS, NA, fmtMoney, fmtPct, priceOf, BY_SLUG, type SynthesisModel } from "./synthesisModel";
import { Donut, Icon } from "./synthesisUi";

function LineChart({ M }: { M: SynthesisModel }) {
  const W = 940,
    H = 300,
    padL = 46,
    padR = 24,
    padT = 14,
    padB = 44;
  const iw = W - padL - padR,
    ih = H - padT - padB;
  const bandsArr = M.lineBands;
  const n = bandsArr.length;
  const xs = (i: number) => padL + (n === 1 ? iw / 2 : (iw * i) / (n - 1));
  const y = (v: number) => padT + ih - (Math.min(v * 100, 100) / 100) * ih;
  const line = (key: "reject" | "lowShare", dash: boolean) => (
    <>
      <polyline
        points={bandsArr.map((b, i) => `${xs(i)},${y(b[key])}`).join(" ")}
        fill="none"
        stroke="var(--amber)"
        strokeWidth={3.2}
        strokeDasharray={dash ? "10 7" : undefined}
      />
      {bandsArr.map((b, i) => (
        <g key={i}>
          <circle cx={xs(i)} cy={y(b[key])} r={7} fill="var(--amber)" />
          <text x={xs(i)} y={y(b[key]) - 16} textAnchor="middle" fill="var(--amber)" fontSize={18} fontWeight={600} fontFamily="Space Grotesk">
            {fmtPct(b[key])}
          </text>
        </g>
      ))}
    </>
  );
  return (
    <div className="syn-line-chart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" style={{ flex: 1, minHeight: 0 }}>
        <text x={8} y={16} fill="var(--titanium-pearl)" fontSize={13} fontFamily="Space Grotesk">
          RATE (%)
        </text>
        {[0, 20, 40, 60, 80, 100].map((g) => (
          <g key={g}>
            <line x1={padL} y1={y(g / 100)} x2={W - padR} y2={y(g / 100)} stroke="rgba(80,85,86,.22)" strokeWidth={1} />
            <text x={padL - 10} y={y(g / 100) + 5} textAnchor="end" fill="var(--titanium-pearl)" fontSize={15} fontFamily="Space Grotesk">
              {g}
            </text>
          </g>
        ))}
        {line("reject", false)}
        {line("lowShare", true)}
        {bandsArr.map((b, i) => (
          <text key={i} x={xs(i)} y={H - 16} textAnchor="middle" fill="var(--titanium-pearl)" fontSize={16} fontFamily="Space Grotesk">
            {b.label}
          </text>
        ))}
      </svg>
      <div style={{ display: "flex", gap: 34, justifyContent: "center", marginTop: 8, fontSize: 14 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 26, height: 3, background: "var(--amber)", display: "inline-block" }} />
          Refused the store
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 26, height: 0, borderTop: "3px dashed var(--amber)", display: "inline-block" }} />
          Of buyers, took the cheapest tier
        </span>
      </div>
    </div>
  );
}

export default function View3Gap({ M, active }: { M: SynthesisModel; active: boolean }) {
  const sw = M.byIdStat["swarovski"],
    lo = M.byIdStat["longines"];
  const exampleStores = [
    { s: sw, dash: "solid", ic: '<path d="M12 3l4 5-4 5-4-5 4-5zM8 8h8M6 13l6 8 6-8"/>' },
    { s: lo, dash: "dashed", ic: '<circle cx="12" cy="13" r="6"/><path d="M12 10v3l2 1M9 4h6M12 4v3"/>' },
  ];
  return (
    <section className={"view" + (active ? " active" : "")} id="view3">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="mich" style={{ fontSize: 28, letterSpacing: ".04em", lineHeight: 1.18 }}>
            <span style={{ color: "var(--teal-bright)" }}>A TRANSIT HUB.</span>{" "}
            <span style={{ color: "var(--plum)" }}>A DESTINATION-RETAIL OFFERING.</span>
          </h1>
          <div className="muted" style={{ fontSize: 15, marginTop: 8, letterSpacing: ".02em" }}>
            Comparing what the Oculus offers with what daily commuters actually chose.
          </div>
        </div>
        <div className="muted" style={{ fontSize: 13, lineHeight: 1.5, maxWidth: 360, textAlign: "right", paddingTop: 4 }}>
          The Oculus moves millions of daily commuters. Our simulation shows how they engaged with the retail program inside.
        </div>
      </div>

      <div className="v3-top">
        <div className="offer-panel">
          <div className="panel-t" style={{ color: "var(--teal-bright)", fontSize: 20, letterSpacing: ".1em" }}>
            What the Oculus offers
          </div>
          <div className="fig-row divided" style={{ margin: "16px 0 22px" }}>
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
          <div className="lbl" style={{ color: "var(--teal-bright)", marginBottom: 8 }}>
            Typical price distribution{" "}
            <span className="muted" style={{ textTransform: "none", letterSpacing: ".02em" }}>
              (mid-range price)
            </span>
          </div>
          <div className="fig-row" style={{ gap: 10, marginTop: 8 }}>
            {M.typicalBands.map((b, i) => {
              const op = 0.05 + i * 0.07;
              return (
                <div
                  key={b.label}
                  className="dist-cell"
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
          <div className="muted" style={{ fontSize: 12, marginTop: 14, lineHeight: 1.45 }}>
            Typical price is the mid-range item observed in each store. Most of the retail program sits well above everyday
            commuter price points — that mismatch is the argument.
          </div>
        </div>

        <div className="gap-mid">
          <div className="gt mich">THE GAP</div>
          <svg width="150" height="28" viewBox="0 0 150 28">
            <line x1="8" y1="14" x2="142" y2="14" stroke="var(--amber)" strokeWidth="1.4" />
            <path d="M8 14l10-6M8 14l10 6" stroke="var(--amber)" strokeWidth="1.4" fill="none" />
            <path d="M142 14l-10-6M142 14l-10 6" stroke="var(--amber)" strokeWidth="1.4" fill="none" />
          </svg>
          <div className="gl">SUPPLY DOES NOT MATCH COMMUTER BEHAVIOUR.</div>
        </div>

        <div className="chose-panel">
          <div className="panel-t" style={{ color: "var(--amber)", fontSize: 20, letterSpacing: ".1em" }}>
            What daily commuters chose
          </div>
          <div className="muted" style={{ fontSize: 12, fontStyle: "italic", marginTop: 2 }}>
            Simulated behaviour — recorded choices, not observed spending.
          </div>
          <div className="fig-row divided-t" style={{ margin: "14px 0 16px" }}>
            {[
              { v: fmtPct(M.choseShopPct), l: "Chose to shop", n: M.activities.find((a) => a.key === "shop")!.count },
              { v: fmtPct(M.openedRetailPct), l: "Opened a retail store", n: M.userMetrics.openedRetail },
              { v: fmtPct(M.purchasePct), l: "Completed a purchase", n: M.userMetrics.completedPurchase },
              { v: fmtPct(M.rejectedAnyPct), l: "Selected “won't shop here”", n: M.userMetrics.rejectedAny },
              { v: fmtPct(M.goOutsidePct, 1), l: "Left the Oculus", n: M.goOutsideCount },
            ].map((f, i) => (
              <div key={i} className="fig">
                <div className="fv num" style={{ color: "var(--amber)", fontSize: 29 }}>
                  {f.v}
                </div>
                <div className="fl">{f.l}</div>
                <div className="fn">
                  {f.n} of {M.N}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 20, alignItems: "center", borderTop: "1px solid var(--border-soft)", paddingTop: 14 }}>
            <div style={{ flex: "0 0 auto" }}>
              <Donut
                segs={[
                  { value: M.entrySel, color: "var(--teal)" },
                  { value: M.typSel, color: "var(--teal-deep)" },
                  { value: M.highSel, color: "var(--titanium-pearl)" },
                  { value: M.wontSel, color: "var(--amber)" },
                ]}
                size={150}
                thick={26}
              />
            </div>
            <div className="donut-legend" style={{ flex: 1 }}>
              {[
                { c: "var(--teal)", p: M.entrySel, t: "Low point selected", s: "($)" },
                { c: "var(--teal-deep)", p: M.typSel, t: "Mid point selected", s: "($$)" },
                { c: "var(--titanium-pearl)", p: M.highSel, t: "High point selected", s: "($$$)" },
                { c: "var(--amber)", p: M.wontSel, t: "Won't shop here", s: "", amber: true },
              ].map((r, i) => (
                <div key={i} className="dl-row">
                  <span className="sw" style={{ background: r.c }} />
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                    <span className="num" style={{ fontWeight: 600, fontSize: 14, color: r.amber ? "var(--amber)" : undefined }}>
                      {fmtPct(M.totalDecisions ? r.p / M.totalDecisions : NaN)}
                    </span>
                    <span className="dt" style={{ fontWeight: 500, color: r.amber ? "var(--amber)" : undefined }}>
                      {r.t}
                    </span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {r.s}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ flex: "0 0 auto", textAlign: "center", borderLeft: "1px solid var(--border-soft)", paddingLeft: 20 }}>
              <div className="lbl" style={{ lineHeight: 1.4 }}>
                Median simulated spending
              </div>
              <div className="num" style={{ fontSize: 38, fontWeight: 600, marginTop: 10 }}>
                {fmtMoney(M.medianSpend)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="v3-bottom">
        <div className="panel" style={{ padding: "16px 22px", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div className="panel-t" style={{ fontSize: 16, color: "var(--amber)" }}>
                Typical price vs. commuter response
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                Two separate measures. Solid: of everyone who opened a store in that band, the share who refused it. Dashed: of
                those who did buy, the share who took the cheapest of the three price tiers.
              </div>
            </div>
            <div className="muted" style={{ fontSize: 12, textAlign: "right", maxWidth: 250, lineHeight: 1.4 }}>
              Refusal climbs steeply with price. Cheapest-tier share stays flat and high, so the mismatch is not only at the
              luxury end. Simulated behaviour.
            </div>
          </div>
          <LineChart M={M} />
        </div>

        <div className="panel" style={{ padding: "16px 22px", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div className="panel-t" style={{ textAlign: "center", fontSize: 16 }}>
            Example stores
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 14, flex: 1, minHeight: 0 }}>
            {exampleStores.map((e, i) => (
              <div
                key={i}
                className="ex-card"
                style={{ flex: 1, border: `1px ${e.dash} var(--amber)`, background: "linear-gradient(180deg,rgba(255,176,32,.07),transparent)" }}
              >
                <div style={{ color: "var(--amber)" }}>
                  <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: e.ic }} />
                </div>
                <div className="store-name" style={{ fontSize: 18 }}>
                  {e.s.name.toUpperCase()}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <div className="num" style={{ fontSize: 38, fontWeight: 600, color: "var(--amber)" }}>
                    {e.s.timesOpened >= MIN_OPENS ? fmtPct(e.s.refusalRate) : NA}
                  </div>
                  <div className="lbl">Refusal rate{e.s.timesOpened < MIN_OPENS ? ` (${e.s.timesOpened} opens)` : ""}</div>
                </div>
                <hr className="hair" style={{ width: "100%", margin: 0 }} />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <div className="lbl">Entry price</div>
                  <div className="num" style={{ fontSize: 22, fontWeight: 600, color: "var(--teal-bright)" }}>
                    {fmtMoney(priceOf(BY_SLUG[e.s.slug], "low"))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel" style={{ padding: "16px 22px", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div className="panel-t" style={{ textAlign: "center", fontSize: 16, marginBottom: 14 }}>
            Key observations
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            {[
              {
                ic: "xcircle",
                color: "var(--amber)",
                v: M.rejectAbove500.c ? `${fmtPct(M.rejectAbove500.rate)} rejection at high prices` : `${NA} rejection at high prices`,
                d: M.rejectAbove500.c
                  ? `${M.rejectAbove500.w} of ${M.rejectAbove500.c} interactions at stores with entry prices above $500 resulted in "Won't Shop Here".`
                  : `No interactions recorded yet at stores with entry prices above $500.`,
              },
              {
                ic: "trend",
                color: "var(--amber)",
                v: M.refusalMultiple ? `${M.refusalMultiple.toFixed(1)}× more refusals` : `${NA} refusal multiple`,
                d: M.refusalMultiple
                  ? `Stores whose cheapest item is over $500 were refused ${M.refusalMultiple.toFixed(1)}× as often as stores under $100.`
                  : `Not enough interactions yet to compare refusal across price bands.`,
              },
              {
                ic: "exit",
                color: "var(--teal-bright)",
                v: `${fmtPct(M.goOutsidePct, 1)} left the Oculus`,
                d: `${M.goOutsideCount} of ${M.N} users chose to spend their remaining time outside the building.`,
              },
            ].map((o, i) => (
              <div key={i} className="obs-row">
                <div className="oi" style={{ borderColor: o.color, color: o.color }}>
                  <Icon name={o.ic} sz={22} sw={2.4} />
                </div>
                <div>
                  <div className="ov" style={{ color: o.color }}>
                    {o.v}
                  </div>
                  <div className="od">{o.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 34, padding: "16px 30px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div
            style={{
              width: 52,
              height: 52,
              border: "1.5px solid var(--teal-bright)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "0 0 auto",
              boxShadow: "0 0 20px rgba(60,207,207,.35),inset 0 0 12px rgba(60,207,207,.2)",
            }}
          >
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="var(--teal-bright)" strokeWidth="2">
              <circle cx="12" cy="5" r="2.4" />
              <path d="M12 8v7M8 21l4-6 4 6M7 11l5 1 5-1" />
            </svg>
          </div>
          <div className="mich" style={{ fontSize: 18, letterSpacing: ".05em", lineHeight: 1.45 }}>
            <div style={{ color: "var(--titanium-pearl)" }}>THE OCULUS IS BUILT FOR MOVEMENT.</div>
            <div style={{ color: "var(--teal-bright)" }}>THE RETAIL PROGRAM INSIDE IS DESIGNED FOR A DIFFERENT KIND OF CUSTOMER.</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 26, flex: "0 0 auto" }}>
          <div style={{ width: 1, height: 52, background: "var(--border)" }} />
          <div className="muted" style={{ fontSize: 13, lineHeight: 1.5, maxWidth: 360 }}>
            Daily commuters have limited time, different price expectations, and different needs — and that shows in their
            choices.
          </div>
        </div>
      </div>

    </section>
  );
}
