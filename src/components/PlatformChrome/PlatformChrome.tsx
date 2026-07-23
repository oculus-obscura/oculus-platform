/**
 * PlatformChrome — the shared navigation chrome for every post-intro part.
 *
 * Fixed top bar: TitleMark left (reused component — returns to 'intro'),
 * section nav right, both on the same optical level. Page content renders
 * beneath as children. The intro/title page renders WITHOUT this chrome —
 * it stays full-bleed.
 *
 * Shell chrome rules (DESIGN.md): teal monochrome only — no data colors here.
 * Not-yet-built sections render visibly disabled (the DESIGN.md locked
 * pattern); shipping one later is a one-line change: flip its `enabled` flag.
 *
 * The active-item underline slides between items on view change (left/width
 * transition, measured from the label, re-measured by ResizeObserver so it
 * survives fluid-type resizes).
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import TitleMark from "../TitleMark";
import "./platformChrome.css";

export type PlatformView = "intro" | "overview" | "dashboard" | "simulation" | "synthesis";

interface NavItem {
  label: string;
  view: PlatformView;
  /** Flip to true when the part ships — nothing else to change. */
  enabled: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", view: "overview", enabled: true },
  { label: "Data Dashboard", view: "dashboard", enabled: true },
  { label: "Simulation", view: "simulation", enabled: true },
  { label: "Synthesis", view: "synthesis", enabled: true },
];

interface PlatformChromeProps {
  currentView: PlatformView;
  onNavigate: (view: PlatformView) => void;
  /** Render the TitleMark invisibly (FLIP landing target during the enter flight). */
  markGhost?: boolean;
  /**
   * Top scrim beneath the bar — for views that sit over video/bright imagery
   * (the dashboard). Leave off over dark grounds like the overview.
   */
  scrim?: boolean;
  children: ReactNode;
}

export default function PlatformChrome({
  currentView,
  onNavigate,
  markGhost = false,
  scrim = false,
  children,
}: PlatformChromeProps) {
  const listRef = useRef<HTMLUListElement>(null);
  // ready gates the transition off for the very first placement (no slide-in)
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const update = () => {
      const label = list.querySelector<HTMLElement>('[data-active="true"] .pc-nav__label');
      if (!label) {
        setIndicator((s) => ({ ...s, width: 0 }));
        return;
      }
      const listRect = list.getBoundingClientRect();
      const rect = label.getBoundingClientRect();
      // content coordinates (indicator lives inside the scrollable list)
      setIndicator({
        left: rect.left - listRect.left + list.scrollLeft,
        width: rect.width,
        ready: true,
      });
    };
    update();
    const ro = new ResizeObserver(update); // fluid type/gaps change label widths
    ro.observe(list);
    return () => ro.disconnect();
  }, [currentView]);

  return (
    <div className="platform-chrome">
      {scrim && <div className="platform-chrome__scrim" aria-hidden="true" />}
      <header className="platform-chrome__bar">
        <TitleMark ghost={markGhost} onClick={() => onNavigate("intro")} />
        <nav className="pc-nav" aria-label="Platform sections">
          <ul className="pc-nav__list" ref={listRef}>
            {NAV_ITEMS.map((item) => {
              const active = item.view === currentView;
              return (
                <li key={item.view} className="pc-nav__li">
                  <button
                    type="button"
                    className="pc-nav__item"
                    data-active={active || undefined}
                    aria-current={active ? "page" : undefined}
                    disabled={!item.enabled}
                    aria-disabled={!item.enabled || undefined}
                    onClick={item.enabled && !active ? () => onNavigate(item.view) : undefined}
                  >
                    <span className="pc-nav__label">{item.label}</span>
                  </button>
                </li>
              );
            })}
            <span
              className="pc-nav__indicator"
              aria-hidden="true"
              style={{
                left: indicator.left,
                width: indicator.width,
                transition: indicator.ready ? undefined : "none",
              }}
            />
          </ul>
        </nav>
      </header>
      {children}
    </div>
  );
}
