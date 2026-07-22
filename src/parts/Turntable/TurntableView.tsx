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
 */
import { Fragment, useEffect, useRef } from "react";
import gsap from "gsap";
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

export default function TurntableView() {
  const rootRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dataRef = useRef<HTMLDivElement>(null);
  const revealedRef = useRef(false);

  useEffect(() => {
    const root = rootRef.current;
    const video = videoRef.current;
    const dataEl = dataRef.current;
    if (!root || !video || !dataEl) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context((self) => {
      if (reduced) return; // markup already renders the final state

      const q = gsap.utils.selector(dataEl) as (s: string) => HTMLElement[];

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
        const tl = gsap.timeline({ defaults: { ease: "expo.out" } });

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
      };
    }, root);

    if (reduced) revealedRef.current = true;

    return () => ctx.revert();
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
    </section>
  );
}
