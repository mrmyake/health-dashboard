// Webhook for Health Auto Export (iOS). Auth: Authorization: Bearer <token> or x-ingest-token header.
// Writes directly to Postgres so the health schema does not need to be exposed for ingest.
import postgres from "npm:postgres@3.4.5";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 1 });

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// "2026-10-28 08:01:00 +0100" -> "2026-10-28T08:01:00+01:00"
function toIso(d: string): string {
  const m = d.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})\s*([+-])(\d{2}):?(\d{2})$/);
  if (m) return `${m[1]}T${m[2]}${m[3]}${m[4]}:${m[5]}`;
  return new Date(d).toISOString();
}

const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : typeof v === "string" && v !== "" && isFinite(+v) ? +v : null);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : (req.headers.get("x-ingest-token") ?? "").trim();
  if (!token) return json({ error: "unauthorized" }, 401);

  const [tok] = await sql`select id, owner_id from health.ingest_tokens where token_hash = ${await sha256(token)}`;
  if (!tok) return json({ error: "unauthorized" }, 401);
  const owner = tok.owner_id as string;

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const metrics: any[] = payload?.data?.metrics ?? payload?.metrics ?? [];

  // Keyed maps: duplicates within one payload would break ON CONFLICT DO UPDATE
  const samples = new Map<string, any>();
  const bp = new Map<string, any>();

  for (const m of metrics) {
    const name = String(m?.name ?? "");
    const unit = m?.units ?? null;
    for (const d of m?.data ?? []) {
      if (!d?.date) continue;
      const recorded_at = toIso(String(d.date));
      const source = String(d.source ?? "");
      if (name === "blood_pressure") {
        const sys = num(d.systolic), dia = num(d.diastolic);
        if (sys !== null && dia !== null) bp.set(`${recorded_at}|${source}`, { owner_id: owner, recorded_at, systolic: sys, diastolic: dia, source });
        continue;
      }
      let value = num(d.qty) ?? num(d.Avg) ?? num(d.avg);
      let extra: any = null;
      if (name === "sleep_analysis") {
        value = num(d.totalSleep) ?? num(d.asleep);
        const { date: _d, source: _s, ...rest } = d;
        extra = rest;
      }
      samples.set(`${name}|${recorded_at}|${source}`, {
        owner_id: owner, metric: name, unit, recorded_at, value,
        value_min: num(d.Min) ?? num(d.min), value_max: num(d.Max) ?? num(d.max),
        source, extra,
      });
    }
  }
  const sRows = [...samples.values()];
  const bRows = [...bp.values()];

  try {
    let s = 0, b = 0;
    await sql.begin(async (tx) => {
      for (let i = 0; i < sRows.length; i += 500) {
        const chunk = sRows.slice(i, i + 500);
        const r = await tx`
          insert into health.metric_samples ${tx(chunk, "owner_id", "metric", "unit", "recorded_at", "value", "value_min", "value_max", "source", "extra")}
          on conflict (owner_id, metric, recorded_at, source) do update set
            value = excluded.value, value_min = excluded.value_min, value_max = excluded.value_max,
            unit = excluded.unit, extra = excluded.extra`;
        s += r.count;
      }
      for (let i = 0; i < bRows.length; i += 500) {
        const chunk = bRows.slice(i, i + 500);
        const r = await tx`
          insert into health.blood_pressure ${tx(chunk, "owner_id", "recorded_at", "systolic", "diastolic", "source")}
          on conflict (owner_id, recorded_at, source) do update set
            systolic = excluded.systolic, diastolic = excluded.diastolic`;
        b += r.count;
      }
      await tx`update health.ingest_tokens set last_used_at = now() where id = ${tok.id}`;
      await tx`insert into health.ingest_log (owner_id, metrics_count, samples_upserted, bp_upserted) values (${owner}, ${metrics.length}, ${s}, ${b})`;
    });
    return json({ ok: true, metrics: metrics.length, samples: s, blood_pressure: b });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sql`insert into health.ingest_log (owner_id, metrics_count, error) values (${owner}, ${metrics.length}, ${msg})`.catch(() => {});
    return json({ error: "insert failed", detail: msg }, 500);
  }
});
