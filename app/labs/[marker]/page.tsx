import Link from "next/link";
import TrendChart from "@/components/TrendChart";
import { getEvents, getLabResults } from "@/lib/data";
import { fmt, labFlag } from "@/lib/health";

export const dynamic = "force-dynamic";

export default async function Marker({ params }: { params: Promise<{ marker: string }> }) {
  const { marker } = await params;
  const [rows, events] = await Promise.all([getLabResults(marker), getEvents()]);
  if (!rows.length) return <div className="card empty">Geen uitslagen voor deze marker. <Link href="/labs">Terug</Link></div>;

  const last = rows[rows.length - 1];
  const low = rows.findLast((r) => r.ref_low !== null)?.ref_low ?? null;
  const high = rows.findLast((r) => r.ref_high !== null)?.ref_high ?? null;
  const chart = rows.filter((r) => r.value !== null && r.lab_panels?.taken_at).map((r) => ({ day: r.lab_panels!.taken_at, value: r.value }));
  const first = chart[0]?.value ?? null;
  const decimals = rows.some((r) => r.value !== null && r.value % 1) ? 2 : 0;

  return (
    <>
      <p><Link href="/labs" className="muted">← Bloedwaardes</Link></p>
      <h1>{last.marker_label ?? marker}</h1>
      <p className="sub">
        Referentie {low ?? "?"} – {high ?? "?"} {last.unit}. {chart.length > 1 && first !== null && last.value !== null
          ? `Sinds eerste meting ${last.value - first > 0 ? "+" : ""}${fmt(last.value - first, decimals)} ${last.unit ?? ""}.` : ""}
      </p>
      <div className="card">
        <TrendChart data={chart} unit={last.unit ?? ""} decimals={decimals} band={{ low, high }} height={280}
          events={events.map((e) => ({ day: e.happened_on, title: e.title }))}
          series={[{ key: "value", label: last.marker_label ?? marker, color: "var(--accent)" }]} />
      </div>
      <div className="card section">
        <table>
          <thead><tr><th>Datum</th><th className="num">Waarde</th><th className="num">Referentie</th><th>Lab</th></tr></thead>
          <tbody>
            {[...rows].reverse().map((r) => {
              const f = labFlag(r.value, r.ref_low, r.ref_high);
              return (
                <tr key={r.id}>
                  <td>{r.lab_panels?.taken_at ? new Date(r.lab_panels.taken_at + "T12:00:00").toLocaleDateString("nl-NL") : ""}</td>
                  <td className={`num ${f === "normal" ? "" : "badc"}`}>{r.value !== null ? fmt(r.value, decimals) : r.value_text} {r.unit}</td>
                  <td className="num muted">{r.ref_low ?? ""} – {r.ref_high ?? ""}</td>
                  <td className="muted">{r.lab_panels?.lab ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
