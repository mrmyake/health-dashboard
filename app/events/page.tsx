import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEvents } from "@/lib/data";

export const dynamic = "force-dynamic";

async function addEvent(form: FormData) {
  "use server";
  const supabase = await createClient();
  await supabase.from("events").insert({
    happened_on: String(form.get("happened_on")),
    title: String(form.get("title")).slice(0, 80),
    category: String(form.get("category") || "other"),
    notes: String(form.get("notes") || "") || null,
  });
  revalidatePath("/", "layout");
}

async function deleteEvent(form: FormData) {
  "use server";
  const supabase = await createClient();
  await supabase.from("events").delete().eq("id", String(form.get("id")));
  revalidatePath("/", "layout");
}

const CATS: Record<string, string> = { training: "Training", food: "Voeding", medication: "Medicatie", sleep: "Slaap", other: "Overig" };

export default async function Events() {
  const events = await getEvents();
  return (
    <>
      <h1>Interventies</h1>
      <p className="sub">Wat je verandert, verschijnt als stippellijn in elke grafiek. Zo zie je of het effect heeft.</p>
      <form action={addEvent} className="card stack">
        <div className="row">
          <label>Datum<input type="date" name="happened_on" required defaultValue={new Date().toISOString().slice(0, 10)} /></label>
          <label style={{ flex: 2 }}>Wat<input name="title" required placeholder="Start StrongLifts" maxLength={80} /></label>
          <label>Categorie
            <select name="category" defaultValue="training">{Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </label>
        </div>
        <label>Notities<input name="notes" /></label>
        <div><button>Toevoegen</button></div>
      </form>
      <div className="card section">
        {events.length ? (
          <table>
            <thead><tr><th>Datum</th><th>Wat</th><th>Categorie</th><th /></tr></thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.happened_on + "T12:00:00").toLocaleDateString("nl-NL")}</td>
                  <td>{e.title}{e.notes && <div className="muted">{e.notes}</div>}</td>
                  <td>{CATS[e.category ?? "other"] ?? e.category}</td>
                  <td className="num"><form action={deleteEvent}><input type="hidden" name="id" value={e.id} /><button className="ghost">Verwijder</button></form></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="empty">Nog geen interventies</div>}
      </div>
    </>
  );
}
