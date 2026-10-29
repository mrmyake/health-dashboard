import ImportStrongLifts from "@/components/ImportStrongLifts";
import TrendChart from "@/components/TrendChart";
import { getE1rm, getEvents, getMetricSeries } from "@/lib/data";
import { daysAgo, fmt, LIFTS, rolling } from "@/lib/health";

export const dynamic = "force-dynamic";

const COLORS = ["var(--accent)", "var(--series-2)", "#6b7fd7", "#9a6bc4", "#c2577e"];

export default async function Training() {
  const [rows, events, series] = await Promise.all([getE1rm(), getEvents(), getMetricSeries(["weight_body_mass"], daysAgo(365 * 3))]);
  const markers = events.map((e) => ({ day: e.happened_on, title: e.title }));
  const weight = rolling(series.weight_body_mass);
  const bwOn = (day: string) => {
    for (let i = weight.length - 1; i >= 0; i--) if (weight[i].day <= day && weight[i].avg !== null) return weight[i].avg;
    return null;
  };

  const lifts = Object.keys(LIFTS).filter((k) => rows.some((r) => r.exercise === k));
  const days = [...new Set(rows.map((r) => r.day))].sort();

  // e1RM per lift, one column per lift
  const chart = days.map((day) => {
    const o: Record<string, string | number | null> = { day };
    for (const k of lifts) o[k] = rows.find((r) => r.day === day && r.exercise === k)?.e1rm ?? null;
    return o;
  });

  // Relative strength: sum of best e1RM of big three / bodyweight, running best
  const best: Record<string, number> = {};
  const rel = days.map((day) => {
    for (const r of rows.filter((x) => x.day === day && x.e1rm !== null)) best[r.exercise] = Math.max(best[r.exercise] ?? 0, r.e1rm as number);
    const total = (best.squat ?? 0) + (best.bench_press ?? 0) + (best.deadlift ?? 0);
    const bw = bwOn(day);
    return { day, total: total || null, rel: total && bw ? total / bw : null };
  });

  // PRs and progress
  const prRows = lifts.map((k) => {
    const r = rows.filter((x) => x.exercise === k && x.e1rm !== null);
    const pr = r.reduce((a, b) => ((b.e1rm as number) > (a.e1rm as number) ? b : a), r[0]);
    const first = r[0], last = r[r.length - 1];
    const top = rows.filter((x) => x.exercise === k && x.top_weight !== null).reduce((m, x) => Math.max(m, x.top_weight as number), 0);
    const lastPr = r.filter((x) => x.e1rm === pr.e1rm).at(-1)?.day ?? pr.day;
    const stalled = Math.round((new Date(last.day).getTime() - new Date(lastPr).getTime()) / 864e5);
    return { k, pr, first, last, top, stalled };
  });

  // Weekly volume (working sets, kg x reps)
  const vol = new Map<string, number>();
  for (const r of rows) {
    const d = new Date(r.day + "T12:00:00");
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const k = d.toISOString().slice(0, 10);
    vol.set(k, (vol.get(k) ?? 0) + (r.volume_kg ?? 0));
  }
  const volChart = [...vol.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-26).map(([day, v]) => ({ day, vol: Math.round(v) }));

  return (
    <>
      <h1>Training</h1>
      <p className="sub">Geschatte 1RM (Epley) uit werksets, warming-up telt niet mee.</p>

      {lifts.length === 0 ? (
        <div className="card empty">Nog geen trainingen. Importeer je StrongLifts-export hieronder.</div>
      ) : (
        <>
          <div className="card">
            <h2>Progressie per lift (e1RM, kg)</h2>
            <TrendChart data={chart} unit="kg" events={markers} height={300}
              series={lifts.map((k, i) => ({ key: k, label: LIFTS[k], color: COLORS[i % COLORS.length] }))} />
            <div className="legend">{lifts.map((k, i) => <span key={k}><i style={{ background: COLORS[i % COLORS.length] }} />{LIFTS[k]}</span>)}</div>
          </div>

          <div className="card section scroll">
            <h2>Records</h2>
            <table>
              <thead><tr><th>Lift</th><th className="num">Start e1RM</th><th className="num">PR e1RM</th><th className="num">Zwaarste set</th><th className="num">Winst</th><th>PR datum</th><th className="num">Dagen sinds PR</th></tr></thead>
              <tbody>
                {prRows.map(({ k, pr, first, top, stalled }) => (
                  <tr key={k}>
                    <td>{LIFTS[k]}</td>
                    <td className="num">{fmt(first.e1rm, 1)}</td>
                    <td className="num"><strong>{fmt(pr.e1rm, 1)}</strong></td>
                    <td className="num">{fmt(top, 1)}</td>
                    <td className="num good">+{fmt((pr.e1rm as number) - (first.e1rm as number), 1)}</td>
                    <td>{new Date(pr.day + "T12:00:00").toLocaleDateString("nl-NL")}</td>
                    <td className="num">{stalled > 21 ? <span className="pill warn">{stalled}</span> : stalled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted">Meer dan 3 weken geen PR is bij StrongLifts vaak het moment voor een deload.</p>
          </div>

          <div className="grid two section">
            <div className="card">
              <h2>Relatieve kracht</h2>
              <TrendChart data={rel} decimals={2} events={markers}
                series={[{ key: "rel", label: "Squat+bench+deadlift / lichaamsgewicht", color: "var(--accent)" }]} />
              <p className="muted">Som van beste e1RM squat, bench en deadlift gedeeld door je 7-daags gemiddelde gewicht.</p>
            </div>
            <div className="card">
              <h2>Volume per week (kg × reps)</h2>
              <TrendChart data={volChart} decimals={0} unit="kg" series={[{ key: "vol", label: "Volume", color: "var(--series-2)" }]} />
            </div>
          </div>
        </>
      )}

      <div className="section"><ImportStrongLifts /></div>
    </>
  );
}
