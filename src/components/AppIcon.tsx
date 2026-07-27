/**
 * Theme-aware app logo/icon.
 *
 * Renders all three theme variants stacked on top of one another and lets
 * CSS (see the ".app-icon" rules in globals.css) show whichever one matches
 * the current theme class on <html> (none = light, ".dark" = cosmic,
 * ".princess" = princess). This avoids any flash-of-wrong-icon on load and
 * needs no JS/store access, so it works even before settings are ready
 * (e.g. in the splash screen).
 *
 * Drop the matching files into /public as:
 *   /Icon_Light.svg      (nova-700 #5a32c9)
 *   /Icon_Dark.svg       (nova-400 #8a6cf5)
 *   /Icon_Princess.svg   (princess nova-500 #f4429e)
 */
export function AppIcon({ className = "", alt = "BodyBuddy" }: { className?: string; alt?: string }) {
  return (
    <span className={`app-icon relative inline-block overflow-hidden ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/Icon_Light.svg" alt={alt} className="app-icon-light absolute inset-0 h-full w-full object-contain" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/Icon_Dark.svg" alt={alt} className="app-icon-dark absolute inset-0 h-full w-full object-contain" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/Icon_Princess.svg" alt={alt} className="app-icon-princess absolute inset-0 h-full w-full object-contain" />
    </span>
  );
}
