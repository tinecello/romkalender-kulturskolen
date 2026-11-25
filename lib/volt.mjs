// Henter Volt scene ut av VOLT-husets Outlook-kalender (ICS).
// Kalenderen har mange rom; vi beholder bare hendelser der stedet er Volt scene.
import IcalExpander from "ical-expander";

const OSLO = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Oslo",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

// "2026-11-30T09:00" i norsk tid
export function osloLocal(date) {
  return OSLO.format(date).replace(" ", "T");
}

// «Volt scene», «volt scene», «VOLT Scene», «volt kafe; VOLT Scene», «Volt-scenen» …
const VOLT_SCENE = /volt[\s\-_]*scen/i;

export function isVoltScene(location, summary) {
  return VOLT_SCENE.test(location || "") || VOLT_SCENE.test(summary || "");
}

function pad(n) { return String(n).padStart(2, "0"); }
function icalDateStr(t) { return `${t.year}-${pad(t.month)}-${pad(t.day)}`; }

// Gjør én forekomst om til { start, end, allDay } i norsk lokal tid.
function toSlot(startTime, endTime) {
  if (startTime.isDate) {
    // Heldagshendelse: slutt-dato er eksklusiv i ICS. Vis som 08:00–20:00 hver dag.
    const days = [];
    const cur = startTime.clone();
    const end = endTime ? endTime.clone() : startTime.clone();
    if (!endTime || end.compare(cur) <= 0) { end.day += 1; end.normalize?.(); }
    let guard = 0;
    while (cur.compare(end) < 0 && guard++ < 60) {
      const d = icalDateStr(cur);
      days.push({ start: `${d}T08:00`, end: `${d}T20:00`, allDay: true });
      cur.day += 1;
      if (typeof cur.normalize === "function") cur.normalize();
    }
    return days;
  }
  return [{
    start: osloLocal(startTime.toJSDate()),
    end: osloLocal((endTime || startTime).toJSDate()),
    allDay: false,
  }];
}

/**
 * Plukker ut Volt scene-bookinger mellom fromDate og toDate (begge "YYYY-MM-DD", inklusive).
 * Ledig/TRANSPARENT telles som opptatt: øvingshelger står ofte som «Ledig» i Outlook.
 */
export function extractVoltScene(ics, fromDate, toDate) {
  const expander = new IcalExpander({ ics, maxIterations: 2000 });
  // Litt slingringsmonn rundt vinduet for tidssoner; filtreres nøyaktig etterpå.
  const from = new Date(`${fromDate}T00:00:00Z`);
  from.setUTCHours(from.getUTCHours() - 14);
  const to = new Date(`${toDate}T23:59:59Z`);
  to.setUTCHours(to.getUTCHours() + 14);

  const { events, occurrences } = expander.between(from, to);
  const slots = [];

  for (const ev of events) {
    if (ev.component.getFirstPropertyValue("status") === "CANCELLED") continue;
    if (!isVoltScene(ev.location, ev.summary)) continue;
    slots.push(...toSlot(ev.startDate, ev.endDate));
  }
  for (const occ of occurrences) {
    const item = occ.item;
    if (item.component.getFirstPropertyValue("status") === "CANCELLED") continue;
    if (!isVoltScene(item.location, item.summary)) continue;
    slots.push(...toSlot(occ.startDate, occ.endDate));
  }

  const lo = `${fromDate}T00:00`;
  const hi = `${toDate}T23:59`;
  const seen = new Set();
  return slots
    .filter((s) => s.end > lo && s.start <= hi)
    .filter((s) => {
      const k = s.start + "|" + s.end;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}
