/**
 * SynNav — the persistent bottom-centre navigation cluster for the Synthesis
 * section (Part A of the UI overhaul). This is CHROME: teal-monochrome glass
 * on its own surface so it can never blend into whatever sits behind it. It
 * replaces the prototype's in-view arrows, which read as content.
 *
 *     ‹    ● ○ ○ ○    ›
 *         SYNTHESIS
 *
 * - arrows page the view sequence and disable at the ends (never a dead click)
 * - dots are clickable for direct jumps; the active dot fills teal
 * - ← / → keys work anywhere in the section, except while a <select>/input
 *   has focus (arrows edit those) or the View-2 tutorial spotlight is open
 * - a one-time hint fades on first arrival (per session)
 * - handles the variable view count (4 views with a session, 3 without)
 * - tap targets are 44px minimum, real pixels — the cluster lives outside the
 *   scaled stage
 */
import { useEffect, useRef, useState } from "react";

export interface SynNavView {
  id: 1 | 2 | 3 | 4;
  name: string;
}

const HINT_KEY = "oculus:synNavHint";

interface SynNavProps {
  views: SynNavView[];
  current: 1 | 2 | 3 | 4;
  onSelect: (id: 1 | 2 | 3 | 4) => void;
}

export default function SynNav({ views, current, onSelect }: SynNavProps) {
  const idx = views.findIndex((v) => v.id === current);
  const prev = idx > 0 ? views[idx - 1] : null;
  const next = idx >= 0 && idx < views.length - 1 ? views[idx + 1] : null;

  // one-time keyboard hint, first Synthesis arrival per session
  const [hint, setHint] = useState(() => {
    try {
      return !sessionStorage.getItem(HINT_KEY);
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (!hint) return;
    try {
      sessionStorage.setItem(HINT_KEY, "1");
    } catch {
      /* private mode — the hint just shows again next time */
    }
    const t = window.setTimeout(() => setHint(false), 5200); // matches synHintLife
    return () => clearTimeout(t);
    // mount-only: the hint's lifetime starts at first arrival
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keyboard paging — read latest neighbours through a ref so the listener
  // binds once
  const stateRef = useRef({ prev, next, onSelect });
  stateRef.current = { prev, next, onSelect };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && t.closest("select, input, textarea")) return; // arrows edit those
      if (document.querySelector(".syn .syn-tutorial")) return; // spotlight owns the stage
      const s = stateRef.current;
      const go = e.key === "ArrowLeft" ? s.prev : s.next;
      if (go) {
        e.preventDefault();
        s.onSelect(go.id);
        setHint(false); // the hint has served its purpose
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="syn-navrow">
      <nav className="syn-nav glass" aria-label="Synthesis views">
        {hint && (
          <div className="syn-nav__hint" role="status">
            ← → arrow keys move between views
          </div>
        )}
        <div className="syn-nav__row">
          <button
            type="button"
            className="syn-nav__arrow"
            disabled={!prev}
            aria-label={prev ? `Back to ${prev.name}` : "No previous view"}
            onClick={prev ? () => onSelect(prev.id) : undefined}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <div className="syn-nav__dots">
            {views.map((v) => (
              <button
                key={v.id}
                type="button"
                className={"syn-nav__dot" + (v.id === current ? " on" : "")}
                aria-label={`Go to ${v.name}`}
                aria-current={v.id === current || undefined}
                onClick={v.id === current ? undefined : () => onSelect(v.id)}
              >
                <span aria-hidden="true" />
              </button>
            ))}
          </div>
          <button
            type="button"
            className="syn-nav__arrow"
            disabled={!next}
            aria-label={next ? `Forward to ${next.name}` : "No next view"}
            onClick={next ? () => onSelect(next.id) : undefined}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div className="syn-nav__name">{idx >= 0 ? views[idx].name : ""}</div>
      </nav>
    </div>
  );
}
