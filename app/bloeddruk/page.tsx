import TrendChart from "@/components/TrendChart";
import { getBloodPressure, getBpReadings, getEvents } from "@/lib/data";
import { bpCategory, daysAgo, fmt, rolling } from "@/lib/health";

export const dynamic = "force-dynamic";

export default async function BloodPressure() {
  const from = daysAgo(365);
  const [days, readings, events] = await Promise.all([getBloodPressure(from), getBpReadings(daysAgo(30)), getEvents()]);
  const markers = events.map((e) => ({ day: e.happened_on, title: e.title }));

  const sys7 = rolling(days.map((d) => ({ day: d.day, value: d.systolic })));
  const dia7 = rolling(days.map((d) => ({ day: d.day, value: d.diastolic })));
  const chart = days.map((d, i) => ({ day: d.day, sys: d.systolic, dia: d.diastolic, sys7: sys7[i].avg, dia7: dia7[i].avg }));

  // Morning (before 12:00) vs evening (from 17:00), last 30 days, Amsterdam time
  const hour = (iso: string) => Number(new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/Amsterdam", hour: "2-digit", hour12: false }));
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const morning = readings.filter((r) => hour(r.recorded_at) < 12);
  const evening = readings.filter((r) => hour(r.recorded_at) >= 17);
  const slot = (rs: typeof readings) => ({ sys: avg(rs.map((r) => Number(r.systolic))), dia: avg(rs.map((r) => Number(r.diastolic))), n: rs.length });
  const m = slot(morning), e = slot(evening), all = slot(readings);

  // Weekly averages
  const weeks = new Map<string, { s: number[]; d: number[] }>();
  for (const d of days) {
    const dt = new Date(d.day + "T12:00:00");
    const monday = new Date(dt);
    monday.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
    const k = monday.toISOString().slice(0, 10);
    const w = weeks.get(k) ?? { s: [], d: [] };
    w.s.push(d.systolic); w.d.push(d.diastolic);
    weeks.set(k, w);
  }
  const weekRows = [...weeks.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12)
    .map(([k, w]) => ({ week: k, sys: avg(w.s), dia: avg(w.d), n: w.s.length }));

  return (
    <>
      <h1>Bloeddruk</h1>
      <p className="sub">Thuismeting: hypertensie-grens is een gemiddelde boven 135/85. Meet bij voorkeur 7 dagen lang ochtend en avond.</p>

      <div className="grid tiles">
        {[{ k: "30 dagen", v: all }, { k: "Ochtend", v: m }, { k: "Avond", v: e }].map(({ k, v }) => {
          const c = bpCategory(v.sys, v.dia);
          return (
            <div key={k} className="card tile">
              <div className="k">{k}</div>
              <div className="v">{fmt(v.sys, 0)}/{fmt(v.dia, 0)}<small>mmHg</small></div>
              <span className={`pill ${c.tone}`}>{c.label}</span> <span className="muted">{v.n} metingen</span>
            </div>
          );
        })}
      </div>

      <div className="card">
        <h2>Verloop (12 maanden)</h2>
        <TrendChart data={chart} unit="mmHg" decimals={0} height={300} events={markers}
          refLines={[{ y: 135, label: "135" }, { y: 85, label: "85" }]}
          series={[
            { key: "sys", label: "Systolisch", color: "var(--accent)", dots: true },
            { key: "dia", label: "Diastolisch", color: "var(--series-2)", dots: true },
            { key: "sys7", label: "Systolisch 7d", color: "var(--accent)" },
            { key: "dia7", label: "Diastolisch 7d", color: "var(--series-2)" },
          ]} />
      </div>

      <div className="card section scroll">
        <h2>Per week</h2>
        {weekRows.length ? (
          <table>
            <thead><tr><th>Week van</th><th className="num">Gemiddeld</th><th className="num">Dagen</th><th>Categorie</th></tr></thead>
            <tbody>
              {weekRows.map((w) => {
                const c = bpCategory(w.sys, w.dia);
                return (
                  <tr key={w.week}>
                    <td>{new Date(w.week + "T12:00:00").toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td className="num">{fmt(w.sys, 0)}/{fmt(w.dia, 0)}</td>
                    <td className="num">{w.n}</td>
                    <td><span className={`pill ${c.tone}`}>{c.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <div className="empty">Nog geen metingen</div>}
      </div>
    </>
  );
}
