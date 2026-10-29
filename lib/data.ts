import { createClient } from "@/lib/supabase/server";
import { METRICS, normalise, type EventRow, type Point } from "@/lib/health";

export async function getMetricSeries(metrics: string[], fromDay: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_metrics")
    .select("metric, day, avg_value, min_value, sum_value")
    .in("metric", metrics)
    .gte("day", fromDay)
    .order("day", { ascending: true })
    .limit(10000);
  if (error) throw new Error(error.message);
  const out: Record<string, Point[]> = Object.fromEntries(metrics.map((m) => [m, []]));
  for (const r of data ?? []) {
    const def = METRICS[r.metric];
    const raw = def?.agg === "sum" ? r.sum_value : def?.agg === "min" ? r.min_value : r.avg_value;
    out[r.metric].push({ day: r.day, value: normalise(r.metric, raw === null ? null : Number(raw)) });
  }
  return out;
}

export type BpDay = { day: string; systolic: number; diastolic: number; pulse: number | null; n: number };

export async function getBloodPressure(fromDay: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_blood_pressure")
    .select("day, systolic, diastolic, pulse, n")
    .gte("day", fromDay)
    .order("day", { ascending: true })
    .limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ ...r, systolic: Number(r.systolic), diastolic: Number(r.diastolic), pulse: r.pulse === null ? null : Number(r.pulse) })) as BpDay[];
}

export async function getBpReadings(fromDay: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blood_pressure")
    .select("recorded_at, systolic, diastolic, source")
    .gte("recorded_at", fromDay)
    .order("recorded_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getEvents() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").select("id, happened_on, title, category, notes").order("happened_on", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as EventRow[];
}

export type LabRow = {
  id: number; marker: string; marker_label: string | null; value: number | null; value_text: string | null;
  unit: string | null; ref_low: number | null; ref_high: number | null; panel_id: string;
  lab_panels: { taken_at: string; lab: string | null; file_path: string | null } | null;
};

export async function getLabResults(marker?: string) {
  const supabase = await createClient();
  let q = supabase
    .from("lab_results")
    .select("id, marker, marker_label, value, value_text, unit, ref_low, ref_high, panel_id, lab_panels(taken_at, lab, file_path)")
    .limit(5000);
  if (marker) q = q.eq("marker", marker);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((r: any) => ({
    ...r,
    value: r.value === null ? null : Number(r.value),
    ref_low: r.ref_low === null ? null : Number(r.ref_low),
    ref_high: r.ref_high === null ? null : Number(r.ref_high),
    lab_panels: Array.isArray(r.lab_panels) ? r.lab_panels[0] ?? null : r.lab_panels,
  })) as LabRow[];
  return rows.sort((a, b) => (a.lab_panels?.taken_at ?? "").localeCompare(b.lab_panels?.taken_at ?? ""));
}

export async function getPanels() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("lab_panels").select("id, taken_at, lab, file_path, notes").order("taken_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type E1rmDay = { exercise: string; day: string; e1rm: number | null; top_weight: number | null; volume_kg: number | null };

export async function getE1rm() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("daily_e1rm").select("exercise, day, e1rm, top_weight, volume_kg").order("day", { ascending: true }).limit(10000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    exercise: r.exercise, day: r.day,
    e1rm: r.e1rm === null ? null : Number(r.e1rm),
    top_weight: r.top_weight === null ? null : Number(r.top_weight),
    volume_kg: r.volume_kg === null ? null : Number(r.volume_kg),
  })) as E1rmDay[];
}

export async function getLastIngest() {
  const supabase = await createClient();
  const { data } = await supabase.from("ingest_log").select("received_at, samples_upserted, bp_upserted, error").order("received_at", { ascending: false }).limit(1);
  return data?.[0] ?? null;
}
