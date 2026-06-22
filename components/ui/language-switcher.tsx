"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "@/lib/i18n/use-translations";
import { LOCALE_LABELS, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/config";
import { ChevronDown, Globe } from "lucide-react";

export function LanguageSwitcher() {
  const { locale, setLocale, isLoading } = useTranslations();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentLabel = LOCALE_LABELS[locale];

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={isLoading}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-all text-xs font-semibold disabled:opacity-50"
        aria-label="Switch language"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Globe className="w-3.5 h-3.5 text-slate-500" />
        <span>{currentLabel?.flag}</span>
        <span className="hidden sm:inline">{currentLabel?.label}</span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-2 w-44 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2"
        >
          {SUPPORTED_LOCALES.map(loc => {
            const cfg = LOCALE_LABELS[loc];
            const isActive = loc === locale;
            return (
              <button
                key={loc}
                role="option"
                aria-selected={isActive}
                onClick={() => { setLocale(loc as Locale); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700 font-bold"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="text-base">{cfg.flag}</span>
                <span>{cfg.label}</span>
                {isActive && <span className="ml-auto text-indigo-500 text-xs">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
