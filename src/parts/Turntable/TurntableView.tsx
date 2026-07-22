/**
 * Part 1A — the Oculus turntable view.
 *
 * A pre-rendered 1920×1080 turntable video of the Oculus wireframe floating in
 * PURE BLACK. The section background is #000000 (not --color-bg #0A0A0A) on
 * purpose: the video holds pure black to its edges, so matching it makes the
 * video boundary invisible and the whole viewport reads as one continuous
 * black field. See turntableView.css.
 *
 * The video plays ONCE and pauses on its final frame (the loop point equals the
 * first frame, so it rests on a clean pose). Its 'ended' event triggers the data
 * layer: MEASURED (teal) writes in on the left with counting values, WITHHELD
 * (plum) tries and fails to resolve on the right — each value scrambles, then
 * collapses into a NOT DISCLOSED redaction bar — then the bottom pivot lands.
 *
 * The structure rotates, so nothing is anchored to it: all content lives in the
 * open margins (wide) or below the video (narrow). Reduced motion: no autoplay
 * (poster holds), data layer rendered directly in its final state.
 *
 * Renders inside PlatformChrome (which owns the TitleMark + nav bar).
 *
 * Exit (→ Data Dashboard): the data layer RETRACTS — values scramble back
 * down and fade, hairlines withdraw, redactions dissolve — until only the
 * Oculus holds in black, then the field fades out and onRetracted fires.
 * The public record has been exhausted; the walk begins. Triggered by the
 * `retracting` prop (App flips it on nav click / the bottom affordance /
 * wheeling past the page bottom).
 */
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import type Lenis from "lenis";
import "./turntableView.css";

/* Exported so App can warm the browser cache while the intro plays. */
export const TURNTABLE_VIDEO_SRC = "/videos/oculus-turntable.mp4";
export const TURNTABLE_POSTER_SRC = "/videos/oculus-turntable-poster.jpg";

/* ---------------------------------------------------------------------------
 * Copy — the ledger rows.
 * ------------------------------------------------------------------------- */
interface MeasuredRow {
  values: number[]; // multiple values render joined with " / "
  label: string;
  source: string;
  /** Amber proxy row: adjacent-station data, per DESIGN.md never solid teal. */
  edge?: boolean;
  note?: string;
}

const MEASURED_ROWS: MeasuredRow[] = [
  {
    values: [14216591],
    label: "Annual PATH ridership, WTC",
    source: "Port Authority, 2025",
  },
  {
    values: [46802, 24772],
    label: "Average weekday / weekend riders",
    source: "Port Authority, 2025",
  },
  {
    values: [19221396],
    label: "Annual subway entries, Fulton St Complex",
    source: "MTA, 2024",
    edge: true,
    note: "adjacent station — proxy",
  },
  {
    values: [12],
    label: "Subway lines served",
    source: "1 · 2 · 3 · 4 · 5 · A · C · E · J · Z · R · W",
  },
];

/* Each withheld metric scrambles digits in the SHAPE it would have had —
   a footfall count, a $/sqft, a rate, a split — before failing to resolve. */
const WITHHELD_ROWS = [
  { label: "Foot traffic inside the retail concourse", shape: "##,###,###" },
  { label: "Sales per square foot", shape: "$#,###" },
  { label: "Vacancy rate", shape: "##.#%" },
  { label: "Commuter vs. shopper split", shape: "## / ##" },
];

const fmt = (n: number) => n.toLocaleString("en-US");

interface TurntableViewProps {
  /**
   * "sequence": first arrival this session — video plays once, the ledger
   *   reveals, and SCROLL IS LOCKED until the sequence completes or is
   *   skipped (the advance affordance stays hidden meanwhile).
   * "settled": every later arrival — video paused on its final frame, ledger
   *   fully written, affordance visible immediately. No replay, no lock.
   * "return": scrolled back up from the dashboard — the retract plays in
   *   reverse over the resting pose. No lock.
   * Read once at mount.
   */
  entry?: "sequence" | "settled" | "return";
  /** App's Lenis ref — sequence mode stops/starts it for the scroll lock. */
  lenis?: { current: Lenis | null };
  /** Fired when the first-arrival sequence completes or is skipped. */
  onSequenceDone?: () => void;
  /** Advance to the Data Dashboard (chevron click / wheel past bottom). */
  onAdvance?: () => void;
  /** When true, run the retract exit; onRetracted fires when black holds. */
  retracting?: boolean;
  onRetracted?: () => void;
}

export default function TurntableView({
  entry = "sequence",
  lenis,
  onSequenceDone,
  onAdvance,
  retracting = false,
  onRetracted,
}: TurntableViewProps) {
  const rootRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dataRef = useRef<HTMLDivElement>(null);
  const revealedRef = useRef(false);
  const entryRef = useRef(entry); // frozen at mount
  // sequence lock state + the skip control's jump-to-end (built inside ctx)
  const seqLockedRef = useRef(false);
  const skipRef = useRef<(() => void) | null>(null);
  const onSequenceDoneRef = useRef(onSequenceDone);
  onSequenceDoneRef.current = onSequenceDone;
  const [skipVisible, setSkipVisible] = useState(false);
  // exit machinery: the ctx `self` + a builder created inside the context
  // closure (where the scoped selector lives), invoked when `retracting` flips
  const retractRef = useRef<(() => void) | null>(null);
  const revealTlRef = useRef<gsap.core.Timeline | null>(null);
  const retractingRef = useRef(false);
  const onAdvanceRef = useRef(onAdvance);
  const onRetractedRef = useRef(onRetracted);
  onAdvanceRef.current = onAdvance;
  onRetractedRef.current = onRetracted;

  // layout effect: the "return" entry hides everything pre-paint before the
  // write-back plays — a plain effect would flash the final state for a frame
  useLayoutEffect(() => {
    const root = rootRef.current;
    const video = videoRef.current;
    const dataEl = dataRef.current;
    if (!root || !video || !dataEl) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context((self) => {
      const qRoot = gsap.utils.selector(root) as (s: string) => HTMLElement[];

      /* ---- the retract exit (available in all motion modes but reduced) ---- */
      retractRef.current = () => {
        if (reduced) {
          onRetractedRef.current?.();
          return;
        }
        self!.add(() => {
          revealTlRef.current?.kill(); // stop a mid-flight reveal cleanly
          const tl = gsap.timeline({ onComplete: () => onRetractedRef.current?.() });
          // values scramble back down while fading — the tally un-writes itself
          qRoot(".tt-value__num").forEach((el) => {
            const shape = (el.textContent ?? "").replace(/\d/g, "#");
            const proxy = { t: 0 };
            let last = -1;
            tl.to(
              proxy,
              {
                t: 1,
                duration: 0.34,
                ease: "none",
                onUpdate: () => {
                  const frame = Math.floor(proxy.t * 9);
                  if (frame !== last) {
                    last = frame;
                    el.textContent = shape.replace(/#/g, () => String(Math.floor(Math.random() * 10)));
                  }
                },
              },
              0,
            );
          });
          tl.to(qRoot(".tt-value"), { opacity: 0, duration: 0.38, ease: "power2.in" }, 0.06);
          tl.to(qRoot(".tt-row"), { opacity: 0, y: 10, duration: 0.4, ease: "power3.out", stagger: 0.035 }, 0.1);
          tl.to(qRoot(".tt-row__line"), { scaleX: 0, duration: 0.3, ease: "power3.out" }, 0.02);
          tl.to(qRoot(".tt-redaction__bar"), { scaleX: 0, opacity: 0, duration: 0.34, ease: "power3.out" }, 0.06);
          tl.to(qRoot(".tt-redaction__text"), { opacity: 0, duration: 0.25, ease: "power2.in" }, 0.06);
          tl.to(qRoot(".tt-rule"), { scaleY: 0, duration: 0.45, ease: "expo.inOut" }, 0.12);
          tl.to(qRoot(".tt-header"), { opacity: 0, y: 6, duration: 0.3, ease: "power2.in" }, 0.22);
          tl.to(qRoot(".tt-pivot__line"), { opacity: 0, y: 10, duration: 0.34, ease: "power3.out", stagger: 0.06 }, 0.1);
          tl.to(qRoot(".turntable__replay, .turntable__advance"), { opacity: 0, duration: 0.25, ease: "power2.in" }, 0);
          // …only the Oculus remains in black — beat — then the field goes dark
          tl.to(qRoot(".turntable__stage"), { opacity: 0, duration: 0.32, ease: "power2.in" }, 0.62);
        });
      };

      if (reduced || entryRef.current === "settled") {
        // Settled: the sequence already ran this session (or motion is
        // reduced) — markup renders the final ledger natively; the video
        // rests on its LAST frame (loop point ≡ poster, so no visible seek).
        // No lock, affordance immediately live.
        if (entryRef.current === "settled") {
          const seekEnd = () => {
            if (isFinite(video.duration) && video.duration > 0) {
              video.currentTime = Math.max(0, video.duration - 0.05);
            }
          };
          if (video.readyState >= 1) seekEnd();
          else video.addEventListener("loadedmetadata", seekEnd, { once: true });
        }
        // reduced-motion first arrival: the sequence "completes" instantly
        if (entryRef.current === "sequence") onSequenceDoneRef.current?.();
        return;
      }

      const q = gsap.utils.selector(dataEl) as (s: string) => HTMLElement[];
      // sequence mode wires this to the scroll-lock release
      let onRevealComplete: (() => void) | null = null;

      // ---- initial hidden states (only when we intend to animate) ----
      gsap.set(q(".tt-header, .tt-row, .tt-pivot__line"), { opacity: 0, y: 10 });
      gsap.set(q(".tt-rule"), { scaleY: 0, transformOrigin: "top center" });
      gsap.set(q(".tt-row__line"), { scaleX: 0, transformOrigin: "left center" });
      gsap.set(q(".tt-redaction__bar"), { scaleX: 0, transformOrigin: "left center" });
      gsap.set(q(".tt-redaction__text"), { opacity: 0 });

      // self.add registers the late-built timeline with the context so an
      // unmount mid-reveal (title-mark click) kills it cleanly
      const reveal = () => self!.add(buildReveal);
      const buildReveal = () => {
        const tl = gsap.timeline({
          defaults: { ease: "expo.out" },
          onComplete: () => onRevealComplete?.(),
        });
        revealTlRef.current = tl; // so a retract can cut a mid-flight reveal

        /** Ledger tally: value counts up rapidly to its final figure. */
        const countUp = (el: HTMLElement, target: number, at: number) => {
          const proxy = { v: 0 };
          tl.to(
            proxy,
            {
              v: target,
              duration: 0.7,
              ease: "power2.out",
              onUpdate: () => {
                el.textContent = fmt(Math.round(proxy.v));
              },
            },
            at,
          );
        };

        /** Failure-to-resolve: digits cycle in the metric's shape, then die. */
        const scramble = (el: HTMLElement, shape: string, at: number) => {
          const proxy = { t: 0 };
          let lastFrame = -1;
          tl.to(el, { opacity: 0.85, duration: 0.16, ease: "power1.out" }, at);
          tl.to(
            proxy,
            {
              t: 1,
              duration: 0.55,
              ease: "none",
              onUpdate: () => {
                const frame = Math.floor(proxy.t * 13);
                if (frame !== lastFrame) {
                  lastFrame = frame;
                  el.textContent = shape.replace(/#/g, () =>
                    String(Math.floor(Math.random() * 10)),
                  );
                }
              },
            },
            at,
          );
          tl.to(el, { opacity: 0, duration: 0.2, ease: "power2.in" }, at + 0.55);
        };

        // ---- LEFT: MEASURED — hairline draws down, rows write in, values tally ----
        tl.to(q(".tt-rule--measured"), { scaleY: 1, duration: 0.5 }, 0);
        tl.to(q(".tt-col--measured .tt-header"), { opacity: 1, y: 0, duration: 0.45 }, 0.12);
        const leftRows = dataEl.querySelectorAll<HTMLElement>(".tt-col--measured .tt-row");
        leftRows.forEach((row, i) => {
          const at = 0.3 + i * 0.5;
          tl.to(row, { opacity: 1, y: 0, duration: 0.5 }, at);
          row.querySelectorAll<HTMLElement>(".tt-value__num").forEach((numEl) => {
            countUp(numEl, Number(numEl.dataset.target ?? 0), at + 0.05);
          });
          const line = row.querySelector<HTMLElement>(".tt-row__line");
          if (line) tl.to(line, { scaleX: 1, duration: 0.55 }, at + 0.12);
        });
        const leftEnd = 0.3 + (leftRows.length - 1) * 0.5 + 0.75;

        // ---- beat ----
        const rs = leftEnd + 0.6;

        // ---- RIGHT: WITHHELD — rows try to resolve and fail into redaction ----
        tl.to(q(".tt-rule--withheld"), { scaleY: 1, duration: 0.5 }, rs);
        tl.to(q(".tt-col--withheld .tt-header"), { opacity: 1, y: 0, duration: 0.45 }, rs + 0.12);
        const rightRows = dataEl.querySelectorAll<HTMLElement>(".tt-col--withheld .tt-row");
        rightRows.forEach((row, i) => {
          const at = rs + 0.3 + i * 0.5;
          tl.to(row, { opacity: 1, y: 0, duration: 0.5 }, at);
          const sc = row.querySelector<HTMLElement>(".tt-scramble");
          if (sc) scramble(sc, sc.dataset.shape ?? "########", at + 0.08);
          const bar = row.querySelector<HTMLElement>(".tt-redaction__bar");
          const txt = row.querySelector<HTMLElement>(".tt-redaction__text");
          if (bar) tl.to(bar, { scaleX: 1, duration: 0.5 }, at + 0.66);
          if (txt) tl.to(txt, { opacity: 1, duration: 0.3, ease: "power2.out" }, at + 0.84);
        });
        const rightEnd = rs + 0.3 + (rightRows.length - 1) * 0.5 + 1.2;

        // ---- BOTTOM: the pivot statement, line 1 then line 2 ----
        tl.to(q(".tt-pivot__line--1"), { opacity: 1, y: 0, duration: 0.6 }, rightEnd + 0.35);
        tl.to(q(".tt-pivot__line--2"), { opacity: 1, y: 0, duration: 0.6 }, rightEnd + 0.8);
      };

      if (entryRef.current === "return") {
        // Returning from the dashboard: the retract in reverse. The video
        // holds its poster (the clean loop-point pose — no replay); the
        // Oculus re-emerges from black and the record writes back in.
        revealedRef.current = true;
        self!.add(() => {
          const stageEl = qRoot(".turntable__stage");
          gsap.set(stageEl, { opacity: 0 });
          const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
          tl.to(stageEl, { opacity: 1, duration: 0.4, ease: "power2.out" }, 0);
          tl.fromTo(q(".tt-rule"), { scaleY: 0 }, { scaleY: 1, duration: 0.5, ease: "expo.inOut" }, 0.12);
          tl.to(q(".tt-header"), { opacity: 1, y: 0, duration: 0.35 }, 0.3);
          tl.to(q(".tt-row"), { opacity: 1, y: 0, duration: 0.45, stagger: 0.05 }, 0.32);
          tl.fromTo(q(".tt-row__line"), { scaleX: 0 }, { scaleX: 1, duration: 0.4 }, 0.5);
          tl.fromTo(q(".tt-redaction__bar"), { scaleX: 0 }, { scaleX: 1, opacity: 1, duration: 0.45 }, 0.5);
          tl.to(q(".tt-redaction__text"), { opacity: 1, duration: 0.3 }, 0.68);
          // values resolve out of a brief scramble into the true figures
          q(".tt-value__num").forEach((el) => {
            const final = el.textContent ?? "";
            const shape = final.replace(/\d/g, "#");
            const proxy = { t: 0 };
            let last = -1;
            tl.to(
              proxy,
              {
                t: 1,
                duration: 0.38,
                ease: "none",
                onUpdate: () => {
                  const frame = Math.floor(proxy.t * 10);
                  if (frame !== last) {
                    last = frame;
                    el.textContent = shape.replace(/#/g, () => String(Math.floor(Math.random() * 10)));
                  }
                },
                onComplete: () => {
                  el.textContent = final;
                },
              },
              0.42,
            );
          });
          tl.to(q(".tt-pivot__line"), { opacity: 1, y: 0, duration: 0.4, stagger: 0.08 }, 0.66);
        });
        return; // no autoplay, no ended-wiring — the ledger is already open
      }

      /* ---- entry === "sequence": first arrival — scroll locks until the
         record has finished writing itself (or the user skips). Lenis stop()
         swallows wheel; key + touch guards cover the rest. ---- */
      const SCROLL_KEYS = [" ", "Spacebar", "ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"];
      const keyGuard = (e: KeyboardEvent) => {
        if (!SCROLL_KEYS.includes(e.key)) return;
        // never break keyboard activation of the skip/nav buttons
        if (e.target instanceof HTMLElement && e.target.closest("button, a, input, textarea")) return;
        e.preventDefault();
      };
      const touchGuard = (e: TouchEvent) => e.preventDefault();
      let skipTimer: number | undefined;

      const release = () => {
        if (!seqLockedRef.current) return;
        seqLockedRef.current = false;
        lenis?.current?.start();
        window.removeEventListener("keydown", keyGuard, true);
        window.removeEventListener("touchmove", touchGuard);
        window.clearTimeout(skipTimer);
        setSkipVisible(false);
        // the way onward opens only now
        gsap.to(qRoot(".turntable__advance, .turntable__replay"), {
          autoAlpha: 1,
          duration: 0.5,
          ease: "power2.out",
        });
        onSequenceDoneRef.current?.();
      };
      onRevealComplete = release;

      seqLockedRef.current = true;
      gsap.set(qRoot(".turntable__advance, .turntable__replay"), { autoAlpha: 0 });
      lenis?.current?.stop();
      window.addEventListener("keydown", keyGuard, true);
      window.addEventListener("touchmove", touchGuard, { passive: false });
      skipTimer = window.setTimeout(() => setSkipVisible(true), 2500);

      // the way out: jump everything to its final state and unlock
      skipRef.current = () => {
        if (!seqLockedRef.current) return;
        video.pause();
        if (isFinite(video.duration) && video.duration > 0) {
          video.currentTime = Math.max(0, video.duration - 0.05);
        }
        if (revealTlRef.current) {
          revealTlRef.current.progress(1); // fires onComplete → release
        } else {
          revealedRef.current = true;
          self!.add(() => {
            gsap.set(q(".tt-header, .tt-row, .tt-pivot__line"), { autoAlpha: 1, y: 0 });
            gsap.set(q(".tt-rule"), { scaleY: 1 });
            gsap.set(q(".tt-row__line"), { scaleX: 1 });
            gsap.set(q(".tt-redaction__bar"), { scaleX: 1 });
            gsap.set(q(".tt-redaction__text"), { opacity: 1 });
            q(".tt-value__num").forEach((el) => {
              el.textContent = fmt(Number(el.dataset.target ?? 0));
            });
          });
          release();
        }
      };

      const onEnded = () => {
        // Replays keep the data layer up: only the first 'ended' reveals.
        if (revealedRef.current) return;
        revealedRef.current = true;
        reveal();
      };
      video.addEventListener("ended", onEnded);
      // If the file can't load, don't strand an empty screen — show the ledger.
      video.addEventListener("error", onEnded);
      // Play once. If autoplay is blocked the poster holds; reveal anyway.
      video.play().catch(onEnded);

      return () => {
        video.removeEventListener("ended", onEnded);
        video.removeEventListener("error", onEnded);
        window.clearTimeout(skipTimer);
        // never leave the app scroll-locked (e.g. nav-away mid-sequence)
        if (seqLockedRef.current) {
          seqLockedRef.current = false;
          lenis?.current?.start();
          window.removeEventListener("keydown", keyGuard, true);
          window.removeEventListener("touchmove", touchGuard);
        }
      };
    }, root);

    if (reduced) revealedRef.current = true;

    return () => ctx.revert();
  }, []);

  // exit: App flips `retracting` (nav click or the affordance below)
  useEffect(() => {
    retractingRef.current = retracting;
    if (!retracting) return;
    if (retractRef.current) retractRef.current();
    else onRetractedRef.current?.(); // effects raced — never strand the app
  }, [retracting]);

  // wheeling down past the page bottom also advances (desktop; the chevron
  // covers touch). Accumulates decaying deltas so a stray tick can't trigger.
  useEffect(() => {
    const acc = { v: 0, t: 0 };
    const onWheel = (e: WheelEvent) => {
      // the sequence lock also bars the scroll-past-bottom advance
      if (seqLockedRef.current || retractingRef.current || !onAdvanceRef.current) return;
      const doc = document.documentElement;
      const atBottom = window.scrollY + window.innerHeight >= doc.scrollHeight - 8;
      if (!atBottom || e.deltaY <= 0) return;
      const now = performance.now();
      if (now - acc.t > 600) acc.v = 0;
      acc.t = now;
      acc.v += e.deltaY;
      if (acc.v > 160) {
        acc.v = Number.NEGATIVE_INFINITY; // once
        onAdvanceRef.current?.();
      }
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  const handleReplay = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.play().catch(() => {
      /* user-initiated; if it still fails the poster holds */
    });
  };

  return (
    <section className="turntable" ref={rootRef}>
      <div className="turntable__stage">
        <video
          ref={videoRef}
          className="turntable__video"
          src={TURNTABLE_VIDEO_SRC}
          poster={TURNTABLE_POSTER_SRC}
          muted
          playsInline
          preload="auto"
          aria-label="Wireframe model of the Oculus rotating in place"
        />
        <button type="button" className="turntable__replay" onClick={handleReplay}>
          ↻&nbsp;&nbsp;Replay rotation
        </button>
        {/* sequence mode's way out — same spot as Replay, which is hidden
            while the lock holds, so they never collide */}
        {skipVisible && (
          <button
            type="button"
            className="turntable__skip"
            onClick={() => skipRef.current?.()}
          >
            Skip intro
          </button>
        )}
      </div>

      {/* Data layer — margins only, never over the structure. */}
      <div className="turntable__data" ref={dataRef}>
        <div className="tt-col tt-col--measured">
          <span className="tt-rule tt-rule--measured" aria-hidden="true" />
          <h2 className="tt-header">Measured</h2>
          {MEASURED_ROWS.map((row) => (
            <div
              key={row.label}
              className={"tt-row" + (row.edge ? " tt-row--edge" : "")}
            >
              <span className="tt-row__line" aria-hidden="true" />
              <div className="tt-value tnum">
                {row.values.map((v, i) => (
                  <Fragment key={i}>
                    {i > 0 && <span className="tt-value__sep"> / </span>}
                    <span className="tt-value__num" data-target={v}>
                      {fmt(v)}
                    </span>
                  </Fragment>
                ))}
              </div>
              {row.note && <p className="tt-note">{row.note}</p>}
              <p className="tt-label">{row.label}</p>
              <p className="tt-src">{row.source}</p>
            </div>
          ))}
        </div>

        <div className="tt-col tt-col--withheld">
          <span className="tt-rule tt-rule--withheld" aria-hidden="true" />
          <h2 className="tt-header">Withheld</h2>
          {WITHHELD_ROWS.map((row) => (
            <div key={row.label} className="tt-row">
              <p className="tt-label">{row.label}</p>
              <div className="tt-wvalue">
                <span
                  className="tt-scramble tnum"
                  data-shape={row.shape}
                  aria-hidden="true"
                />
                <span className="tt-redaction">
                  <span className="tt-redaction__bar" aria-hidden="true" />
                  <span className="tt-redaction__text">Not disclosed</span>
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="tt-pivot">
          <p className="tt-pivot__line tt-pivot__line--1">
            <span className="tt-pivot__num tnum">365,000</span> sq ft of retail.
            {"  "}
            <span className="tt-pivot__num tnum">71</span> shops.{" "}
            <span className="tt-src tt-pivot__src">Westfield, 2026</span>
          </p>
          <p className="tt-pivot__line tt-pivot__line--2">
            What happens inside them is not disclosed.
          </p>
        </div>
      </div>

      {/* quiet advance affordance — same transition as the nav item */}
      {onAdvance && (
        <button type="button" className="turntable__advance" onClick={onAdvance}>
          <span className="turntable__advance-label">Data Dashboard</span>
          <svg className="turntable__advance-chevron" viewBox="0 0 16 8" aria-hidden="true">
            <path
              d="M1 1 L8 7 L15 1"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </section>
  );
}
