import { readFileSync } from "node:fs";
const ics = readFileSync(new URL("./sample.ics", import.meta.url), "utf8");
globalThis.Netlify = { env: { get: (k) => ({ VOLT_ICS_URL: "https://example/volt.ics" })[k] } };
globalThis.fetch = async (url, opts) => {
  if (String(url).includes("volt.ics")) return new Response(ics);
  if (String(url).includes("elefantrommet_availability")) return Response.json([{ starts_at: "2026-12-02T12:00:00", ends_at: "2026-12-02T13:00:00" }]);
  if (String(url).includes("glassrommet_availability")) return new Response("down", { status: 503 });
  throw new Error("unexpected " + url);
};
const { default: handler } = await import("../netlify/functions/kalender.mts");
const ok = await handler(new Request("https://x/api/kalender?from=2026-11-30&to=2026-12-04"));
console.log(ok.status, JSON.stringify(await ok.json(), null, 1));
const bad = await handler(new Request("https://x/api/kalender?from=2026-11-30&to=2027-03-01"));
console.log(bad.status, await bad.text());
