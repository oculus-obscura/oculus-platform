/**
 * Data Dashboard — a scroll-driven walk around the Oculus.
 *
 * Scroll grammar (desktop "scrub" mode): one sticky full-viewport stage inside
 * a tall driver. A single ScrollTrigger-scrubbed master timeline (unit = vh)
 * runs move → arrive → dwell four times clockwise (W→N→E→S), then the descent:
 *
 *   TRAVEL videos are SCROLL-SCRUBBED — but never from scroll events directly.
 *   ScrollTrigger writes only a target time; a single frame-paced loop
 *   (requestVideoFrameCallback where available, rAF otherwise) lerps the
 *   video's currentTime toward it, skipping while a seek is in flight so
 *   seeks never queue. Lenis (app level) normalises wheel input above this.
 *   Travel videos are never play()ed.
 *
 *   TRACKS videos are NEVER scrubbed: the stage holds (~70vh of scroll) while
 *   they play at real time on loop — they show observed human movement, and
 *   scrubbing them would misrepresent it. Dwell time is the user's own; the
 *   short pin only bounds the scrolling, not the playback.
 *
 * The travel→tracks handoff is an exact-frame swap (each travel's last frame
 * is the frame its tracks video holds), so layers stack and flip opacity.
 * Station→station and descent boundaries are short scrub-tied crossfades.
 *
 * After SOUTH, 05-descent scrubs from outside to inside and cross-fades into
 * the interior still. NOTE (deliberate spec deviation): the still is already
 * a dark graded render — grading it again would crush it to black, so it
 * renders ungraded; the compositions match, which makes the swap read as one
 * continuous image.
 *
 * Scrolling UP past the dashboard's top hands back to the Overview (the
 * retract plays in reverse there) — see the return-wheel effect in the entry
 * component.
 *
 * Fallback modes: "sequence" (touch / <768px — no scrubbing; travel plays
 * through on entry, then tracks, same rhythm) and "static" (reduced motion —
 * posters + final-state overlays + a manual play control per station).
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  DESCENT,
  INTERIOR_STILL_SRC,
  SIMULATION_ENABLED,
  STATIONS,
  type StationDef,
} from "./stationData";
import useTrackDetection, { type DetectionReading } from "./useTrackDetection";
import "./dashboardScroll.css";

gsap.registerPlugin(ScrollTrigger);

/* ---------------------------------------------------------------------------
 * Scroll layout (vh units) — the walk's rhythm lives here.
 * ------------------------------------------------------------------------- */
const TRAVEL_VH = 100; // move: one viewport of scroll scrubs a travel video
const TRACKS_VH = 70; // dwell: holds while tracks plays — short to escape
const DESCENT_VH = 130;
const END_VH = 90; // interior still + simulation handoff
const CROSS_VH = 6; // station→station / descent crossfade length
const STATION_VH = TRAVEL_VH + TRACKS_VH;
const DESCENT_AT = STATIONS.length * STATION_VH;
const TOTAL_VH = DESCENT_AT + DESCENT_VH + END_VH;

/** Seek-loop lerp factor (per serviced frame). */
const SEEK_LERP = 0.18;

/**
 * Experiment flag: layer a duplicate of each tracks video over itself in
 * screen blend, matted to teal only (SVG feColorMatrix alpha = G−R, so the
 * white architecture contributes nothing) — makes the trackers glow without
 * brightening the building. Toggle freely; it's a second decode per dwell.
 */
const TRACKS_GLOW = true;

type Mode = "scrub" | "sequence" | "static";

function resolveMode(): Mode {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "static";
  if (window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768) return "sequence";
  return "scrub";
}

/* ---------------------------------------------------------------------------
 * Station overlay — identity (left) + amber detection instrument (right).
 * Detection values are ESTIMATES: amber only, labelled as derived (DESIGN.md).
 * ------------------------------------------------------------------------- */
interface StationOverlayProps {
  station: StationDef;
  index: number;
  active: boolean;
  getVideo: () => HTMLVideoElement | null;
  /** sequence/static reveal via class; scrub mode reveals via GSAP */
  revealedByClass?: boolean;
}

function StationOverlay({ station, index, active, getVideo, revealedByClass }: StationOverlayProps) {
  const reading: DetectionReading = useTrackDetection(getVideo, active);
  const fmt = (n: number) => (reading.live ? String(n) : "—");
  return (
    <div
      className={"dash-overlay" + (revealedByClass ? " dash-overlay--class-reveal" : "") + (revealedByClass && active ? " is-on" : "")}
      data-station={index}
    >
      <div className="dash-overlay__station">
        <p className="dash-overlay__kicker" data-reveal>
          Station 0{index + 1} · {station.compass}
        </p>
        <h3 className="dash-overlay__name" data-reveal>
          {station.name}
        </h3>
        <p className="dash-overlay__caption" data-reveal>
          {station.caption}
        </p>
      </div>
      <div className="dash-overlay__detect">
        <div className="dash-overlay__count tnum" data-reveal>
          {fmt(reading.count)}
        </div>
        <p className="dash-overlay__live" data-reveal>
          Live detection
        </p>
        <p className="dash-overlay__sub" data-reveal>
          computer vision estimate · derived from on-site footage
        </p>
        <div className="dash-overlay__pace" data-reveal>
          <span className="dash-overlay__pace-label">movement rate</span>
          <span className="dash-overlay__pace-track" aria-hidden="true">
            <span
              className="dash-overlay__pace-fill"
              style={{ width: `${Math.round(reading.pace * 100)}%` }}
            />
          </span>
        </div>
        <p className="dash-overlay__peak" data-reveal>
          peak this pass · <span className="tnum">{fmt(reading.peak)}</span>
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Compass — quiet chrome echoing the intro's ring. Needle rotates clockwise
 * W→N→E→S as the walk advances; active tick + centre letter follow.
 * ------------------------------------------------------------------------- */
const TICKS = [
  { p: "N", x1: 32, y1: 4, x2: 32, y2: 11 },
  { p: "E", x1: 60, y1: 32, x2: 53, y2: 32 },
  { p: "S", x1: 32, y1: 60, x2: 32, y2: 53 },
  { p: "W", x1: 4, y1: 32, x2: 11, y2: 32 },
];

interface CompassProps {
  letter: string;
  needleRef?: React.RefObject<SVGGElement | null>;
  /** one-time WEST hint: soft pulse on the ring */
  pulse?: boolean;
}

function Compass({ letter, needleRef, pulse = false }: CompassProps) {
  return (
    <div className={"dash-compass" + (pulse ? " is-hinting" : "")} aria-hidden="true">
      <svg viewBox="0 0 64 64">
        <circle className="dash-compass__ring" cx="32" cy="32" r="24" />
        {TICKS.map((t) => (
          <line
            key={t.p}
            className="dash-compass__tick"
            data-active={t.p === letter || undefined}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
          />
        ))}
        <g ref={needleRef} className="dash-compass__needle">
          <circle cx="32" cy="8" r="2.1" />
        </g>
      </svg>
      <span className="dash-compass__letter">{letter}</span>
    </div>
  );
}

/** Needle rotation for a station index: W=-90 → N=0 → E=90 → S=180. */
const needleAngle = (i: number) => -90 + i * 90;

/** Small downward chevron used inside the ScrollGuide. */
function CueChevron({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 8" aria-hidden="true">
      <path
        d="M1 1 L8 7 L15 1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type GuideState = "hidden" | "pill" | "panel";

/**
 * ScrollGuide — bare bottom-center guidance text over the video (no
 * container; legibility comes from layered text-shadows plus the stage's
 * full-bleed bottom edge gradient). "Scroll" + chevron during dwells; the
 * final invitation lines at the last station, opacity-crossfaded only.
 * Presentational (pointer-events: none), but the invitation is a status
 * region so the instruction reaches screen readers.
 */
function ScrollGuide({ state }: { state: GuideState }) {
  const panel = state === "panel";
  return (
    <div className={"scroll-guide" + (state !== "hidden" ? " is-visible" : "")}>
      <div
        className={"scroll-guide__content scroll-guide__pill" + (panel ? " is-off" : "")}
        aria-hidden={panel || state === "hidden" || undefined}
      >
        <span className="scroll-guide__label">Scroll</span>
        <CueChevron className="scroll-guide__chev" />
      </div>
      <div
        className={"scroll-guide__content scroll-guide__invite" + (panel ? "" : " is-off")}
        role="status"
      >
        {panel && (
          <>
            <p className="scroll-guide__line1">Keep scrolling to go inside</p>
            <p className="scroll-guide__line2">The simulation begins in the concourse.</p>
            <CueChevron className="scroll-guide__chev" />
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Interior end card — the record hands off to the simulation.
 * ------------------------------------------------------------------------- */
function InteriorEnd({ asSection }: { asSection?: boolean }) {
  const body = (
    <>
      <p className="dash-end__line" data-reveal>
        The walk ends at the doors. The simulation begins inside.
      </p>
      <button
        type="button"
        className="dash-end__cta"
        disabled={!SIMULATION_ENABLED}
        aria-disabled={!SIMULATION_ENABLED || undefined}
        data-reveal
      >
        Enter the Simulation
      </button>
      {!SIMULATION_ENABLED && (
        <p className="dash-end__soon" data-reveal>
          coming in the next part
        </p>
      )}
    </>
  );
  return asSection ? (
    <section className="dash-end dash-end--section">{body}</section>
  ) : (
    <div className="dash-end dash-layer">{body}</div>
  );
}

/* ---------------------------------------------------------------------------
 * Decoupled seek machinery (FIX 2): scroll writes targets; one frame-paced
 * loop services the single active video.
 * ------------------------------------------------------------------------- */
interface ScrubState {
  video: HTMLVideoElement;
  target: number;
  display: number;
  seeking: boolean;
}

/* ===========================================================================
 * SCRUB MODE — sticky stage + master scrubbed timeline.
 * ========================================================================= */
function ScrubDashboard() {
  const rootRef = useRef<HTMLDivElement>(null);
  const driverRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const needleRef = useRef<SVGGElement>(null);
  const travelRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const tracksRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const tracksWrapRefs = useRef<(HTMLDivElement | null)[]>([]);
  const glowRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const descentRef = useRef<HTMLVideoElement>(null);

  // which station's dwell is live (drives detection + compass letter)
  const [activeStation, setActiveStation] = useState(0);
  const [dwelling, setDwelling] = useState<number | null>(null);
  // guidance layer: idle scroll cue, one-time compass hint (FIX 3)
  const [cueOn, setCueOn] = useState(false);
  const [hintOn, setHintOn] = useState(false);
  const hintDoneRef = useRef(false);
  const lastStation = STATIONS.length - 1;

  const getters = useMemo(
    () => STATIONS.map((_, i) => () => tracksRefs.current[i] ?? null),
    [],
  );

  // at the final station the guide expands into the invitation panel once
  // the overlay has had time to write in; it then persists (no idle gating)
  // until the descent takes over
  const [panelArmed, setPanelArmed] = useState(false);
  useEffect(() => {
    if (dwelling !== lastStation) {
      setPanelArmed(false);
      return;
    }
    const t = window.setTimeout(() => setPanelArmed(true), 1400);
    return () => window.clearTimeout(t);
  }, [dwelling, lastStation]);

  const guideState: GuideState =
    dwelling === null
      ? "hidden"
      : dwelling === lastStation && panelArmed
        ? "panel"
        : cueOn
          ? "pill"
          : "hidden";

  // scroll pill: appears once the user idles during a dwell (the 1.4s delay
  // also covers the overlay's ~1.1s write-in, since arriving IS scrolling);
  // hides the moment scrolling resumes. Not shown during travels.
  useEffect(() => {
    if (dwelling === null) {
      setCueOn(false);
      return;
    }
    let timer = window.setTimeout(() => setCueOn(true), 1400);
    const onScroll = () => {
      setCueOn(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setCueOn(true), 1400);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      setCueOn(false);
    };
  }, [dwelling]);

  // one-time compass hint at WEST: label + ring pulse, gone after 4s or on
  // the first scroll (armed after a beat so entry momentum can't kill it)
  useEffect(() => {
    if (dwelling !== 0 || hintDoneRef.current) return;
    hintDoneRef.current = true;
    setHintOn(true);
    const off = () => setHintOn(false);
    const hideTimer = window.setTimeout(off, 4000);
    const armTimer = window.setTimeout(() => {
      window.addEventListener("scroll", off, { passive: true, once: true });
    }, 800);
    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(armTimer);
      window.removeEventListener("scroll", off);
    };
  }, [dwelling]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const driver = driverRef.current;
    const stage = stageRef.current;
    if (!root || !driver || !stage) return;

    const vh = (u: number) => (u / 100) * window.innerHeight;

    const ctx = gsap.context(() => {
      const travels = travelRefs.current.filter(Boolean) as HTMLVideoElement[];
      const tracksWraps = tracksWrapRefs.current.filter(Boolean) as HTMLDivElement[];
      const descent = descentRef.current!;
      const still = stage.querySelector(".dash-still");
      const end = stage.querySelector(".dash-end");
      const overlays = Array.from(stage.querySelectorAll<HTMLElement>(".dash-overlay"));

      // ---- initial layer states: the first travel paints from frame 0 at
      // full grade (no emergence ramp — the poster underlay sits beneath) ----
      gsap.set([...travels.slice(1), ...tracksWraps, descent, still, end], { autoAlpha: 0 });
      gsap.set(travels[0], { autoAlpha: 1 });
      overlays.forEach((o) => {
        gsap.set(o, { autoAlpha: 0 });
        gsap.set(o.querySelectorAll("[data-reveal]"), { autoAlpha: 0, y: 12 });
      });
      gsap.set(needleRef.current, { rotation: needleAngle(0), svgOrigin: "32 32" });

      // ---- FIX 2: seek loop — scroll writes targets, this services them ----
      const cleanupFns: (() => void)[] = [];
      let activeScrub: ScrubState | null = null;
      let scheduled = false;
      let disposed = false;
      let rafId = 0;

      const scrubStates: ScrubState[] = [...travels, descent].map((video) => {
        const s: ScrubState = { video, target: 0, display: 0, seeking: false };
        const onSeeking = () => (s.seeking = true);
        const onSeeked = () => {
          s.seeking = false;
          if (activeScrub === s) schedule(); // keep the loop fed after a seek
        };
        video.addEventListener("seeking", onSeeking);
        video.addEventListener("seeked", onSeeked);
        cleanupFns.push(() => {
          video.removeEventListener("seeking", onSeeking);
          video.removeEventListener("seeked", onSeeked);
        });
        return s;
      });

      const run = () => {
        scheduled = false;
        const s = activeScrub;
        if (!s || disposed) return; // parked — reactivated by segment triggers
        let issuedOn: HTMLVideoElement | null = null;
        if (!s.seeking) {
          s.display += (s.target - s.display) * SEEK_LERP;
          if (Math.abs(s.target - s.display) < 0.003) s.display = s.target;
          // guard: no sub-frame seeks
          if (Math.abs(s.video.currentTime - s.display) > 1 / 60) {
            s.video.currentTime = s.display;
            issuedOn = s.video;
          }
        }
        schedule(issuedOn);
      };
      // pace by requestVideoFrameCallback when a seek is in flight (a frame
      // WILL present); plain rAF while idling toward a target
      const schedule = (via: HTMLVideoElement | null = null) => {
        if (disposed || scheduled) return;
        scheduled = true;
        if (via && "requestVideoFrameCallback" in via) {
          via.requestVideoFrameCallback(() => run());
        } else {
          rafId = requestAnimationFrame(run);
        }
      };
      const setActiveScrub = (s: ScrubState | null) => {
        activeScrub = s;
        if (s) schedule();
      };

      // ---- master scrubbed timeline (unit = vh of scroll) ----
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: driver,
          start: "top top",
          end: "bottom bottom",
          // small: Lenis smooths input upstream; more here would double-smooth
          scrub: 0.35,
        },
      });

      /** scroll → target time only; the seek loop does the writing */
      const scrubTo = (state: ScrubState, at: number, len: number) => {
        const proxy = { t: 0 };
        tl.to(
          proxy,
          {
            t: 1,
            duration: len,
            onUpdate: () => {
              const d = state.video.duration;
              if (isFinite(d) && d > 0) state.target = Math.min(proxy.t * d, d - 0.05);
            },
          },
          at,
        );
      };

      STATIONS.forEach((_s, i) => {
        const at = i * STATION_VH;
        const arrive = at + TRAVEL_VH;
        scrubTo(scrubStates[i], at, TRAVEL_VH);
        if (i > 0) {
          // stations cut via a short scrub-tied crossfade over the prior dwell
          tl.fromTo(travels[i], { autoAlpha: 0 }, { autoAlpha: 1, duration: CROSS_VH }, at);
          tl.set(tracksWraps[i - 1], { autoAlpha: 0 }, at + CROSS_VH);
        }
        // arrive: exact-frame swap — tracks holds the travel's last frame
        tl.set(tracksWraps[i], { autoAlpha: 1 }, arrive);
        tl.set(travels[i], { autoAlpha: 0 }, arrive + 0.5);
        // compass needle sweeps to this station across the travel leg
        if (i > 0) {
          tl.to(needleRef.current, { rotation: needleAngle(i), duration: TRAVEL_VH * 0.6 }, at + TRAVEL_VH * 0.2);
        }
      });

      // ---- descent: outside → inside ----
      tl.fromTo(descent, { autoAlpha: 0 }, { autoAlpha: 1, duration: CROSS_VH }, DESCENT_AT);
      tl.set(tracksWraps[STATIONS.length - 1], { autoAlpha: 0 }, DESCENT_AT + CROSS_VH);
      scrubTo(scrubStates[scrubStates.length - 1], DESCENT_AT, DESCENT_VH - 10);
      // cross-fade into the interior still on the final metres of the scrub
      tl.fromTo(still, { autoAlpha: 0 }, { autoAlpha: 1, duration: 9 }, DESCENT_AT + DESCENT_VH - 11);
      tl.set(descent, { autoAlpha: 0 }, DESCENT_AT + DESCENT_VH);
      // compass has nothing left to point at underground
      tl.to(".dash-compass", { autoAlpha: 0, duration: 10 }, DESCENT_AT + 4);

      // ---- end card ----
      if (end) {
        tl.set(end, { autoAlpha: 1 }, DESCENT_AT + DESCENT_VH + 8);
        tl.fromTo(
          end.querySelectorAll("[data-reveal]"),
          { autoAlpha: 0, y: 14 },
          { autoAlpha: 1, y: 0, duration: 22, stagger: 8, ease: "power3.out" },
          DESCENT_AT + DESCENT_VH + 10,
        );
      }

      // Pin the timeline's duration to exactly TOTAL_VH so 1 timeline unit maps
      // to exactly 1vh of scroll (driver height is TOTAL_VH + one viewport).
      // Without this the last tween's end defines the duration and every
      // boundary drifts a few % against the px-based segment triggers.
      tl.set({}, {}, TOTAL_VH);

      // ---- per-station overlay reveals + tracks playback (not scrubbed) ----
      const revealTls = overlays.map((o) =>
        gsap
          .timeline({ paused: true })
          .to(o, { autoAlpha: 1, duration: 0.3, ease: "power1.out" }, 0)
          .to(
            o.querySelectorAll("[data-reveal]"),
            { autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.07, ease: "expo.out" },
            0.05,
          ),
      );

      STATIONS.forEach((_s, i) => {
        const dwellStart = i * STATION_VH + TRAVEL_VH;
        // dwell trigger: play/pause the real-time loop, reveal the instrument
        ScrollTrigger.create({
          start: () => vh(dwellStart - 4),
          end: () => vh(dwellStart + TRACKS_VH + CROSS_VH),
          onToggle: (self) => {
            const video = tracksRefs.current[i];
            const glow = glowRefs.current[i];
            if (self.isActive) {
              video?.play().catch(() => {});
              if (glow && video) {
                glow.currentTime = video.currentTime; // keep the matte in step
                glow.play().catch(() => {});
              }
              revealTls[i].timeScale(1).play();
              setDwelling(i);
            } else {
              video?.pause();
              glow?.pause();
              revealTls[i].timeScale(2).reverse();
              setDwelling((d) => (d === i ? null : d));
            }
          },
        });
        // travel leg: this station's scrub loop owns the frame budget
        ScrollTrigger.create({
          start: () => vh(i * STATION_VH),
          end: () => vh(i * STATION_VH + TRAVEL_VH),
          onToggle: (self) => {
            if (self.isActive) setActiveScrub(scrubStates[i]);
            else if (activeScrub === scrubStates[i]) setActiveScrub(null);
          },
        });
        // station span: keeps compass letter in step during the travel leg too
        ScrollTrigger.create({
          start: () => vh(i * STATION_VH),
          end: () => vh((i + 1) * STATION_VH),
          onToggle: (self) => self.isActive && setActiveStation(i),
        });
      });
      // descent scrub activation
      ScrollTrigger.create({
        start: () => vh(DESCENT_AT),
        end: () => vh(DESCENT_AT + DESCENT_VH),
        onToggle: (self) => {
          const s = scrubStates[scrubStates.length - 1];
          if (self.isActive) setActiveScrub(s);
          else if (activeScrub === s) setActiveScrub(null);
        },
      });

      // at mount the first travel leg is already in range — arm it
      if (window.scrollY < vh(TRAVEL_VH)) setActiveScrub(scrubStates[0]);

      return () => {
        disposed = true;
        cancelAnimationFrame(rafId);
        cleanupFns.forEach((fn) => fn());
        tracksRefs.current.forEach((v) => v?.pause());
        glowRefs.current.forEach((v) => v?.pause());
      };
    }, root);

    // debounced refresh — RESPONSIVE.md resize resilience
    let timer: number | undefined;
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => ScrollTrigger.refresh(), 150);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(timer);
      ctx.revert(); // kills the pin, triggers and tweens (StrictMode-safe)
    };
  }, []);

  return (
    <div className="dashboard" ref={rootRef}>
      {/* teal matte for the glow experiment: alpha = 2.5·(G−R), so the white
          architecture (G≈R) vanishes and only the trackers survive */}
      <svg className="dash-defs" aria-hidden="true" focusable="false">
        <filter id="dash-teal-matte" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -2.5 2.5 0 0 0"
          />
        </filter>
      </svg>
      {/* +100vh: scroll DISTANCE is height − viewport, so this makes the
          scrubbed distance exactly TOTAL_VH vh — 1 unit ↔ 1vh, no drift */}
      <div className="dash-driver" ref={driverRef} style={{ height: `${TOTAL_VH + 100}vh` }}>
        <div className="dash-stage" ref={stageRef}>
          {/* frame-0 insurance: painted beneath everything so entry never
              shows an empty black frame while the video element warms up */}
          <img
            className="dash-layer dash-video dash-video--travel dash-underlay"
            src={STATIONS[0].travelPoster}
            alt=""
            aria-hidden="true"
          />
          {STATIONS.map((s, i) => (
            <VideoPair
              key={s.id}
              station={s}
              index={i}
              travelRefs={travelRefs}
              tracksRefs={tracksRefs}
              tracksWrapRefs={tracksWrapRefs}
              glowRefs={glowRefs}
            />
          ))}
          <video
            ref={descentRef}
            className="dash-video dash-video--travel dash-layer"
            src={DESCENT.src}
            poster={DESCENT.poster}
            muted
            playsInline
            preload="auto"
            disablePictureInPicture
            aria-label="Descending from the plaza into the Oculus interior"
          />
          {/* already a dark graded render — no display grade (see header note) */}
          <img className="dash-still dash-layer" src={INTERIOR_STILL_SRC} alt="Inside the Oculus concourse, rendered dark" />
          {/* localized scrims: legibility for the margin columns without
              re-darkening the whole frame; centre ground plane stays clear */}
          <div className="dash-scrim dash-scrim--left" aria-hidden="true" />
          <div className="dash-scrim dash-scrim--right" aria-hidden="true" />
          <div className="dash-scrim dash-scrim--vignette" aria-hidden="true" />
          {/* full-width bottom edge — grounds the bare ScrollGuide text */}
          <div className="dash-scrim dash-scrim--bottom" aria-hidden="true" />
          <InteriorEnd />
          {STATIONS.map((s, i) => (
            <StationOverlay
              key={s.id}
              station={s}
              index={i}
              active={dwelling === i}
              getVideo={getters[i]}
            />
          ))}

          {/* the morphing scroll guide: "Scroll" pill during dwells →
              invitation panel at the final station */}
          <ScrollGuide state={guideState} />

          {/* one-time compass hint (WEST) */}
          <div className={"dash-hint" + (hintOn ? " is-on" : "")} aria-hidden="true">
            your position around the building
          </div>

          <Compass
            letter={STATIONS[activeStation]?.compass ?? "W"}
            needleRef={needleRef}
            pulse={hintOn}
          />
        </div>
      </div>
    </div>
  );
}

/** The stacked travel + (tracks [+ glow]) layers for one station (scrub mode). */
function VideoPair({
  station,
  index,
  travelRefs,
  tracksRefs,
  tracksWrapRefs,
  glowRefs,
}: {
  station: StationDef;
  index: number;
  travelRefs: { current: (HTMLVideoElement | null)[] };
  tracksRefs: { current: (HTMLVideoElement | null)[] };
  tracksWrapRefs: { current: (HTMLDivElement | null)[] };
  glowRefs: { current: (HTMLVideoElement | null)[] };
}) {
  return (
    <>
      <video
        ref={(el) => {
          travelRefs.current[index] = el;
        }}
        className="dash-video dash-video--travel dash-layer"
        src={station.travelSrc}
        poster={station.travelPoster}
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        aria-label={`Approach to the ${station.name} side of the Oculus`}
      />
      <div
        ref={(el) => {
          tracksWrapRefs.current[index] = el;
        }}
        className="dash-layer dash-tracks-layer"
      >
        <video
          ref={(el) => {
            tracksRefs.current[index] = el;
          }}
          className="dash-video dash-video--tracks"
          src={station.tracksSrc}
          poster={station.tracksPoster}
          muted
          playsInline
          loop
          preload="auto"
          disablePictureInPicture
          aria-label={`Observed movement at the ${station.name} side, played in real time`}
        />
        {TRACKS_GLOW && (
          <video
            ref={(el) => {
              glowRefs.current[index] = el;
            }}
            className="dash-video dash-video--glow"
            src={station.tracksSrc}
            muted
            playsInline
            loop
            preload="auto"
            disablePictureInPicture
            aria-hidden="true"
            tabIndex={-1}
          />
        )}
      </div>
    </>
  );
}

/* ===========================================================================
 * SEQUENCE MODE — touch / narrow. Same rhythm, no scrubbing: travel plays
 * through when its section arrives, then the tracks dwell loops.
 * ========================================================================= */
function SequenceStation({
  station,
  index,
  onActive,
}: {
  station: StationDef;
  index: number;
  onActive: (i: number) => void;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const travelRef = useRef<HTMLVideoElement>(null);
  const tracksRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<"idle" | "travel" | "tracks">("idle");
  const [inView, setInView] = useState(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting;
        setInView(visible);
        if (visible) {
          onActive(index);
          if (phaseRef.current === "idle") {
            setPhase("travel");
            travelRef.current?.play().catch(() => {
              // autoplay refused: fall straight through to the dwell
              setPhase("tracks");
              tracksRef.current?.play().catch(() => {});
            });
          } else if (phaseRef.current === "tracks") {
            tracksRef.current?.play().catch(() => {});
          }
        } else {
          travelRef.current?.pause();
          tracksRef.current?.pause();
        }
      },
      { threshold: 0.45 },
    );
    io.observe(section);
    return () => io.disconnect();
  }, [index, onActive]);

  const handleEnded = () => {
    setPhase("tracks");
    tracksRef.current?.play().catch(() => {});
  };

  return (
    <section className="dash-seq" ref={sectionRef}>
      <div className="dash-seq__media">
        <video
          ref={travelRef}
          className="dash-video dash-video--travel"
          src={station.travelSrc}
          poster={station.travelPoster}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          onEnded={handleEnded}
          aria-label={`Approach to the ${station.name} side of the Oculus`}
        />
        <video
          ref={tracksRef}
          className="dash-video dash-video--tracks dash-seq__tracks"
          src={station.tracksSrc}
          poster={station.tracksPoster}
          muted
          playsInline
          loop
          preload="auto"
          disablePictureInPicture
          style={{ opacity: phase === "tracks" ? 1 : 0 }}
          aria-label={`Observed movement at the ${station.name} side, played in real time`}
        />
      </div>
      <StationOverlay
        station={station}
        index={index}
        active={phase === "tracks" && inView}
        getVideo={() => tracksRef.current}
        revealedByClass
      />
    </section>
  );
}

function SequenceDashboard() {
  const [active, setActive] = useState(0);
  const needleRef = useRef<SVGGElement>(null);
  const descentRef = useRef<HTMLVideoElement>(null);
  const descentSection = useRef<HTMLElement>(null);
  const [descentDone, setDescentDone] = useState(false);
  const startedRef = useRef(false);

  const handleActive = useCallback((i: number) => setActive(i), []);

  useEffect(() => {
    gsap.to(needleRef.current, {
      rotation: needleAngle(active),
      svgOrigin: "32 32",
      duration: 0.5,
      ease: "power3.out",
    });
  }, [active]);

  useEffect(() => {
    const section = descentSection.current;
    if (!section) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !startedRef.current) {
          startedRef.current = true;
          descentRef.current?.play().catch(() => setDescentDone(true));
        }
      },
      { threshold: 0.5 },
    );
    io.observe(section);
    return () => io.disconnect();
  }, []);

  return (
    <div className="dashboard dashboard--flow">
      {STATIONS.map((s, i) => (
        <SequenceStation key={s.id} station={s} index={i} onActive={handleActive} />
      ))}
      <section className="dash-seq" ref={descentSection}>
        <div className="dash-seq__media">
          <video
            ref={descentRef}
            className="dash-video dash-video--travel"
            src={DESCENT.src}
            poster={DESCENT.poster}
            muted
            playsInline
            preload="auto"
            disablePictureInPicture
            onEnded={() => setDescentDone(true)}
            aria-label="Descending from the plaza into the Oculus interior"
          />
          <img
            className="dash-still"
            style={{ opacity: descentDone ? 1 : 0 }}
            src={INTERIOR_STILL_SRC}
            alt="Inside the Oculus concourse, rendered dark"
          />
        </div>
      </section>
      <InteriorEnd asSection />
      <Compass letter={STATIONS[active]?.compass ?? "W"} needleRef={needleRef} />
    </div>
  );
}

/* ===========================================================================
 * STATIC MODE — reduced motion. Posters + final-state overlays; a manual
 * play control per station starts the real-time dwell (function, not motion).
 * ========================================================================= */
function StaticStation({ station, index }: { station: StationDef; index: number }) {
  const tracksRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    const v = tracksRef.current;
    if (!v) return;
    if (playing) {
      v.pause();
      setPlaying(false);
    } else {
      v.play()
        .then(() => setPlaying(true))
        .catch(() => {});
    }
  };

  return (
    <section className="dash-seq dash-seq--static">
      <div className="dash-seq__media">
        <video
          ref={tracksRef}
          className="dash-video dash-video--tracks"
          src={station.tracksSrc}
          poster={station.tracksPoster}
          muted
          playsInline
          loop
          preload="metadata"
          disablePictureInPicture
          aria-label={`Observed movement at the ${station.name} side, played in real time`}
        />
        <button type="button" className="dash-seq__play" onClick={toggle}>
          {playing ? "Pause" : "Play movement"}
        </button>
      </div>
      <StationOverlay
        station={station}
        index={index}
        active={playing}
        getVideo={() => tracksRef.current}
        revealedByClass
      />
    </section>
  );
}

function StaticDashboard() {
  return (
    <div className="dashboard dashboard--flow dashboard--static">
      {STATIONS.map((s, i) => (
        <StaticStation key={s.id} station={s} index={i} />
      ))}
      <section className="dash-seq">
        <div className="dash-seq__media">
          <img className="dash-still" src={INTERIOR_STILL_SRC} alt="Inside the Oculus concourse, rendered dark" />
        </div>
      </section>
      <InteriorEnd asSection />
    </div>
  );
}

/* ===========================================================================
 * Entry — resolves the mode once, re-resolves across the 768px boundary.
 * Owns the scroll-up-at-top return to the Overview (FIX 6).
 * ========================================================================= */
interface DashboardScrollProps {
  /** Fired when the user scrolls up past the dashboard's top. */
  onReturn?: () => void;
}

export default function DashboardScroll({ onReturn }: DashboardScrollProps) {
  const [mode, setMode] = useState<Mode>(() => resolveMode());
  const onReturnRef = useRef(onReturn);
  onReturnRef.current = onReturn;

  useEffect(() => {
    let timer: number | undefined;
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setMode((m) => {
          const next = resolveMode();
          return next === m ? m : next;
        });
      }, 150);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(timer);
    };
  }, []);

  // scrolling up at the very top hands back to the Overview (which plays the
  // retract in reverse). Armed after a beat so entry momentum can't fire it;
  // accumulating decaying deltas so one stray tick can't either.
  useEffect(() => {
    let armed = false;
    let fired = false;
    const armTimer = window.setTimeout(() => (armed = true), 600);
    const acc = { v: 0, t: 0 };
    const onWheel = (e: WheelEvent) => {
      if (!armed || fired || !onReturnRef.current) return;
      if (window.scrollY > 2 || e.deltaY >= 0) {
        acc.v = 0;
        return;
      }
      const now = performance.now();
      if (now - acc.t > 600) acc.v = 0;
      acc.t = now;
      acc.v += -e.deltaY;
      if (acc.v > 140) {
        fired = true;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduced) {
          onReturnRef.current?.();
          return;
        }
        // retreat into black — mirrors the entry handoff, then swap
        gsap.to(".dashboard", {
          opacity: 0,
          duration: 0.28,
          ease: "power2.in",
          onComplete: () => onReturnRef.current?.(),
        });
      }
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.clearTimeout(armTimer);
      window.removeEventListener("wheel", onWheel);
    };
  }, []);

  if (mode === "scrub") return <ScrubDashboard />;
  if (mode === "sequence") return <SequenceDashboard />;
  return <StaticDashboard />;
}
