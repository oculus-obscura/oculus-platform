/**
 * View 1 — Individual Result ("Your Session Summary").
 *
 * Reads ONLY the in-memory CompletedSession + the static catalog, so it renders
 * instantly and never waits on the network. Session vocabulary (Step 1
 * contract): endedBy 'wentOutside'|'timerExpired', path steps keyed by
 * storeSlug, decisions entry|typical|high|wontShopHere.
 *
 * Refinement pass (styling / consistency / animation — NOT a rebuild):
 *  - every figure derives from THIS session's path from one source of truth,
 *    so counts and rates can never contradict one another; percentages carry
 *    their underlying "N of M", and an incomputable rate renders "—".
 *  - YOUR PATH is a transit ROUTE: a hairline draws from START to SESSION END,
 *    a travelling light rides its leading edge, and each station node
 *    illuminates (teal = purchase, amber = refusal) as the light arrives while
 *    its card fades in — the journey builds. Floor changes step the route
 *    between two bands (1ST above / 2ND below). The visual language (hairline
 *    weight, station-node motif, travelling light, expo easing) echoes the
 *    intro sequence and the Simulation's timer rail.
 *  - the whole view reveals in order (title → stat tiles → left panels →
 *    purchases/rejected → path → highlight → CTA); prefers-reduced-motion and
 *    inactive render the composed final frame instantly (route drawn, no light,
 *    no count-ups).
 */
import { useLayoutEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
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

gsap.registerPlugin(MotionPathPlugin);

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

/** All figures on this view come from here — one pass over the session path. */
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

/* ─────────────────────────────────────────────────────────────────────────
 * The route model. Every station on Your Path is one Stop; the DOM cards and
 * the SVG route are both built from this array, in this order, so a measured
 * node center always maps to the right stop.
 * band: which horizontal rail the node sits on — floor 1 above, floor 2 below,
 * terminus/utility stops on the neutral mid-rail.
 * ──────────────────────────────────────────────────────────────────────── */
type Band = "top" | "mid" | "bottom";
type Tone = "start" | "end" | "util" | "buy" | "reject";

interface Stop {
  key: string;
  kind: "terminus" | "util" | "store";
  band: Band;
  tone: Tone;
  card: ReactNode;
  cap?: string;
}

const bandOfFloor = (f: number): Band => (Number(f) === 2 ? "bottom" : "top");

function buildStops(D: Derived): Stop[] {
  const is = D.is;
  const isFood = D.cat === "grabABite";
  const stops: Stop[] = [];

  // START — the activity the commuter set out to do
  stops.push({
    key: "start",
    kind: "terminus",
    band: "mid",
    tone: "start",
    cap: "START",
    card: <MiniCard icon={D.cat ? CAT_ICON[D.cat] || "clock" : "clock"} label={D.cat ? CAT_LABEL[D.cat] : NA} />,
  });

  if (D.cat === "restroom") {
    stops.push({
      key: "rest",
      kind: "util",
      band: "mid",
      tone: "util",
      cap: "BASIC NEED",
      card: <MiniCard icon="people" label="RESTROOM" />,
    });
  }

  (D.nodes || []).forEach((n, i) => {
    const s = BY_SLUG[n.storeSlug];
    const reject = n.decision === "wontShopHere";
    const pill = reject ? (
      <span className="pill reject">{isFood ? "WOULDN'T STOP HERE" : "WOULDN'T SHOP HERE"}</span>
    ) : (
      <span className={`pill ${PRICE_PILL[n.decision].cls}`}>{PRICE_PILL[n.decision].label}</span>
    );
    stops.push({
      key: `s${i}`,
      kind: "store",
      band: bandOfFloor(n.floor),
      tone: reject ? "reject" : "buy",
      cap: `${floorLabel(n.floor)} · ${reject ? "LOWEST PRICE" : "PURCHASE"}`,
      card: (
        <div className="path-card">
          <div className="store-name path-card__name">{(s?.name ?? n.storeSlug).toUpperCase()}</div>
          {pill}
          <div className="num path-card__price">{fmtMoney(reject ? (s ? priceOf(s, "low") : null) : n.pricePaid)}</div>
        </div>
      ),
    });
  });

  if (is.endedBy === "wentOutside") {
    const dest = OUTSIDE_META.find((o) => o.key === is.outsideDestination);
    stops.push(
      {
        key: "out",
        kind: "util",
        band: "mid",
        tone: "util",
        cap: "CHOICE",
        card: <MiniCard small icon="exit" label={<>WENT<br />OUTSIDE</>} />,
      },
      {
        key: "dest",
        kind: "util",
        band: "mid",
        tone: "util",
        cap: "DESTINATION",
        card: (
          <div className="path-card mini">
            <div className="path-ico">
              <Icon name={dest?.icon || "exit"} sz={46} sw={1.5} />
            </div>
            <div className="num path-dest-label">{(dest?.label || NA).toUpperCase()}</div>
          </div>
        ),
      },
      { key: "end", kind: "terminus", band: "mid", tone: "end", card: <MiniCard small icon="clock" label="SESSION END" /> },
    );
  } else {
    stops.push({
      key: "end",
      kind: "terminus",
      band: "mid",
      tone: "end",
      cap: "SESSION END",
      card: <MiniCard icon="clock" label="TIME'S UP" />,
    });
  }

  return stops;
}

function MiniCard({ icon, label, small }: { icon: string; label: ReactNode; small?: boolean }) {
  return (
    <div className="path-card mini">
      <div className="path-ico">
        <Icon name={icon} sz={46} sw={1.5} />
      </div>
      <div
        className="num path-mini-label"
        style={{ fontSize: small ? 15 : 16, letterSpacing: small ? ".07em" : ".11em" }}
      >
        {label}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * PathRoute — the cards, measured and connected by an SVG transit route that
 * draws itself, illuminates node by node, and rides a travelling light. Owns
 * its own animation (built imperatively from measured node centers), gated on
 * `active`. prefers-reduced-motion / inactive → composed frame instantly.
 * ──────────────────────────────────────────────────────────────────────── */
const SVGNS = "http://www.w3.org/2000/svg";
function mk(tag: string, attrs: Record<string, string | number>): SVGElement {
  const el = document.createElementNS(SVGNS, tag);
  for (const k in attrs) el.setAttribute(k, String(attrs[k]));
  return el;
}
const NODE_TONE: Record<Tone, string> = {
  start: "#8de8e0",
  end: "#8de8e0",
  util: "#3ccfcf",
  buy: "#3ccfcf",
  reject: "#ffb020",
};

function PathRoute({ stops, empty, active }: { stops: Stop[]; empty: boolean; active: boolean }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  // a stable-ish signature so the geometry rebuilds when the session changes
  const sig = stops.map((s) => s.key + s.tone + s.band).join("|");

  useLayoutEffect(() => {
    const svg = svgRef.current,
      track = trackRef.current;
    if (!svg || !track) return;
    const els = nodeRefs.current.filter(Boolean) as HTMLDivElement[];
    if (els.length !== stops.length) return;

    // ---- measure node centers in the SVG's own (unscaled) coordinate space.
    // getBoundingClientRect is affected by the stage's scale transform;
    // clientWidth is not — their ratio recovers the scale so coordinates land
    // in viewBox units regardless of viewport size.
    const svgRect = svg.getBoundingClientRect();
    const W = svg.clientWidth,
      H = svg.clientHeight;
    if (!W || !H) return;
    const scale = svgRect.width / W || 1;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

    const usesTop = stops.some((s) => s.band === "top");
    const usesBottom = stops.some((s) => s.band === "bottom");
    const twoBands = usesTop && usesBottom;
    // rail bands live in the reserved strip at the top of the viewport; with
    // both floors in play they separate clearly so the step reads as a level
    // change, otherwise a single rail runs down the middle of the strip
    const yTop = twoBands ? 22 : 42;
    const yMid = twoBands ? 44 : 42;
    const yBot = 66;
    const yOf = (b: Band) => (b === "top" ? yTop : b === "bottom" ? yBot : yMid);

    const pts = els.map((el, i) => {
      const r = el.getBoundingClientRect();
      return { x: (r.left + r.width / 2 - svgRect.left) / scale, y: yOf(stops[i].band) };
    });

    // ---- build the route geometry imperatively (derived from measurement) ----
    const frag = document.createDocumentFragment();

    // faint band guide-lines + labels (only for bands actually used)
    const x0 = pts[0].x,
      x1 = pts[pts.length - 1].x;
    const guide = (y: number, label: string) => {
      frag.appendChild(mk("line", { class: "pr-band", x1: x0, y1: y, x2: x1, y2: y }));
      const t = mk("text", { class: "pr-band-label", x: Math.max(4, x0 - 14), y: y + 3.5 });
      t.textContent = label;
      frag.appendChild(t);
    };
    if (twoBands) {
      guide(yTop, "1ST");
      guide(yBot, "2ND");
    }

    // the route itself: a hairline polyline through the node centers
    const d = "M " + pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L ");
    const route = mk("path", { class: "pr-route", d, fill: "none" }) as SVGPathElement;
    frag.appendChild(route);

    // per-node connector ticks down to the card + the station node itself
    const cardTop = 80; // the cards begin below the rail strip (CSS padding-top)
    const nodeEls: SVGGElement[] = [];
    pts.forEach((p, i) => {
      const s = stops[i];
      frag.appendChild(mk("line", { class: "pr-tick", x1: p.x, y1: p.y, x2: p.x, y2: cardTop - 6 }));
      const g = mk("g", { class: "pr-node pr-node--" + s.tone }) as SVGGElement;
      const term = s.kind === "terminus";
      g.appendChild(mk("circle", { class: "pr-node__halo", cx: p.x, cy: p.y, r: term ? 13 : 11 }));
      g.appendChild(
        mk("circle", { class: "pr-node__ring", cx: p.x, cy: p.y, r: term ? 8.5 : 6.5, fill: "none", stroke: NODE_TONE[s.tone] }),
      );
      g.appendChild(mk("circle", { class: "pr-node__dot", cx: p.x, cy: p.y, r: term ? 4 : 3.4, fill: NODE_TONE[s.tone] }));
      frag.appendChild(g);
      nodeEls.push(g);
    });

    // the travelling light that rides the drawing edge
    const lightG = mk("g", { class: "pr-light" }) as SVGGElement;
    lightG.appendChild(mk("circle", { class: "pr-light__glow", cx: 0, cy: 0, r: 9 }));
    lightG.appendChild(mk("circle", { class: "pr-light__core", cx: 0, cy: 0, r: 3.4 }));
    frag.appendChild(lightG);

    svg.appendChild(frag);

    // cumulative fractions so nodes/cards fire exactly as the light passes
    const segLen: number[] = [0];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      segLen[i] = total;
    }
    const frac = pts.map((_, i) => (total ? segLen[i] / total : i / Math.max(1, pts.length - 1)));

    const routeLen = route.getTotalLength();
    const cards = els.map((el) => el.querySelector<HTMLElement>(".path-card"));

    const reduced = window.matchMedia("(prefers-reduced-motion:reduce)").matches;

    // ---- COMPOSED frame (inactive / reduced motion): everything at rest ----
    const compose = () => {
      gsap.set(route, { strokeDasharray: "none", strokeDashoffset: 0, opacity: 1 });
      gsap.set(nodeEls, { autoAlpha: 1, scale: 1 });
      gsap.set(lightG, { autoAlpha: 0 });
      gsap.set(svg.querySelectorAll(".pr-band, .pr-band-label, .pr-tick"), { autoAlpha: 1 });
      cards.forEach((c) => c && gsap.set(c, { autoAlpha: 1, scale: 1, y: 0 }));
    };

    let tl: gsap.core.Timeline | null = null;
    if (!active || reduced) {
      compose();
    } else {
      // ---- the journey builds: line draws, light travels, nodes light up ----
      // starts on the path's beat in the view reveal order (after the panel has
      // faded in, ~group 5), NOT at t0 — so the draw is never spent behind an
      // invisible panel. Longer journeys read as richer.
      const DUR = Math.min(3.1, 1.7 + stops.length * 0.16);
      tl = gsap.timeline({ delay: 1.15 });
      gsap.set(route, { strokeDasharray: routeLen, strokeDashoffset: routeLen, opacity: 1 });
      gsap.set(lightG, { autoAlpha: 0 }); // hidden until it departs (no t0 corner flash)
      gsap.set(nodeEls, { autoAlpha: 0, scale: 0.2, transformOrigin: "50% 50%", svgOrigin: "0 0" });
      gsap.set(svg.querySelectorAll(".pr-band, .pr-band-label"), { autoAlpha: 0 });
      gsap.set(svg.querySelectorAll(".pr-tick"), { autoAlpha: 0 });
      cards.forEach((c) => c && gsap.set(c, { autoAlpha: 0, scale: 0.92, y: 8, transformOrigin: "50% 30%" }));
      // motion origin for node pop: set per-node transform-box so scale is local
      nodeEls.forEach((g) => gsap.set(g, { transformOrigin: "50% 50%" }));

      tl.to(svg.querySelectorAll(".pr-band, .pr-band-label"), { autoAlpha: 1, duration: 0.5, ease: "power2.out" }, 0);
      tl.to(route, { strokeDashoffset: 0, duration: DUR, ease: "none" }, 0);
      // travelling light rides the leading edge (ease none → time == distance)
      tl.set(lightG, { autoAlpha: 1 }, 0)
        .to(lightG, { motionPath: { path: route, align: route, alignOrigin: [0.5, 0.5] }, duration: DUR, ease: "none" }, 0)
        .to(lightG, { autoAlpha: 0, duration: 0.4, ease: "power2.in" }, DUR - 0.1);

      pts.forEach((_, i) => {
        const at = frac[i] * DUR;
        tl!.to(svg.querySelectorAll(".pr-tick")[i], { autoAlpha: 1, duration: 0.3 }, at);
        tl!.to(nodeEls[i], { autoAlpha: 1, scale: 1, duration: 0.5, ease: "back.out(2.2)" }, at);
        const c = cards[i];
        if (c) tl!.to(c, { autoAlpha: 1, scale: 1, y: 0, duration: 0.55, ease: "expo.out" }, at + 0.04);
      });
    }

    return () => {
      tl?.kill();
      // remove imperative geometry so the next build starts clean
      svg.querySelectorAll(".pr-band, .pr-band-label, .pr-route, .pr-tick, .pr-node, .pr-light").forEach((n) => n.remove());
      cards.forEach((c) => c && gsap.set(c, { clearProps: "opacity,visibility,transform" }));
    };
  }, [sig, active]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="path-viewport">
      <div className="path-track" ref={trackRef}>
        <svg className="path-route-svg" ref={svgRef} aria-hidden="true" preserveAspectRatio="xMidYMid meet" />
        <div className={"path-row n" + Math.min(stops.length, 6)}>
          {stops.map((s, i) => (
            <div
              key={s.key}
              className={"path-node path-node--" + s.tone}
              ref={(el) => void (nodeRefs.current[i] = el)}
            >
              {s.card}
              {s.cap ? <div className="path-cap">{s.cap}</div> : null}
            </div>
          ))}
        </div>
      </div>
      {empty ? <div className="path-empty-note">No stores were opened during this session.</div> : null}
    </div>
  );
}

export default function View1Individual({
  is,
  active,
  onExplore,
}: {
  is: CompletedSession;
  active: boolean;
  onExplore: () => void;
}) {
  const D = computeIndividual(is);
  const rootRef = useRef<HTMLDivElement>(null);

  const isFood = D.cat === "grabABite";
  const rejectWord = isFood ? "WOULDN'T STOP HERE" : "WOULDN'T SHOP HERE";
  const catLabelV = D.cat ? CAT_LABEL[D.cat] : "NONE";
  const extraCats = (is.primaryChoices || []).slice(1);
  const floorsTrail = (is.floorsVisited || []).map(floorLong).join("  →  ") || NA;

  const isOutside = is.endedBy === "wentOutside";
  const dest = isOutside ? OUTSIDE_META.find((o) => o.key === is.outsideDestination) || { label: NA, icon: "exit" } : null;
  const destType = isOutside ? DEST_TYPE[is.outsideDestination ?? ""] || NA : null;

  const stops = buildStops(D);
  const noStores = D.nodes.length === 0;

  const statCells = isOutside
    ? [
        { ic: "exit", n: destType as string, l: "Destination Type", text: true },
        { ic: "dollar", n: 0, l: "Total Spent", money: true },
        { ic: "bag", n: D.storesVisited, l: D.storesVisited === 1 ? "Store Visited Before Leaving" : "Stores Visited Before Leaving" },
      ]
    : [
        { ic: "bag", n: D.storesVisited, l: D.storesVisited === 1 ? "Store Visited" : "Stores Visited" },
        { ic: "bagcheck", n: D.purchasesMade, l: D.purchasesMade === 1 ? "Purchase Made" : "Purchases Made" },
        { ic: "xcircle", n: D.storesRejected, l: D.storesRejected === 1 ? "Store Rejected" : "Stores Rejected" },
        { ic: "stairs", n: D.floorsVisited, l: D.floorsVisited === 1 ? "Floor Visited" : "Floors Visited" },
        { ic: "dollar", n: D.totalSpent, l: "Total Spent", money: true },
      ];

  // Purchases panel empty states — NEVER conflate "opened nothing" with "bought
  // nothing"; the wording is derived from the real session so it can never
  // contradict the header or Your Path.
  const purchasesTbl =
    D.cat === "restroom" ? (
      <div className="empty-line">
        You prioritised a basic need.
        <br />
        No commercial interaction was logged.
      </div>
    ) : D.purchases.length === 0 ? (
      <div className="empty-line">
        {noStores
          ? "No stores were opened during this session."
          : `You opened ${D.storesVisited} ${D.storesVisited === 1 ? "store" : "stores"} and made no purchases.`}
      </div>
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
            <td colSpan={3} className="data-table__total-l">
              Total Spent
            </td>
            <td className="num data-table__total-v">{fmtMoney(D.totalSpent)}</td>
          </tr>
        </tfoot>
      </table>
    );

  // Rejected table: explicit column tracks (table-layout: fixed) so the
  // "wouldn't shop here" outcome never wraps mid-phrase — carried as an amber
  // reject pill, consistent with Your Path.
  const rejectedTbl =
    D.cat === "restroom" ? (
      <div className="empty-line">No commercial interaction was logged.</div>
    ) : D.rejected.length === 0 ? (
      <div className="empty-line">
        {noStores ? "No stores were opened during this session." : "No stores were rejected during this session."}
      </div>
    ) : (
      <table className="data-table rej-table">
        <colgroup>
          <col className="rej-col-store" />
          <col className="rej-col-floor" />
          <col className="rej-col-price" />
          <col className="rej-col-choice" />
        </colgroup>
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
                <td className="rej-choice">
                  <span className="pill reject">{rejectWord}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );

  // Session Highlight — every rate carries its "N of M"; an incomputable rate
  // shows "—", never a misleading percentage.
  const highlight = isOutside ? (
    <div className="v1-hl-row">
      <div className="v1-hl-title">
        <Icon name="exit" sz={28} sw={1.8} />
        <span className="panel-t">Session Highlight</span>
      </div>
      {[
        { l: "Total Spent", v: "$0", sub: "no purchase" },
        { l: D.storesVisited === 1 ? "Store Visited" : "Stores Visited", v: String(D.storesVisited), sub: "before leaving" },
        { l: "Destination Type", v: destType as string, small: true },
      ].map((h, i) => (
        <div key={i} className="v1-hl-cell">
          <div className="lbl">{h.l}</div>
          <div className="num v1-hl-num" data-countup style={{ fontSize: h.small ? 22 : 30 }}>
            {h.v}
          </div>
          {h.sub ? <div className="v1-hl-sub">{h.sub}</div> : null}
        </div>
      ))}
    </div>
  ) : (
    <div className="v1-hl-row">
      <div className="v1-hl-title">
        <Icon name="bars" sz={28} sw={1.8} />
        <span className="panel-t">Session Highlight</span>
      </div>
      {[
        {
          l: "Purchase Rate",
          v: D.nodes.length ? fmtPct(D.purchaseRate) : NA,
          sub: D.nodes.length ? `${D.purchasesMade} of ${D.storesVisited} opened` : "no stores opened",
        },
        {
          l: "Store Rejection Rate",
          v: D.nodes.length ? fmtPct(D.rejectionRate) : NA,
          sub: D.nodes.length ? `${D.storesRejected} of ${D.storesVisited} opened` : "no stores opened",
        },
        {
          l: "Average Purchase",
          v: D.purchasesMade ? fmtMoney(Math.round(D.avgPurchase)) : NA,
          sub: D.purchasesMade ? `across ${D.purchasesMade} ${D.purchasesMade === 1 ? "purchase" : "purchases"}` : "no purchases",
        },
      ].map((h, i) => (
        <div key={i} className="v1-hl-cell">
          <div className="lbl">{h.l}</div>
          <div className="num v1-hl-num" data-countup>
            {h.v}
          </div>
          <div className="v1-hl-sub">{h.sub}</div>
        </div>
      ))}
    </div>
  );

  // ── reveal choreography: title → tiles → left panels → tables → path →
  //    highlight → CTA. Count-ups on [data-countup]. Composed instantly when
  //    inactive or reduced-motion (PathRoute self-composes on the same gate).
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const q = gsap.utils.selector(root) as unknown as (s: string) => any[];

    // count-up targets: remember their final text, restore on cleanup
    const nums = q("[data-countup]") as HTMLElement[];
    const finals = nums.map((el) => el.textContent ?? "");
    const restore = () => nums.forEach((el, i) => (el.textContent = finals[i]));

    if (!active) return;
    if (window.matchMedia("(prefers-reduced-motion:reduce)").matches) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      const groups: [string, number][] = [
        [".v1-title", 0.0],
        [".stat-cell", 0.25],
        [".v1-left > *", 0.5],
        [".v1-tables > *", 0.78],
        [".v1-path", 1.0], // panel fades in; the route then draws (PathRoute, +1.15)
        [".v1-highlight", 3.0],
        [".v1-cta-wrap", 3.28],
      ];
      groups.forEach(([sel, at]) => {
        const els = q(sel);
        if (els.length) tl.fromTo(els, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: "expo.out", stagger: 0.08, clearProps: "opacity,visibility,transform" }, at);
      });

      // count-ups fire when their group arrives (tiles at 0.32, highlight at 2.9)
      nums.forEach((el) => {
        const inHighlight = !!el.closest(".v1-highlight");
        const at = inHighlight ? 3.08 : 0.35;
        const txt = finals[nums.indexOf(el)];
        const m = txt.match(/^(\$?)([\d,]+(?:\.\d+)?)(%?)$/);
        if (!m) return;
        const prefix = m[1],
          suffix = m[3],
          target = parseFloat(m[2].replace(/,/g, "")),
          dec = (m[2].split(".")[1] || "").length;
        if (isNaN(target) || target === 0) return;
        const px = { v: 0 };
        el.textContent = prefix + "0" + suffix;
        tl.to(
          px,
          {
            v: target,
            duration: 0.7,
            ease: "power2.out",
            onUpdate: () => (el.textContent = prefix + (dec ? px.v.toFixed(dec) : Math.round(px.v).toLocaleString("en-US")) + suffix),
            onComplete: () => (el.textContent = txt),
          },
          at,
        );
      });
    }, root);

    return () => {
      ctx.revert();
      restore();
    };
  }, [active, is]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="v1-grid" ref={rootRef}>
      {/* left column */}
      <div className="v1-left">
        <div className="v1-title">
          <h1 className="mich v1-h1">YOUR SESSION SUMMARY</h1>
          <div className="lbl v1-eyebrow">Individual Result</div>
          <div className="muted v1-lede">Here is what you did within 15 minutes inside the Oculus.</div>
        </div>
        <div className="panel v1-cat">
          <div className="lbl">1st Category Chosen</div>
          <div className="mich v1-cat__val">{catLabelV}</div>
        </div>
        <div className="panel v1-floors">
          <div className="lbl">Floors Visited</div>
          <div className="num v1-floors__val">{floorsTrail}</div>
        </div>
        {extraCats.map((c, i) => (
          <div key={i} className="panel v1-xcat">
            <div className="lbl v1-xcat__lbl">{ORD[i + 1]} Category Chosen</div>
            <div className="num v1-xcat__val">{CAT_LABEL[c] || NA}</div>
          </div>
        ))}
        {is.outsideDestination ? (
          <div className="panel v1-destpanel">
            <div className="lbl">Destination Chosen</div>
            <div className="num v1-destpanel__val">
              <span className="v1-destpanel__ico">
                <Icon name={OUTSIDE_META.find((o) => o.key === is.outsideDestination)?.icon || "exit"} sz={22} sw={1.6} />
              </span>
              {(OUTSIDE_META.find((o) => o.key === is.outsideDestination) || { label: NA }).label}
            </div>
          </div>
        ) : null}
      </div>

      {/* stat cells */}
      <div className="v1-stats" style={{ gridTemplateColumns: `repeat(${statCells.length},1fr)` }}>
        {statCells.map((c, i) => (
          <div key={i} className="stat-cell">
            <div className="top">
              <span className="ico">
                <Icon name={c.ic} sz={32} sw={1.6} />
              </span>
              {"text" in c && c.text ? (
                <span className="num stat-cell__text">{c.n}</span>
              ) : (
                <span className="big num" data-countup>
                  {"money" in c && c.money ? fmtMoney(c.n as number) : c.n}
                </span>
              )}
            </div>
            <div className="lbl">{c.l}</div>
          </div>
        ))}
      </div>

      {/* tables / outside panel */}
      {isOutside ? (
        <div className="v1-tables v1-tables--outside">
          <div className="panel v1-outside-panel">
            <div className="lbl v1-outside-panel__lbl">Destination Chosen</div>
            <div className="v1-outside-panel__head">
              <span className="v1-outside-panel__ico">
                <Icon name={dest!.icon} sz={54} sw={1.4} />
              </span>
              <div className="mich v1-outside-panel__name">{dest!.label}</div>
            </div>
            <div className="num v1-outside-panel__type">{destType}</div>
            <hr className="hair v1-outside-panel__hr" />
            <div className="v1-outside-panel__foot">
              <div>
                <div className="lbl">Total Spent</div>
                <div className="num v1-outside-panel__spent" data-countup>
                  $0
                </div>
              </div>
              <div className="v1-outside-panel__note muted">
                This player chose to leave the Oculus
                {D.storesVisited ? ` after visiting ${D.storesVisited} ${D.storesVisited === 1 ? "store" : "stores"}` : ` straight away`}. No purchase was made inside.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="v1-tables">
          <div className="panel v1-purch">
            <div className="panel-t v1-panel-head">Purchases</div>
            {purchasesTbl}
          </div>
          <div className="panel v1-rej">
            <div className="panel-t v1-panel-head">Rejected Stores</div>
            {rejectedTbl}
          </div>
        </div>
      )}

      {/* path */}
      <div className="panel v1-path">
        <div className="panel-t">Your Path</div>
        <div className="muted v1-path__sub">A transit route through the stores you opened and the choices you made.</div>
        <PathRoute stops={stops} empty={noStores} active={active} />
      </div>

      {/* footer */}
      <div className="v1-footer">
        <div className="panel v1-highlight">{highlight}</div>
        <div className="v1-cta-wrap">
          <span className="lbl v1-cta-eyebrow">See how you compare</span>
          <button type="button" className="cta v1-cta" onClick={onExplore}>
            See the Full Record{" "}
            <svg className="cta-arrow" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
