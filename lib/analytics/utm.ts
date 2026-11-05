export type UtmParams = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
};

const STORAGE_KEY = "agentify_utm";
const COOKIE_KEY = "agentify_utm";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign"] as const;

function sanitize(value: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().slice(0, 200);
  return trimmed || undefined;
}

function readStored(): UtmParams {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return UTM_KEYS.reduce<UtmParams>((acc, key) => {
      const value = parsed[key];
      if (typeof value === "string" && value) acc[key] = value.slice(0, 200);
      return acc;
    }, {});
  } catch {
    return {};
  }
}

export function captureUtm(): UtmParams {
  if (typeof window === "undefined") return {};

  const params = new URLSearchParams(window.location.search);
  const fromUrl: UtmParams = {};
  for (const key of UTM_KEYS) {
    const value = sanitize(params.get(key));
    if (value) fromUrl[key] = value;
  }

  const merged = { ...readStored(), ...fromUrl };
  if (Object.keys(fromUrl).length > 0) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      document.cookie = `${COOKIE_KEY}=${encodeURIComponent(JSON.stringify(merged))}; path=/; max-age=7776000; SameSite=Lax`;
    } catch {
      // Storage can be unavailable in private mode; attribution is best-effort.
    }
  }

  return merged;
}

export function getStoredUtm(): UtmParams {
  return readStored();
}
