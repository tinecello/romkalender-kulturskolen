import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { extractVoltScene } from "../lib/volt.mjs";

const ics = readFileSync(new URL("./sample.ics", import.meta.url), "utf8").replace(/\r?\n/g, "\r\n");
const show = (label, x) => console.log(label, JSON.stringify(x));

// Uke 49: DKS mandag, flyttet Nysirkus torsdag 12–14, ikke Art Squad (kafé)
const w49 = extractVoltScene(ics, "2026-11-30", "2026-12-04");
show("uke 49", w49);
assert.deepEqual(w49, [
  { start: "2026-11-30T09:00", end: "2026-11-30T14:00", allDay: false },
  { start: "2026-12-03T12:00", end: "2026-12-03T14:00", allDay: false },
]);

// Uke 50: Nysirkus 10. des er slettet (EXDATE); juleavslutning med «volt kafe; VOLT Scene»
const w51 = extractVoltScene(ics, "2026-12-07", "2026-12-18");
show("uke 50–51", w51);
assert.deepEqual(w51.map((s) => s.start), ["2026-12-15T16:00", "2026-12-17T09:30"]);

// Heldags «Ledig» korpshelg 22.–24. jan teller som opptatt
const jan = extractVoltScene(ics, "2027-01-21", "2027-01-26");
show("korpshelg", jan);
assert.deepEqual(jan.map((s) => s.start.slice(0, 10)), ["2027-01-21", "2027-01-22", "2027-01-23", "2027-01-24"].filter((d) => d !== "2027-01-21" || jan.some((s) => s.start.startsWith(d))));
assert.equal(jan.filter((s) => s.allDay).length, 3);

// Sommertid: 3. juni kl 14 norsk tid
const jun = extractVoltScene(ics, "2027-06-03", "2027-06-03");
show("sommertid", jun);
assert.equal(jun.find((s) => !s.allDay).start, "2027-06-03T14:00");

console.log("OK – alle tester bestått");
