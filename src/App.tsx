import { useCallback, useEffect, useState } from "react";
import IntroSequence from "./parts/Intro/IntroSequence";
import PlatformChrome, { type PlatformView } from "./components/PlatformChrome/PlatformChrome";
import TurntableView, {
  TURNTABLE_POSTER_SRC,
  TURNTABLE_VIDEO_SRC,
} from "./parts/Turntable/TurntableView";

/** The full intro animation plays once per tab session. */
const SEEN_KEY = "oculus:hasSeenIntro";

function readHasSeenIntro(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false; // storage unavailable (private mode) — just replay
  }
}

export default function App() {
  const [view, setView] = useState<PlatformView>("intro");
  const [hasSeenIntro, setHasSeenIntro] = useState(readHasSeenIntro);
  // While true, the intro stays mounted as an overlay above the overview so
  // the hero title can fly (FLIP) to the TitleMark, which renders as a ghost.
  const [transitioning, setTransitioning] = useState(false);

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

  const handleEnter = useCallback(() => {
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* private mode — session flag just won't persist */
    }
    setHasSeenIntro(true);
    setView("overview");
    setTransitioning(true); // intro remains mounted on top until the flight lands
  }, []);

  const handleExited = useCallback(() => setTransitioning(false), []);

  // Chrome navigation — 'intro' comes from the TitleMark (fully-formed title
  // page, no replay); other views arrive as their parts are built.
  const handleNavigate = useCallback((next: PlatformView) => setView(next), []);

  return (
    <>
      {view === "overview" && (
        <PlatformChrome
          key="overview"
          currentView="overview"
          onNavigate={handleNavigate}
          markGhost={transitioning}
        >
          <TurntableView />
        </PlatformChrome>
      )}
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
