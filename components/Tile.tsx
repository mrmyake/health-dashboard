import { fmt } from "@/lib/health";

export default function Tile({
  label, value, unit, decimals = 1, delta, deltaLabel, lowerIsBetter, extra,
}: {
  label: string;
  value: number | null;
  unit?: string;
  decimals?: number;
  delta?: number | null;
  deltaLabel?: string;
  lowerIsBetter?: boolean;
  extra?: React.ReactNode;
}) {
  const dir = delta === null || delta === undefined || Math.abs(delta) < 10 ** -decimals / 2 ? 0 : delta > 0 ? 1 : -1;
  const tone = dir === 0 || lowerIsBetter === undefined ? "" : (dir < 0) === lowerIsBetter ? "good" : "badc";
  return (
    <div className="card tile">
      <div className="k">{label}</div>
      <div className="v">
        {fmt(value, decimals)}
        {unit && <small>{unit}</small>}
      </div>
      {delta !== undefined && (
        <div className="d">
          <span className={tone}>{dir > 0 ? "+" : ""}{fmt(delta, decimals)}</span> {deltaLabel}
        </div>
      )}
      {extra}
    </div>
  );
}
