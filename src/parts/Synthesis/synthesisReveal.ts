/**
 * synthesisReveal — the shared reveal choreography for the AGGREGATE views.
 *
 * Two modes, one vocabulary (fade + slight rise, expo.out, count-ups):
 *
 * DEFAULT (no markers, used by View 4 and the placeholders): top-level blocks
 * stagger in DOM order — Part A's sensible default.
 *
 * MARKED (Parts B1/B2 — the reveal ORDER is the hierarchy): elements carrying
 * `data-reveal="<group>"` reveal group by group (1, 2, 3…), each group
 * starting GROUP_GAP after the previous, elements within a group staggering
 * in DOM order. Variants change the motion, not the timing system:
 *   data-reveal-draw        — scaleX 0→1 from the left (hairlines)
 *   data-reveal-draw="y"    — scaleY 0→1 from the top (vertical dividers)
 *   data-reveal-pop         — scale up from the centre (map dots, donuts)
 *   data-reveal-out="left"  — arrive moving outward to the left (opposing
 *   data-reveal-out="right"    arrows); fades in while translating to rest
 *   data-reveal-dash="<w>"  — a clip rect whose width tweens 0→<w>: SVG
 *                             lines DRAW left to right (pattern-safe — works
 *                             for dashed strokes, unlike dashoffset tricks)
 * `data-reveal-delay="<s>"` on any marked element positions it that many
 * seconds after its group's start (sequencing inside one group). Count-ups
 * on .num elements start when their enclosing mark starts, so a number never
 * counts inside a still-invisible panel.
 *
 * Contracts (both modes):
 *  - re-runs on every activation; never blocks interaction (opacity/transform
 *    only); cleanup restores final state + exact text instantly (dash rects
 *    restore their full markup width)
 *  - prefers-reduced-motion: no-op — the final state renders immediately
 */
import gsap from "gsap";

const STAGGER = 0.14; // default mode: ~120–180ms apart
const RISE = 18;
const COUNT_MS = 700;
const COUNT_MIN_PX = 18; // big figures count up; table/legend cells just render

const GROUP_GAP = 0.42; // marked mode: seconds between group starts
const GROUP_STAGGER = 0.09;
const POP_STAGGER = 0.018;
const POP_LAG = 0.22; // batched pops wait for their group's draws/fades

/** rAF count-up on .num elements ≥ COUNT_MIN_PX; returns a cleanup. */
function playCountUps(viewEl: HTMLElement, delayOf: (el: HTMLElement) => number): () => void {
  const rafs: number[] = [];
  const restore: [HTMLElement, string][] = [];
  viewEl.querySelectorAll<HTMLElement>(".num").forEach((n) => {
    if (n.closest("[data-reveal-skip]")) return;
    if (parseFloat(getComputedStyle(n).fontSize) < COUNT_MIN_PX) return;
    const txt = n.textContent?.trim() ?? "";
    const m = txt.match(/^(\$?)([\d,]+(?:\.\d+)?)(%?)$/);
    if (!m) return;
    const prefix = m[1],
      suffix = m[3];
    const target = parseFloat(m[2].replace(/,/g, ""));
    if (isNaN(target) || target === 0) return;
    const dec = (m[2].split(".")[1] || "").length;
    restore.push([n, txt]);
    const t0 = performance.now() + delayOf(n);
    const step = (now: number) => {
      if (now < t0) {
        rafs.push(requestAnimationFrame(step));
        return;
      }
      const p = Math.min((now - t0) / COUNT_MS, 1);
      const e = 1 - Math.pow(1 - p, 3);
      const val = target * e;
      n.textContent = prefix + (dec ? val.toFixed(dec) : Math.round(val).toLocaleString("en-US")) + suffix;
      if (p < 1) rafs.push(requestAnimationFrame(step));
      else n.textContent = txt;
    };
    rafs.push(requestAnimationFrame(step));
  });
  return () => {
    rafs.forEach(cancelAnimationFrame);
    restore.forEach(([n, txt]) => {
      n.textContent = txt;
    });
  };
}

type Kind = "fade" | "drawx" | "drawy" | "pop" | "outl" | "outr" | "dash";

function kindOf(el: HTMLElement): Kind {
  if (el.hasAttribute("data-reveal-dash")) return "dash";
  if (el.hasAttribute("data-reveal-draw")) return el.getAttribute("data-reveal-draw") === "y" ? "drawy" : "drawx";
  if (el.hasAttribute("data-reveal-pop")) return "pop";
  const out = el.getAttribute("data-reveal-out");
  if (out === "left") return "outl";
  if (out === "right") return "outr";
  return "fade";
}

/** from/to vars per kind (batched or individual — same motion). */
const KIND_VARS: Record<Exclude<Kind, "dash">, { from: gsap.TweenVars; to: gsap.TweenVars }> = {
  fade: { from: { opacity: 0, y: 14 }, to: { opacity: 1, y: 0, duration: 0.8, ease: "expo.out" } },
  drawx: {
    from: { opacity: 0, scaleX: 0, transformOrigin: "left center" },
    to: { opacity: 1, scaleX: 1, duration: 0.7, ease: "expo.out" },
  },
  drawy: {
    from: { opacity: 0, scaleY: 0, transformOrigin: "center top" },
    to: { opacity: 1, scaleY: 1, duration: 0.7, ease: "expo.out" },
  },
  pop: {
    from: { opacity: 0, scale: 0.35, transformOrigin: "center center" },
    to: { opacity: 1, scale: 1, duration: 0.55, ease: "back.out(1.7)" },
  },
  outl: { from: { opacity: 0, x: 16 }, to: { opacity: 1, x: 0, duration: 0.7, ease: "expo.out" } },
  outr: { from: { opacity: 0, x: -16 }, to: { opacity: 1, x: 0, duration: 0.7, ease: "expo.out" } },
};

export function playViewReveal(viewEl: HTMLElement): () => void {
  if (window.matchMedia("(prefers-reduced-motion:reduce)").matches) return () => {};

  const marked = Array.from(viewEl.querySelectorAll<HTMLElement>("[data-reveal]")).filter(
    (el) => !el.hasAttribute("data-reveal-skip"),
  );

  // ---------- MARKED mode: explicit group order ----------
  if (marked.length) {
    const groups = new Map<number, HTMLElement[]>();
    for (const el of marked) {
      const g = parseInt(el.getAttribute("data-reveal") || "0", 10) || 0;
      const arr = groups.get(g);
      if (arr) arr.push(el);
      else groups.set(g, [el]);
    }
    const ordered = [...groups.keys()].sort((a, b) => a - b);
    const tl = gsap.timeline();
    const delayMs = new Map<HTMLElement, number>();
    ordered.forEach((g, gi) => {
      const start = gi * GROUP_GAP;
      const els = groups.get(g)!;
      const batched: Partial<Record<Kind, HTMLElement[]>> = {};
      const singles: { el: HTMLElement; kind: Kind; delay: number }[] = [];
      els.forEach((el) => {
        const kind = kindOf(el);
        const dAttr = el.getAttribute("data-reveal-delay");
        if (dAttr !== null || kind === "dash") {
          singles.push({ el, kind, delay: dAttr !== null ? parseFloat(dAttr) || 0 : 0 });
        } else {
          (batched[kind] ??= []).push(el);
        }
      });
      // batched buckets keep the Part-B1 semantics (incl. pops lagging their
      // group's draws/fades so bands settle before dots land)
      (Object.keys(batched) as Kind[]).forEach((kind) => {
        if (kind === "dash") return;
        const list = batched[kind]!;
        const v = KIND_VARS[kind as Exclude<Kind, "dash">];
        const at =
          kind === "pop" && (batched.fade?.length || batched.drawx?.length || batched.drawy?.length) ? start + POP_LAG : start;
        tl.fromTo(
          list,
          v.from,
          { ...v.to, stagger: kind === "pop" ? POP_STAGGER : GROUP_STAGGER, clearProps: "opacity,transform" },
          at,
        );
      });
      // individually positioned marks (data-reveal-delay / dash draws)
      singles.forEach(({ el, kind, delay }) => {
        if (kind === "dash") {
          const w = parseFloat(el.getAttribute("data-reveal-dash") || "0") || 0;
          tl.fromTo(el, { attr: { width: 0 } }, { attr: { width: w }, duration: 0.75, ease: "power2.inOut" }, start + delay);
        } else {
          const v = KIND_VARS[kind];
          tl.fromTo(el, v.from, { ...v.to, clearProps: "opacity,transform" }, start + delay);
        }
      });
      els.forEach((el, i) => {
        const dAttr = el.getAttribute("data-reveal-delay");
        delayMs.set(el, (start + (dAttr !== null ? parseFloat(dAttr) || 0 : i * 0.05)) * 1000);
      });
    });
    const stopCounts = playCountUps(viewEl, (n) => {
      const host = n.closest<HTMLElement>("[data-reveal]");
      return host ? delayMs.get(host) ?? 0 : 0;
    });
    return () => {
      tl.kill();
      gsap.set(marked, { clearProps: "opacity,transform" });
      // dash clip rects own their width attr — restore the full markup value
      marked.forEach((el) => {
        const w = el.getAttribute("data-reveal-dash");
        if (w) gsap.set(el, { attr: { width: parseFloat(w) || 0 } });
      });
      stopCounts();
    };
  }

  // ---------- DEFAULT mode (Part A): top-level blocks, DOM order ----------
  const targets = Array.from(viewEl.querySelectorAll<HTMLElement>(":scope > *")).filter(
    (el) => !el.hasAttribute("data-reveal-skip"),
  );
  const tween = targets.length
    ? gsap.fromTo(
        targets,
        { opacity: 0, y: RISE },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          ease: "expo.out",
          stagger: STAGGER,
          overwrite: "auto",
          clearProps: "opacity,transform", // final state owns no inline styles
        },
      )
    : null;
  const stopCounts = playCountUps(viewEl, () => 0);
  return () => {
    tween?.kill();
    if (targets.length) gsap.set(targets, { clearProps: "opacity,transform" });
    stopCounts();
  };
}
