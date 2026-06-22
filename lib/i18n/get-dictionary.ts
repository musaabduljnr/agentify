import type en from "./dictionaries/en.json";

export type Dictionary = typeof en;

const DICTIONARIES: Record<string, () => Promise<Dictionary>> = {
  en: () => import("./dictionaries/en.json").then(m => m.default),
  fr: () => import("./dictionaries/fr.json").then(m => m.default),
  es: () => import("./dictionaries/es.json").then(m => m.default),
  pt: () => import("./dictionaries/pt.json").then(m => m.default),
};

/**
 * Server-side dictionary loader.
 * Use this in Server Components and server actions.
 */
export async function getDictionary(locale: string): Promise<Dictionary> {
  const loader = DICTIONARIES[locale] ?? DICTIONARIES.en;
  return loader();
}
