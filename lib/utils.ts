import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const UZ_MONTHS = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
] as const;

/** Tashkent is UTC+5 all year (no DST) — keeps server and client output identical. */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

function toTashkent(input: Date | string | number) {
  const d = new Date(input);
  return new Date(d.getTime() + TASHKENT_OFFSET_MS);
}

/** "20-noyabr, 2026" */
export function formatDate(input: Date | string | number | null | undefined) {
  if (input == null) return "—";
  const d = toTashkent(input);
  return `${d.getUTCDate()}-${UZ_MONTHS[d.getUTCMonth()]}, ${d.getUTCFullYear()}`;
}

/** "20-noyabr, 2026 · 14:05" */
export function formatDateTime(input: Date | string | number | null | undefined) {
  if (input == null) return "—";
  const d = toTashkent(input);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${formatDate(input)} · ${hh}:${mm}`;
}

/** Value for <input type="datetime-local"> in Tashkent time. */
export function toDateTimeLocalValue(input: Date | string | null | undefined) {
  if (!input) return "";
  return toTashkent(input).toISOString().slice(0, 16);
}

/** Parses a datetime-local string entered in Tashkent time into a UTC Date. */
export function fromDateTimeLocalValue(value: string) {
  const [datePart, timePart = "00:00"] = value.split("T");
  const [y, m, d] = (datePart ?? "").split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d, hh ?? 0, mm ?? 0) - TASHKENT_OFFSET_MS);
}

/** 3725 → "1:02:05", 125 → "2:05" */
export function formatDuration(totalSeconds: number | null | undefined) {
  if (!totalSeconds || totalSeconds < 0) return "—";
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Human-friendly total like "3 soat 20 daqiqa" */
export function formatTotalDuration(totalSeconds: number) {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} daqiqa`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} soat ${m} daqiqa` : `${h} soat`;
}

export function formatBytes(bytes: number | bigint | null | undefined) {
  if (bytes == null) return "—";
  const n = typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let value = n / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[i]}`;
}

const TRANSLIT: Record<string, string> = {
  "‘": "",
  "’": "",
  "ʻ": "",
  "ʼ": "",
  "'": "",
  "`": "",
};

/** URL-safe slug. Uzbek apostrophes (o‘, g‘) are dropped: "O‘rganish" → "organish". */
export function slugify(input: string) {
  return input
    .split("")
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join("")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function initials(name: string | null | undefined) {
  if (!name) return "AU";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return letters.join("") || "AU";
}

/** "Xamidullo Abdurahimov" → "Xamidullo A." (used on public leaderboards). */
export function publicDisplayName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "Ishtirokchi";
  return `${parts[0]} ${parts[1]?.[0]?.toUpperCase() ?? ""}.`;
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function pluralizeUz(count: number, noun: string) {
  // Uzbek nouns do not change after numerals: "5 ta dars"
  return `${count} ta ${noun}`;
}

/** Only allow same-origin relative redirects (prevents open redirects). */
export function safeRedirectPath(input: string | null | undefined, fallback = "/dashboard") {
  if (!input) return fallback;
  if (!input.startsWith("/") || input.startsWith("//") || input.startsWith("/\\")) return fallback;
  return input;
}
