/**
 * IntroSequence — the finished, approved Oculus Obscura intro animation, ported
 * VERBATIM from the Claude Design export (design-reference/Oculus Obscura Intro.dc.html)
 * into a native React + TypeScript + GSAP component.
 *
 * Nothing here is redesigned, re-timed, or re-colored. The geometry builder, the
 * word/char arrays, every class name, and the entire GSAP timeline (scenes A–H)
 * reproduce the source exactly. Static styles + @keyframes live in introSequence.css.
 *
 * React-specific adaptations (not in the original, required for correct behavior):
 *   - GSAP runs inside gsap.context(..., rootRef) in a useEffect; cleanup calls
 *     ctx.revert() so React 18 StrictMode double-mount can't duplicate or leak timelines.
 *   - MotionPathPlugin registered once at module scope.
 *   - Claude-Design props (sequenceSpeed / loop / showReplay) and the on-canvas Replay
 *     button are removed. Plays once on mount.
 *
 * Additions for Part 1A (the intro animation itself is untouched):
 *   - animate prop: false builds the normal timeline and seeks it to the end,
 *     paused (progress(1)) — the page rests on the timeline's TRUE final frame,
 *     not an approximation, with the ambient CSS loops still breathing.
 *     (prefers-reduced-motion still uses showStatic(), which also freezes the
 *     CSS loops; its values are corrected to match the timeline end state.)
 *   - Exit choreography on "Enter the Ledger": everything except the title falls
 *     away, then the REAL h1 flies (FLIP: measured rects + transforms) to the
 *     persistent TitleMark's position while its letter-spacing tightens
 *     0.14em → 0.06em. The parent mounts TurntableView underneath at onEnter and
 *     swaps in the real mark at onExited — the swap is metric-exact, so invisible.
 */
import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import "./introSequence.css";

gsap.registerPlugin(MotionPathPlugin);

/* ---------------------------------------------------------------------------
 * Geometry — reproduced identically from the source buildGeo().
 * ring at cx=cy=500, R=150; 9 routes whose endpoints seat exactly on the ring.
 * ------------------------------------------------------------------------- */
interface GridLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
interface Route {
  d: string;
  ex: number;
  ey: number;
}

function buildGeo(): { grid: GridLine[]; routes: Route[] } {
  const cx = 500,
    cy = 500,
    R = 150;
  const grid: GridLine[] = [];
  const lo = -100,
    hi = 1100,
    step = 80;
  for (let x = lo; x <= hi; x += step) grid.push({ x1: x, y1: lo, x2: x, y2: hi });
  for (let y = lo; y <= hi; y += step) grid.push({ x1: lo, y1: y, x2: hi, y2: y });
  // Directions biased toward a clockwise cardinal sweep (S, W, N, E) but kept organic.
  const angs = [-88, -50, -18, 26, 64, 118, 156, 202, 254];
  const curves = [170, -140, 210, -90, 150, -195, 120, -165, 95];
  const f = (n: number) => Number(n.toFixed(1));
  const routes: Route[] = angs.map((deg, i) => {
    const a = (deg * Math.PI) / 180,
      ux = Math.cos(a),
      uy = Math.sin(a);
    const px = -uy,
      py = ux,
      k = curves[i];
    const sx = cx + 960 * ux,
      sy = cy + 960 * uy;
    // node/endpoint seated EXACTLY on the ring: (cx + R*cos, cy + R*sin), same R as the circle
    const ex = cx + R * ux,
      ey = cy + R * uy;
    const c1x = cx + 620 * ux + px * k,
      c1y = cy + 620 * uy + py * k;
    const c2x = cx + 300 * ux + px * k * 0.4,
      c2y = cy + 300 * uy + py * k * 0.4;
    return {
      d: `M ${f(sx)},${f(sy)} C ${f(c1x)},${f(c1y)} ${f(c2x)},${f(c2y)} ${f(ex)},${f(ey)}`,
      ex: f(ex),
      ey: f(ey),
    };
  });
  return { grid, routes };
}

const GEO = buildGeo();

/* ---------------------------------------------------------------------------
 * Copy arrays — verbatim from the source getters.
 * ------------------------------------------------------------------------- */
const PARA_LINES = [
  "A public transit and commerce hub that keeps a private ledger.",
  "The Oculus sees roughly 33 million visits a year, and the retail inside it is high-end, curated for someone with money to spend.",
  "That data, who actually walks through, who actually shops, is reported only to the landlord. Never made public.",
  "This platform builds the missing ledger.",
  "Explore what we know so far, then play a two-minute round as a commuter with a train to catch.",
  "Spend the time however you would.",
];
const LAST_LINE_WORDS = "The record starts now.".split(" ");
const TITLE_W1 = "OCULUS".split("");
const TITLE_W2 = "OBSCURA".split("");
const SUB_CHARS = "The missing ledger, built in public."
  .split("")
  .map((ch) => (ch === " " ? " " : ch));

/* ---------------------------------------------------------------------------
 * Floating data numbers — verbatim positions/colors/animations from the source.
 * ------------------------------------------------------------------------- */
interface DataNum {
  left: string;
  top: string;
  fontSize: string;
  color: string;
  animation: string;
  text: string;
}
const DATANUMS: DataNum[] = [
  { left: "8%", top: "16%", fontSize: "clamp(0.7rem,1.3vw,0.95rem)", color: "rgba(60,207,207,0.36)", animation: "numFloat 9s ease-in-out 0s infinite", text: "40.7112 N" },
  { left: "78%", top: "12%", fontSize: "clamp(0.7rem,1.3vw,0.95rem)", color: "rgba(60,207,207,0.3)", animation: "numFloat 11s ease-in-out 2.5s infinite", text: "74.0123 W" },
  { left: "22%", top: "71%", fontSize: "clamp(0.75rem,1.5vw,1.05rem)", color: "rgba(26,135,135,0.5)", animation: "numFloat 8.5s ease-in-out 1.2s infinite", text: "07:42" },
  { left: "83%", top: "64%", fontSize: "clamp(0.75rem,1.5vw,1.05rem)", color: "rgba(26,135,135,0.44)", animation: "numFloat 10s ease-in-out 4s infinite", text: "08:15" },
  { left: "11%", top: "44%", fontSize: "clamp(0.7rem,1.3vw,0.95rem)", color: "rgba(60,207,207,0.3)", animation: "numFloat 12s ease-in-out 3s infinite", text: "12,431 / hr" },
  { left: "70%", top: "83%", fontSize: "clamp(0.7rem,1.3vw,0.95rem)", color: "rgba(60,207,207,0.34)", animation: "numFloat 9.5s ease-in-out 5.5s infinite", text: "R2 · 06:58" },
  { left: "44%", top: "9%", fontSize: "clamp(0.68rem,1.2vw,0.9rem)", color: "rgba(26,135,135,0.4)", animation: "numFloat 10.5s ease-in-out 1.8s infinite", text: "N 40.7127" },
  { left: "33%", top: "87%", fontSize: "clamp(0.68rem,1.2vw,0.9rem)", color: "rgba(26,135,135,0.4)", animation: "numFloat 11.5s ease-in-out 6.2s infinite", text: "W 74.0134" },
  { left: "88%", top: "38%", fontSize: "clamp(0.7rem,1.3vw,0.95rem)", color: "rgba(60,207,207,0.32)", animation: "numFloat 8s ease-in-out 2.2s infinite", text: "23,214" },
  { left: "5%", top: "82%", fontSize: "clamp(0.7rem,1.3vw,0.95rem)", color: "rgba(60,207,207,0.3)", animation: "numFloat 12.5s ease-in-out 7s infinite", text: "Δ 1,204" },
  { left: "60%", top: "24%", fontSize: "clamp(0.66rem,1.1vw,0.85rem)", color: "rgba(26,135,135,0.38)", animation: "numFloat 10s ease-in-out 4.8s infinite", text: "SW / 214" },
  { left: "18%", top: "30%", fontSize: "clamp(0.66rem,1.1vw,0.85rem)", color: "rgba(26,135,135,0.36)", animation: "numFloat 9s ease-in-out 3.6s infinite", text: "18,902" },
];

/* Four ambient flurry blobs — verbatim inline styles from the source. */
const FLURRY_BLOBS: React.CSSProperties[] = [
  { width: "72vmin", height: "72vmin", margin: "-36vmin 0 0 -36vmin", filter: "blur(72px)", opacity: 0.5, background: "radial-gradient(circle at 50% 50%, #0B4546 0%, rgba(11,69,70,0) 68%)", animation: "drift 17s cubic-bezier(0.65,0,0.35,1) infinite" },
  { width: "60vmin", height: "60vmin", margin: "-30vmin 0 0 -30vmin", filter: "blur(66px)", opacity: 0.42, background: "radial-gradient(circle at 50% 50%, #1A8787 0%, rgba(26,135,135,0) 66%)", animation: "drift2 13s cubic-bezier(0.65,0,0.35,1) infinite" },
  { width: "46vmin", height: "46vmin", margin: "-23vmin 0 0 -23vmin", filter: "blur(58px)", opacity: 0.3, background: "radial-gradient(circle at 50% 50%, #3CCFCF 0%, rgba(60,207,207,0) 62%)", animation: "drift 21s cubic-bezier(0.65,0,0.35,1) infinite reverse" },
  { width: "32vmin", height: "32vmin", margin: "-16vmin 0 0 -16vmin", filter: "blur(48px)", opacity: 0.22, background: "radial-gradient(circle at 50% 50%, #8DE8E0 0%, rgba(141,232,224,0) 60%)", animation: "drift2 11s cubic-bezier(0.65,0,0.35,1) infinite" },
];

/** One subway car — identical inner geometry for all 9 routes (source markup). */
function TrainCar() {
  return (
    <g className="train">
      <rect x="-13" y="-4" width="26" height="8" rx="1.6" fill="rgba(9,28,28,0.62)" stroke="#1A8787" strokeWidth="0.7" />
      <line x1="-11" y1="-2" x2="11.5" y2="-2" stroke="#1A8787" strokeWidth="0.35" opacity="0.5" />
      <line x1="-11" y1="2" x2="11.5" y2="2" stroke="#1A8787" strokeWidth="0.35" opacity="0.5" />
      <g stroke="#3CCFCF" strokeWidth="0.3" opacity="0.7">
        <rect x="-9.5" y="-1.6" width="4" height="3.2" rx="0.4" fill="rgba(26,135,135,0.45)" />
        <line x1="-8.4" y1="-1.6" x2="-8.4" y2="1.6" />
        <line x1="-7.5" y1="-1.6" x2="-7.5" y2="1.6" />
        <line x1="-6.6" y1="-1.6" x2="-6.6" y2="1.6" />
        <rect x="-3.2" y="-1.6" width="4" height="3.2" rx="0.4" fill="rgba(26,135,135,0.45)" />
        <line x1="-2.1" y1="-1.6" x2="-2.1" y2="1.6" />
        <line x1="-1.2" y1="-1.6" x2="-1.2" y2="1.6" />
        <line x1="-0.3" y1="-1.6" x2="-0.3" y2="1.6" />
      </g>
      <g stroke="#3CCFCF" strokeWidth="0.4" opacity="0.5">
        <line x1="-8" y1="-4" x2="-8" y2="-2.9" />
        <line x1="-8" y1="4" x2="-8" y2="2.9" />
        <line x1="-3.6" y1="-4" x2="-3.6" y2="-2.9" />
        <line x1="-3.6" y1="4" x2="-3.6" y2="2.9" />
        <line x1="0.8" y1="-4" x2="0.8" y2="-2.9" />
        <line x1="0.8" y1="4" x2="0.8" y2="2.9" />
        <line x1="5.2" y1="-4" x2="5.2" y2="-2.9" />
        <line x1="5.2" y1="4" x2="5.2" y2="2.9" />
      </g>
      <rect x="6.4" y="-3" width="4.6" height="6" rx="1.1" fill="#3CCFCF" opacity="0.5" />
      <rect x="11.5" y="-3.6" width="1.4" height="7.2" rx="0.7" fill="#3CCFCF" opacity="0.9" />
      <circle className="train-light" cx="13" cy="0" r="1.1" fill="#8DE8E0" />
    </g>
  );
}

interface IntroSequenceProps {
  /**
   * true (default): full GSAP timeline. false: skip it and render the final
   * resting state instantly (same showStatic() path as reduced motion) — used
   * when returning to the title page so nothing replays. Read once at mount.
   */
  animate?: boolean;
  /**
   * Fired when the user clicks "Enter the Ledger" — the parent mounts the
   * turntable view underneath (with a ghost TitleMark) while the exit runs.
   */
  onEnter: () => void;
  /** Fired when the title flight lands — the parent unmounts the intro. */
  onExited?: () => void;
}

export default function IntroSequence({ animate = true, onEnter, onExited }: IntroSequenceProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  // frozen at mount: the parent flips hasSeenIntro mid-exit, which must not
  // re-trigger anything here
  const animateRef = useRef(animate);
  const exitingRef = useRef(false);
  const exitTlRef = useRef<gsap.core.Timeline | null>(null);
  const flightTlRef = useRef<gsap.core.Timeline | null>(null);

  // layout effect: the animate={false} end-state render must land before first
  // paint — a plain effect could let one frame of the empty stage flash through
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(root) as unknown as (s: string) => any[];

      // measure path lengths for stroke-draw, exactly as the source prep()
      const prep = (el: SVGGeometryElement) => {
        const L = el.getTotalLength();
        (el as any)._len = L;
        gsap.set(el, { strokeDasharray: L, strokeDashoffset: L });
      };
      q(".grid-line").forEach(prep);
      q(".route").forEach(prep);
      prep(q("#ring")[0]);

      const glide = Math.round((window.innerHeight || 800) * 0.26);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        // static frame AND frozen CSS ambience
        showStatic(q, glide);
        return;
      }
      const tl = buildTL(q, glide);
      if (!animateRef.current) {
        // returning to the title page: rest on the timeline's real final frame,
        // instantly and without playback. CSS ambient loops (flurry, CTA pulse,
        // grain, scan, data numbers) keep running — only the sequence is skipped.
        tl.progress(1).pause();
      }
    }, root);

    return () => {
      ctx.revert();
      exitTlRef.current?.kill();
      flightTlRef.current?.kill();
    };
  }, []);

  const handleEnter = () => {
    if (exitingRef.current) return;
    exitingRef.current = true;

    const root = rootRef.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    onEnter(); // parent mounts the turntable underneath before paint

    if (!root || reduced) {
      // reduced motion: no flight — the title appears directly top-left
      onExited?.();
      return;
    }

    // The stage becomes a fixed overlay above the turntable; its ground
    // dissolves so the black field + video fade up underneath (no dead beat).
    root.classList.add("stage--exiting");
    const q = gsap.utils.selector(root) as unknown as (s: string) => any[];
    const master = gsap.timeline();
    exitTlRef.current = master;

    // (a) everything EXCEPT the title falls away first, short stagger —
    // fade + slight downward drift; the title is the last thing standing
    const drifting = [q(".cta"), q(".paragraph"), q(".subtitle"), q(".underline")];
    drifting.forEach((els, i) => {
      master.to(els, { opacity: 0, y: "+=14", duration: 0.3, ease: "power2.in" }, i * 0.05);
    });
    const ambient = [q(".flurry"), q(".field"), q(".datalayer"), q(".scan"), q(".bignum"), q(".vignette"), q(".grain")];
    ambient.forEach((els, i) => {
      master.to(els, { opacity: 0, duration: 0.32, ease: "power2.in" }, 0.12 + i * 0.03);
    });
    master.to(root, { backgroundColor: "rgba(10,10,10,0)", duration: 0.55, ease: "power2.inOut" }, 0.18);

    // (b/c) the title's FLIP flight, overlapping the tail of the fall-away
    master.add(() => startFlight(root, q, flightTlRef, onExited), 0.32);
  };

  return (
    /* all root styling lives on .stage in introSequence.css (identical values);
       inline duplicates removed so .stage--exiting can lift it to a fixed overlay */
    <div className="stage" ref={rootRef}>
      {/* floating data numbers */}
      <div className="datalayer">
        {DATANUMS.map((d, i) => (
          <span key={i} className="datanum" style={{ left: d.left, top: d.top, fontSize: d.fontSize, color: d.color, animation: d.animation }}>
            {d.text}
          </span>
        ))}
      </div>

      {/* SVG field: grid, routes, pings, ring + nodes, trains */}
      <svg className="field" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice">
        <g className="grid">
          {GEO.grid.map((g, i) => (
            <line key={i} className="grid-line" x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke="#1A8787" strokeWidth="0.6" />
          ))}
        </g>

        <g className="routes-group">
          {GEO.routes.map((r, i) => (
            <path key={i} className="route" d={r.d} fill="none" stroke="#1A8787" strokeWidth="1.3" strokeLinecap="round" />
          ))}
        </g>

        <g className="pings">
          {GEO.routes.map((r, i) => (
            <circle key={i} className="ping" cx={r.ex} cy={r.ey} r="5" fill="none" stroke="#3CCFCF" strokeWidth="1.4" />
          ))}
        </g>

        <g id="ringGroup">
          <circle id="ring" cx="500" cy="500" r="150" fill="none" stroke="#1A8787" strokeWidth="2" />
          <g id="nodesGroup">
            {GEO.routes.map((r, i) => (
              <circle key={i} className="node" cx={r.ex} cy={r.ey} r="4.6" fill="#8DE8E0" />
            ))}
          </g>
        </g>

        <g className="trains">
          {GEO.routes.map((_r, i) => (
            <TrainCar key={i} />
          ))}
        </g>
      </svg>

      {/* faint background counter */}
      <div className="bignum">
        <span className="bignum-val">0</span>
      </div>

      {/* scan sweep */}
      <div className="scan" />

      {/* ambient flurry */}
      <div className="flurry">
        {FLURRY_BLOBS.map((s, i) => (
          <div key={i} className="flurry-blob" style={s} />
        ))}
      </div>

      {/* paragraph (populates word-by-word) + CTA */}
      <div className="paragraph">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", maxWidth: "54ch", width: "100%" }}>
          <p className="p-line">
            {PARA_LINES.map((line, li) =>
              line.split(" ").map((w, wi) => (
                <span key={`${li}-${wi}`} className="p-word">
                  {w}
                </span>
              )),
            )}
            {LAST_LINE_WORDS.map((w, wi) => (
              <span key={`last-${wi}`} className="p-word" style={{ fontWeight: 500 }}>
                {w}
              </span>
            ))}
          </p>
          <div style={{ display: "flex", justifyContent: "center", marginTop: "clamp(16px,2.4vh,30px)", pointerEvents: "none" }}>
            <button type="button" className="cta" onClick={handleEnter}>
              Enter the Ledger
            </button>
          </div>
        </div>
      </div>

      {/* lockup: title types, underline unspools, subtitle types */}
      <div className="lockup">
        <h1 className="title">
          <span className="t-word">
            {TITLE_W1.map((ch, i) => (
              <span key={i} className="t-char">
                {ch}
              </span>
            ))}
          </span>
          <span style={{ display: "inline" }}>{" "}</span>
          <span className="t-word">
            {TITLE_W2.map((ch, i) => (
              <span key={i} className="t-char">
                {ch}
              </span>
            ))}
          </span>
          <span className="caret title-caret">
            <span className="caret-bar" style={{ display: "inline-block", width: "0.07em", height: "0.92em", background: "#1A8787", marginLeft: "0.1em", verticalAlign: "-0.06em", boxShadow: "0 0 9px rgba(26,135,135,0.85)", animation: "blink 1.05s steps(1) infinite" }} />
          </span>
        </h1>

        <div className="underline" />

        <p className="subtitle">
          {SUB_CHARS.map((ch, i) => (
            <span key={i} className="s-char">
              {ch}
            </span>
          ))}
          <span className="caret sub-caret">
            <span className="caret-bar" style={{ display: "inline-block", width: "0.08em", height: "0.9em", background: "#9DA3A3", marginLeft: "0.08em", verticalAlign: "-0.06em", boxShadow: "0 0 7px rgba(157,163,163,0.6)", animation: "blink 1.05s steps(1) infinite" }} />
          </span>
        </p>
      </div>

      {/* vignette + grain */}
      <div className="vignette" />
      <div className="grain" />
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * The title flight — FLIP by hand (Part 1A §3).
 *
 * The REAL hero h1 travels to the persistent TitleMark: measure both rects,
 * re-anchor the element to the viewport at exactly its current visual rect,
 * then animate transforms to the target. gsap's Flip plugin is skipped
 * deliberately: it precomputes its transform from static rects, but we tighten
 * letter-spacing 0.14em → 0.06em IN FLIGHT (spec c), which changes the
 * element's intrinsic width mid-tween and would make a rect-based scale land
 * off-target / pop at start. Anchoring top-left and animating x/y/scale +
 * letter-spacing together lands metric-exact by construction:
 *   final glyphs = fontSize·scale = mark fontSize, tracking 0.06em, at the
 *   mark text's top-left — identical to the real TitleMark, so the swap
 *   (hide flight / show mark, same commit) is invisible.
 * ------------------------------------------------------------------------- */
function startFlight(
  root: HTMLDivElement,
  q: (s: string) => any[],
  flightTlRef: { current: gsap.core.Timeline | null },
  onExited?: () => void,
) {
  const title = q(".title")[0] as HTMLElement | undefined;
  const target = document.querySelector<HTMLElement>(".title-mark__text");
  if (!title || !target) {
    onExited?.();
    return;
  }

  const heroRect = title.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const targetFont = parseFloat(getComputedStyle(target).fontSize);
  // visual font-size = layout font-size × resting ancestor scale (.lockup ends
  // at scale 0.8); the rect/offsetHeight ratio recovers it robustly
  const visualFont =
    parseFloat(getComputedStyle(title).fontSize) * (heroRect.height / title.offsetHeight);

  // Re-anchor: same DOM element, reparented out of the transformed .lockup so
  // position:fixed is viewport-true, frozen at its exact current visual rect.
  root.appendChild(title);
  gsap.set(title, {
    position: "fixed",
    left: heroRect.left,
    top: heroRect.top,
    margin: 0,
    zIndex: 30,
    fontSize: visualFont,
    lineHeight: 1.08,
    letterSpacing: "0.14em",
    whiteSpace: "nowrap",
    textAlign: "left",
    transformOrigin: "0 0",
  });

  flightTlRef.current = gsap
    .timeline({ onComplete: () => onExited?.() })
    .to(
      title,
      {
        x: targetRect.left - heroRect.left,
        y: targetRect.top - heroRect.top,
        scale: targetFont / visualFont,
        letterSpacing: "0.06em", // Michroma: airy at hero scale, tight when small
        duration: 0.82,
        ease: "expo.inOut",
      },
      0,
    )
    // the hero glow reads as haze at mark size — breathe it out en route
    .to(title, { textShadow: "0 0 0px rgba(26,135,135,0)", duration: 0.6, ease: "power2.out" }, 0.06);
}

/* ---------------------------------------------------------------------------
 * GSAP timeline — ported EXACTLY from the source buildTL(). Same scene order,
 * durations, staggers, eases and positions. (sequenceSpeed/loop removed: plays once.)
 * ------------------------------------------------------------------------- */
function buildTL(q: (s: string) => any[], glide: number): gsap.core.Timeline {
  const REVEAL = "expo.out";
  const GLIDE = glide;
  const ringLen = (q("#ring")[0] as any)._len;
  const routes = GEO.routes;
  const trains = q(".train"),
    nodes = q(".node"),
    pings = q(".ping"),
    routeEls = q(".route"),
    pwords = q(".p-word");
  const tl = gsap.timeline();

  // ---- initial states at t=0 (replay-safe) ----
  tl.set(q(".field"), { opacity: 1 }, 0)
    .set(q(".grid"), { opacity: 0 }, 0)
    .set(q(".grid-line"), { strokeDashoffset: (_i: number, t: any) => t._len }, 0)
    .set(q(".route"), { strokeDashoffset: (_i: number, t: any) => t._len, opacity: 0.55 }, 0)
    .set(trains, { opacity: 0, scale: 1, x: 0, y: 0, rotation: 0 }, 0)
    .set(nodes, { opacity: 0, attr: { r: 4.6 }, clearProps: "transform" }, 0)
    .set(pings, { opacity: 0, attr: { r: 5 } }, 0)
    .set(q("#ringGroup"), { opacity: 1, scale: 1, svgOrigin: "500 500" }, 0)
    .set(q("#ring"), { strokeDashoffset: ringLen, opacity: 1 }, 0)
    .set(q("#nodesGroup"), { opacity: 1, rotation: 0, svgOrigin: "500 500" }, 0)
    .set(q(".flurry"), { opacity: 0, y: 0 }, 0)
    .set(q(".bignum"), { opacity: 0 }, 0)
    .set(q(".lockup"), { y: 0, scale: 1, transformOrigin: "50% 50%" }, 0)
    .set(q(".paragraph"), { opacity: 1 }, 0)
    .set(pwords, { opacity: 0, y: 8 }, 0)
    .set(q(".t-char"), { opacity: 0, y: 10 }, 0)
    .set(q(".s-char"), { opacity: 0 }, 0)
    .set(q(".underline"), { opacity: 1, scaleX: 0, transformOrigin: "50% 50%" }, 0)
    .set(q(".title-caret"), { opacity: 0 }, 0)
    .set(q(".sub-caret"), { opacity: 0 }, 0)
    .set(q(".cta"), { opacity: 0, y: 12 }, 0);

  // ---- SCENE A: grid draws in as a faint map, and stays ----
  tl.to(q(".grid"), { opacity: 0.8, duration: 0.7, ease: "power1.out" }, 0.1)
    .to(q(".grid-line"), { strokeDashoffset: 0, duration: 1.7, stagger: 0.02, ease: "power1.out" }, 0.1);

  // ---- SCENE B: subway cars ride in on the tracks and build the ring by docking ----
  const conv = 2.0,
    stagger = 0.16,
    travel = 1.75;
  tl.to(routeEls, { strokeDashoffset: 0, duration: 1.7, stagger: 0.1, ease: "power2.inOut" }, conv);
  routes.forEach((_r, i) => {
    const depart = conv + i * stagger,
      dock = depart + travel;
    tl.to(trains[i], { opacity: 1, duration: 0.3 }, depart);
    // autoRotate keeps the car's front pointing along its curved route
    tl.to(trains[i], { motionPath: { path: routeEls[i], align: routeEls[i], alignOrigin: [0.5, 0.5], autoRotate: true }, duration: travel, ease: "power2.out" }, depart);
    // dock: ping pulse, the car BECOMES the station node seated on the ring
    tl.set(pings[i], { opacity: 0.9, attr: { r: 5 } }, dock)
      .to(pings[i], { attr: { r: 24 }, opacity: 0, duration: 0.6, ease: "power2.out" }, dock)
      .fromTo(nodes[i], { opacity: 0, attr: { r: 0 } }, { opacity: 1, attr: { r: 4.6 }, duration: 0.5, ease: "back.out(2)" }, dock)
      .to(trains[i], { opacity: 0, scale: 0.4, duration: 0.35, ease: "power2.in" }, dock + 0.05);
  });
  const firstDock = conv + travel;
  const lastDock = conv + (routes.length - 1) * stagger + travel;
  // ring stroke draws progressively across the docking window (born from the connecting cars)
  tl.to(q("#ring"), { strokeDashoffset: 0, duration: lastDock - firstDock + 0.3, ease: "none" }, firstDock);
  const formEnd = lastDock + 0.5;

  // ---- SCENE C: nodes pulse + orbit clockwise (ring + nodes share the transform group) ----
  tl.to(q("#ringGroup"), { scale: 1.05, duration: 0.35, ease: "power2.out" }, formEnd - 0.1)
    .to(q("#ringGroup"), { scale: 1.0, duration: 0.45, ease: "power2.inOut" }, formEnd + 0.25)
    .to(q("#nodesGroup"), { rotation: "+=540", duration: 4.6, ease: "none" }, formEnd);

  // ---- SCENE D: bloom -> flurry ----
  const bloom = formEnd + 0.9;
  tl.to(q("#ringGroup"), { scale: 1.13, duration: 0.5, ease: "power2.out" }, bloom)
    .to(q("#ringGroup"), { scale: 1.0, duration: 0.6, ease: "power2.inOut" }, bloom + 0.5)
    .to(q(".route"), { opacity: 0, duration: 0.9, ease: "power2.in" }, bloom)
    .to(q(".grid"), { opacity: 0.3, duration: 1.0, ease: "power2.inOut" }, bloom)
    .to(q(".flurry"), { opacity: 1, duration: 1.4, ease: "power1.out" }, bloom);
  const title = bloom + 1.3;

  // ---- SCENE E: ring unspools into underline, title types ----
  tl.to(q("#ring"), { opacity: 0, duration: 0.9, ease: "power2.in" }, title)
    .to(q("#nodesGroup"), { opacity: 0, duration: 0.6, ease: "power2.in" }, title)
    .to(q(".underline"), { scaleX: 1, duration: 0.9, ease: REVEAL }, title + 0.1)
    .to(q(".title-caret"), { opacity: 1, duration: 0.1 }, title + 0.4)
    .to(q(".t-char"), { opacity: 1, y: 0, duration: 0.3, stagger: 0.085, ease: "power2.out" }, title + 0.5);
  const titleEnd = title + 0.5 + 13 * 0.085 + 0.3;

  // ---- SCENE F: subtitle types (quieter) ----
  const subN = SUB_CHARS.length;
  tl.to(q(".title-caret"), { opacity: 0, duration: 0.2 }, titleEnd + 0.1)
    .to(q(".sub-caret"), { opacity: 1, duration: 0.1 }, titleEnd + 0.15)
    .to(q(".s-char"), { opacity: 1, duration: 0.2, stagger: 0.042, ease: "power1.out" }, titleEnd + 0.2);
  const subEnd = titleEnd + 0.2 + (subN - 1) * 0.042 + 0.2;
  tl.to(q(".sub-caret"), { opacity: 0, duration: 0.25 }, subEnd + 0.25);

  // ---- SCENE G: lockup glides up, paragraph populates WORD-BY-WORD below ----
  const glideT = subEnd + 0.5;
  tl.to(q(".lockup"), { y: -GLIDE, scale: 0.8, duration: 1.0, ease: "power3.out" }, glideT)
    .to(q(".flurry"), { y: -GLIDE, duration: 1.0, ease: "power3.out" }, glideT)
    .to(q(".grid"), { opacity: 0.85, duration: 1.0, ease: "power2.out" }, glideT)
    .to(pwords, { opacity: 1, y: 0, duration: 0.3, stagger: 0.035, ease: "power2.out" }, glideT + 0.3);
  const pEnd = glideT + 0.3 + (pwords.length - 1) * 0.035 + 0.3;

  // ambient: a faint "33,000,000" resolves behind the paragraph, then fades
  const bnWrap = q(".bignum"),
    bn = q(".bignum-val")[0];
  const counter = { v: 0 };
  tl.to(bnWrap, { opacity: 1, duration: 0.7, ease: "power1.out" }, glideT + 0.5)
    .to(counter, { v: 33000000, duration: 1.9, ease: "power2.out", onUpdate: () => { if (bn) bn.textContent = Math.round(counter.v).toLocaleString("en-US"); } }, glideT + 0.5)
    .to(bnWrap, { opacity: 0, duration: 1.1, ease: "power1.in" }, glideT + 2.7);

  // ---- SCENE H: the button appears last and keeps its gentle breathing glow ----
  tl.to(q(".cta"), { opacity: 1, y: 0, duration: 0.8, ease: REVEAL }, pEnd + 0.4);

  return tl; // so animate={false} can rest on the true final frame (progress(1))
}

/* ---------------------------------------------------------------------------
 * Reduced-motion static frame — from the source showStatic(), with three values
 * corrected to match the TIMELINE's actual end state (the source approximation
 * drifted): #ring rests at opacity 0 (Scene E unspools it into the underline),
 * grid at 0.85 (Scene G), .p-word at 1. Reduced-motion users see the same
 * resting frame as everyone else.
 * ------------------------------------------------------------------------- */
function showStatic(q: (s: string) => any[], glide: number) {
  const GLIDE = glide;
  gsap.set(q(".field"), { opacity: 1 });
  gsap.set(q(".grid"), { opacity: 0.85 });
  gsap.set(q(".grid-line"), { strokeDashoffset: 0 });
  gsap.set(q(".route"), { opacity: 0 });
  gsap.set(q(".train"), { opacity: 0 });
  gsap.set(q(".ping"), { opacity: 0 });
  gsap.set(q("#ringGroup"), { opacity: 1 });
  gsap.set(q("#ring"), { strokeDashoffset: 0, opacity: 0 });
  gsap.set(q(".node"), { opacity: 0 });
  gsap.set(q("#nodesGroup"), { opacity: 0 });
  gsap.set(q(".flurry"), { opacity: 1, y: -GLIDE });
  gsap.set(q(".bignum"), { opacity: 0 });
  gsap.set(q(".lockup"), { y: -GLIDE, scale: 0.8, transformOrigin: "50% 50%" });
  gsap.set(q(".underline"), { opacity: 1, scaleX: 1 });
  gsap.set(q(".t-char"), { opacity: 1, y: 0 });
  gsap.set(q(".s-char"), { opacity: 1 });
  gsap.set(q(".title-caret"), { opacity: 0 });
  gsap.set(q(".sub-caret"), { opacity: 0 });
  gsap.set(q(".p-word"), { opacity: 1, y: 0 });
  gsap.set(q(".paragraph"), { opacity: 1 });
  gsap.set(q(".cta"), { opacity: 1, y: 0 });
  // atmosphere held static under reduced motion
  q(".datanum").forEach((n: any) => { n.style.animation = "none"; n.style.opacity = "0.18"; });
  q(".scan").forEach((s: any) => { s.style.animation = "none"; s.style.opacity = "0"; });
  q(".grain").forEach((g: any) => { g.style.animation = "none"; });
  q(".cta").forEach((b: any) => (b.style.animation = "none"));
  q(".train-light").forEach((l: any) => (l.style.animation = "none"));
  q(".caret-bar").forEach((c: any) => (c.style.animation = "none"));
  q(".flurry-blob").forEach((b: any) => (b.style.animation = "none"));
}
