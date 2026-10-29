# Health dashboard

Persoonlijk dashboard voor Apple Health-data, bloeddruk, bloedwaardes en StrongLifts-progressie.
Next.js 15 + Supabase (schema `health` in het tmc-project) + Vercel.

## Hoe het werkt

```
iPhone (Health Auto Export) ──POST JSON──▶ Edge Function health-ingest ──▶ health.metric_samples / health.blood_pressure
StrongLifts CSV ──upload in dashboard──▶ health.strength_sets
Lab-PDF ──upload in dashboard of via Claude──▶ health.lab_panels / health.lab_results (+ bucket health-labs)
```

Alle tabellen hebben RLS: alleen rijen met `owner_id = auth.uid()` zijn zichtbaar. Andere accounts in het tmc-project
(members, trainers) zien niets. `anon` heeft geen toegang tot het schema. De webhook-token staat alleen als sha256-hash in
`health.ingest_tokens`.

## Eenmalige setup

1. **Supabase → Project Settings → Data API → Exposed schemas**: voeg `health` toe. Zonder dit kan het dashboard niet lezen.
2. **Supabase → Authentication → URL Configuration → Redirect URLs**: voeg `https://<jouw-vercel-domein>/auth/callback`
   en `http://localhost:3000/auth/callback` toe.
3. **Vercel**: importeer deze repo en zet de env vars uit `.env.example`
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `ALLOWED_EMAIL`).
4. **Health Auto Export (iOS, premium)** → Automations → nieuwe REST API-automatisering:
   - URL: `https://xoivleieyfcxcfawgveh.supabase.co/functions/v1/health-ingest`
   - Header: `Authorization: Bearer <token>` (token staat in de chat, niet in deze repo)
   - Data type: Health Metrics, format JSON
   - Metrics: Weight, Body Fat Percentage, Lean Body Mass, Blood Pressure, Resting Heart Rate,
     Heart Rate Variability, Sleep Analysis, Step Count
   - Summarize data: **uit** voor bloeddruk (dan blijven ochtend- en avondmetingen apart), voor de rest mag aan
   - Periode: since last sync, elk uur of een paar keer per dag
   - Gebruik "Manual export" één keer met een lange periode om je historie in te laden

Lokaal draaien: `cp .env.example .env.local && npm install && npm run dev`.

## Data toevoegen

- **StrongLifts**: in de app Settings → Export Data, CSV mailen, uploaden op `/training`. De parser herkent zowel
  één rij per set als één rij per oefening met `Set 1..N`-kolommen; de preview laat zien wat er herkend is.
  Opnieuw importeren is veilig (upsert).
- **Bloedwaardes**: `/labs/nieuw`, of upload de PDF bij Claude in de chat; Claude zet de waardes direct in de database.
  Gebruik per marker steeds dezelfde naam (bijv. "LDL-cholesterol"), de `marker`-key is de slug daarvan.
- **Interventies**: `/events`. Verschijnen als stippellijn in alle grafieken.

## Schema (health)

| Tabel / view | Inhoud |
| --- | --- |
| `metric_samples` | Ruwe Apple Health-samples, één rij per metric/tijdstip/bron |
| `blood_pressure` | Losse bloeddrukmetingen |
| `lab_panels`, `lab_results` | Afnames en waardes met referentiebereik |
| `strength_sets` | Sets uit StrongLifts |
| `events` | Interventies |
| `ingest_tokens`, `ingest_log` | Webhook-auth (hash) en sync-log |
| `daily_metrics`, `daily_blood_pressure`, `daily_e1rm` | Dagaggregaten (security_invoker, dus RLS geldt) |

Nieuwe webhook-token maken (oude blijft werken tot je hem verwijdert):

```sql
with t as (select 'hae_' || encode(extensions.gen_random_bytes(24), 'hex') as token),
ins as (insert into health.ingest_tokens (owner_id, token_hash, label)
  select u.id, encode(extensions.digest(t.token, 'sha256'), 'hex'), 'nieuw'
  from t, auth.users u where u.email = 'me@ilja.com' returning id)
select token from t;
```
