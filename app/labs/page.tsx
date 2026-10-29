import Link from "next/link";
import { getLabResults, getPanels } from "@/lib/data";
import { fmt, labFlag, nearEdge } from "@/lib/health";

export const dynamic = "force-dynamic";

export default async function Labs() {
  const [results, panels] = await Promise.all([getLabResults(), getPanels()]);

  const byMarker = new Map<string, typeof results>();
  for (const r of results) byMarker.set(r.marker, [...(byMarker.get(r.marker) ?? []), r]);

  const rows = [...byMarker.entries()].map(([marker, rs]) => {
    const last = rs[rs.length - 1];
    const prev = rs.length > 1 ? rs[rs.length - 2] : null;
    const flag = labFlag(last.value, last.ref_low, last.ref_high);
    const near = flag === "normal" && nearEdge(last.value, last.ref_low, last.ref_high);
    return { marker, last, prev, flag, near, n: rs.length };
  });
  const order = { high: 0, low: 0, normal: 1 } as const;
  rows.sort((a, b) => order[a.flag as keyof typeof order] - order[b.flag as keyof typeof order] || Number(b.near) - Number(a.near) || a.marker.localeCompare(b.marker));
  const out = rows.filter((r) => r.flag !== "normal").length;
  const near = rows.filter((r) => r.near).length;

  return (
    <>
      <div className="head">
        <div>
          <h1>Bloedwaardes</h1>
          <p className="sub">{rows.length} markers uit {panels.length} afnames. {out} buiten bereik, {near} dicht bij de grens.</p>
        </div>
        <Link className="btn" href="/labs/nieuw">Uitslag toevoegen</Link>
      </div>

      <div className="card scroll">
        {rows.length ? (
          <table>
            <thead><tr><th>Marker</th><th className="num">Laatste</th><th className="num">Vorige</th><th className="num">Referentie</th><th>Status</th><th>Datum</th></tr></thead>
            <tbody>
              {rows.map(({ marker, last, prev, flag, near, n }) => (
                <tr key={marker}>
                  <td><Link href={`/labs/${marker}`}>{last.marker_label ?? marker}</Link>{n > 1 && <span className="muted"> · {n}×</span>}</td>
                  <td className="num"><strong>{last.value !== null ? fmt(last.value, last.value % 1 ? 2 : 0) : last.value_text}</strong> <span className="muted">{last.unit}</span></td>
                  <td className="num muted">{prev ? (prev.value !== null ? fmt(prev.value, prev.value % 1 ? 2 : 0) : prev.value_text) : "–"}</td>
                  <td className="num muted">{last.ref_low ?? ""}{last.ref_low !== null || last.ref_high !== null ? " – " : ""}{last.ref_high ?? ""}</td>
                  <td>
                    {flag === "high" && <span className="pill bad">Hoog</span>}
                    {flag === "low" && <span className="pill bad">Laag</span>}
                    {flag === "normal" && (near ? <span className="pill warn">Bij grens</span> : <span className="pill ok">Normaal</span>)}
                  </td>
                  <td className="muted">{last.lab_panels?.taken_at ? new Date(last.lab_panels.taken_at + "T12:00:00").toLocaleDateString("nl-NL") : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty">Nog geen uitslagen. Voeg er een toe, of upload de PDF bij Claude in de chat.</div>
        )}
      </div>

      {panels.length > 0 && (
        <div className="card section">
          <h2>Afnames</h2>
          <table>
            <thead><tr><th>Datum</th><th>Lab</th><th>Notities</th></tr></thead>
            <tbody>
              {panels.map((p) => (
                <tr key={p.id}><td>{new Date(p.taken_at + "T12:00:00").toLocaleDateString("nl-NL")}</td><td>{p.lab ?? "–"}</td><td className="muted">{p.notes ?? ""}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
