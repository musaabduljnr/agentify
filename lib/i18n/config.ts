/**
 * i18n Configuration
 * Supported locales and default locale settings.
 */

export const SUPPORTED_LOCALES = ["en", "fr", "es", "pt"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_LABELS: Record<Locale, { label: string; flag: string }> = {
  en: { label: "English", flag: "🇺🇸" },
  fr: { label: "Français", flag: "🇫🇷" },
  es: { label: "Español", flag: "🇪🇸" },
  pt: { label: "Português", flag: "🇧🇷" },
};

export function isValidLocale(value: string): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}
