"use client";

import {
  CartesianGrid, Line, ComposedChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis,
} from "recharts";

type Row = Record<string, number | string | null>;
export type Series = { key: string; label: string; color: string; dots?: boolean; dashed?: boolean };
export type Marker = { day: string; title: string };

const fmtDay = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("nl-NL", { day: "numeric", month: "short" });

export default function TrendChart({
  data, series, events = [], refLines = [], band, unit = "", decimals = 1, height = 240,
}: {
  data: Row[];
  series: Series[];
  events?: Marker[];
  refLines?: { y: number; label: string }[];
  band?: { low: number | null; high: number | null };
  unit?: string;
  decimals?: number;
  height?: number;
}) {
  if (!data.length) return <div className="empty">Nog geen data</div>;
  const first = String(data[0].day);
  const last = String(data[data.length - 1].day);
  const visibleEvents = events.filter((e) => e.day >= first && e.day <= last);

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="day" tickFormatter={fmtDay} tick={{ fontSize: 11, fill: "var(--ink-3)" }} tickLine={false} axisLine={false} minTickGap={32} />
          <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11, fill: "var(--ink-3)" }} tickLine={false} axisLine={false} width={48}
            tickFormatter={(v: number) => v.toLocaleString("nl-NL", { maximumFractionDigits: decimals })} />
          {band && (band.low !== null || band.high !== null) && (
            <ReferenceArea y1={band.low ?? undefined} y2={band.high ?? undefined} fill="var(--accent-soft)" fillOpacity={0.6} ifOverflow="extendDomain" />
          )}
          {refLines.map((r) => (
            <ReferenceLine key={r.label} y={r.y} stroke="var(--warn)" strokeDasharray="4 4"
              label={{ value: r.label, position: "insideTopRight", fill: "var(--warn)", fontSize: 10 }} />
          ))}
          {visibleEvents.map((e) => (
            <ReferenceLine key={e.day + e.title} x={e.day} stroke="var(--ink-3)" strokeDasharray="2 3"
              label={{ value: e.title, position: "insideTopLeft", fill: "var(--ink-2)", fontSize: 10, angle: 0 }} />
          ))}
          <Tooltip
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }}
            labelFormatter={(d) => fmtDay(String(d))}
            formatter={(v: unknown, name: unknown) => [
              typeof v === "number" ? `${v.toLocaleString("nl-NL", { maximumFractionDigits: decimals })} ${unit}` : "–",
              series.find((s) => s.key === name)?.label ?? String(name),
            ]}
          />
          {series.map((s) =>
            s.dots ? (
              <Scatter key={s.key} dataKey={s.key} fill={s.color} fillOpacity={0.35} isAnimationActive={false} />
            ) : (
              <Line key={s.key} dataKey={s.key} stroke={s.color} strokeWidth={2} dot={data.length < 40 ? { r: 2.5 } : false}
                strokeDasharray={s.dashed ? "4 3" : undefined} connectNulls isAnimationActive={false} />
            )
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
