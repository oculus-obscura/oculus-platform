/**
 * SimulationGame — the commuter game, ported VERBATIM to native React from the
 * approved mockup (design-reference/Oculus Obscura Commuter.dc.html). The look,
 * timing and logic are FINAL — every screen, easing and value mirrors the
 * source. Intentional deviations only (per the port brief):
 *   - store data comes from src/data/storeCatalog.ts (single source of truth);
 *     the game keeps the mockup's internal 'bite' key (it seeds the frozen
 *     scatter) and converts to the DB's 'food' only at the save boundary
 *   - the top layout hangs below the platform chrome (--sim-top)
 *   - endGame() records the TRUE elapsed seconds (mockup wrote the full
 *     duration even for early Go Outside exits — bug fixed at the save layer;
 *     the visual end beat still shows the timer at full, as designed)
 *   - one saveSession() call per legitimately completed round; abandonment
 *     (unmount mid-round) writes nothing
 *   - "CONTINUE TO SYNTHESIS" exits to the platform's synthesis view; the
 *     mockup's RUN IT AGAIN lives beside it on the end screen
 *
 * Timers, listeners and pending callbacks are all cleaned up on unmount
 * (StrictMode-safe: setup/cleanup are symmetric, refs survive the dev
 * double-invoke, and nothing is started outside user action).
 */
import { Fragment, memo, useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import gsap from "gsap";
import { STORE_CATALOG, storeSlug } from "../../data/storeCatalog";
import { saveSession, type InteractionChoice, type SessionPayload } from "../../lib/saveSession";
import { INTERIOR_STILL_SRC } from "../Dashboard/stationData";
import {
  buildAllScatter,
  measureScatterLayout,
  scatterKey,
  type GameCat,
  type GameSize,
  type MeasuredButton,
  type PosMap,
} from "./gameScatter";
import "./simulationGame.css";

const TRAIN_SRC = "/images/game/oculus-train.png";
const SKIP_HAND_SRC = "/images/game/skip-hand.png";

/** Mockup default countdown (the durationSeconds prop's default). */
const DURATION_SECONDS = 300;

// ---------------- store data (from the merged catalog — NOT hardcoded) ----------------
interface GamePrice {
  d: string; // display, e.g. "$10,000+"
  v: number; // numeric value
  l?: string; // optional descriptor (Rebag)
}
interface GameStore {
  slug: string;
  name: string;
  floor: 1 | 2;
  cat: GameCat; // catalog 'food' -> game 'bite' (internal key, seeds the scatter)
  size: GameSize;
  bullets: string[];
  prices: GamePrice[]; // ordered HIGH, MID, LOW (catalog order)
}
const GAME_STORES: GameStore[] = STORE_CATALOG.map((s) => ({
  slug: s.slug,
  name: s.name,
  floor: s.floor,
  cat: s.category === "food" ? "bite" : "shop",
  size: s.size,
  bullets: s.bullets,
  prices: s.prices.map((p) => (p.label === undefined ? { d: p.display, v: p.value } : { d: p.display, v: p.value, l: p.label })),
}));

/** Card price index -> DB choice value (prices are ordered HIGH, MID, LOW). */
const TIER_CHOICE = ["high", "mid", "low"] as const;

// ---------------- session (mirrors the mockup's shape) ----------------
interface Visit {
  name: string;
  floor: 1 | 2;
  cat: GameCat;
  choice: InteractionChoice; // tier clicked, or 'wouldnt_shop' for SKIP
  display: string | null; // the price string shown (log/debug)
  value: number;
  priceLabel: string | null;
  skipped?: boolean;
}
interface Session {
  primaryChoices: ("shop" | "bite" | "restroom" | "outside")[];
  visits: Visit[];
  restroomUsed: boolean;
  outsideDestination: string | null;
  total: number;
  endReason: "timer" | "outside" | null;
}
const freshSession = (): Session => ({
  primaryChoices: [],
  visits: [],
  restroomUsed: false,
  outsideDestination: null,
  total: 0,
  endReason: null,
});

const TUT: { target: TutTarget; text: string }[] = [
  { target: "refTimer", text: "This is your train. When it reaches the end of the track, your time's up. It doesn't stop, pause, or wait." },
  { target: "refChoices", text: "Shop, Grab a Bite, Restroom, or Go Outside. Shop and Grab a Bite can both happen in one run." },
  { target: "refRestroom", text: "Restroom is a one-time stop. Use it once and it's gone." },
  { target: "refOutside", text: "Go Outside ends your run. Pick a spot and there's no turning back." },
  { target: "refShop", text: "Step into a store to see what it sells and pick what you'd spend, or skip it. Either way it counts." },
];
type TutTarget = "refTimer" | "refChoices" | "refShop" | "refRestroom" | "refOutside";

const DEST = ["The Oculus Plaza", "The 9/11 Memorial", "Brookfield Place", "One World Trade Center"];

const DOTS = [8.5, 25, 41.5, 58, 74.5, 91];

// ---- start screen (editorial title card) ----
const START_TITLE_WORDS = "5 MINUTES TO DEPARTURE".split(" ");
const START_COPY_WORDS =
  "You are a daily commuter using the NJ PATH or NYC subway. You have 15 minutes before your next train. For the sake of this simulation, you have 5 minutes. The Oculus is right in front of you. What you do next is up to you.".split(
    " ",
  );
/** Station dots along the departure track, % of the rail span. */
const START_DOTS = [12, 28, 44, 60, 76];

/* ---------------------------------------------------------------------------
 * RailAssembly — the ONE persistent rail. ~2x viewport wide, terminus at the
 * midpoint; left half is the start screen's track, right half is the timer's.
 * The start->timer transition is a transform on this element (poses applied by
 * the parent via refs/GSAP) — memoized so parent state changes (screen flips,
 * the flight itself) can never re-render it mid-tween. It re-renders only when
 * `pct` ticks during the game (trail clip, dot flips, train advance) or when
 * `hidden` changes for the end screen.
 * ------------------------------------------------------------------------- */
interface RailAssemblyProps {
  railRef: RefObject<HTMLDivElement | null>;
  /** 0..100 — elapsed share of the countdown (0 while on start/tutorial). */
  pct: number;
  /** End screen: the end sequence draws its own track. */
  hidden: boolean;
}
const RailAssembly = memo(function RailAssembly({ railRef, pct, hidden }: RailAssemblyProps) {
  return (
    <div ref={railRef} className={"sim-rail" + (hidden ? " is-hidden" : "")} aria-hidden="true">
      {/* track BEHIND the train — the start screen's visible rail */}
      <div className="sim-rail__behind">
        <div className="sim-rail__ties" />
        <div className="sim-rail__bar sim-rail__bar--a" />
        <div className="sim-rail__bar sim-rail__bar--b" />
        <div className="sim-rail__bdots">
          {START_DOTS.map((x) => (
            <div key={x} className="sim-rail__dot" style={{ left: x + "%" }} />
          ))}
        </div>
      </div>
      {/* track AHEAD — revealed by the camera move, becomes the timer */}
      <div className="sim-rail__fwd">
        <div className="sim-rail__ties" />
        <div className="sim-rail__bar sim-rail__bar--a" />
        <div className="sim-rail__bar sim-rail__bar--b" />
        <div className="sim-rail__game">
          <div
            className="sim-rail__trail"
            style={{
              clipPath: `inset(0 ${100 - pct}% 0 0)`,
              WebkitClipPath: `inset(0 ${100 - pct}% 0 0)`,
            }}
          >
            <div className="sim-rail__ties" />
            <div className="sim-rail__bar sim-rail__bar--a" />
            <div className="sim-rail__bar sim-rail__bar--b" />
          </div>
          {DOTS.map((x) => {
            const passed = pct >= x;
            return (
              <div
                key={x}
                className="sim-rail__dot"
                style={{
                  left: x + "%",
                  background: passed ? "#1A8787" : "#FFFFFF",
                  boxShadow: passed
                    ? "0 0 9px rgba(26,135,135,0.75),0 0 4px rgba(26,135,135,0.9)"
                    : "0 0 11px rgba(255,255,255,0.85),0 0 4px rgba(255,255,255,0.95)",
                }}
              />
            );
          })}
        </div>
      </div>
      {/* start-screen draw's leading edge (idle otherwise) */}
      <div className="sim-rail__edge" />
      {/* terminus node at the midpoint — the timer's 0% */}
      <div className="sim-rail__term">
        <span className="sim-rail__tick sim-rail__tick--t" />
        <span className="sim-rail__node" />
        <span className="sim-rail__tick sim-rail__tick--b" />
        <span className="sim-rail__bloom" />
      </div>
      {/* the ONE train: nose at `pct` of the game span (terminus when 0) */}
      <img
        className="sim-rail__train"
        src={TRAIN_SRC}
        alt=""
        style={{ left: `calc(100vw + ${pct} * var(--sim-fwd-w) / 100)` }}
      />
    </div>
  );
});

// scatter type scale — shrunk to fit; ratio preserved (big:med ~1.6, med:small ~2.2, big:small ~3.5)
const SIZE_FS: Record<GameSize, [string, number]> = {
  big: ["clamp(1.82rem, 1.5rem + 1.8vw, 2.9rem)", 600],
  medium: ["clamp(1.18rem, 1.02rem + 0.8vw, 1.82rem)", 500],
  small: ["clamp(0.63rem, 0.6rem + 0.22vw, 0.82rem)", 400],
};

type Screen = "start" | "tutorial" | "choice" | "floor" | "card" | "outside" | "end";

interface Spot {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface GameState {
  screen: Screen;
  floor: 1 | 2;
  category: GameCat;
  elapsed: number;
  started: boolean;
  card: GameStore | null;
  tutStep: number;
  spot: Spot | null;
  restroomCount: number;
  restroomPop: boolean;
  restroomAnchor: { left: number; top: number; width: number; bottom: number } | null;
  scatterReady: string | null;
  endPhase: number;
}
const initialState = (): GameState => ({
  screen: "start",
  floor: 1,
  category: "shop",
  elapsed: 0,
  started: false,
  card: null,
  tutStep: 0,
  spot: null,
  restroomCount: 0,
  restroomPop: false,
  restroomAnchor: null,
  scatterReady: null,
  endPhase: 0,
});

interface SimulationGameProps {
  /** 'handoff' = arriving from the dashboard's interior still (match cut). */
  entry?: "direct" | "handoff";
  /** True while a round is running (timer live) — App gates navigation on it. */
  onRoundActiveChange?: (active: boolean) => void;
  /** End screen's CONTINUE TO SYNTHESIS. */
  onExitToSynthesis?: () => void;
}

export default function SimulationGame({ entry = "direct", onRoundActiveChange, onExitToSynthesis }: SimulationGameProps) {
  const [gs, setGS] = useState<GameState>(initialState);
  const [, setBump] = useState(0); // the mockup's forceUpdate()
  const [underlay, setUnderlay] = useState(entry === "handoff");

  const rootRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<Session>(freshSession());
  const timerIdRef = useRef<number | null>(null);
  const restroomIdRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const devFastRef = useRef(false);
  const savedRef = useRef(false); // one save per round, ever
  const frozenRef = useRef<Partial<Record<GameCat, PosMap>>>({}); // per-category FROZEN positions (never reshuffle)
  const measuringRef = useRef(false);
  const lastVwRef = useRef(typeof window !== "undefined" ? window.innerWidth : 1280);
  const resizeTORef = useRef<number | null>(null);
  const endTimersRef = useRef<number[]>([]);
  const measureRafRef = useRef<number | null>(null);
  const aliveRef = useRef(true);
  const entranceTlRef = useRef<gsap.core.Timeline | null>(null); // start-screen arrival — killed+snapped if START pre-empts it
  const scatterRef = useRef(buildAllScatter(GAME_STORES)); // deterministic + FROZEN for the whole session
  // the persistent rail assembly + its two poses (hero = start, timer = game)
  const railRef = useRef<HTMLDivElement>(null);
  const timerSlotRef = useRef<HTMLDivElement>(null); // the timer bar's rail slot — measured for the TIMER pose
  const flyingRef = useRef(false); // hero->timer flight in progress: no pose writes, no re-triggers
  const flightTlRef = useRef<gsap.core.Timeline | null>(null);
  const poseKeyRef = useRef(""); // pose+viewport memo so re-applies only happen on real change

  const tref = useRef<Record<TutTarget, RefObject<HTMLElement | null>>>({
    refTimer: { current: null },
    refChoices: { current: null },
    refShop: { current: null },
    refRestroom: { current: null },
    refOutside: { current: null },
  });

  // latest state for interval callbacks / measurement guards
  const gsRef = useRef(gs);
  gsRef.current = gs;
  const roundCbRef = useRef(onRoundActiveChange);
  roundCbRef.current = onRoundActiveChange;

  const duration = () => (devFastRef.current ? 30 : Math.max(10, DURATION_SECONDS));

  // ---------------- timer ----------------
  const stopTimer = () => {
    if (timerIdRef.current !== null) {
      clearInterval(timerIdRef.current);
      timerIdRef.current = null;
    }
  };
  const tick = () => {
    const el = (performance.now() - startTimeRef.current) / 1000;
    if (el >= duration()) {
      stopTimer();
      endGame("timer");
      return;
    }
    setGS((s) => ({ ...s, elapsed: el }));
  };

  const clearRestroomTimer = () => {
    if (restroomIdRef.current !== null) {
      clearInterval(restroomIdRef.current);
      restroomIdRef.current = null;
    }
  };
  const clearEndTimers = () => {
    endTimersRef.current.forEach(clearTimeout);
    endTimersRef.current = [];
  };

  const logSession = () => {
    const snap = JSON.parse(JSON.stringify(sessionRef.current));
    console.log("[Oculus session]", snap);
    (window as unknown as { __session: unknown }).__session = snap;
  };

  // ---------------- supabase (the ONLY save site; never on abandonment) ----------------
  const submitSession = (reason: "timer" | "outside", trueElapsedSeconds: number) => {
    if (savedRef.current) return;
    savedRef.current = true;
    const s = sessionRef.current;
    const payload: SessionPayload = {
      choseShop: s.primaryChoices.includes("shop"),
      choseGrabABite: s.primaryChoices.includes("bite"),
      choseRestroom: s.primaryChoices.includes("restroom"),
      choseGoOutside: s.primaryChoices.includes("outside"),
      endedBy: reason === "outside" ? "went_outside" : "timer",
      elapsedSeconds: Math.round(trueElapsedSeconds),
      usedRestroom: s.restroomUsed,
      outsideDestination: s.outsideDestination,
      totalSpend: s.total,
      interactions: s.visits.map((v) => ({
        // by (floor, name) — Apple exists on both floors, name alone is ambiguous
        storeSlug: storeSlug(v.floor, v.name) ?? v.name,
        floor: v.floor,
        category: v.cat === "bite" ? "food" : "shop",
        choice: v.choice,
        spend: v.value,
      })),
    };
    // fire-and-forget: saveSession never throws, and the end beat must play
    // identically whether the save succeeds, fails, or is skipped
    void saveSession(payload).then((result) => console.log("[Oculus] saveSession:", result));
  };

  const endGame = (reason: "timer" | "outside") => {
    stopTimer();
    clearRestroomTimer();
    // TRUE elapsed, captured before the visual state pins the readout to full
    // (mockup recorded the full duration even for early Go Outside — fixed)
    const trueElapsed = Math.min(duration(), Math.max(0, (performance.now() - startTimeRef.current) / 1000));
    sessionRef.current.endReason = reason;
    logSession();
    submitSession(reason, trueElapsed);
    setGS((s) => ({ ...s, screen: "end", started: false, card: null, restroomPop: false, elapsed: duration(), endPhase: 0 }));
    runEndSequence();
  };

  // Cinematic end beat: text (0) -> clock spins + track draws in (1) -> train arrives (2) -> button (3)
  const runEndSequence = () => {
    clearEndTimers();
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setGS((s) => ({ ...s, endPhase: 3 }));
      return;
    }
    endTimersRef.current = [
      window.setTimeout(() => setGS((s) => ({ ...s, endPhase: 1 })), 1100), // short pause, then clock + track build
      window.setTimeout(() => setGS((s) => ({ ...s, endPhase: 2 })), 3250), // track built, train enters
      window.setTimeout(() => setGS((s) => ({ ...s, endPhase: 3 })), 5800), // train settled, show button
    ];
  };

  // ---------------- rail poses (measured geometry, transform-only) ----------------
  /** TIMER pose: translate so the terminus (assembly midpoint) sits at the
   *  timer slot's left edge, with the 20px band aligned into the slot. */
  const computeTimerPose = () => {
    const rail = railRef.current!;
    const slot = timerSlotRef.current!;
    const cs = getComputedStyle(rail);
    const inset = -parseFloat(cs.left); // CSS anchors HERO at left: -inset
    const trackB = parseFloat(cs.bottom);
    const slotRect = slot.getBoundingClientRect();
    return {
      x: slotRect.left - (window.innerWidth - inset),
      y: slotRect.bottom - 20 - (window.innerHeight - trackB - 20),
    };
  };
  const applyFwdWidth = () => {
    const rail = railRef.current, slot = timerSlotRef.current;
    if (!rail || !slot) return;
    rail.style.setProperty("--sim-fwd-w", slot.getBoundingClientRect().width + "px");
  };

  // ---------------- nav ----------------
  // START: the camera move. Start content leaves first, then the assembly
  // flies HERO -> TIMER in one continuous transform tween; the readout fades
  // in as it settles; only then does the tutorial mount and measure.
  const onStart = () => {
    if (flyingRef.current) return;
    const root = rootRef.current, rail = railRef.current, slot = timerSlotRef.current;
    const toTutorial = () => setGS((s) => ({ ...s, screen: "tutorial", tutStep: 0, spot: null }));
    if (!root || !rail || !slot) {
      toTutorial();
      return;
    }
    const q = gsap.utils.selector(root);
    // START mid-arrival: the entrance timeline may still be driving the train
    // (and the draw/terminus pop). Kill it and snap the rail pieces to their
    // composed finals — PHASE 2 requires the train locked at the terminus
    // before the assembly moves, with nothing else animating relative to it.
    if (entranceTlRef.current) {
      entranceTlRef.current.kill();
      entranceTlRef.current = null;
      gsap.set(q(".sim-rail__behind"), { clipPath: "inset(0 0% 0 0)" });
      gsap.set(q(".sim-rail__edge"), { autoAlpha: 0 });
      gsap.set(q(".sim-rail__term"), { opacity: 1, scale: 1 });
      gsap.set(q(".sim-rail__bloom"), { opacity: 0 });
    }
    // The train's stylesheet state IS the locked pose: left = terminus at
    // pct 0, translateX(-100%) nose-anchor, visible. Stripping every inline
    // prop the entrance wrote (opacity/visibility/transform) is the only
    // snap that cannot go stale — kill() breaks the context's revert
    // bookkeeping, which is exactly how the countdown train went invisible.
    gsap.set(q(".sim-rail__train"), { clearProps: "opacity,visibility,transform" });
    applyFwdWidth();
    const pose = computeTimerPose();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // no flight: content fades (instant under the global clamp), the
      // assembly renders directly in the TIMER pose, tutorial proceeds
      gsap.set(rail, { x: pose.x, y: pose.y, force3D: true });
      gsap.set(q(".sim-rail__fwd"), { opacity: 1 });
      poseKeyRef.current = "t|" + window.innerWidth + "x" + window.innerHeight;
      toTutorial();
      return;
    }
    flyingRef.current = true;
    const tl = gsap.timeline({
      onComplete: () => {
        // exact landing even if the viewport changed mid-flight
        const fresh = computeTimerPose();
        gsap.set(rail, { x: fresh.x, y: fresh.y, willChange: "auto" });
        poseKeyRef.current = "t|" + window.innerWidth + "x" + window.innerHeight;
        flyingRef.current = false;
        flightTlRef.current = null;
        if (aliveRef.current) toTutorial(); // tutorial mounts + measures only now
      },
    });
    flightTlRef.current = tl;
    // GPU-composited for the duration of the flight only
    tl.set(rail, { willChange: "transform" }, 0)
      // 1. title, copy and START leave first (opacity only, short stagger)
      .to([q(".sim-start__text"), q(".sim-start__btn")], { autoAlpha: 0, duration: 0.25, stagger: 0.06, ease: "power2.in" }, 0)
      .to(q(".sim-start__scrim"), { autoAlpha: 0, duration: 0.3, ease: "power2.in" }, 0.05)
      // 2. the forward track joins the world just as motion begins (opacity
      //    only — by the time it could be noticed it is already sliding)
      .to(q(".sim-rail__fwd"), { opacity: 1, duration: 0.12, ease: "none" }, 0.25)
      // 3. HERO -> TIMER: one continuous diagonal, transform only
      .to(rail, { x: pose.x, y: pose.y, duration: 0.85, ease: "power3.inOut", force3D: true }, 0.25)
      // 4. readout fades in at the right end as the rail settles…
      .to(q(".sim-timer__readout"), { autoAlpha: 1, duration: 0.3, ease: "power2.out" }, 0.95)
      // …with a brief lock-in pulse at the terminus (opacity/scale only)
      .fromTo(q(".sim-rail__bloom"), { opacity: 0, scale: 0.7 }, { opacity: 0.7, scale: 1.1, duration: 0.16, ease: "power2.out" }, 1.0)
      .to(q(".sim-rail__bloom"), { opacity: 0, scale: 1.3, duration: 0.35, ease: "power2.out" }, 1.16);
  };
  const onTutNext = () =>
    setGS((s) => {
      const n = s.tutStep + 1;
      return { ...s, tutStep: n, spot: n >= TUT.length ? null : s.spot };
    });
  const onTutBack = () => setGS((s) => (s.tutStep > 0 ? { ...s, tutStep: s.tutStep - 1 } : s));
  const onPlay = () => {
    savedRef.current = false;
    setGS((s) => ({ ...s, screen: "choice", started: true, elapsed: 0, spot: null }));
    startTimeRef.current = performance.now(); // elapsed is 0 by definition here
    stopTimer();
    timerIdRef.current = window.setInterval(tick, 250);
  };
  const onTutSkip = () => onPlay();

  const goCategory = (cat: "shop" | "bite") => {
    if (!sessionRef.current.primaryChoices.includes(cat)) sessionRef.current.primaryChoices.push(cat);
    logSession();
    setGS((s) => ({ ...s, screen: "floor", category: cat }));
  };
  const onShop = () => {
    if (gsRef.current.screen === "tutorial") return;
    goCategory("shop");
  };
  const onBite = () => {
    if (gsRef.current.screen === "tutorial") return;
    goCategory("bite");
  };
  const onRestroom = () => {
    if (gsRef.current.screen === "tutorial" || sessionRef.current.restroomUsed) return;
    sessionRef.current.restroomUsed = true;
    if (!sessionRef.current.primaryChoices.includes("restroom")) sessionRef.current.primaryChoices.push("restroom");
    logSession();
    const el = tref.current.refRestroom.current;
    const anchor = el ? el.getBoundingClientRect() : null;
    setGS((s) => ({
      ...s,
      restroomPop: true,
      restroomCount: 5,
      restroomAnchor: anchor ? { left: anchor.left, top: anchor.top, width: anchor.width, bottom: anchor.bottom } : null,
    }));
    clearRestroomTimer();
    restroomIdRef.current = window.setInterval(() => {
      const c = gsRef.current.restroomCount - 1;
      if (c <= 0) {
        clearRestroomTimer();
        setGS((s) => ({ ...s, restroomPop: false, restroomCount: 0 }));
      } else {
        setGS((s) => ({ ...s, restroomCount: c }));
      }
    }, 1000);
  };
  const onOutside = () => {
    if (gsRef.current.screen === "tutorial") return;
    if (!sessionRef.current.primaryChoices.includes("outside")) sessionRef.current.primaryChoices.push("outside");
    logSession();
    setGS((s) => ({ ...s, screen: "outside" }));
  };
  const pickDestination = (name: string) => {
    sessionRef.current.outsideDestination = name;
    endGame("outside");
  };

  const onMenu = () => setGS((s) => ({ ...s, screen: "choice", card: null }));
  const onFloor1 = () => setGS((s) => ({ ...s, floor: 1 }));
  const onFloor2 = () => setGS((s) => ({ ...s, floor: 2 }));
  const openStore = (store: GameStore) => setGS((s) => ({ ...s, screen: "card", card: store }));
  const choosePrice = (price: GamePrice, tierIndex: number) => {
    const st = gsRef.current.card;
    if (!st) return;
    sessionRef.current.visits.push({
      name: st.name,
      floor: st.floor,
      cat: st.cat,
      choice: TIER_CHOICE[tierIndex],
      display: price.d,
      value: price.v,
      priceLabel: price.l || null,
    });
    sessionRef.current.total += price.v;
    logSession();
    setGS((s) => ({ ...s, screen: "floor", card: null }));
  };
  const onSkip = () => {
    const st = gsRef.current.card;
    if (!st) return;
    sessionRef.current.visits.push({
      name: st.name,
      floor: st.floor,
      cat: st.cat,
      choice: "wouldnt_shop",
      display: null,
      value: 0,
      priceLabel: null,
      skipped: true,
    });
    logSession();
    setGS((s) => ({ ...s, screen: "floor", card: null }));
  };
  const onSynthesis = () => onExitToSynthesis?.();
  const onReset = () => {
    stopTimer();
    clearEndTimers();
    clearRestroomTimer();
    sessionRef.current = freshSession();
    savedRef.current = false;
    setGS((s) => ({
      ...s,
      screen: "start",
      floor: 1,
      category: "shop",
      elapsed: 0,
      started: false,
      card: null,
      tutStep: 0,
      spot: null,
      restroomPop: false,
    }));
  };

  // ---------------- scatter measurement (fonts -> layout -> FROZEN) ----------------
  const measureRelaxNow = (cat: GameCat) => {
    const root = rootRef.current;
    if (!root) return;
    const vw = window.innerWidth,
      vh = window.innerHeight;
    const activeFloor = gsRef.current.floor;
    const buttons: MeasuredButton[] = [];
    root.querySelectorAll<HTMLButtonElement>("button[data-key]").forEach((bn) => {
      const key = bn.getAttribute("data-key");
      if (!key) return;
      const r = bn.getBoundingClientRect();
      // the inactive floor renders inside a scale(0.55) wrapper — compensate so
      // the layout packs TRUE text footprints (they display at scale 1 when live)
      const fl = +key.slice(0, key.indexOf(":"));
      const scale = fl === activeFloor ? 1 : 0.55;
      buttons.push({ key, width: r.width / scale, height: r.height / scale });
    });
    // floor 2's top clearance: chrome bar + the offset timer strip (in vh %)
    const timerEl = tref.current.refTimer.current;
    const topClearPct = timerEl ? (timerEl.getBoundingClientRect().bottom / vh) * 100 + 2 : 16;
    const pos = measureScatterLayout({ cat, stores: GAME_STORES, buttons, vw, vh, topClearPct });
    lastVwRef.current = vw;
    frozenRef.current[cat] = pos;
    setGS((s) => ({ ...s, scatterReady: cat + "@" + Math.round(vw) }));
  };

  const maybeMeasure = (screen: Screen, cat: GameCat) => {
    if (screen !== "floor" || measuringRef.current) return;
    if (frozenRef.current[cat]) return;
    measuringRef.current = true;
    const run = () => {
      measureRafRef.current = requestAnimationFrame(() => {
        if (!aliveRef.current) return;
        measureRelaxNow(cat);
        measuringRef.current = false;
      });
    };
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (aliveRef.current) run();
        else measuringRef.current = false;
      });
    } else {
      run();
    }
  };

  // ---------------- tutorial spotlight (measured bounding rects) ----------------
  const measureSpotlight = () => {
    const step = TUT[gsRef.current.tutStep];
    if (!step) {
      if (gsRef.current.spot !== null) setGS((s) => ({ ...s, spot: null }));
      return;
    }
    const el = tref.current[step.target].current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pad = step.target === "refTimer" ? 6 : 12;
    const spot = { x: Math.round(r.left - pad), y: Math.round(r.top - pad), w: Math.round(r.width + 2 * pad), h: Math.round(r.height + 2 * pad) };
    const prev = gsRef.current.spot;
    if (!prev || prev.x !== spot.x || prev.y !== spot.y || prev.w !== spot.w || prev.h !== spot.h) {
      setGS((s) => ({ ...s, spot }));
    }
  };

  // componentDidMount / componentWillUnmount
  useEffect(() => {
    aliveRef.current = true;
    const onKey = (e: KeyboardEvent) => {
      // DEV CONVENIENCE: "d" toggles a ~30s countdown for testing (real value stays 5:00)
      if ((e.key === "d" || e.key === "D") && !/input|textarea/i.test((e.target as HTMLElement).tagName)) {
        devFastRef.current = !devFastRef.current;
        if (gsRef.current.started) {
          startTimeRef.current = performance.now() - gsRef.current.elapsed * 1000;
        }
        setBump((b) => b + 1);
        console.log("[Oculus] dev fast timer:", devFastRef.current, "→", duration() + "s");
      }
    };
    const onResize = () => {
      if (Math.abs(window.innerWidth - lastVwRef.current) > 24) {
        frozenRef.current = {}; // real size change -> reflow
      }
      if (resizeTORef.current !== null) clearTimeout(resizeTORef.current);
      resizeTORef.current = window.setTimeout(() => setBump((b) => b + 1), 120);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      aliveRef.current = false;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      stopTimer();
      clearEndTimers();
      clearRestroomTimer();
      flightTlRef.current?.kill(); // mid-flight unmount: stop the camera move
      if (resizeTORef.current !== null) clearTimeout(resizeTORef.current);
      if (measureRafRef.current !== null) cancelAnimationFrame(measureRafRef.current);
      measuringRef.current = false;
      roundCbRef.current?.(false); // leaving mid-round = round over, nothing recorded
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // rail pose upkeep: apply the CURRENT pose from freshly measured geometry
  // whenever the pose family or the viewport changes (debounced resize lands
  // here via the bump render). Never during the flight — the tween owns the
  // transform, and its onComplete re-snaps to fresh measurements itself.
  useEffect(() => {
    if (flyingRef.current) return;
    const rail = railRef.current, slot = timerSlotRef.current, root = rootRef.current;
    if (!rail || !slot || !root) return;
    const inTimerPose = gs.screen !== "start"; // end keeps the pose, hidden
    const key = (inTimerPose ? "t|" : "h|") + window.innerWidth + "x" + window.innerHeight;
    if (poseKeyRef.current === key) return;
    poseKeyRef.current = key;
    applyFwdWidth();
    if (inTimerPose) {
      const p = computeTimerPose();
      gsap.set(rail, { x: p.x, y: p.y, force3D: true });
      gsap.set(root.querySelectorAll(".sim-rail__fwd"), { opacity: 1 });
    } else {
      gsap.set(rail, { x: 0, y: 0, force3D: true }); // HERO is the CSS anchor
    }
  });

  // componentDidUpdate
  useEffect(() => {
    if (gs.screen === "tutorial") measureSpotlight();
    maybeMeasure(gs.screen, gs.category);
  });

  // round-in-progress signal for App's leave-confirm gate
  useEffect(() => {
    roundCbRef.current?.(gs.started);
  }, [gs.started]);

  // dashboard match cut: the still stays beneath while the start UI composites
  // in; drop it once the entry fade has fully landed
  useEffect(() => {
    if (entry !== "handoff") return;
    const t = window.setTimeout(() => setUnderlay(false), 1400);
    return () => clearTimeout(t);
  }, [entry]);

  // start-screen orchestration: title types (intro cadence) -> copy reveals
  // word-by-word, while the departure track draws and the train brakes in;
  // START fades up last. gsap.context + revert = StrictMode-safe.
  useEffect(() => {
    if (gs.screen !== "start") return;
    const root = rootRef.current;
    if (!root) return;
    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(root);
      const chars = q(".sim-start__char");
      const words = q(".sim-start__word");
      const caret = q(".sim-start__caret");
      const behind = q(".sim-rail__behind");
      const fwd = q(".sim-rail__fwd");
      const edge = q(".sim-rail__edge");
      const term = q(".sim-rail__term");
      const bloom = q(".sim-rail__bloom");
      const train = q(".sim-rail__train");
      const btn = q(".sim-start__btn");
      const readout = q(".sim-timer__readout");

      // a replay (RUN IT AGAIN) may carry the flight's inline opacity on the
      // readout — return it to the stylesheet's pre-flight hidden state
      gsap.set(readout, { clearProps: "opacity,visibility" });

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        // the composed final state, immediately — full text, drawn track,
        // train at the terminus, button visible (CSS clamp freezes the loops)
        gsap.set(chars, { opacity: 1, y: 0 });
        gsap.set(words, { opacity: 1, y: 0 });
        gsap.set(caret, { opacity: 0 });
        gsap.set(fwd, { opacity: 0 }); // the hero shows only the behind-track
        gsap.set(term, { opacity: 1 });
        // xPercent restates the stylesheet's translateX(-100%) — gsap reads
        // computed transforms as baked px, so a bare x would discard it
        gsap.set(train, { x: 0, xPercent: -100 });
        gsap.set(btn, { autoAlpha: 1, y: 0 });
        return;
      }

      // off-screen-left arrival origin, assembly-relative and transform-immune:
      // the train's offsetLeft is 100vw (assembly space), the assembly's own
      // offsetLeft is its negative CSS inset — their sum is the nose's viewport
      // x, and 80px beyond that is fully off-screen. Function-based so gsap's
      // re-invocations always recompute from layout, never from transforms.
      const offscreenX = () =>
        -((railRef.current?.offsetLeft ?? 0) + (train[0] as HTMLElement).offsetLeft + 80);

      const tl = gsap.timeline();
      entranceTlRef.current = tl;
      // initial states (replay-safe)
      tl.set(chars, { opacity: 0, y: 10 }, 0)
        .set(words, { opacity: 0, y: 8 }, 0)
        .set(caret, { opacity: 0 }, 0)
        .set(behind, { clipPath: "inset(0 100% 0 0)" }, 0)
        .set(fwd, { opacity: 0 }, 0) // hero pose: the track ends at the terminus
        .set(edge, { opacity: 0, x: 0 }, 0)
        .set(term, { opacity: 0 }, 0)
        .set(bloom, { opacity: 0 }, 0)
        // ONE train, three phases: before its ARRIVAL begins it must not exist
        // on screen — parked-at-the-terminus-from-frame-one was the bug. Start
        // it off-screen left (assembly-relative) AND hidden. xPercent restates
        // the stylesheet's translateX(-100%) nose-anchor (gsap parses computed
        // transforms as baked px and would drop it).
        .set(train, { x: offscreenX, xPercent: -100, autoAlpha: 0 }, 0)
        .set(btn, { autoAlpha: 0, y: 12 }, 0);

      // title typewriter — the intro title's cadence/caret timing verbatim
      tl.to(caret, { opacity: 1, duration: 0.1 }, 0.15).to(
        chars,
        { opacity: 1, y: 0, duration: 0.3, stagger: 0.085, ease: "power2.out" },
        0.25,
      );
      const titleEnd = 0.25 + (chars.length - 1) * 0.085 + 0.3;
      tl.to(caret, { opacity: 0, duration: 0.2 }, titleEnd + 0.1);

      // copy, word by word — the intro paragraph's cadence
      tl.to(words, { opacity: 1, y: 0, duration: 0.3, stagger: 0.035, ease: "power2.out" }, titleEnd + 0.15);
      const pEnd = titleEnd + 0.15 + (words.length - 1) * 0.035 + 0.3;

      // 1–2. the behind-track draws left -> right, the glowing edge riding the
      // draw front (both across the same div-space span, so they stay in sync)
      tl.to(behind, { clipPath: "inset(0 0% 0 0)", duration: 1.0, ease: "expo.out" }, 0.35)
        .to(edge, { opacity: 0.9, duration: 0.06 }, 0.38)
        .to(edge, { x: () => (behind[0] as HTMLElement).offsetWidth, duration: 1.0, ease: "expo.out" }, 0.35)
        .to(edge, { opacity: 0, duration: 0.18 }, 1.2);

      // 3. terminus node pops in (the intro's dock pop), CSS pulse takes over
      tl.fromTo(term, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.25, ease: "back.out(2)" }, 1.35);

      // 4–5. beat, then PHASE 1 — ARRIVAL: become visible (still off-screen),
      // then brake in along the rail to rest with the nose at the terminus.
      // immediateRender:false is explicit: the position-0 set owns the initial
      // state, and this tween must not re-render it early OR late.
      tl.set(train, { autoAlpha: 1 }, 1.79).fromTo(
        train,
        { xPercent: -100, x: offscreenX },
        { xPercent: -100, x: 0, duration: 1.5, ease: "power3.out", immediateRender: false },
        1.8,
      );

      // 6. soft bloom where the nose meets the node
      tl.fromTo(bloom, { opacity: 0, scale: 0.6 }, { opacity: 0.9, scale: 1, duration: 0.18, ease: "power2.out" }, 3.25)
        .to(bloom, { opacity: 0, scale: 1.25, duration: 0.5, ease: "power2.out" }, 3.43);

      // 7. START last — after both the copy and the settle
      tl.to(btn, { autoAlpha: 1, y: 0, duration: 0.8, ease: "expo.out" }, Math.max(pEnd + 0.4, 3.7));
    }, root);
    return () => {
      entranceTlRef.current = null;
      ctx.revert();
      // PHASE 2/3 guarantee: whatever the revert bookkeeping did (it goes
      // stale once onStart kills the entrance timeline), the train leaves the
      // start screen in its pure stylesheet state — visible, nose-anchored,
      // driven only by the countdown's `left`.
      const train = root.querySelector<HTMLElement>(".sim-rail__train");
      if (train) gsap.set(train, { clearProps: "opacity,visibility,transform" });
    };
  }, [gs.screen]);

  // ---------------- render values (mirrors the mockup's renderVals) ----------------
  const S = gs;
  const sc = S.screen;
  const dur = duration();
  // (the timer bar + rail assembly now render on every screen except "end")
  const rem = Math.max(0, dur - S.elapsed);
  const mm = Math.floor(rem / 60),
    ss = Math.floor(rem % 60);
  const mmss = mm + ":" + String(ss).padStart(2, "0");
  const pct = S.started ? Math.min(100, Math.max(0, (S.elapsed / dur) * 100)) : 0;

  const rUsed = sessionRef.current.restroomUsed;

  // ---- scatter ----
  const cat = S.category,
    active = S.floor,
    cardOpen = sc === "card",
    sel = S.card;
  const scReady = !!frozenRef.current[cat];
  const posMap: PosMap = frozenRef.current[cat] || scatterRef.current[cat] || {};
  const scatterStores = GAME_STORES.filter((x) => x.cat === cat);

  // ---- tutorial ----
  const isTutorial = sc === "tutorial";
  const tutIsFinal = S.tutStep >= TUT.length;
  const hasSpot = isTutorial && !tutIsFinal && !!S.spot;
  let spotStyle: CSSProperties | undefined, tipStyle: CSSProperties | undefined, tutText = "";
  if (hasSpot && S.spot) {
    const sp = S.spot;
    spotStyle = {
      position: "absolute",
      left: sp.x + "px",
      top: sp.y + "px",
      width: sp.w + "px",
      height: sp.h + "px",
      borderRadius: "12px",
      boxShadow: "0 0 0 9999px rgba(8,9,10,0.76)",
      animation: "ocRing 2.4s ease-in-out infinite",
      transition:
        "left 420ms cubic-bezier(0.16,1,0.3,1),top 420ms cubic-bezier(0.16,1,0.3,1),width 420ms cubic-bezier(0.16,1,0.3,1),height 420ms cubic-bezier(0.16,1,0.3,1)",
      pointerEvents: "none",
    };
    const vw = window.innerWidth,
      vh = window.innerHeight;
    const tw = 380,
      below = sp.y + sp.h + 220 < vh;
    const cx = sp.x + sp.w / 2;
    const left = Math.min(Math.max(16, cx - tw / 2), vw - tw - 16);
    const top = below ? sp.y + sp.h + 18 : Math.max(16, sp.y - 206);
    tipStyle = { left: left + "px", top: top + "px" };
    tutText = TUT[S.tutStep].text;
  }

  // ---- restroom popup ----
  let restPopStyle: CSSProperties | undefined;
  if (S.restroomPop) {
    const a = S.restroomAnchor;
    const vw = window.innerWidth;
    let left: number, top: number;
    if (a) {
      left = Math.min(Math.max(16, a.left + a.width / 2 - 150), vw - 316);
      top = a.bottom + 16;
    } else {
      left = window.innerWidth / 2 - 150;
      top = window.innerHeight / 2;
    }
    restPopStyle = { left: left + "px", top: top + "px" };
  }

  return (
    <div ref={rootRef} className={"sim" + (entry === "handoff" && underlay ? " sim--enter" : "")}>
      {/* match-cut underlay: the exact still the dashboard descent ended on */}
      {underlay && <img className="sim__underlay" src={INTERIOR_STILL_SRC} alt="" aria-hidden="true" />}

      {/* vignette (quiet legibility only) */}
      <div className="sim__vignette" aria-hidden="true" />

      {/* ============ THE PERSISTENT RAIL (start track ∪ timer track) ============ */}
      <RailAssembly railRef={railRef} pct={pct} hidden={sc === "end"} />

      {/* ============ TIMER BAR (rail landing slot + readout) ============
          Rendered from the start screen on so the TIMER pose can be measured
          before the flight; the readout stays hidden until the rail settles. */}
      {sc !== "end" && (
        <div
          ref={(el) => void (tref.current.refTimer.current = el)}
          className={"sim-timer" + (sc === "start" ? " is-pre" : "")}
        >
          <div className="sim-timer__rail" ref={timerSlotRef} />
          {/* readout box: vertically centred on the rail line, track runs into it */}
          <div className="sim-timer__readout" role="timer" aria-label={`Time remaining ${mmss}`}>
            {mmss}
          </div>
        </div>
      )}

      {/* ============ BACK (bottom-left, floor screens) ============ */}
      {sc === "floor" && (
        <button type="button" className="sim-back" onClick={onMenu}>
          ‹ BACK
        </button>
      )}

      {/* ============ STATE · START (editorial title card) ============ */}
      {sc === "start" && (
        <div className="sim-start">
          {/* left-edge legibility scrim (full height, dissolves rightward) */}
          <div className="sim-start__scrim" aria-hidden="true" />
          <div className="sim-start__text">
            <h1 className="sim-start__title">
              {START_TITLE_WORDS.map((w, wi) => (
                <Fragment key={wi}>
                  {wi > 0 && " "}
                  <span className="sim-start__tword">
                    {w.split("").map((ch, ci) => (
                      <span key={ci} className="sim-start__char">
                        {ch}
                      </span>
                    ))}
                  </span>
                </Fragment>
              ))}
              <span className="sim-start__caret" aria-hidden="true">
                <span className="sim-start__caret-bar" />
              </span>
            </h1>
            <p className="sim-start__copy">
              {START_COPY_WORDS.map((w, i) => (
                <span key={i} className="sim-start__word">
                  {w}
                </span>
              ))}
            </p>
          </div>
          {/* the departure track itself is the persistent RailAssembly above */}
          <button type="button" className="sim-start__btn" onClick={onStart}>
            START
          </button>
        </div>
      )}

      {/* ============ CHOICE LAYOUT (also behind tutorial) ============ */}
      {(sc === "choice" || sc === "tutorial") && (
        <div className="sim-choice">
          <div className="sim-choice__q">WHAT WOULD YOU LIKE TO DO TODAY?</div>
          <div ref={(el) => void (tref.current.refChoices.current = el)} className="sim-choice__row">
            <button
              type="button"
              ref={(el) => void (tref.current.refShop.current = el)}
              className="sim-choice__btn"
              onClick={onShop}
            >
              1 · SHOP
            </button>
            <button type="button" className="sim-choice__btn" onClick={onBite}>
              2 · GRAB A BITE
            </button>
            <button
              type="button"
              ref={(el) => void (tref.current.refRestroom.current = el)}
              className="sim-choice__btn"
              onClick={onRestroom}
              disabled={rUsed}
              aria-disabled={rUsed || undefined}
            >
              {rUsed ? "3 · RESTROOM · USED" : "3 · RESTROOM"}
            </button>
            <button
              type="button"
              ref={(el) => void (tref.current.refOutside.current = el)}
              className="sim-choice__btn"
              onClick={onOutside}
            >
              4 · GO OUTSIDE
            </button>
          </div>
        </div>
      )}

      {/* ============ RESTROOM POPUP ============ */}
      {S.restroomPop && (
        <div className="sim-rest" style={restPopStyle} role="status">
          <div className="sim-rest__kicker">RESTROOM</div>
          <div className="sim-rest__text">
            Back to your options in <span className="sim-rest__count">{S.restroomCount}</span>…
          </div>
          <div className="sim-rest__bar">
            <div className="sim-rest__fill" style={{ width: (S.restroomCount / 5) * 100 + "%" }} />
          </div>
        </div>
      )}

      {/* ============ TUTORIAL OVERLAY ============ */}
      {isTutorial && (
        <div className="sim-tut">
          {hasSpot && (
            <>
              <div style={spotStyle} aria-hidden="true" />
              <div className="sim-tut__tip" style={tipStyle} role="dialog" aria-label={`Tutorial step ${Math.min(S.tutStep, TUT.length - 1) + 1} of ${TUT.length}`}>
                <div className="sim-tut__head">
                  <span className="sim-tut__step">STEP {Math.min(S.tutStep, TUT.length - 1) + 1} / {TUT.length}</span>
                  <button type="button" className="sim-tut__skip" onClick={onTutSkip}>
                    SKIP ›
                  </button>
                </div>
                <p className="sim-tut__text">{tutText}</p>
                <div className="sim-tut__row">
                  <button type="button" className={"sim-tut__back" + (S.tutStep === 0 ? " is-first" : "")} onClick={onTutBack}>
                    BACK
                  </button>
                  <button type="button" className="sim-tut__next" onClick={onTutNext}>
                    NEXT
                  </button>
                </div>
              </div>
            </>
          )}
          {tutIsFinal && (
            <div className="sim-tut__final">
              <div className="sim-tut__final-card">
                <h2 className="sim-tut__final-title">THAT'S THE WHOLE GAME</h2>
                <p className="sim-tut__final-copy">Clock starts the second you hit play. Catch your train.</p>
                <button type="button" className="sim-play" onClick={onPlay}>
                  PLAY
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ STATE · FLOOR SCATTER ============ */}
      {(sc === "floor" || sc === "card") && (
        <>
          <div className="sim-floor">
            {/* soft depth scrim over the INACTIVE half (never touches the timer/train/track) */}
            {sc === "floor" && (
              <div
                aria-hidden="true"
                style={
                  active === 1
                    ? {
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: 0,
                        bottom: "52%",
                        zIndex: 9,
                        pointerEvents: "none",
                        background:
                          "linear-gradient(to bottom, rgba(6,8,9,0.6) 0%, rgba(6,8,9,0.55) 30%, rgba(6,8,9,0.3) 60%, transparent 100%)",
                      }
                    : {
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: "52%",
                        bottom: 0,
                        zIndex: 9,
                        pointerEvents: "none",
                        background: "linear-gradient(to top, rgba(6,8,9,0.6) 0%, rgba(6,8,9,0.3) 45%, transparent 100%)",
                      }
                }
              />
            )}
            {scatterStores.map((st) => {
              const key = scatterKey(st);
              const p = posMap[key];
              if (!p) return null;
              const [fs, fw] = SIZE_FS[st.size];
              let mode: "sel" | "dim" | "live" | "ghost";
              if (cardOpen) mode = sel && sel.floor === st.floor && sel.name === st.name ? "sel" : "dim";
              else mode = st.floor === active ? "live" : "ghost";
              // WRAPPER owns position + frozen translate (+ floor-swap scale); INNER button owns
              // type + the hover scale. The inner button has NO inline transform, so the CSS
              // :hover scale is never stomped by the 4x/sec timer re-render.
              const wrapBase: CSSProperties = {
                position: "absolute",
                left: p.x + "%",
                top: p.y + "%",
                transform: "translate(-50%,-50%)",
                opacity: scReady ? 1 : 0,
                transition: "opacity 240ms,transform 340ms cubic-bezier(0.16,1,0.3,1),filter 340ms cubic-bezier(0.16,1,0.3,1)",
              };
              const innerBase: CSSProperties = {
                fontFamily: "'Space Grotesk',sans-serif",
                fontSize: fs,
                fontWeight: fw,
                letterSpacing: "0.01em",
                whiteSpace: "nowrap",
                border: "none",
                background: "none",
                padding: "1px 9px",
                lineHeight: 1,
                borderRadius: "8px",
                margin: 0,
              };
              let wrap: CSSProperties, style: CSSProperties, live = false;
              if (mode === "live") {
                // white text + soft TEAL outer glow halo; hover scale + amber glow via .ocN.live:hover
                wrap = { ...wrapBase, zIndex: 12 };
                style = {
                  ...innerBase,
                  color: "#F3F5F0",
                  cursor: "pointer",
                  background: "none",
                  textShadow:
                    "0 0 4px rgba(0,0,0,0.9),0 0 10px rgba(26,135,135,0.6),0 0 22px rgba(26,135,135,0.42),0 1px 3px rgba(0,0,0,0.95)",
                };
                live = true;
              } else if (mode === "ghost") {
                // inactive floor: light blur + scaled down (depth cue), dimmed; scale on the WRAPPER
                wrap = { ...wrapBase, transform: "translate(-50%,-50%) scale(0.55)", filter: "blur(0.7px)", pointerEvents: "none", zIndex: 6 };
                style = { ...innerBase, color: "rgba(184,202,202,0.5)", cursor: "default", textShadow: "0 1px 4px rgba(0,0,0,0.9)" };
              } else if (mode === "sel") {
                wrap = { ...wrapBase, pointerEvents: "none", zIndex: 34 };
                style = {
                  ...innerBase,
                  color: "#FFFFFF",
                  cursor: "default",
                  background: "radial-gradient(ellipse 132% 152% at 50% 50%, rgba(7,9,9,0.42) 0%, transparent 72%)",
                  textShadow: "0 0 3px rgba(0,0,0,0.95),0 0 24px rgba(255,176,32,0.6),0 1px 3px rgba(0,0,0,1)",
                };
              } else {
                // dim (card open) — faded but still visible, above the scrim
                wrap = { ...wrapBase, pointerEvents: "none", zIndex: 32 };
                style = {
                  ...innerBase,
                  color: "rgba(214,222,222,0.5)",
                  cursor: "default",
                  textShadow: "0 0 4px rgba(0,0,0,0.9),0 1px 4px rgba(0,0,0,0.95)",
                };
              }
              return (
                <div key={key} style={wrap}>
                  <button
                    type="button"
                    className={"ocN ocN--" + st.size + (live ? " live" : "")}
                    data-key={key}
                    tabIndex={live ? 0 : -1}
                    aria-hidden={live ? undefined : true}
                    style={style}
                    onClick={live ? () => openStore(st) : undefined}
                  >
                    {st.name}
                  </button>
                </div>
              );
            })}
          </div>
          {sc === "floor" && (
            <div className="sim-floor__toggles">
              <button type="button" className={"sim-tg" + (active === 1 ? " is-active" : "")} onClick={onFloor1}>
                1st FLOOR
              </button>
              <button type="button" className={"sim-tg" + (active === 2 ? " is-active" : "")} onClick={onFloor2}>
                2nd FLOOR
              </button>
            </div>
          )}
        </>
      )}

      {/* ============ STATE · STORE CARD (a choice is mandatory — no close) ============ */}
      {cardOpen && sel && (
        <>
          <div className="sim-card-veil" aria-hidden="true" />
          <div className="sim-card" role="dialog" aria-modal="true" aria-label={sel.name}>
            <div className="sim-card__panel">
              <div className="sim-card__sheen" aria-hidden="true" />
              <div className="sim-card__meta">
                {sel.floor === 1 ? "1ST FLOOR" : "2ND FLOOR"} · {sel.cat === "bite" ? "GRAB A BITE" : "SHOPPING"}
              </div>
              <div className="sim-card__name">{sel.name}</div>
              <div className="sim-card__div" aria-hidden="true">
                <div className="sim-card__div-l" />
                <div className="sim-card__div-dot" />
                <div className="sim-card__div-r" />
              </div>
              <div className="sim-card__bullets">
                {sel.bullets.map((b) => (
                  <div key={b} className="sim-card__bullet">
                    {b}
                  </div>
                ))}
              </div>
              <div className="sim-card__ask">HOW MUCH WILL YOU SPEND?</div>
              <div className="sim-card__prices">
                {sel.prices.map((pp, i) => (
                  <button key={i} type="button" className="sim-price" onClick={() => choosePrice(pp, i)}>
                    <span className="sim-price__tier">{["HIGH", "MID", "LOW"][i] || ""}</span>
                    <span className="sim-price__value">{pp.d}</span>
                    {pp.l ? <span className="sim-price__label">{pp.l}</span> : null}
                  </button>
                ))}
              </div>
              <button type="button" className="sim-skip" onClick={onSkip}>
                <span className="sim-skip__icon">
                  <img className="sim-skip__img" src={SKIP_HAND_SRC} alt="" />
                </span>
                <span className="sim-skip__label">SKIP THIS STORE</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ============ STATE · GO OUTSIDE ============ */}
      {sc === "outside" && (
        <div className="sim-outside">
          <div className="sim-outside__q">WHERE WOULD YOU CHOOSE TO GO?</div>
          <div className="sim-outside__list">
            {DEST.map((n) => (
              <button key={n} type="button" className="sim-dest" onClick={() => pickDestination(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ============ STATE · END (cinematic beat) ============ */}
      {sc === "end" && (
        <div className="sim-end">
          <h1 className="sim-end__title">
            Time's up.
            <br />
            Your train is here.
          </h1>
          {/* STEP 2: clock spins in, hands racing away */}
          {S.endPhase >= 1 && (
            <div className="sim-end__clock" aria-hidden="true">
              <div className="sim-end__clock-face" />
              <div className="sim-end__tick-t" />
              <div className="sim-end__tick-b" />
              <div className="sim-end__tick-l" />
              <div className="sim-end__tick-r" />
              <div className="sim-end__hand-hr" />
              <div className="sim-end__hand-min" />
              <div className="sim-end__hub" />
            </div>
          )}
          <div className="sim-end__trackwrap" aria-hidden="true">
            {/* STEP 3: track builds in left to right with a glowing leading edge */}
            {S.endPhase >= 1 && (
              <>
                <div className="sim-end__track">
                  <div className="sim-end__track-ties" />
                  <div className="sim-end__track-a" />
                  <div className="sim-end__track-b" />
                </div>
                <div className="sim-end__edge" />
              </>
            )}
            {/* STEP 4: train slides in from the left, settles half off the right edge */}
            {S.endPhase >= 2 && <img className="sim-end__train" src={TRAIN_SRC} alt="" />}
          </div>
          {/* STEP 5: continue (+ replay) */}
          {S.endPhase >= 3 && (
            <div className="sim-end__actions">
              <button type="button" className="sim-end__btn" onClick={onSynthesis}>
                CONTINUE TO SYNTHESIS
              </button>
              <button type="button" className="sim-end__again" onClick={onReset}>
                RUN IT AGAIN
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
