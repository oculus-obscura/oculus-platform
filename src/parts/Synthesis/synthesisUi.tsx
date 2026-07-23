/**
 * synthesisUi — the prototype's icon set and SVG donut, as React atoms.
 * Path data and donut geometry are verbatim from oculus_synthesis.html.
 * Plus SegmentedControl — Part A's ONE control component for every filter
 * across the aggregate views.
 */

const ICON_PATHS: Record<string, string> = {
  bag: '<path d="M6 8h12l-1 13H7L6 8z"/><path d="M9 8V6a3 3 0 016 0v2"/>',
  bagcheck: '<path d="M6 8h12l-1 13H7L6 8z"/><path d="M9 8V6a3 3 0 016 0v2"/><path d="M9.5 14.5l2 2 3.5-3.5"/>',
  xcircle: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  stairs: '<path d="M4 19h4v-4h4v-4h4V7h4"/>',
  dollar:
    '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M14.5 9.2C14 8.3 13 8 12 8c-1.4 0-2.5.8-2.5 2s1.1 1.8 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.3-2.5-1.2"/>',
  bars: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14v-2M12 14v-4M15.5 14v-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  people:
    '<circle cx="8.5" cy="7" r="2.4"/><circle cx="15.5" cy="7" r="2.4"/><path d="M4.5 19v-2a3 3 0 013-3h2a3 3 0 013 3M11.5 19v-2a3 3 0 013-3h2a3 3 0 013 3"/>',
  exit: '<path d="M14 4H6v16h8"/><path d="M11 12h9M16 8l4 4-4 4"/>',
  cup: '<path d="M6 8h11v5a5 5 0 01-5 5H11a5 5 0 01-5-5V8z"/><path d="M17 9h2a2 2 0 010 4h-2"/><path d="M8 4v1M11 4v1M14 4v1"/>',
  bulb: '<circle cx="12" cy="10" r="6"/><path d="M9.5 19h5M10 22h4"/>',
  star: '<path d="M12 3l2.6 5.6 6 .7-4.4 4.1 1.2 5.9L12 16.9 6.6 19.3l1.2-5.9L3.4 9.3l6-.7L12 3z"/>',
  tag: '<path d="M4 12V5a1 1 0 011-1h7l8 8-8 8-8-8z"/><circle cx="8.5" cy="8.5" r="1.4"/>',
  trend: '<circle cx="12" cy="12" r="9"/><path d="M7 14l3-3 2 2 5-5M14 5h3v3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  building:
    '<path d="M5 21V5a1 1 0 011-1h6a1 1 0 011 1v16M13 21V9h5a1 1 0 011 1v11M8 8h2M8 12h2M8 16h2"/>',
  arch: '<path d="M5 21V11a7 7 0 0114 0v10M9 21v-9a3 3 0 016 0v9"/>',
  tower: '<path d="M12 3l3 5v13H9V8l3-5zM9 12h6M9 16h6"/>',
  pool: '<path d="M4 20V8l8-4 8 4v12M4 12h16M12 4v16"/>',
};

export function Icon({ name, sz = 24, sw = 1.6 }: { name: string; sz?: number; sw?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={sz}
      height={sz}
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] || "" }}
    />
  );
}

/**
 * SegmentedControl — Part A's unified control language. Every filter across
 * the aggregate views uses this one component: a small tracked-caps group
 * label over a hairline segmented pill on dark glass. Active option fills
 * shell teal with Titanium Pearl text; inactive options stay readable muted.
 * Styling lives in synthesisView.css (.syn-ctl / .syn-ctl__seg).
 */
export function SegmentedControl<V extends string | number>({
  label,
  options,
  value,
  onChange,
  className,
  labelHidden = false,
}: {
  label: string;
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
  className?: string;
  /** Omit the visible caps label (e.g. when the panel title already names the
   *  group) — the accessible group label is kept either way. */
  labelHidden?: boolean;
}) {
  return (
    <div className={"syn-ctl" + (className ? " " + className : "")}>
      {!labelHidden && <span className="syn-ctl__label">{label}</span>}
      <div className="syn-ctl__seg" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            className={o.value === value ? "on" : ""}
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export interface DonutSeg {
  value: number;
  color: string;
}

export function Donut({
  segs,
  size,
  thick,
  centerTop,
  centerVal,
}: {
  segs: DonutSeg[];
  size: number;
  thick: number;
  centerTop?: string | null;
  centerVal?: string | null;
}) {
  const total = segs.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - thick) / 2,
    cx = size / 2,
    cy = size / 2,
    C = 2 * Math.PI * r;
  let off = 0;
  const rings = segs.map((s, i) => {
    const len = (s.value / total) * C;
    const el = (
      <circle
        key={i}
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={s.color}
        strokeWidth={thick}
        strokeDasharray={`${len} ${C - len}`}
        strokeDashoffset={-off}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    );
    off += len;
    return el;
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rings}
      {centerTop != null && (
        <>
          <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--titanium-pearl)" fontSize="13" letterSpacing="1" fontFamily="Space Grotesk">
            {centerTop}
          </text>
          <text className="num" x={cx} y={cy + 16} textAnchor="middle" fill="var(--titanium-pearl)" fontSize="22" fontWeight="600" fontFamily="Space Grotesk">
            {centerVal}
          </text>
        </>
      )}
    </svg>
  );
}
