export type Point = { day: string; value: number | null };
export type EventRow = { id: string; happened_on: string; title: string; category: string | null; notes: string | null };

export const METRICS: Record<string, { label: string; unit: string; decimals: number; agg: "avg" | "sum" | "min"; lowerIsBetter?: boolean }> = {
  weight_body_mass: { label: "Gewicht", unit: "kg", decimals: 1, agg: "avg", lowerIsBetter: true },
  body_fat_percentage: { label: "Vetpercentage", unit: "%", decimals: 1, agg: "avg", lowerIsBetter: true },
  lean_body_mass: { label: "Vetvrije massa", unit: "kg", decimals: 1, agg: "avg" },
  resting_heart_rate: { label: "Rusthartslag", unit: "bpm", decimals: 0, agg: "avg", lowerIsBetter: true },
  heart_rate_variability: { label: "HRV", unit: "ms", decimals: 0, agg: "avg" },
  sleep_analysis: { label: "Slaap", unit: "u", decimals: 1, agg: "sum" },
  step_count: { label: "Stappen", unit: "", decimals: 0, agg: "sum" },
};

export const LIFTS: Record<string, string> = {
  squat: "Squat",
  bench_press: "Bench press",
  deadlift: "Deadlift",
  overhead_press: "Overhead press",
  barbell_row: "Barbell row",
};

export function fmt(v: number | null | undefined, decimals = 1) {
  if (v === null || v === undefined || !isFinite(v)) return "–";
  return v.toLocaleString("nl-NL", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtDate(d: string) {
  return new Date(d + (d.length === 10 ? "T12:00:00" : "")).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

export function isoDay(d: Date) {
  return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" });
}

export function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDay(d);
}

/** Normalise values that arrive in odd units (fractions for %, minutes for sleep). */
export function normalise(metric: string, v: number | null) {
  if (v === null) return null;
  if (metric === "body_fat_percentage" && v <= 1) return v * 100;
  if (metric === "sleep_analysis" && v > 24) return v / 60;
  return v;
}

/** Trailing rolling mean over calendar days (gaps are skipped, not filled). */
export function rolling(points: Point[], window = 7): (Point & { avg: number | null })[] {
  const out: (Point & { avg: number | null })[] = [];
  for (let i = 0; i < points.length; i++) {
    const end = new Date(points[i].day).getTime();
    const vals: number[] = [];
    for (let j = i; j >= 0; j--) {
      if ((end - new Date(points[j].day).getTime()) / 864e5 >= window) break;
      if (points[j].value !== null) vals.push(points[j].value as number);
    }
    out.push({ ...points[i], avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null });
  }
  return out;
}

export function meanSince(points: Point[], fromDay: string) {
  const v = points.filter((p) => p.day >= fromDay && p.value !== null).map((p) => p.value as number);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** Change of the 7-day mean now vs 7-day mean N days ago. */
export function change(points: Point[], days: number) {
  if (!points.length) return null;
  const last = points[points.length - 1].day;
  const lastT = new Date(last).getTime();
  const win = (endT: number) => {
    const v = points
      .filter((p) => p.value !== null && new Date(p.day).getTime() <= endT && new Date(p.day).getTime() > endT - 7 * 864e5)
      .map((p) => p.value as number);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const now = win(lastT);
  const then = win(lastT - days * 864e5);
  return now !== null && then !== null ? now - then : null;
}

export function sinceStart(points: Point[]) {
  const v = points.filter((p) => p.value !== null);
  if (v.length < 2) return null;
  const first = v.slice(0, Math.min(7, v.length)).map((p) => p.value as number);
  const last = v.slice(-Math.min(7, v.length)).map((p) => p.value as number);
  const m = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  return { from: v[0].day, delta: m(last) - m(first) };
}

/** ESC/ESH 2023 office categories; home threshold for hypertension is 135/85. */
export function bpCategory(sys: number | null, dia: number | null) {
  if (sys === null || dia === null) return { label: "–", tone: "muted" as const };
  if (sys >= 140 || dia >= 90) return { label: "Hypertensie", tone: "bad" as const };
  if (sys >= 135 || dia >= 85) return { label: "Boven thuisgrens", tone: "warn" as const };
  if (sys >= 130 || dia >= 85) return { label: "Hoog-normaal", tone: "warn" as const };
  if (sys >= 120 || dia >= 80) return { label: "Normaal", tone: "ok" as const };
  return { label: "Optimaal", tone: "ok" as const };
}

export function labFlag(value: number | null, low: number | null, high: number | null) {
  if (value === null) return "normal";
  if (low !== null && value < low) return "low";
  if (high !== null && value > high) return "high";
  return "normal";
}

/** Within 10% of the range width from either edge. */
export function nearEdge(value: number | null, low: number | null, high: number | null) {
  if (value === null || low === null || high === null || high <= low) return false;
  const w = high - low;
  return (value >= low && value - low < 0.1 * w) || (value <= high && high - value < 0.1 * w);
}

export function slug(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function liftKey(label: string): string {
  const s = label.toLowerCase();
  if (s.includes("squat")) return "squat";
  if (s.includes("bench")) return "bench_press";
  if (s.includes("dead")) return "deadlift";
  if (s.includes("overhead") || s.includes("ohp") || s.includes("military") || s.includes("press")) return "overhead_press";
  if (s.includes("row")) return "barbell_row";
  return slug(label) || "other";
}

export const e1rm = (w: number, r: number) => (r >= 1 && r <= 12 ? w * (1 + r / 30) : null);
