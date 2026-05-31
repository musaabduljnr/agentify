"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * NavigationLoader
 *
 * Renders a circular indeterminate spinner fixed in the top-right corner
 * whenever a Next.js App Router navigation is in-flight. It detects the
 * start of a navigation by intercepting link/button clicks, and clears
 * itself once the pathname actually changes (i.e. the new page has rendered).
 */
export function NavigationLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const prevPathRef = useRef(pathname + searchParams.toString());

  // Detect click on any <a> that triggers a client-side navigation
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      // Only intercept internal links (not anchors, external, or mailto)
      const isInternal =
        href.startsWith("/") &&
        !href.startsWith("//") &&
        !target.getAttribute("target");

      if (isInternal && href !== pathname) {
        setLoading(true);
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname]);

  // Clear loader once the route finishes rendering
  useEffect(() => {
    const current = pathname + searchParams.toString();
    if (current !== prevPathRef.current) {
      prevPathRef.current = current;
      setLoading(false);
    }
  }, [pathname, searchParams]);

  // Safety net: cap the spinner at 8 s so it never gets stuck
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setLoading(false), 8000);
    return () => clearTimeout(timer);
  }, [loading]);

  if (!loading) return null;

  return (
    <div
      aria-label="Page loading"
      role="status"
      className="fixed bottom-6 right-6 z-[9999] flex items-center gap-3
                 bg-white/90 backdrop-blur-md border border-slate-200
                 shadow-xl shadow-indigo-100/40 rounded-2xl px-4 py-3
                 animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      {/* Circular SVG spinner */}
      <div className="relative h-6 w-6 shrink-0">
        <svg
          className="h-6 w-6 -rotate-90"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          {/* Track ring */}
          <circle
            cx="12"
            cy="12"
            r="9"
            strokeWidth="2.5"
            stroke="#e2e8f0"
          />
          {/* Animated progress arc */}
          <circle
            cx="12"
            cy="12"
            r="9"
            strokeWidth="2.5"
            stroke="url(#loader-grad)"
            strokeLinecap="round"
            strokeDasharray="56.5"
            strokeDashoffset="14"
            className="animate-[spin_0.9s_linear_infinite] origin-center"
            style={{ transformOrigin: "12px 12px" }}
          />
          <defs>
            <linearGradient id="loader-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <span className="text-xs font-bold text-slate-500 tracking-wide whitespace-nowrap">
        Loading…
      </span>
    </div>
  );
}
