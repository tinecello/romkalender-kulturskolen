// GET /api/kalender?from=2026-11-30&to=2026-12-04
// Samler ledig/opptatt for Elefantrommet, Glassrommet, Madsen-salen og Volt scene.
import type { Config } from "@netlify/functions";
import { ROOMS, fetchSupabaseRoom, fetchMadsen } from "../../lib/rooms.mjs";
import { extractVoltScene } from "../../lib/volt.mjs";

const MAX_DAYS = 35;
const ICS_TTL_MS = 5 * 60 * 1000;
let icsCache: { at: number; text: string } | null = null;

async function getVoltIcs(): Promise<string> {
  if (icsCache && Date.now() - icsCache.at < ICS_TTL_MS) return icsCache.text;
  const url = Netlify.env.get("VOLT_ICS_URL");
  if (!url) throw new Error("VOLT_ICS_URL mangler");
  const res = await fetch(url, { headers: { accept: "text/calendar" } });
  if (!res.ok) throw new Error(`Outlook svarte ${res.status}`);
  const text = await res.text();
  icsCache = { at: Date.now(), text };
  return text;
}

const isDate = (s: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export default async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const from = q.get("from");
  const to = q.get("to");
  if (!isDate(from) || !isDate(to) || to! < from!) {
    return Response.json({ error: "Bruk ?from=ÅÅÅÅ-MM-DD&to=ÅÅÅÅ-MM-DD" }, { status: 400 });
  }
  const days = (Date.parse(to!) - Date.parse(from!)) / 86400000;
  if (days > MAX_DAYS) {
    return Response.json({ error: `Velg et tidsrom på høyst ${MAX_DAYS} dager` }, { status: 400 });
  }

  const rooms = await Promise.all(ROOMS.map(async (room) => {
    const base = {
      id: room.id, name: room.name, booking: room.booking,
      ...(room.requestWindowDays ? { requestWindowDays: room.requestWindowDays } : {}),
    };
    try {
      if (room.source === "supabase") {
        return { ...base, status: "ok", events: await fetchSupabaseRoom(room, from, to) };
      }
      if (room.source === "outlook") {
        return { ...base, status: "ok", events: extractVoltScene(await getVoltIcs(), from!, to!) };
      }
      if (room.source === "speedadmin") {
        const r = await fetchMadsen(from, to);
        return { ...base, ...r };
      }
      return { ...base, status: "error", message: "Ukjent kilde", events: [] };
    } catch (err) {
      console.error(room.id, err);
      return { ...base, status: "error", message: "Kunne ikke hente kalenderen akkurat nå", events: [] };
    }
  }));

  return Response.json(
    { from, to, timezone: "Europe/Oslo", generatedAt: new Date().toISOString(), rooms },
    {
      headers: {
        "Cache-Control": "public, max-age=60",
        "Netlify-CDN-Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    },
  );
};

export const config: Config = { path: "/api/kalender", method: "GET" };
