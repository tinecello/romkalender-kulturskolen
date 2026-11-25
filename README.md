# Romkalender – Lørenskog Kulturskole

Felles oversikt og booking for Elefantrommet, Glassrommet, Madsen-salen og Volt scene.

`GET /api/kalender?from=ÅÅÅÅ-MM-DD&to=ÅÅÅÅ-MM-DD` (maks 35 dager) gir ledig/opptatt per rom i norsk tid.

| Rom | Kilde |
|---|---|
| Elefantrommet, Glassrommet | Supabase-funksjonene `*_availability` (leser bare, endrer ingenting) |
| Madsen-salen | SpeedAdmin (venter på API) |
| Volt scene | Outlook-kalenderen «volt», filtrert på Volt scene |

Miljøvariabler i Netlify: `VOLT_ICS_URL`, senere `SPEEDADMIN_API_URL` og `SPEEDADMIN_API_KEY`.

Test: `npm install && npm test`
