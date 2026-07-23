/**
 * SynthesisView — the four output views, ported from
 * design-reference/oculus_synthesis.html.
 *
 * Structure: a fixed 1920×1080 stage scaled to fit the area between the
 * platform chrome and the Part-A navigation cluster (the prototype's own
 * scaling model — it is what keeps the approved layout intact at every
 * viewport). Views stay mounted and cross-fade via the .view/.active opacity
 * transition, exactly as the prototype.
 *
 * Part A (UI overhaul, universal systems):
 *  - the interior photograph is gone from the aggregate views; the ground is
 *    SynthesisBackdrop, a generated full-bleed data substrate at the ROOT
 *    level (no letterboxing). View 1 keeps its own photo ground, scoped to
 *    its section and untouched.
 *  - navigation is SynNav, a persistent glass cluster below the stage
 *    (arrows + clickable dots + view name + keyboard ← →). The old in-view
 *    arrows are removed.
 *  - views 2–4 play the shared reveal choreography (synthesisReveal) each
 *    time they become active; View 1 keeps its untouched prototype count-up.
 *
 * Data: View 1 renders INSTANTLY from the in-memory CompletedSession.
 * Views 2–4 build from fetchSynthesisData() -> buildModel() —
 *   - fetched on every mount (Amendment A; the component unmounts when the
 *     user navigates away, so mount === becoming active)
 *   - one short retry ~1.5s later when a round was just completed, so the
 *     aggregate can never miss the row the save just wrote (Amendment B)
 *   - totalUsers === 0 renders the empty state (the ledger legitimately
 *     begins empty); fetch failure renders a quiet non-alarming notice
 * View count is conditional: with a session 1→4 opening on View 1; without,
 * three views opening on the aggregate — the cluster adapts, no dead ends.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CompletedSession } from "../Simulation/SimulationGame";
import { fetchSynthesisData, type SynthesisData } from "./synthesisData";
import { buildModel } from "./synthesisModel";
import { playViewReveal } from "./synthesisReveal";
import SynthesisBackdrop from "./SynthesisBackdrop";
import SynNav, { type SynNavView } from "./SynNav";
import View1Individual from "./View1Individual";
import View2Synthesis from "./View2Synthesis";
import View3Gap from "./View3Gap";
import View4Ending from "./View4Ending";
import "./synthesisView.css";

type AggState =
  | { status: "loading" }
  | { status: "ready"; data: SynthesisData }
  | { status: "unavailable" } // Supabase not configured
  | { status: "error"; message: string };

const VIEW_NAMES: Record<1 | 2 | 3 | 4, string> = {
  1: "Individual Result",
  2: "Synthesis",
  3: "The Gap",
  4: "Ending",
};

interface SynthesisViewProps {
  /** The most recent completed round (in-memory) — null when arriving cold. */
  lastSession: CompletedSession | null;
  /** "Restart simulation" / the play invite — navigates to the Simulation. */
  onPlaySimulation: () => void;
}

export default function SynthesisView({ lastSession, onPlaySimulation }: SynthesisViewProps) {
  const hasSession = lastSession !== null;
  const [view, setView] = useState<1 | 2 | 3 | 4>(hasSession ? 1 : 2);
  const [agg, setAgg] = useState<AggState>({ status: "loading" });
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // ---- data (Amendments A + B) ----
  const hasSessionRef = useRef(hasSession);
  hasSessionRef.current = hasSession;
  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | undefined;
    const load = async (attempt: number) => {
      try {
        const data = await fetchSynthesisData();
        if (cancelled) return;
        if (!data) {
          setAgg({ status: "unavailable" });
          return;
        }
        setAgg({ status: "ready", data });
        // a just-finished round's write may still be in flight — refetch once
        if (attempt === 0 && hasSessionRef.current) {
          retryTimer = window.setTimeout(() => {
            if (!cancelled) void load(1);
          }, 1500);
        }
      } catch (e) {
        if (!cancelled) setAgg({ status: "error", message: e instanceof Error ? e.message : String(e) });
      }
    };
    void load(0);
    return () => {
      cancelled = true;
      if (retryTimer !== undefined) clearTimeout(retryTimer);
    };
  }, []);

  const M = useMemo(
    () => (agg.status === "ready" && agg.data.meta.totalUsers > 0 ? buildModel(agg.data) : null),
    [agg],
  );

  // real values for the background substrate (never invented — see backdrop)
  const bgExtra = useMemo(() => {
    if (agg.status !== "ready") return null;
    const d = agg.data;
    const out = [...d.fragments, `N = ${d.meta.totalUsers}`];
    if (d.meta.periodLabel !== "—") out.push(d.meta.periodLabel);
    return out;
  }, [agg]);

  // the view sequence the nav cluster pages through (4 with a session, 3 without)
  const navViews = useMemo<SynNavView[]>(
    () => (hasSession ? ([1, 2, 3, 4] as const) : ([2, 3, 4] as const)).map((id) => ({ id, name: VIEW_NAMES[id] })),
    [hasSession],
  );

  // ---- stage scaling (prototype fitStage, sized to the area between the
  //      chrome bar and the nav cluster) ----
  useEffect(() => {
    const wrap = wrapRef.current,
      stage = stageRef.current;
    if (!wrap || !stage) return;
    const fit = () => {
      const s = Math.min(wrap.clientWidth / 1920, wrap.clientHeight / 1080);
      stage.style.transform = `scale(${s})`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // ---- reveal choreography on view enter ----
  // View 1: the prototype's own count-up (.num >= 30px), UNTOUCHED.
  // Views 2–4: the Part-A shared reveal (stagger + count-up), re-triggered on
  // every activation — including when the model lands under an active view.
  useEffect(() => {
    const el = stageRef.current?.querySelector<HTMLElement>(`#view${view}`);
    if (!el) return;
    if (view !== 1) return playViewReveal(el);

    if (window.matchMedia("(prefers-reduced-motion:reduce)").matches) return;
    const rafs: number[] = [];
    el.querySelectorAll<HTMLElement>(".num").forEach((n) => {
      if (parseFloat(getComputedStyle(n).fontSize) < 30) return;
      const txt = n.textContent?.trim() ?? "";
      const m = txt.match(/^(\$?)([\d,]+(?:\.\d+)?)(%?)$/);
      if (!m) return;
      const prefix = m[1],
        suffix = m[3];
      const target = parseFloat(m[2].replace(/,/g, ""));
      if (isNaN(target) || target === 0) return;
      const dec = (m[2].split(".")[1] || "").length;
      const dur = 850,
        t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min((now - t0) / dur, 1);
        const e = 1 - Math.pow(1 - p, 3);
        const val = target * e;
        n.textContent = prefix + (dec ? val.toFixed(dec) : Math.round(val).toLocaleString("en-US")) + suffix;
        if (p < 1) rafs.push(requestAnimationFrame(step));
        else n.textContent = txt;
      };
      rafs.push(requestAnimationFrame(step));
    });
    return () => rafs.forEach(cancelAnimationFrame);
  }, [view, M, lastSession]);

  // aggregate views share one placeholder while loading / empty / failed;
  // the nav cluster keeps the sequence walkable — no in-view arrows
  const aggPlaceholder = (id: 2 | 3 | 4) => (
    <section
      key={id}
      className={"view" + (view === id ? " active" : "")}
      id={`view${id}`}
      style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      {agg.status === "loading" ? (
        <div className="syn-wait" role="status">
          <div className="panel-t" style={{ fontSize: 16 }}>
            Assembling the ledger
          </div>
          <div className="syn-wait__bar" aria-hidden="true">
            <span />
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            Reading every recorded session…
          </div>
        </div>
      ) : agg.status === "ready" ? (
        /* ready but zero sessions — the counter-ledger's correct opening state */
        <div className="syn-empty">
          <div className="mich syn-empty__title">NO SESSIONS RECORDED.</div>
          <div className="muted syn-empty__line">
            The ledger begins empty. Every simulated round adds a row — the record starts with the first commuter.
          </div>
          <button type="button" className="cta-out" onClick={onPlaySimulation}>
            Play the simulation{" "}
            <svg viewBox="0 0 24 24">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="syn-wait" role="status">
          <div className="panel-t" style={{ fontSize: 16 }}>
            The ledger is unreachable
          </div>
          <div className="muted" style={{ fontSize: 13, maxWidth: 420, lineHeight: 1.6, textAlign: "center" }}>
            {agg.status === "unavailable"
              ? "Supabase is not configured in this environment. The aggregate views resume when a connection exists."
              : "The connection failed while reading sessions. Your own round is unaffected — try again shortly."}
          </div>
        </div>
      )}
    </section>
  );

  return (
    <div className="syn">
      <SynthesisBackdrop extra={bgExtra} />
      <div ref={wrapRef} className="syn-stagewrap">
        <div ref={stageRef} className="syn-stage">
          {hasSession && lastSession && (
            <section className={"view" + (view === 1 ? " active" : "")} id="view1">
              {/* View 1 keeps its own photo ground, scoped to this section */}
              <div className="syn-bg" aria-hidden="true" />
              <View1Individual is={lastSession} onExplore={() => setView(2)} />
            </section>
          )}
          {M ? (
            <>
              <View2Synthesis
                M={M}
                active={view === 2}
                hasSession={hasSession}
                onPlaySimulation={onPlaySimulation}
              />
              <View3Gap M={M} active={view === 3} />
              <View4Ending M={M} active={view === 4} onExplore={() => setView(2)} onRestart={onPlaySimulation} />
            </>
          ) : (
            <>
              {aggPlaceholder(2)}
              {aggPlaceholder(3)}
              {aggPlaceholder(4)}
            </>
          )}
        </div>
      </div>
      <SynNav views={navViews} current={view} onSelect={setView} />
    </div>
  );
}
