// Felles romoppsett. Rekkefølgen her er rekkefølgen i kalenderen.
export const ROOMS = [
  { id: "elefantrommet", name: "Elefantrommet", booking: "direct", source: "supabase", rpc: "elefantrommet_availability" },
  { id: "glassrommet", name: "Glassrommet", booking: "direct", source: "supabase", rpc: "glassrommet_availability" },
  { id: "madsen", name: "Madsen-salen", booking: "speedadmin", source: "speedadmin" },
  { id: "volt", name: "Volt scene", booking: "request", source: "outlook", requestWindowDays: 7, requestTo: "emikon@lorenskog.kommune.no" },
];

// Supabase-nøkkelen under er den offentlige «publishable»-nøkkelen, laget for nettlesere.
// Den gir bare det RLS og funksjonene tillater (her: ledig/opptatt uten navn).
const SUPABASE_URL = "https://tjzxtgslprmxmrvvegpu.supabase.co";
const SUPABASE_KEY = "sb_publishable_9J9D0Btg8I6bM-rBhtdQ0g_5AghkPVI";

const hhmm = (ts) => String(ts).replace(" ", "T").slice(0, 16);

export async function fetchSupabaseRoom(room, from, to) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${room.rpc}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "content-type": "application/json" },
    body: JSON.stringify({ p_from: from, p_to: to }),
  });
  if (!res.ok) throw new Error(`${room.name}: Supabase svarte ${res.status}`);
  const rows = await res.json();
  return rows.map((r) => ({ start: hhmm(r.starts_at), end: hhmm(r.ends_at), allDay: false }));
}

// Madsen-salen: SpeedAdmin. Når toveis-API-et er klart fyller vi inn henting her
// (og skriving i en egen funksjon som også varsler undervisningsinspektøren).
export async function fetchMadsen(_from, _to) {
  const url = Netlify.env.get("SPEEDADMIN_API_URL");
  const key = Netlify.env.get("SPEEDADMIN_API_KEY");
  if (!url || !key) return { status: "pending", message: "Venter på SpeedAdmin-API", events: [] };
  throw new Error("SpeedAdmin-oppsett finnes, men henting er ikke koblet til ennå");
}
