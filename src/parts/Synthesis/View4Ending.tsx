/**
 * View 4 — Ending. Part B4 of the UI overhaul: "THE RECORD, WRITTEN OVER THE
 * REDACTION."
 *
 * The Overview opens the platform with four plum "NOT DISCLOSED" redaction
 * bars (foot traffic · sales/sqft · vacancy · commuter-vs-shopper split). This
 * view returns to them and writes the counter-record into that space. The
 * redaction treatment is reused from the Overview's withheld column (plum bar
 * fill/border, "Not disclosed" caps) at comparable presence — it is the
 * platform's central claim, not a caption.
 *
 * Honesty (Part 3): the four generated figures are NOT answers to the four
 * withheld questions — the mapping is only POSITIONAL (a figure writes into
 * the space a bar held). Each figure keeps its own caption + counts; the
 * withheld labels dissolve rather than being "solved".
 *
 * READING ORDER vs REVEAL ORDER: the resting layout reads top-to-bottom —
 * title, subtitle, bridge line, ledger, closing statement, live indicator,
 * buttons. The reveal plays in dramatic order (redaction → hold → turn →
 * record writes → title resolves) by animating each box in place; every box
 * holds its layout slot from the first frame, so nothing shifts.
 *
 * The full ~10s sequence plays on FIRST arrival this session only (session
 * flag, the IntroSequence `animate={false}` pattern); later returns render the
 * composed frame instantly. It is fully SKIPPABLE — any pointer/key/wheel
 * interaction jumps to the composed frame — and never blocks interaction
 * (opacity/transform only, no overlay). prefers-reduced-motion / inactive /
 * seen → the composed frame instantly. Colours fixed: amber = behaviour, plum
 * = withheld, teal = measured; percentages WHOLE; every % carries its count.
 */
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import gsap from "gsap";
import { fmtPct, type SynthesisModel } from "./synthesisModel";
import { Prov } from "./synthesisUi";

/** The full sequence plays once per session (then the composed frame shows). */
const SEEN_KEY = "oculus:hasSeenEndingSequence";

interface Entry {
  key: string;
  dominant: boolean;
  color: string;
  tone: "amber" | "plum" | "teal";
  v: string;
  desc: string;
  src: string;
  prov: { d: number; unit: string } | null;
  withheld: string; // the Overview item whose bar held this space
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
  const rootRef = useRef<HTMLElement>(null);

  // Percentages are WHOLE across this view — at small n a decimal implies
  // precision the sample can't support. Colours are FIXED per figure.
  const restroom = M.activities.find((a) => a.key === "restroom")!.count;
  const entries: Entry[] = [
    {
      key: "dom",
      dominant: true,
      color: "#FFB020",
      tone: "amber",
      v: fmtPct(M.rejectAbove100.c ? M.rejectAbove100.rate : NaN),
      desc: "Selected “won't shop here” at stores above $100",
      src: `Mismatch indicator · ${M.rejectAbove100.w} of ${M.rejectAbove100.c} interactions`,
      prov: { d: M.rejectAbove100.c, unit: "interactions" },
      withheld: "Foot traffic inside the retail concourse",
    },
    {
      key: "r1",
      dominant: false,
      color: "#E24FD1",
      tone: "plum",
      v: fmtPct(M.typicalOver100Pct),
      desc: "Of the current retail mix has a typical price above $100",
      src: `Current retail offering · ${M.typicalOver100} of ${M.totalStores} stores`,
      prov: null, // audited offer — never provisional
      withheld: "Sales per square foot",
    },
    {
      key: "r2",
      dominant: false,
      color: "#3CCFCF",
      tone: "teal",
      v: fmtPct(M.totalDecisions ? M.entrySel / M.totalDecisions : NaN),
      desc: "Selected the lowest price point",
      src: `Commuter behaviour · ${M.entrySel} of ${M.totalDecisions} decisions`,
      prov: { d: M.totalDecisions, unit: "decisions" },
      withheld: "Vacancy rate",
    },
    {
      key: "r3",
      dominant: false,
      color: "#3CCFCF",
      tone: "teal",
      v: fmtPct(M.restroomPctVal),
      desc: "Prioritised a basic need",
      src: `Commuter behaviour · ${restroom} of ${M.N} sessions`,
      prov: { d: M.N, unit: "sessions" },
      withheld: "Commuter vs. shopper split",
    },
  ];

  // ---- the sequence: wound → hold → turn → record writes → statement ----
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const q = gsap.utils.selector(root) as unknown as (s: string) => any[];

    // figures restore their exact final text on cleanup (count-up is transient)
    const figs = q(".led-fig") as HTMLElement[];
    const finals = figs.map((el) => el.textContent ?? "");
    const restore = () => figs.forEach((el, i) => (el.textContent = finals[i]));

    if (!active) return; // inactive: CSS composed frame, no timeline
    if (window.matchMedia("(prefers-reduced-motion:reduce)").matches) return; // composed frame instantly
    // FIRST arrival this session plays the full sequence; later returns rest
    // on the composed frame (IntroSequence's animate={false} pattern)
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      /* private mode — just replay */
    }
    if (seen) return;
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }

    let skip: (() => void) | null = null;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      const entryEls = q(".led-entry");

      // ── t0 hidden (every box holds its layout slot; only opacity changes) ──
      tl.set(q(".led-record"), { autoAlpha: 0, y: 6 }, 0)
        .set(q(".led-redact"), { autoAlpha: 0 }, 0)
        .set(q(".led-redact-bar"), { scaleX: 0, transformOrigin: "left center" }, 0)
        .set(q(".led-redact-label"), { autoAlpha: 0 }, 0)
        .set(q(".led-redact-text"), { autoAlpha: 0 }, 0)
        .set(q(".led-rule"), { autoAlpha: 0 }, 0)
        .set(".v4-turn", { autoAlpha: 0, y: 8 }, 0)
        .set(".v4-h", { autoAlpha: 0, scale: 0.9, transformOrigin: "50% 50%" }, 0)
        .set(".v4-sub", { autoAlpha: 0, y: 10 }, 0)
        .set("#v4-note", { autoAlpha: 0, y: 8 }, 0)
        .set(".v4-live", { autoAlpha: 0, y: 6 }, 0)
        .set("#v4-btns > *", { autoAlpha: 0, y: 10 }, 0);

      // ── ACT 1 — THE WOUND: the four withheld items land one at a time, so
      //    the absence accumulates; each ~0.5s apart, legible as it arrives ──
      entryEls.forEach((_: HTMLElement, i: number) => {
        const at = 0.3 + i * 0.5;
        const e = q(".led-entry")[i];
        tl.to(e.querySelector(".led-redact"), { autoAlpha: 1, duration: 0.35 }, at)
          .fromTo(e.querySelector(".led-redact-bar"), { scaleX: 0 }, { scaleX: 1, duration: 0.55, ease: "power2.out" }, at)
          .to(e.querySelector(".led-redact-label"), { autoAlpha: 1, duration: 0.4 }, at)
          .to(e.querySelector(".led-redact-text"), { autoAlpha: 1, duration: 0.35 }, at + 0.18);
      });
      tl.to(q(".led-rule"), { autoAlpha: 1, duration: 0.4 }, 0.6);

      // HOLD — all four visible and static for a full beat. This is the point.
      const holdEnd = 3.55; // last bar lands ~2.35, then ~1.2s of held absence

      // ── ACT 2 — THE TURN: the line resolves; the plum bars dim ──
      tl.to(".v4-turn", { autoAlpha: 0.92, y: 0, duration: 0.8, ease: "power2.out" }, holdEnd)
        .to([".led-redact-bar", ".led-redact-label", ".led-redact-text"], { autoAlpha: 0.4, duration: 0.6, ease: "power2.inOut" }, holdEnd);

      // ── ACT 3 — THE RECORD WRITES: each bar dissolves as its figure arrives,
      //    slow enough to read as a substitution, not a flicker ──
      const REC0 = holdEnd + 1.1,
        REC_STAG = 0.6;
      entries.forEach((_, i) => {
        const at = REC0 + i * REC_STAG;
        const e = q(".led-entry")[i];
        tl.to(e.querySelector(".led-redact-bar"), { scaleX: 0, duration: 0.6, ease: "power3.inOut" }, at)
          .to(e.querySelector(".led-redact"), { autoAlpha: 0, duration: 0.5, ease: "power2.in" }, at + 0.05)
          .to(e.querySelector(".led-record"), { autoAlpha: 1, y: 0, duration: 0.7, ease: "expo.out" }, at + 0.15);
        // count-up (proxy tween; final text restored on cleanup)
        const el = figs[i];
        const m = finals[i].match(/^(\$?)([\d,]+(?:\.\d+)?)(%?)$/);
        if (m) {
          const prefix = m[1],
            suffix = m[3],
            target = parseFloat(m[2].replace(/,/g, "")),
            dec = (m[2].split(".")[1] || "").length;
          if (!isNaN(target) && target !== 0) {
            const px = { v: 0 };
            el.textContent = prefix + "0" + suffix;
            tl.to(
              px,
              {
                v: target,
                duration: 1.1,
                ease: "power2.out",
                onUpdate: () =>
                  (el.textContent = prefix + (dec ? px.v.toFixed(dec) : Math.round(px.v).toLocaleString("en-US")) + suffix),
                onComplete: () => (el.textContent = finals[i]),
              },
              at + 0.2,
            );
          }
        }
      });

      // ── ACT 4 — THE STATEMENT resolves last (at the top of the layout) ──
      const statement = REC0 + entries.length * REC_STAG + 0.6;
      tl.to(".v4-h", { autoAlpha: 1, scale: 1, duration: 0.9, ease: "expo.out" }, statement)
        .fromTo(
          ".v4-h",
          { textShadow: "0 0 46px rgba(60,207,207,0.5)" },
          { textShadow: "0 0 22px rgba(26,135,135,0.32)", duration: 1.1, ease: "power2.out" },
          statement,
        )
        .to(".v4-sub", { autoAlpha: 1, y: 0, duration: 0.7, ease: "expo.out" }, statement + 0.6)
        // note/live settle at their quiet resting opacity, matching the CSS
        // composed frame that reduced-motion / seen returns show
        .to("#v4-note", { autoAlpha: 0.85, y: 0, duration: 0.7, ease: "power2.out" }, statement + 1.05);

      // ── ACT 5 — THE INVITATION: live indicator, then the buttons ──
      tl.to(".v4-live", { autoAlpha: 1, y: 0, duration: 0.6, ease: "power2.out" }, statement + 1.4).to(
        "#v4-btns > *",
        { autoAlpha: 1, y: 0, duration: 0.6, ease: "expo.out", stagger: 0.12 },
        statement + 1.65,
      );

      // SKIPPABLE: the first pointer / key / wheel interaction jumps to the frame
      skip = () => {
        tl.progress(1);
        window.removeEventListener("pointerdown", skip!, true);
        window.removeEventListener("keydown", skip!, true);
        window.removeEventListener("wheel", skip!, true);
      };
      window.addEventListener("pointerdown", skip, true);
      window.addEventListener("keydown", skip, true);
      window.addEventListener("wheel", skip, true);
    }, root);

    return () => {
      if (skip) {
        window.removeEventListener("pointerdown", skip, true);
        window.removeEventListener("keydown", skip, true);
        window.removeEventListener("wheel", skip, true);
      }
      ctx.revert();
      restore();
    };
  }, [active, M]);

  const renderProv = (e: Entry): ReactNode => (e.prov ? <Prov d={e.prov.d} unit={e.prov.unit} zero /> : null);

  return (
    <section ref={rootRef} className={"view" + (active ? " active" : "")} id="view4">
      {/* 1 · title  2 · subtitle */}
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

      {/* 3 · the bridge */}
      <div className="v4-turn">So we built the record ourselves.</div>

      {/* 4 · the ledger — the record written over the redaction */}
      <div className="v4-ledger">
        {entries.map((e, i) => (
          <div key={e.key}>
            {i === 1 && <div className="led-rule led-rule--strong" aria-hidden="true" />}
            {i > 1 && <div className="led-rule" aria-hidden="true" />}
            <div className={"led-entry led-" + e.tone}>
              {/* the record (final content — the fade unit) */}
              <div className={"led-record " + (e.dominant ? "led-dom" : "led-row")} style={{ "--cc": e.color } as CSSProperties}>
                <div className="led-fig num">{e.v}</div>
                <div className="led-desc">{e.desc}</div>
                <div className="led-src">
                  {e.src}
                  {renderProv(e)}
                </div>
              </div>
              {/* the wound (Overview's redaction, reused) — dissolves in Act 3 */}
              <div className={"led-redact" + (e.dominant ? " led-redact--dom" : "")} aria-hidden="true">
                <span className="led-redact-label">{e.withheld}</span>
                <span className="led-redact-barwrap">
                  <span className="led-redact-bar" />
                  <span className="led-redact-text">Not disclosed</span>
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 5 · the closing statement */}
      <div id="v4-note">
        The platform does not prescribe an answer.
        <br />
        It makes commuter choices visible and lets the data speak.
      </div>

      {/* 6 · the live indicator */}
      <div className="v4-live">
        <span className="v4-live-dot" aria-hidden="true" />
        The record is still open · {M.N} session{M.N === 1 ? "" : "s"} and counting
      </div>

      {/* 7 · the buttons (B3 names/behaviour kept) */}
      <div id="v4-btns">
        <button type="button" className="cta-out v4-btn-secondary" onClick={onExplore}>
          Re-visit synthesis{" "}
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7M8 12h11" />
          </svg>
        </button>
        <button type="button" className="cta v4-btn-primary" onClick={onRestart}>
          Play the simulation{" "}
          <svg className="v4-play" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5v14l11-7-11-7z" />
          </svg>
        </button>
      </div>
    </section>
  );
}
