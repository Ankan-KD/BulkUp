"use client";

/**
 * The app's signature illustration: a sprout that fills in and grows fuller
 * leaves as the day's progress increases, used inside the growth ring on
 * the dashboard. Stages: seed -> sprout -> budding -> full leaf.
 */
export function Sprout({ progress, className }: { progress: number; className?: string }) {
  const p = Math.min(1, Math.max(0, progress));
  const stemHeight = 10 + p * 26;
  const leafScale = 0.3 + p * 0.8;
  const leafOpacity = p < 0.05 ? 0 : 0.4 + p * 0.6;

  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      {/* soil mound */}
      <ellipse cx="50" cy="82" rx="22" ry="6" className="fill-nova-800/10 dark:fill-nova-100/10" />
      {/* stem */}
      <line
        x1="50"
        y1="82"
        x2="50"
        y2={82 - stemHeight}
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="text-nova-600 dark:text-nova-300"
      />
      {/* left leaf */}
      <g
        style={{
          transformOrigin: `50px ${82 - stemHeight * 0.55}px`,
          transform: `scale(${leafScale})`,
          opacity: leafOpacity,
          transition: "transform 300ms ease, opacity 300ms ease",
        }}
      >
        <path
          d={`M50,${82 - stemHeight * 0.55} C 32,${78 - stemHeight * 0.6} 26,${64 - stemHeight * 0.5} 40,${58 - stemHeight * 0.45} C 46,${68 - stemHeight * 0.5} 49,${75 - stemHeight * 0.55} 50,${82 - stemHeight * 0.55} Z`}
          className="fill-nova-400 dark:fill-nova-300"
        />
      </g>
      {/* right leaf */}
      <g
        style={{
          transformOrigin: `50px ${82 - stemHeight * 0.8}px`,
          transform: `scale(${leafScale})`,
          opacity: leafOpacity,
          transition: "transform 300ms ease, opacity 300ms ease",
        }}
      >
        <path
          d={`M50,${82 - stemHeight * 0.8} C 68,${76 - stemHeight * 0.85} 74,${62 - stemHeight * 0.7} 60,${56 - stemHeight * 0.65} C 54,${66 - stemHeight * 0.7} 51,${73 - stemHeight * 0.8} 50,${82 - stemHeight * 0.8} Z`}
          className="fill-nova-500 dark:fill-nova-400"
        />
      </g>
      {/* top bud / leaf, appears near completion */}
      <g
        style={{
          transformOrigin: `50px ${82 - stemHeight}px`,
          transform: `scale(${p > 0.75 ? (p - 0.75) * 4 : 0})`,
          opacity: p > 0.75 ? 1 : 0,
          transition: "transform 300ms ease, opacity 300ms ease",
        }}
      >
        <circle cx="50" cy={82 - stemHeight - 4} r="6" className="fill-aurora-400" />
      </g>
      {/* seed, visible at very start */}
      {p < 0.08 && (
        <ellipse cx="50" cy="80" rx="4" ry="5" className="fill-nova-700 dark:fill-nova-200" />
      )}
    </svg>
  );
}
