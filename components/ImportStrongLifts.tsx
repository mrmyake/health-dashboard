"use client";

import Papa from "papaparse";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { liftKey } from "@/lib/health";

type SetRow = {
  performed_at: string; workout_key: string; exercise: string; exercise_label: string;
  set_number: number; reps: number | null; weight_kg: number | null; is_warmup: boolean; source: string;
};

const find = (cols: string[], ...needles: RegExp[]) => cols.find((c) => needles.some((n) => n.test(c.toLowerCase().trim())));

function toNum(v: unknown) {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(",", ".").replace(/[^0-9.\-]/g, "");
  return s === "" || isNaN(+s) ? null : +s;
}

function toIso(v: string) {
  const s = v.trim();
  // dd-mm-yyyy or dd/mm/yyyy
  const eu = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(.*)$/);
  const d = eu ? new Date(`${eu[3]}-${eu[2].padStart(2, "0")}-${eu[1].padStart(2, "0")}${eu[4] ? "T" + eu[4].trim() : "T12:00:00"}`) : new Date(s.length === 10 ? s + "T12:00:00" : s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Accepts one-row-per-set exports and one-row-per-exercise exports with "Set 1..N" columns. */
export function parseCsv(text: string): { rows: SetRow[]; problems: string[] } {
  const { data, meta } = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  const cols = meta.fields ?? [];
  const problems: string[] = [];
  const cDate = find(cols, /^date/, /datum/, /^time/, /start/);
  const cEx = find(cols, /exercise/, /oefening/, /^lift/, /^name$/);
  const cWorkout = find(cols, /^workout( name| #)?$/, /^workout$/, /routine/);
  const cWeight = find(cols, /weight(?!.*body)/, /gewicht/, /^kg$/, /^lbs?$/);
  const cReps = find(cols, /^reps?$/, /herhaling/, /^reps /);
  const cSet = find(cols, /^set( ?#| number| order)?$/, /^set$/);
  const cWarm = find(cols, /warm/);
  const setCols = cols.filter((c) => /^set\s*\d+/i.test(c.trim()));
  const isLb = cWeight ? /lb/i.test(cWeight) : false;

  if (!cDate) problems.push("Geen datumkolom gevonden");
  if (!cEx) problems.push("Geen oefeningkolom gevonden");
  if (problems.length) return { rows: [], problems: [...problems, `Kolommen: ${cols.join(", ")}`] };

  const out: SetRow[] = [];
  const counters = new Map<string, number>();
  const kg = (w: number | null) => (w === null ? null : isLb ? +(w * 0.45359237).toFixed(2) : w);

  for (const r of data) {
    const iso = toIso(r[cDate!] ?? "");
    const label = (r[cEx!] ?? "").trim();
    if (!iso || !label) continue;
    const day = iso.slice(0, 10);
    const wk = `${day}${cWorkout ? ":" + (r[cWorkout] ?? "").trim() : ""}`;
    const warm = cWarm ? /^(1|true|yes|ja|w|warm)/i.test(String(r[cWarm] ?? "")) : false;
    const base = { performed_at: iso, workout_key: wk, exercise: liftKey(label), exercise_label: label, is_warmup: warm, source: "stronglifts" };

    if (setCols.length) {
      // Wide format: Set 1 = "5" or "5x100" or "100kg x 5"
      setCols.forEach((c, i) => {
        const v = String(r[c] ?? "").trim();
        if (!v) return;
        const pair = v.match(/([\d.,]+)\s*(kg|lb)?\s*[x×]\s*([\d.,]+)\s*(kg|lb)?/i);
        let reps: number | null, w: number | null;
        if (pair) {
          const a = toNum(pair[1]), b = toNum(pair[3]);
          // the side with a unit, or the larger number, is the weight
          const aIsW = !!pair[2] || (!pair[4] && (a ?? 0) > (b ?? 0));
          w = aIsW ? a : b; reps = aIsW ? b : a;
          if (/lb/i.test(pair[2] ?? pair[4] ?? "")) w = w === null ? null : +(w * 0.45359237).toFixed(2);
        } else {
          reps = toNum(v); w = kg(cWeight ? toNum(r[cWeight]) : null);
        }
        out.push({ ...base, set_number: i + 1, reps: reps === null ? null : Math.round(reps), weight_kg: w });
      });
    } else {
      const key = `${wk}|${label}|${warm}`;
      const n = cSet ? toNum(r[cSet]) ?? (counters.get(key) ?? 0) + 1 : (counters.get(key) ?? 0) + 1;
      counters.set(key, n);
      const reps = cReps ? toNum(r[cReps]) : null;
      out.push({ ...base, set_number: n, reps: reps === null ? null : Math.round(reps), weight_kg: kg(cWeight ? toNum(r[cWeight]) : null) });
    }
  }
  if (!out.length) problems.push(`Geen sets herkend. Kolommen: ${cols.join(", ")}`);
  return { rows: out, problems };
}

export default function ImportStrongLifts() {
  const router = useRouter();
  const [rows, setRows] = useState<SetRow[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function onFile(f: File | undefined) {
    if (!f) return;
    const { rows, problems } = parseCsv(await f.text());
    setRows(rows); setProblems(problems); setStatus("");
  }

  async function save() {
    setBusy(true);
    const supabase = createClient();
    let done = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from("strength_sets").upsert(rows.slice(i, i + 500), {
        onConflict: "owner_id,workout_key,exercise_label,set_number,is_warmup",
      });
      if (error) { setStatus(`Fout: ${error.message}`); setBusy(false); return; }
      done += Math.min(500, rows.length - i);
    }
    setStatus(`${done} sets opgeslagen`);
    setBusy(false);
    setRows([]);
    router.refresh();
  }

  const workouts = new Set(rows.map((r) => r.workout_key)).size;

  return (
    <div className="card">
      <h2>StrongLifts importeren</h2>
      <p className="muted">In StrongLifts: Settings → Export Data, mail de CSV naar jezelf en kies hem hier. Dubbele sets worden overschreven, dus opnieuw importeren kan altijd.</p>
      <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} />
      {problems.map((p) => <p key={p} className="badc">{p}</p>)}
      {rows.length > 0 && (
        <>
          <p>{rows.length} sets in {workouts} trainingen herkend. Eerste rijen:</p>
          <div className="scroll">
            <table>
              <thead><tr><th>Datum</th><th>Oefening</th><th>Herkend als</th><th className="num">Set</th><th className="num">Reps</th><th className="num">kg</th></tr></thead>
              <tbody>
                {rows.slice(0, 8).map((r, i) => (
                  <tr key={i}><td>{r.performed_at.slice(0, 10)}</td><td>{r.exercise_label}</td><td>{r.exercise}</td>
                    <td className="num">{r.set_number}{r.is_warmup ? " (w)" : ""}</td><td className="num">{r.reps ?? "–"}</td><td className="num">{r.weight_kg ?? "–"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p><button onClick={save} disabled={busy}>{busy ? "Opslaan..." : "Importeren"}</button></p>
        </>
      )}
      {status && <p>{status}</p>}
    </div>
  );
}
