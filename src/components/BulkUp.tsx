"use client";

/**
 * The app's signature illustration: a barbell that loads up with weight
 * plates as the day's progress increases, used inside the growth ring on
 * the dashboard. Stages: empty bar -> light load -> heavy load -> full pump.
 */
export function BulkUp({ progress, className }: { progress: number; className?: string }) {
  const p = Math.min(1, Math.max(0, progress));
  const plateScale = 0.35 + p * 0.75;
  const plateOpacity = p < 0.05 ? 0 : 0.45 + p * 0.55;
  const maxedOut = p > 0.85;

  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      {/* floor shadow */}
      <ellipse cx="50" cy="82" rx="24" ry="5" className="fill-nova-800/10 dark:fill-nova-100/10" />

      {/* completion glow */}
      <circle
        cx="50"
        cy="50"
        r="34"
        className="fill-aurora-400"
        style={{
          opacity: maxedOut ? 0.18 : 0,
          transition: "opacity 300ms ease",
        }}
      />

      {/* bar */}
      <rect x="26" y="47" width="48" height="6" rx="3" className="fill-nova-600 dark:fill-nova-300" />

      {/* left weight plates, small -> large as progress fills in */}
      <g
        style={{
          transformOrigin: "26px 50px",
          transform: `scale(${plateScale})`,
          opacity: plateOpacity,
          transition: "transform 300ms ease, opacity 300ms ease",
        }}
      >
        <rect x="14" y="34" width="10" height="32" rx="3" className="fill-nova-400 dark:fill-nova-300" />
        <rect x="24" y="40" width="6" height="20" rx="2" className="fill-nova-500 dark:fill-nova-400" />
      </g>

      {/* right weight plates, mirrored */}
      <g
        style={{
          transformOrigin: "74px 50px",
          transform: `scale(${plateScale})`,
          opacity: plateOpacity,
          transition: "transform 300ms ease, opacity 300ms ease",
        }}
      >
        <rect x="76" y="34" width="10" height="32" rx="3" className="fill-nova-400 dark:fill-nova-300" />
        <rect x="70" y="40" width="6" height="20" rx="2" className="fill-nova-500 dark:fill-nova-400" />
      </g>

      {/* pump spark, appears near completion */}
      <g
        style={{
          transformOrigin: "50px 50px",
          transform: `scale(${p > 0.75 ? (p - 0.75) * 4 : 0})`,
          opacity: p > 0.75 ? 1 : 0,
          transition: "transform 300ms ease, opacity 300ms ease",
        }}
      >
        <circle cx="50" cy="24" r="5" className="fill-aurora-400" />
      </g>

      {/* empty collars, visible at the very start before any plates are loaded */}
      {p < 0.08 && (
        <>
          <circle cx="20" cy="50" r="3" className="fill-nova-700 dark:fill-nova-200" />
          <circle cx="80" cy="50" r="3" className="fill-nova-700 dark:fill-nova-200" />
        </>
      )}
    </svg>
  );
}
