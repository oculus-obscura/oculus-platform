import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import IntroSequence from "./parts/Intro/IntroSequence";
import PlatformChrome, { type PlatformView } from "./components/PlatformChrome/PlatformChrome";
import TurntableView, {
  TURNTABLE_POSTER_SRC,
  TURNTABLE_VIDEO_SRC,
} from "./parts/Turntable/TurntableView";
import DashboardScroll from "./parts/Dashboard/DashboardScroll";
import SimulationGame, { type CompletedSession } from "./parts/Simulation/SimulationGame";
import SynthesisView from "./parts/Synthesis/SynthesisView";
import LeaveConfirm from "./components/LeaveConfirm/LeaveConfirm";
import { STATIONS } from "./parts/Dashboard/stationData";

gsap.registerPlugin(ScrollTrigger);

/** The full intro animation plays once per tab session. */
const SEEN_KEY = "oculus:hasSeenIntro";
/** The overview sequence (turntable + ledger write-in) locks scroll once per session. */
const SEQ_KEY = "oculus:hasSeenOverviewSequence";

function readSessionFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false; // storage unavailable (private mode) — just replay
  }
}

function writeSessionFlag(key: string) {
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    /* private mode — flag just won't persist */
  }
}

export default function App() {
  const [view, setView] = useState<PlatformView>("intro");
  const [hasSeenIntro, setHasSeenIntro] = useState(() => readSessionFlag(SEEN_KEY));
  // first Overview arrival locks scroll while the sequence plays; afterwards
  // the overview always renders settled
  const [hasSeenSequence, setHasSeenSequence] = useState(() => readSessionFlag(SEQ_KEY));
  // While true, the intro stays mounted as an overlay above the overview so
  // the hero title can fly (FLIP) to the TitleMark, which renders as a ghost.
  const [transitioning, setTransitioning] = useState(false);
  // Overview → dashboard runs the retract exit first; this holds the target
  // while the overview un-writes itself, then the swap happens on black.
  const [leaving, setLeaving] = useState<PlatformView | null>(null);
  // How the overview is being entered: "return" (scrolled back up from the
  // dashboard) plays the retract in reverse — the record writes back in.
  const [overviewEntry, setOverviewEntry] = useState<"normal" | "return">("normal");
  // How the simulation is entered: "handoff" (dashboard's interior still →
  // match cut) or "direct" (nav item — plain mount at the start screen).
  const [simEntry, setSimEntry] = useState<"direct" | "handoff">("direct");
  // True while a game round is running (timer live). Navigating away then
  // needs confirmation — the round would be discarded, not recorded.
  const [simRoundActive, setSimRoundActive] = useState(false);
  // The navigation target held while the leave-confirm dialog is open.
  const [pendingLeave, setPendingLeave] = useState<PlatformView | null>(null);
  // The most recent COMPLETED simulation round (ordered, in-memory only — a
  // refresh clears it). Feeds Synthesis View 1 in Step 2; each new completed
  // round replaces it. Abandoned rounds never set it.
  const [lastSession, setLastSession] = useState<CompletedSession | null>(null);
  const lenisRef = useRef<Lenis | null>(null);

  // Lenis smooth scroll — normalises mouse-wheel vs trackpad deltas so the
  // dashboard scrub feels the same on both. Driven from GSAP's ticker per the
  // ScrollTrigger integration recipe. Touch keeps native momentum (syncTouch
  // off); reduced motion keeps native scrolling entirely.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({
      lerp: 0.09,
      smoothWheel: true,
      wheelMultiplier: 1,
      syncTouch: false,
    });
    lenisRef.current = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    ScrollTrigger.refresh();
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  // Warm the turntable assets while the intro plays so the transition never
  // pops: poster into the image cache, video buffering via a detached element.
  useEffect(() => {
    const img = new Image();
    img.src = TURNTABLE_POSTER_SRC;
    const warm = document.createElement("video");
    warm.preload = "auto";
    warm.muted = true;
    warm.src = TURNTABLE_VIDEO_SRC;
  }, []);

  // …and warm the dashboard's opening leg while the user is on the overview,
  // so the retract hands directly into an already-decodable first frame.
  useEffect(() => {
    if (view !== "overview") return;
    const img = new Image();
    img.src = STATIONS[0].travelPoster;
    const warm = document.createElement("video");
    warm.preload = "auto";
    warm.muted = true;
    warm.src = STATIONS[0].travelSrc;
  }, [view]);

  // …and warm the game's assets while the user walks the dashboard, so the
  // "Enter the Simulation" match cut composites over an already-decoded frame.
  useEffect(() => {
    if (view !== "dashboard") return;
    for (const src of ["/images/game/bg.jpg", "/images/game/oculus-train.png", "/images/game/skip-hand.png"]) {
      const img = new Image();
      img.src = src;
    }
  }, [view]);

  // each view owns its own scroll world — reset on swap (through Lenis when
  // it's active, so its internal target can't fight the jump)
  useEffect(() => {
    const lenis = lenisRef.current;
    if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
    else window.scrollTo(0, 0);
  }, [view]);

  const handleEnter = useCallback(() => {
    writeSessionFlag(SEEN_KEY);
    setHasSeenIntro(true);
    setOverviewEntry("normal");
    setView("overview");
    setTransitioning(true); // intro remains mounted on top until the flight lands
  }, []);

  const handleSequenceDone = useCallback(() => {
    writeSessionFlag(SEQ_KEY);
    setHasSeenSequence(true);
  }, []);

  const handleExited = useCallback(() => setTransitioning(false), []);

  const handleNavigate = useCallback(
    (next: PlatformView) => {
      if (next === view) return;
      // Mid-round, leaving the simulation needs a confirm — the round is
      // discarded, never part-saved. The timer keeps running underneath.
      if (view === "simulation" && simRoundActive) {
        setPendingLeave(next);
        return;
      }
      if (view === "overview" && next === "dashboard") {
        setLeaving("dashboard"); // TurntableView retracts, then onRetracted swaps
        return;
      }
      if (next === "overview") setOverviewEntry("normal");
      if (next === "simulation") setSimEntry("direct");
      setView(next);
    },
    [view, simRoundActive],
  );

  const handleRetracted = useCallback(() => {
    setLeaving((target) => {
      if (target) setView(target);
      return null;
    });
  }, []);

  const handleAdvance = useCallback(() => handleNavigate("dashboard"), [handleNavigate]);

  // scrolling up from the dashboard's top: the record writes back in
  const handleDashboardReturn = useCallback(() => {
    setOverviewEntry("return");
    setView("overview");
  }, []);

  // the dashboard's end card → the game, backgrounds match-cut on the still
  const handleEnterSimulation = useCallback(() => {
    setSimEntry("handoff");
    setView("simulation");
  }, []);

  const handleLeaveStay = useCallback(() => setPendingLeave(null), []);

  // LEAVE: the game unmounts (its cleanup stops the clock), the session is
  // discarded — nothing is written — and the requested section opens.
  const handleLeaveConfirm = useCallback(() => {
    if (pendingLeave) {
      setSimRoundActive(false);
      if (pendingLeave === "overview") setOverviewEntry("normal");
      setView(pendingLeave);
    }
    setPendingLeave(null);
  }, [pendingLeave]);

  return (
    <>
      {view === "overview" && (
        <PlatformChrome
          key="overview"
          // the nav indicator slides to the target DURING the retract
          currentView={leaving ?? "overview"}
          onNavigate={handleNavigate}
          markGhost={transitioning}
        >
          <TurntableView
            // "sequence" only on the very first arrival this session: scroll
            // locks while the record writes itself; every later visit settles
            entry={
              overviewEntry === "return" ? "return" : hasSeenSequence ? "settled" : "sequence"
            }
            lenis={lenisRef}
            onSequenceDone={handleSequenceDone}
            onAdvance={handleAdvance}
            retracting={leaving === "dashboard"}
            onRetracted={handleRetracted}
          />
        </PlatformChrome>
      )}
      {view === "dashboard" && (
        // scrim: the nav needs separation from the bright graded video here
        <PlatformChrome key="dashboard" currentView="dashboard" onNavigate={handleNavigate} scrim>
          <DashboardScroll onReturn={handleDashboardReturn} onEnterSimulation={handleEnterSimulation} />
        </PlatformChrome>
      )}
      {view === "simulation" && (
        // scrim: same treatment — the nav sits over the bright interior photo
        <PlatformChrome key="simulation" currentView="simulation" onNavigate={handleNavigate} scrim>
          <SimulationGame
            entry={simEntry}
            onRoundActiveChange={setSimRoundActive}
            onExitToSynthesis={() => setView("synthesis")}
            onSessionComplete={setLastSession}
          />
        </PlatformChrome>
      )}
      {view === "synthesis" && (
        <PlatformChrome key="synthesis" currentView="synthesis" onNavigate={handleNavigate}>
          <SynthesisView
            lastSession={lastSession}
            onPlaySimulation={() => {
              setSimEntry("direct");
              setView("simulation");
            }}
          />
        </PlatformChrome>
      )}
      {pendingLeave !== null && <LeaveConfirm onStay={handleLeaveStay} onLeave={handleLeaveConfirm} />}
      {(view === "intro" || transitioning) && (
        <IntroSequence
          key="intro"
          animate={!hasSeenIntro}
          onEnter={handleEnter}
          onExited={handleExited}
        />
      )}
    </>
  );
}
