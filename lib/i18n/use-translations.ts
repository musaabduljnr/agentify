"use client";

import { useState, useEffect, useCallback } from "react";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale, isValidLocale } from "./config";
import type { Dictionary } from "./get-dictionary";

const STORAGE_KEY = "agentify_locale";

/** Reads the locale from localStorage, defaulting to 'en'. */
function getStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isValidLocale(stored)) return stored;
  } catch {
    // Ignore storage errors
  }
  return DEFAULT_LOCALE;
}

/** Writes locale preference to localStorage. */
function setStoredLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Ignore storage errors
  }
}

/** Module-level dictionary cache to avoid repeated dynamic imports. */
const dictionaryCache: Partial<Record<Locale, Dictionary>> = {};

async function loadDictionary(locale: Locale): Promise<Dictionary> {
  if (dictionaryCache[locale]) return dictionaryCache[locale]!;

  const dict = await import(`./dictionaries/${locale}.json`).then(m => m.default);
  dictionaryCache[locale] = dict;
  return dict;
}

/**
 * Client-side i18n hook.
 *
 * Usage:
 *   const { t, locale, setLocale, isLoading } = useTranslations();
 *   t("dashboard.overview_title")  // → "Overview"
 */
export function useTranslations() {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [dictionary, setDictionary] = useState<Dictionary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const saved = getStoredLocale();
    setLocaleState(saved);
    loadDictionary(saved).then(dict => {
      setDictionary(dict);
      setIsLoading(false);
    });
  }, []);

  const setLocale = useCallback(async (newLocale: Locale) => {
    setIsLoading(true);
    setLocaleState(newLocale);
    setStoredLocale(newLocale);
    const dict = await loadDictionary(newLocale);
    setDictionary(dict);
    setIsLoading(false);
  }, []);

  /**
   * Translate a dot-notated key like "dashboard.overview_title".
   * Returns the key itself as fallback if translation is missing.
   */
  const t = useCallback(
    (key: string): string => {
      if (!dictionary) return key;
      const parts = key.split(".");
      let value: any = dictionary;
      for (const part of parts) {
        if (value == null || typeof value !== "object") return key;
        value = value[part];
      }
      return typeof value === "string" ? value : key;
    },
    [dictionary]
  );

  return { t, locale, setLocale, isLoading, supportedLocales: SUPPORTED_LOCALES };
}
