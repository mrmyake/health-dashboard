"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { labFlag, slug } from "@/lib/health";

type Line = { label: string; value: string; unit: string; low: string; high: string };
const empty = (): Line => ({ label: "", value: "", unit: "", low: "", high: "" });
const num = (s: string) => (s.trim() === "" || isNaN(+s.replace(",", ".")) ? null : +s.replace(",", "."));

export default function NewLab() {
  const router = useRouter();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [lab, setLab] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [lines, setLines] = useState<Line[]>([empty(), empty(), empty()]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const set = (i: number, k: keyof Line, v: string) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErr("Niet ingelogd"); setBusy(false); return; }

    let file_path: string | null = null;
    if (file) {
      file_path = `${user.id}/${date}-${slug(file.name.replace(/\.pdf$/i, ""))}.pdf`;
      const up = await supabase.storage.from("health-labs").upload(file_path, file, { upsert: true, contentType: file.type || "application/pdf" });
      if (up.error) { setErr(`Upload: ${up.error.message}`); setBusy(false); return; }
    }

    const { data: panel, error } = await supabase.from("lab_panels").insert({ taken_at: date, lab: lab || null, notes: notes || null, file_path }).select("id").single();
    if (error || !panel) { setErr(error?.message ?? "Opslaan mislukt"); setBusy(false); return; }

    const results = lines.filter((l) => l.label.trim()).map((l) => {
      const v = num(l.value), lo = num(l.low), hi = num(l.high);
      return {
        panel_id: panel.id, marker: slug(l.label), marker_label: l.label.trim(),
        value: v, value_text: v === null ? l.value.trim() || null : null, unit: l.unit.trim() || null,
        ref_low: lo, ref_high: hi, flag: labFlag(v, lo, hi),
      };
    });
    if (results.length) {
      const r = await supabase.from("lab_results").insert(results);
      if (r.error) { setErr(r.error.message); setBusy(false); return; }
    }
    router.push("/labs");
    router.refresh();
  }

  return (
    <>
      <h1>Uitslag toevoegen</h1>
      <p className="sub">Tip: upload de PDF bij Claude in de chat, dan worden alle waardes voor je ingevuld. Gebruik steeds dezelfde naam per marker, zodat de trend klopt.</p>
      <form className="card stack" onSubmit={save}>
        <div className="row">
          <label>Afnamedatum<input type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label>Lab<input value={lab} onChange={(e) => setLab(e.target.value)} placeholder="bijv. Saltro" /></label>
          <label>PDF<input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        </div>
        <label>Notities<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="nuchter, na vakantie, ..." /></label>
        <div className="scroll">
          <table>
            <thead><tr><th>Marker</th><th>Waarde</th><th>Eenheid</th><th>Ref. laag</th><th>Ref. hoog</th></tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td><input value={l.label} onChange={(e) => set(i, "label", e.target.value)} placeholder="LDL-cholesterol" /></td>
                  <td><input value={l.value} onChange={(e) => set(i, "value", e.target.value)} inputMode="decimal" /></td>
                  <td><input value={l.unit} onChange={(e) => set(i, "unit", e.target.value)} placeholder="mmol/L" /></td>
                  <td><input value={l.low} onChange={(e) => set(i, "low", e.target.value)} inputMode="decimal" /></td>
                  <td><input value={l.high} onChange={(e) => set(i, "high", e.target.value)} inputMode="decimal" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <button type="button" className="ghost" style={{ flex: 0 }} onClick={() => setLines((ls) => [...ls, empty()])}>+ Regel</button>
          <button style={{ flex: 0 }} disabled={busy}>{busy ? "Opslaan..." : "Opslaan"}</button>
        </div>
        {err && <p className="badc">{err}</p>}
      </form>
    </>
  );
}
