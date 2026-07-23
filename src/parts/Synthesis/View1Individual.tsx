/**
 * View 1 — Individual Result. Ported from the prototype's renderView1() /
 * renderPath(); reads ONLY the in-memory CompletedSession + the static
 * catalog, so it renders instantly and never waits on the network.
 * Session vocabulary (Step 1 contract): endedBy 'wentOutside'|'timerExpired',
 * path steps keyed by storeSlug, decisions entry|typical|high|wontShopHere.
 */
import type { CompletedSession, CompletedSessionPathStep } from "../Simulation/SimulationGame";
import {
  BY_SLUG,
  CAT_ICON,
  CAT_LABEL,
  DEST_TYPE,
  NA,
  OUTSIDE_META,
  PRICE_PILL,
  fmtMoney,
  fmtPct,
  floorLabel,
  floorLong,
  priceOf,
} from "./synthesisModel";
import { Icon } from "./synthesisUi";
import type { ReactNode } from "react";

interface Derived {
  is: CompletedSession;
  cat: string | null;
  nodes: CompletedSessionPathStep[];
  purchases: CompletedSessionPathStep[];
  rejected: CompletedSessionPathStep[];
  storesVisited: number;
  purchasesMade: number;
  storesRejected: number;
  floorsVisited: number;
  totalSpent: number;
  purchaseRate: number;
  rejectionRate: number;
  avgPurchase: number;
}

/** The prototype's computeIndividual(), verbatim. */
function computeIndividual(is: CompletedSession): Derived {
  const nodes = is.path || [];
  const purchases = nodes.filter((n) => n.decision !== "wontShopHere");
  const rejected = nodes.filter((n) => n.decision === "wontShopHere");
  const totalSpent = nodes.reduce((a, n) => a + (n.pricePaid || 0), 0);
  const cat = (is.primaryChoices && is.primaryChoices[0]) || null;
  return {
    is,
    cat,
    nodes,
    purchases,
    rejected,
    storesVisited: nodes.length,
    purchasesMade: purchases.length,
    storesRejected: rejected.length,
    floorsVisited: (is.floorsVisited || []).length,
    totalSpent,
    purchaseRate: nodes.length ? purchases.length / nodes.length : 0,
    rejectionRate: nodes.length ? rejected.length / nodes.length : 0,
    avgPurchase: purchases.length ? totalSpent / purchases.length : 0,
  };
}

const ORD = ["1ST", "2ND", "3RD", "4TH", "5TH"];

function PathNode({ inner, cap, floor }: { inner: ReactNode; cap?: string; floor?: string | null }) {
  return (
    <div className="path-node">
      <div className="path-floor">{floor || " "}</div>
      {inner}
      {cap ? <div className="path-cap">{cap}</div> : null}
    </div>
  );
}

function MiniCard({ icon, label, small }: { icon: string; label: ReactNode; small?: boolean }) {
  return (
    <div className="path-card mini">
      <div className="path-ico">
        <Icon name={icon} sz={50} sw={1.5} />
      </div>
      <div className="num" style={{ fontSize: small ? 16 : 17, letterSpacing: small ? ".08em" : ".12em", textAlign: "center" }}>
        {label}
      </div>
    </div>
  );
}

function Path({ D }: { D: Derived }) {
  const is = D.is;
  const parts: ReactNode[] = [];
  parts.push(
    <PathNode key="start" cap="START" inner={<MiniCard icon={D.cat ? CAT_ICON[D.cat] || "clock" : "clock"} label={D.cat ? CAT_LABEL[D.cat] : NA} />} />,
  );
  if (D.cat === "restroom") {
    parts.push(<PathNode key="rest" cap="BASIC NEED" inner={<MiniCard icon="people" label="RESTROOM" />} />);
  }
  let prevFloor: number | null = null;
  (D.nodes || []).forEach((n, i) => {
    if (prevFloor && n.floor !== prevFloor) {
      parts.push(
        <PathNode key={`fl${i}`} inner={<MiniCard small icon="stairs" label={<>TO {floorLong(n.floor)}</>} />} />,
      );
    }
    const s = BY_SLUG[n.storeSlug];
    const reject = n.decision === "wontShopHere";
    const pill = reject ? (
      <span className="pill reject">{D.cat === "grabABite" ? "WOULDN'T STOP HERE" : "WOULDN'T SHOP HERE"}</span>
    ) : (
      <span className={`pill ${PRICE_PILL[n.decision].cls}`}>{PRICE_PILL[n.decision].label}</span>
    );
    parts.push(
      <PathNode
        key={`s${i}`}
        cap={reject ? "LOWEST PRICE" : "PURCHASE"}
        floor={floorLong(n.floor)}
        inner={
          <div className="path-card">
            <div className={`path-badge ${reject ? "no" : "ok"}`}>
              {reject ? (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#3a2400" strokeWidth="2.6">
                  <path d="M7 7l10 10M17 7L7 17" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#06201f" strokeWidth="2.8">
                  <path d="M5 12l5 5 9-10" />
                </svg>
              )}
            </div>
            <div className="store-name" style={{ fontSize: 19 }}>
              {(s?.name ?? n.storeSlug).toUpperCase()}
            </div>
            {pill}
            <div className="num" style={{ fontSize: reject ? 22 : 24, fontWeight: 600 }}>
              {fmtMoney(reject ? (s ? priceOf(s, "low") : null) : n.pricePaid)}
            </div>
          </div>
        }
      />,
    );
    prevFloor = n.floor;
  });
  if (is.endedBy === "wentOutside") {
    const dest = OUTSIDE_META.find((o) => o.key === is.outsideDestination);
    parts.push(
      <PathNode key="out" cap="CHOICE" inner={<MiniCard small icon="exit" label={<>WENT<br />OUTSIDE</>} />} />,
      <PathNode
        key="dest"
        cap="DESTINATION"
        inner={
          <div className="path-card mini">
            <div className="path-ico">
              <Icon name={dest?.icon || "exit"} sz={50} sw={1.5} />
            </div>
            <div className="num" style={{ fontSize: 15, letterSpacing: ".04em", textAlign: "center", lineHeight: 1.25 }}>
              {(dest?.label || NA).toUpperCase()}
            </div>
          </div>
        }
      />,
      <PathNode key="end" inner={<MiniCard small icon="clock" label="SESSION END" />} />,
    );
  } else {
    parts.push(<PathNode key="end" cap="SESSION END" inner={<MiniCard icon="clock" label="TIME'S UP" />} />);
  }
  return <>{parts}</>;
}

export default function View1Individual({ is, onExplore }: { is: CompletedSession; onExplore: () => void }) {
  const D = computeIndividual(is);
  const isFood = D.cat === "grabABite";
  const rejectWord = isFood ? "WOULDN'T STOP HERE" : "WOULDN'T SHOP HERE";
  const catLabelV = D.cat ? CAT_LABEL[D.cat] : "NONE";
  const extraCats = (is.primaryChoices || []).slice(1);
  const floorsTrail = (is.floorsVisited || []).map(floorLong).join("  →  ") || NA;

  const isOutside = is.endedBy === "wentOutside";
  const dest = isOutside ? OUTSIDE_META.find((o) => o.key === is.outsideDestination) || { label: NA, icon: "exit" } : null;
  const destType = isOutside ? DEST_TYPE[is.outsideDestination ?? ""] || NA : null;

  const statCells = isOutside
    ? [
        { ic: "exit", n: destType as string, l: "Destination Type", text: true },
        { ic: "dollar", n: 0, l: "Total Spent", money: true },
        { ic: "bag", n: D.storesVisited, l: D.storesVisited === 1 ? "Store Visited Before Leaving" : "Stores Visited Before Leaving" },
      ]
    : [
        { ic: "bag", n: D.storesVisited, l: "Stores Visited" },
        { ic: "bagcheck", n: D.purchasesMade, l: "Purchases Made" },
        { ic: "xcircle", n: D.storesRejected, l: D.storesRejected === 1 ? "Store Rejected" : "Stores Rejected" },
        { ic: "stairs", n: D.floorsVisited, l: "Floors Visited" },
        { ic: "dollar", n: D.totalSpent, l: "Total Spent", money: true },
      ];

  // node count for the adaptive path sizing (start + floors + stores + tail)
  let nodeCount = 1 + (D.cat === "restroom" ? 1 : 0) + (isOutside ? 3 : 1);
  let pf: number | null = null;
  for (const n of D.nodes) {
    if (pf && n.floor !== pf) nodeCount++;
    nodeCount++;
    pf = n.floor;
  }
  nodeCount = Math.min(nodeCount, 6);

  const purchasesTbl =
    D.cat === "restroom" ? (
      <div className="empty-line">
        You prioritised a basic need.
        <br />
        No commercial interaction was logged.
      </div>
    ) : D.purchases.length === 0 ? (
      <div className="empty-line">No stores were opened during this session.</div>
    ) : (
      <table className="data-table">
        <thead>
          <tr>
            <th>Store</th>
            <th>Floor</th>
            <th>Price Level</th>
            <th style={{ textAlign: "right" }}>Selected Price</th>
          </tr>
        </thead>
        <tbody>
          {D.purchases.map((n, i) => {
            const s = BY_SLUG[n.storeSlug];
            const pp = PRICE_PILL[n.decision];
            return (
              <tr key={i}>
                <td className="store-name">{(s?.name ?? n.storeSlug).toUpperCase()}</td>
                <td className="num">{floorLabel(n.floor)}</td>
                <td>
                  <span className={`pill ${pp.cls}`}>{pp.label}</span>
                </td>
                <td className="num" style={{ textAlign: "right", fontSize: 18, fontWeight: 600 }}>
                  {fmtMoney(n.pricePaid)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} style={{ color: "var(--teal-bright)", fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", fontSize: 14, borderBottom: 0, paddingTop: 18 }}>
              Total Spent
            </td>
            <td className="num" style={{ textAlign: "right", color: "var(--teal-glow)", fontSize: 22, fontWeight: 600, borderBottom: 0, paddingTop: 18 }}>
              {fmtMoney(D.totalSpent)}
            </td>
          </tr>
        </tfoot>
      </table>
    );

  const rejectedTbl =
    D.cat === "restroom" ? (
      <div className="empty-line">No commercial interaction was logged.</div>
    ) : D.rejected.length === 0 ? (
      <div className="empty-line">No stores were rejected during this session.</div>
    ) : (
      <table className="data-table">
        <thead>
          <tr>
            <th>Store</th>
            <th>Floor</th>
            <th style={{ textAlign: "right" }}>Lowest Price</th>
            <th style={{ textAlign: "right" }}>Your Choice</th>
          </tr>
        </thead>
        <tbody>
          {D.rejected.map((n, i) => {
            const s = BY_SLUG[n.storeSlug];
            return (
              <tr key={i}>
                <td className="store-name">{(s?.name ?? n.storeSlug).toUpperCase()}</td>
                <td className="num">{floorLabel(n.floor)}</td>
                <td className="num" style={{ textAlign: "right", fontSize: 17 }}>
                  {fmtMoney(s ? priceOf(s, "low") : null)}
                </td>
                <td style={{ textAlign: "right", color: "var(--amber)", fontWeight: 600, letterSpacing: ".06em", fontSize: 13 }}>
                  {rejectWord}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );

  const highlight = isOutside ? (
    <div style={{ display: "flex", alignItems: "center", gap: 44 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, color: "var(--teal-bright)" }}>
        <Icon name="exit" sz={30} sw={1.8} />
        <span className="panel-t">Session Highlight</span>
      </div>
      {[
        { l: "Total Spent", v: "$0" },
        { l: D.storesVisited === 1 ? "Store Visited" : "Stores Visited", v: String(D.storesVisited) },
        { l: "Destination Type", v: destType as string, small: true },
      ].map((h, i) => (
        <div key={i}>
          <div className="lbl">{h.l}</div>
          <div className="num" style={{ fontSize: h.small ? 22 : 30, fontWeight: 600, marginTop: 6 }}>
            {h.v}
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div style={{ display: "flex", alignItems: "center", gap: 44 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, color: "var(--teal-bright)" }}>
        <Icon name="bars" sz={30} sw={1.8} />
        <span className="panel-t">Session Highlight</span>
      </div>
      {[
        { l: "Purchase Rate", v: fmtPct(D.nodes.length ? D.purchaseRate : NaN) },
        { l: "Store Rejection Rate", v: fmtPct(D.nodes.length ? D.rejectionRate : NaN) },
        { l: "Average Purchase", v: D.purchasesMade ? fmtMoney(Math.round(D.avgPurchase)) : NA },
      ].map((h, i) => (
        <div key={i}>
          <div className="lbl">{h.l}</div>
          <div className="num" style={{ fontSize: 30, fontWeight: 600, marginTop: 6 }}>
            {h.v}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="v1-grid">
      {/* left column */}
      <div style={{ gridRow: "1 / span 2", display: "flex", flexDirection: "column", gap: 10, minHeight: 0, overflowY: "auto" }}>
        <div>
          <h1 className="mich" style={{ fontSize: 26, letterSpacing: ".05em", lineHeight: 1.15 }}>
            YOUR SESSION SUMMARY
          </h1>
          <div className="lbl" style={{ fontSize: 13, marginTop: 6 }}>
            Individual Result
          </div>
          <div className="muted" style={{ fontSize: 14, marginTop: 8, lineHeight: 1.4 }}>
            Here is what you did within 15 minutes inside the Oculus.
          </div>
        </div>
        <div className="panel" style={{ padding: "14px 26px" }}>
          <div className="lbl">1st Category Chosen</div>
          <div className="mich" style={{ fontSize: 34, marginTop: 8, letterSpacing: ".04em" }}>
            {catLabelV}
          </div>
        </div>
        <div className="panel" style={{ padding: "12px 26px" }}>
          <div className="lbl">Floors Visited</div>
          <div className="num" style={{ fontSize: 20, marginTop: 8, letterSpacing: ".08em", color: "var(--titanium-pearl)" }}>
            {floorsTrail}
          </div>
        </div>
        {extraCats.map((c, i) => (
          <div key={i} className="panel" style={{ padding: "9px 24px", borderColor: "rgba(226,79,209,.45)", background: "linear-gradient(180deg,rgba(40,12,38,.42),var(--panel))" }}>
            <div className="lbl" style={{ color: "var(--plum)" }}>
              {ORD[i + 1]} Category Chosen
            </div>
            <div className="num" style={{ fontSize: 18, marginTop: 5, letterSpacing: ".08em", color: "var(--plum)" }}>
              {CAT_LABEL[c] || NA}
            </div>
          </div>
        ))}
        {is.outsideDestination ? (
          <div className="panel" style={{ padding: "22px 26px" }}>
            <div className="lbl">Destination Chosen</div>
            <div className="num" style={{ fontSize: 22, marginTop: 12, letterSpacing: ".06em", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ color: "var(--teal-bright)" }}>
                <Icon name={OUTSIDE_META.find((o) => o.key === is.outsideDestination)?.icon || "exit"} sz={24} sw={1.6} />
              </span>
              {(OUTSIDE_META.find((o) => o.key === is.outsideDestination) || { label: NA }).label}
            </div>
          </div>
        ) : null}
      </div>

      {/* stat cells */}
      <div style={{ gridColumn: 2, display: "grid", gridTemplateColumns: `repeat(${statCells.length},1fr)`, gap: 16 }}>
        {statCells.map((c, i) => (
          <div key={i} className="stat-cell">
            <div className="top">
              <span className="ico">
                <Icon name={c.ic} sz={34} sw={1.6} />
              </span>
              {"text" in c && c.text ? (
                <span className="num" style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.15 }}>
                  {c.n}
                </span>
              ) : (
                <span className="big num">{"money" in c && c.money ? fmtMoney(c.n as number) : c.n}</span>
              )}
            </div>
            <div className="lbl">{c.l}</div>
          </div>
        ))}
      </div>

      {/* tables / outside panel */}
      {isOutside ? (
        <div style={{ gridColumn: 2, display: "flex" }}>
          <div className="panel" style={{ flex: 1, padding: "38px 44px", display: "flex", flexDirection: "column", justifyContent: "center", background: "linear-gradient(180deg,rgba(8,40,42,.4),var(--panel))" }}>
            <div className="lbl" style={{ color: "var(--teal-bright)" }}>
              Destination Chosen
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 18 }}>
              <span style={{ color: "var(--teal-bright)", flex: "0 0 auto" }}>
                <Icon name={dest!.icon} sz={58} sw={1.4} />
              </span>
              <div className="mich" style={{ fontSize: 54, letterSpacing: ".02em", lineHeight: 1.05 }}>
                {dest!.label}
              </div>
            </div>
            <div className="num" style={{ fontSize: 20, letterSpacing: ".06em", marginTop: 20, color: "var(--titanium-pearl)" }}>
              {destType}
            </div>
            <hr className="hair" style={{ margin: "26px 0" }} />
            <div style={{ display: "flex", alignItems: "flex-end", gap: 48 }}>
              <div>
                <div className="lbl">Total Spent</div>
                <div className="num" style={{ fontSize: 46, fontWeight: 600, marginTop: 8 }}>
                  $0
                </div>
              </div>
              <div style={{ maxWidth: 380 }}>
                <div className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
                  This player chose to leave the Oculus
                  {D.storesVisited ? ` after visiting ${D.storesVisited} ${D.storesVisited === 1 ? "store" : "stores"}` : ` straight away`}. No purchase was made inside.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ gridColumn: 2, display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 18, alignItems: "stretch" }}>
          <div className="panel" style={{ padding: "22px 26px", display: "flex", flexDirection: "column" }}>
            <div className="panel-t" style={{ marginBottom: 14 }}>
              Purchases
            </div>
            {purchasesTbl}
          </div>
          <div className="panel" style={{ padding: "22px 26px", display: "flex", flexDirection: "column" }}>
            <div className="panel-t" style={{ marginBottom: 14 }}>
              Rejected Stores
            </div>
            {rejectedTbl}
          </div>
        </div>
      )}

      {/* path */}
      <div className="panel" style={{ gridColumn: "1 / span 2", padding: "18px 26px", display: "flex", flexDirection: "column" }}>
        <div className="panel-t">Your Path</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 5 }}>
          A timeline of the stores you visited and your choices.
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", minHeight: 0 }}>
          <div className={`path-row n${nodeCount}`}>
            <Path D={D} />
          </div>
        </div>
      </div>

      {/* footer */}
      <div style={{ gridColumn: "1 / span 2", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 30 }}>
        <div className="panel" style={{ padding: "20px 30px", flex: 1 }}>
          {highlight}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 11, flex: "0 0 auto" }}>
          <span className="lbl" style={{ letterSpacing: ".18em" }}>
            See how you compare
          </span>
          <button type="button" className="cta" onClick={onExplore}>
            Explore Synthesis{" "}
            <svg className="cta-arrow" viewBox="0 0 24 24">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
