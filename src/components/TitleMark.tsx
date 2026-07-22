/**
 * TitleMark — the small persistent "OCULUS OBSCURA" wordmark.
 *
 * Rendered inside PlatformChrome's top bar on every post-intro view (the bar
 * owns its placement). Clicking it returns to the title page (fully formed,
 * no intro replay — the parent passes animate={false} there).
 *
 * It is also the landing target of the intro→turntable FLIP flight: the flying
 * hero title ends exactly on `.title-mark__text`, so that span's font, size,
 * letter-spacing (0.06em) and line-height (1.08, matching the hero) must not
 * drift — the invisible swap depends on them.
 *
 * `ghost` renders it invisible but still laid out, so the flight can measure
 * its rect before the real mark is shown.
 */
import "./titleMark.css";

interface TitleMarkProps {
  onClick: () => void;
  /** Invisible but measurable — the FLIP target during the enter transition. */
  ghost?: boolean;
}

export default function TitleMark({ onClick, ghost = false }: TitleMarkProps) {
  return (
    <button
      type="button"
      className="title-mark"
      style={ghost ? { visibility: "hidden" } : undefined}
      aria-hidden={ghost || undefined}
      tabIndex={ghost ? -1 : undefined}
      aria-label="Back to title"
      onClick={onClick}
    >
      <span className="title-mark__text">OCULUS OBSCURA</span>
    </button>
  );
}
