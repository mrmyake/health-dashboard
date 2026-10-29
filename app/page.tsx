import Tile from "@/components/Tile";
import TrendChart from "@/components/TrendChart";
import { getBloodPressure, getE1rm, getEvents, getLastIngest, getMetricSeries } from "@/lib/data";
import { bpCategory, change, daysAgo, fmt, LIFTS, METRICS, rolling, sinceStart, type Point } from "@/lib/health";

export const dynamic = "force-dynamic";

const KEYS = ["weight_body_mass", "body_fat_percentage", "lean_body_mass", "resting_heart_rate", "heart_rate_variability", "sleep_analysis", "step_count"];

export default async function Overview() {
  const from = daysAgo(365 * 3);
  const [series, bp, events, e1rm, ingest] = await Promise.all([
    getMetricSeries(KEYS, from), getBloodPressure(from), getEvents(), getE1rm(), getLastIngest(),
  ]);
  const markers = events.map((e) => ({ day: e.happened_on, title: e.title }));
  const last = (p: Point[]) => p.filter((x) => x.value !== null).at(-1)?.value ?? null;
  const last90 = daysAgo(90);

  const sys: Point[] = bp.map((b) => ({ day: b.day, value: b.systolic }));
  const dia: Point[] = bp.map((b) => ({ day: b.day, value: b.diastolic }));
  const sys7 = rolling(sys), dia7 = rolling(dia);
  const sysNow = sys7.at(-1)?.avg ?? null, diaNow = dia7.at(-1)?.avg ?? null;
  const cat = bpCategory(sysNow, diaNow);

  const weight = rolling(series.weight_body_mass);
  const weightChart = weight.filter((p) => p.day >= last90).map((p) => ({ day: p.day, raw: p.value, avg: p.avg }));
  const bpChart = sys7
    .map((s, i) => ({ day: s.day, sys: s.avg, dia: dia7[i].avg }))
    .filter((r) => r.day >= last90);

  const rhr = rolling(series.resting_heart_rate).filter((p) => p.day >= last90);
  const hrv = rolling(series.heart_rate_variability).filter((p) => p.day >= last90);
  const recovery = Array.from(new Set([...rhr, ...hrv].map((p) => p.day))).sort().map((day) => ({
    day, rhr: rhr.find((p) => p.day === day)?.avg ?? null, hrv: hrv.find((p) => p.day === day)?.avg ?? null,
  }));

  const bodyweight = last(series.weight_body_mass);
  const bestLift = (k: string) => {
    const r = e1rm.filter((x) => x.exercise === k && x.e1rm !== null);
    return r.length ? Math.max(...r.map((x) => x.e1rm as number)) : null;
  };

  const tile = (k: string) => {
    const s = series[k], d = METRICS[k], st = sinceStart(s);
    return (
      <Tile key={k} label={d.label} value={last(s)} unit={d.unit} decimals={d.decimals}
        delta={change(s, 30)} deltaLabel="vs 30 dgn" lowerIsBetter={d.lowerIsBetter}
        extra={st && <div className="d">{st.delta > 0 ? "+" : ""}{fmt(st.delta, d.decimals)} sinds start</div>} />
    );
  };

  return (
    <>
      <div className="head">
        <div>
          <h1>Overzicht</h1>
          <p className="sub">Trends op 7-daags gemiddelde, laatste 90 dagen in grafieken.</p>
        </div>
        <span className="muted">
          {ingest ? `Laatste sync ${new Date(ingest.received_at).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}${ingest.error ? " (fout)" : ""}` : "Nog geen sync ontvangen"}
        </span>
      </div>

      <div className="grid tiles">
        <div className="card tile">
          <div className="k">Bloeddruk 7d</div>
          <div className="v">{fmt(sysNow, 0)}/{fmt(diaNow, 0)}<small>mmHg</small></div>
          <span className={`pill ${cat.tone}`}>{cat.label}</span>
        </div>
        {tile("weight_body_mass")}
        {tile("body_fat_percentage")}
        {tile("resting_heart_rate")}
        {tile("heart_rate_variability")}
        {tile("sleep_analysis")}
      </div>

      <div className="grid two">
        <div className="card">
          <h2>Gewicht</h2>
          <TrendChart data={weightChart} unit="kg" events={markers}
            series={[{ key: "raw", label: "Meting", color: "var(--ink-3)", dots: true }, { key: "avg", label: "7d gemiddelde", color: "var(--accent)" }]} />
        </div>
        <div className="card">
          <h2>Bloeddruk (7d gemiddelde)</h2>
          <TrendChart data={bpChart} unit="mmHg" decimals={0} events={markers}
            refLines={[{ y: 135, label: "135" }, { y: 85, label: "85" }]}
            series={[{ key: "sys", label: "Systolisch", color: "var(--accent)" }, { key: "dia", label: "Diastolisch", color: "var(--series-2)" }]} />
        </div>
        <div className="card">
          <h2>Herstel</h2>
          <TrendChart data={recovery} decimals={0} events={markers}
            series={[{ key: "rhr", label: "Rusthartslag (bpm)", color: "var(--series-2)" }, { key: "hrv", label: "HRV (ms)", color: "var(--accent)" }]} />
          <div className="legend"><span><i style={{ background: "var(--series-2)" }} />Rusthartslag</span><span><i style={{ background: "var(--accent)" }} />HRV</span></div>
        </div>
        <div className="card">
          <h2>Kracht (beste geschatte 1RM)</h2>
          <table>
            <thead><tr><th>Lift</th><th className="num">e1RM</th><th className="num">× lichaamsgewicht</th></tr></thead>
            <tbody>
              {Object.entries(LIFTS).map(([k, label]) => {
                const b = bestLift(k);
                return (
                  <tr key={k}><td>{label}</td><td className="num">{fmt(b, 1)} kg</td>
                    <td className="num">{b && bodyweight ? fmt(b / bodyweight, 2) : "–"}</td></tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
