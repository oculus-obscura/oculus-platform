/**
 * View 4 — Ending. Ported from renderView4()/drawLeaders()/startTrail().
 * The trail canvas runs only while the view is active and is fully cleaned
 * up on deactivation/unmount (StrictMode-safe).
 */
import { useEffect, useRef } from "react";
import { fmtPct, type SynthesisModel } from "./synthesisModel";

const LEADERS = [
  { id: "lp", c: "#E24FD1", dot: [480, 375] as const, end: [660, 432] as const, d: "M480 375 L600 388 L660 432" },
  { id: "la", c: "#FFB020", dot: [1440, 375] as const, end: [1260, 432] as const, d: "M1440 375 L1320 388 L1260 432" },
  { id: "lt1", c: "#3CCFCF", dot: [530, 650] as const, end: [660, 596] as const, d: "M530 650 L610 638 L660 596" },
  { id: "lt2", c: "#3CCFCF", dot: [1390, 650] as const, end: [1260, 596] as const, d: "M1390 650 L1310 638 L1260 596" },
];

function Stat({
  id,
  v,
  color,
  angle,
  d,
  cap,
  style,
}: {
  id: string;
  v: string;
  color: string;
  angle: string;
  d: string;
  cap: string;
  style: React.CSSProperties;
}) {
  return (
    <div
      className="v4-stat"
      id={id}
      style={
        {
          ...style,
          "--cc": color,
          "--frame": `linear-gradient(${angle}, rgba(0,0,0,0) 0%, ${color} 34%, ${color} 56%, rgba(0,0,0,0) 100%)`,
        } as React.CSSProperties
      }
    >
      <div className="sv num">{v}</div>
      <div className="sd">{d}</div>
      <div className="sc">{cap}</div>
    </div>
  );
}

export default function View4Ending({
  M,
  active,
  onExplore,
  onRestart,
}: {
  M: SynthesisModel;
  active: boolean;
  onExplore: () => void;
  onRestart: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // the drifting teal trail (prototype startTrail/stopTrail, verbatim maths)
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !active) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    if (window.matchMedia("(prefers-reduced-motion:reduce)").matches) {
      ctx.clearRect(0, 0, cv.width, cv.height);
      return;
    }
    let raf = 0;
    let t = 0;
    const frame = () => {
      t += 0.006;
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        const yb = 300 - k * 22;
        for (let x = 0; x <= 760; x += 8) {
          const y = yb + Math.sin(x * 0.012 + t + k * 0.7) * 28 - x * 0.12;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        const grad = ctx.createLinearGradient(0, 0, 760, 0);
        grad.addColorStop(0, "rgba(11,69,70,0)");
        grad.addColorStop(0.5, `rgba(60,207,207,${0.1 + k * 0.03})`);
        grad.addColorStop(1, `rgba(141,232,224,${0.16 + k * 0.03})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      raf = requestAnimationFrame(frame);
    };
    frame();
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return (
    <section className={"view" + (active ? " active" : "")} id="view4">
      <svg id="v4-leaders" viewBox="0 0 1920 1080" preserveAspectRatio="none">
        <defs>
          {LEADERS.map((l) => (
            <linearGradient key={l.id} id={`grad-${l.id}`} gradientUnits="userSpaceOnUse" x1={l.dot[0]} y1={l.dot[1]} x2={l.end[0]} y2={l.end[1]}>
              <stop offset="0" stopColor={l.c} stopOpacity=".9" />
              <stop offset="1" stopColor={l.c} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {LEADERS.map((l) => (
          <g key={l.id}>
            <path d={l.d} fill="none" stroke={`url(#grad-${l.id})`} strokeWidth="1.4" />
            <circle cx={l.dot[0]} cy={l.dot[1]} r="10" fill={l.c} opacity=".18" />
            <circle cx={l.dot[0]} cy={l.dot[1]} r="3.4" fill={l.c} />
          </g>
        ))}
      </svg>
      <canvas ref={canvasRef} id="v4-trail" width={760} height={420} />
      <div id="v4-center">
        <div className="v4-h mich">THE DATA IS IN.</div>
        <div className="v4-sub mich">
          HERE IS WHAT COMMUTERS ACTUALLY DID
          <br />
          WITHIN 15 MINUTES INSIDE
          <br />
          THE OCULUS.
        </div>
      </div>
      <Stat id="v4-tl" style={{ top: 300, left: 130, textAlign: "left" }} v={fmtPct(M.typicalOver100Pct)} color="#E24FD1" angle="215deg" d="Of the current retail mix has a typical price above $100" cap="Current retail offering" />
      <Stat
        id="v4-tr"
        style={{ top: 300, right: 130, textAlign: "right" }}
        v={fmtPct(M.rejectAbove100.c ? M.rejectAbove100.rate : NaN)}
        color="#FFB020"
        angle="145deg"
        d="Selected “won't shop here” at stores above $100"
        cap={`Mismatch indicator · ${M.rejectAbove100.w} of ${M.rejectAbove100.c} interactions`}
      />
      <Stat
        id="v4-bl"
        style={{ top: 590, left: 170, textAlign: "left" }}
        v={fmtPct(M.totalDecisions ? M.entrySel / M.totalDecisions : NaN)}
        color="#3CCFCF"
        angle="305deg"
        d="Selected the lowest price point"
        cap={`Commuter behaviour · ${M.entrySel} of ${M.totalDecisions} decisions`}
      />
      <Stat
        id="v4-br"
        style={{ top: 590, right: 170, textAlign: "right" }}
        v={fmtPct(M.restroomPctVal, 1)}
        color="#3CCFCF"
        angle="55deg"
        d="Prioritised a basic need"
        cap={`Commuter behaviour · ${M.activities.find((a) => a.key === "restroom")!.count} of ${M.N} sessions`}
      />
      <div id="v4-note">
        The platform does not prescribe an answer.
        <br />
        It makes commuter choices visible and lets the data speak.
      </div>
      <div id="v4-btns">
        <button type="button" className="cta-out" onClick={onExplore}>
          Explore the synthesis{" "}
          <svg viewBox="0 0 24 24">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
        <button type="button" className="cta-out" id="v4-restart" onClick={onRestart}>
          Restart simulation{" "}
          <svg viewBox="0 0 24 24">
            <path d="M4 12a8 8 0 108-8M4 4v5h5" />
          </svg>
        </button>
      </div>
    </section>
  );
}
