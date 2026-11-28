import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Offentlig «publishable»-nøkkel; tilgang styres av reglene i databasen.
const sb = createClient("https://tjzxtgslprmxmrvvegpu.supabase.co", "sb_publishable_9J9D0Btg8I6bM-rBhtdQ0g_5AghkPVI");

const ROOMS = {
  elefantrommet: { color: "#C70054", tint: "#F6E1EA", ink: "#6A0023", badge: "Book direkte", note: "Møterom", table: "elefantrommet_bookings", members: "elefantrommet_members" },
  glassrommet: { color: "#2F5DA8", tint: "#E3EBF7", ink: "#1E3C6E", badge: "Book direkte", note: "Møterom", table: "glassrommet_bookings", members: "glassrommet_members" },
  madsen: { color: "#B4570B", tint: "#F8E8D8", ink: "#6E3407", badge: "SpeedAdmin", note: "Synkes med SpeedAdmin" },
  volt: { color: "#4A4A55", tint: "#ECEBEF", ink: "#2E2E36", badge: "Forespørsel", note: "Vises fra VOLT-kalenderen" },
};
const DAYNAMES = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag"];
const SHORT = ["Man", "Tir", "Ons", "Tor", "Fre"];
const MONTHS = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];
const VOLT_DAYS = 7;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const parseYmd = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const nice = (s) => { const d = parseYmd(s); return `${d.getDate()}. ${MONTHS[d.getMonth()]}`; };
const hm = (iso) => iso.slice(11, 16);
function monday(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const wd = (x.getDay() + 6) % 7; return addDays(x, -wd); }
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y) / 86400000 + 1) / 7);
}
const todayStr = () => ymd(new Date());

const state = {
  week: (() => { const n = new Date(); const wd = (n.getDay() + 6) % 7; return monday(wd >= 5 ? addDays(n, 7) : n); })(),
  filter: "alle", day: 0, rooms: [], user: null, name: "", mine: [],
};

// ---------- Data ----------
async function load() {
  const from = ymd(state.week), to = ymd(addDays(state.week, 4));
  setStatus("Henter kalenderen …");
  try {
    const res = await fetch(`/api/kalender?from=${from}&to=${to}`);
    if (!res.ok) throw new Error(res.status);
    state.rooms = (await res.json()).rooms;
    setStatus("");
  } catch (e) {
    setStatus("Fikk ikke hentet kalenderen. Prøv å laste siden på nytt.");
    state.rooms = [];
  }
  await loadMine();
  render();
}

async function loadMine() {
  state.mine = [];
  if (!state.user) return;
  const since = `${todayStr()}T00:00:00`;
  for (const id of ["elefantrommet", "glassrommet"]) {
    const { data } = await sb.from(ROOMS[id].table)
      .select("id,title,starts_at,ends_at")
      .eq("owner_id", state.user.id).is("cancelled_at", null).gte("starts_at", since)
      .order("starts_at");
    (data || []).forEach((b) => state.mine.push({ ...b, room: id, start: b.starts_at.slice(0, 16), end: b.ends_at.slice(0, 16) }));
  }
  state.mine.sort((a, b) => a.start.localeCompare(b.start));
}

function setStatus(t) { const s = $("status"); s.textContent = t; s.hidden = !t; }

// ---------- Visning ----------
function weekDays() { return [0, 1, 2, 3, 4].map((i) => ymd(addDays(state.week, i))); }

function cellInfo(room, date) {
  const cfg = ROOMS[room.id];
  const today = todayStr();
  const evs = room.events.filter((e) => e.start.slice(0, 10) === date).map((e) => {
    const mine = state.mine.find((m) => m.room === room.id && m.start === e.start && m.end === e.end);
    return { ...e, mine };
  });
  let act = null, lock = null;
  if (date >= today && room.status !== "error") {
    if (room.booking === "direct") act = { label: "+ Book", fn: () => openBook(room.id, date) };
    else if (room.booking === "request") {
      const opens = ymd(addDays(parseYmd(date), -VOLT_DAYS));
      if (opens <= today) act = { label: "Send forespørsel", fn: () => openVolt(date) };
      else lock = `Forespørsel åpner ${nice(opens)}`;
    }
  }
  return { cfg, evs, act, lock, past: date < today };
}

function evHtml(e, cfg) {
  const time = e.allDay ? "Hele dagen" : `${hm(e.start)}–${hm(e.end)}`;
  const style = e.mine ? `background:${cfg.color};color:#fff` : `background:${cfg.tint};color:${cfg.ink}`;
  const label = e.mine ? `Din booking · ${esc(e.mine.title)}` : "Opptatt";
  return `<div class="ev" style="${style}"><b>${time}</b><span>${label}</span></div>`;
}

const lockSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;

function roomNote(room) {
  const cfg = ROOMS[room.id];
  if (room.status === "pending") return "Venter på SpeedAdmin – viser ingen tider ennå";
  if (room.status === "error") return "Kunne ikke hente kalenderen akkurat nå";
  return cfg.note;
}

function render() {
  const days = weekDays();
  const today = todayStr();
  $("weekNo").textContent = `Uke ${isoWeek(state.week)}`;
  const last = addDays(state.week, 4);
  $("weekRange").textContent = `${state.week.getDate()}. ${MONTHS[state.week.getMonth()]} – ${last.getDate()}. ${MONTHS[last.getMonth()]} ${last.getFullYear()}`;

  // Filtre
  const fl = [{ id: "alle", name: "Alle rom" }, ...state.rooms];
  $("filters").innerHTML = fl.map((r) => `<button class="chip" data-f="${r.id}" aria-pressed="${state.filter === r.id}">${r.id === "alle" ? "" : `<i class="dot" style="background:${ROOMS[r.id].color}"></i>`}${esc(r.name)}</button>`).join("");

  // Ukesvisning
  const actions = [];
  const head = `<div class="grow ghead"><div class="gc"><span class="small muted" style="font-weight:600;text-transform:uppercase;letter-spacing:.04em">Rom</span></div>${days.map((d, i) => `<div class="gc${d === today ? " today" : ""}"><span class="dname">${DAYNAMES[i]}${d === today ? " · i dag" : ""}</span><span class="small muted">${nice(d)}</span></div>`).join("")}</div>`;
  const rows = state.rooms.filter((r) => state.filter === "alle" || state.filter === r.id).map((room) => {
    const cfg = ROOMS[room.id];
    const cells = days.map((d) => {
      const c = cellInfo(room, d);
      let h = c.evs.map((e) => evHtml(e, cfg)).join("");
      if (c.act) { actions.push(c.act.fn); h += `<button class="act" style="color:${cfg.ink}" data-a="${actions.length - 1}">${c.act.label}</button>`; }
      if (c.lock) h += `<div class="lock">${lockSvg}${c.lock}</div>`;
      return `<div class="gc${c.past ? " past" : ""}">${h}</div>`;
    }).join("");
    return `<div class="grow"><div class="gc roomcell"><div class="rname"><i class="dot" style="width:12px;height:12px;background:${cfg.color}"></i>${esc(room.name)}</div><span class="badge" style="background:${cfg.tint};color:${cfg.ink}">${cfg.badge}</span><span class="rnote">${roomNote(room)}</span></div>${cells}</div>`;
  }).join("");
  $("grid").innerHTML = head + rows;

  // Dagsvisning (mobil)
  $("dayTabs").innerHTML = days.map((d, i) => `<button class="daytab" data-d="${i}" aria-pressed="${state.day === i}"><span>${SHORT[i]}</span><strong>${parseYmd(d).getDate()}</strong></button>`).join("");
  const date = days[state.day];
  $("dayRooms").innerHTML = state.rooms.map((room) => {
    const cfg = ROOMS[room.id];
    const c = cellInfo(room, date);
    const bars = c.evs.map((e) => {
      const s = e.allDay ? 8 : +hm(e.start).slice(0, 2) + +hm(e.start).slice(3) / 60;
      const en = e.allDay ? 20 : +hm(e.end).slice(0, 2) + +hm(e.end).slice(3) / 60;
      const l = Math.max(0, (s - 8) / 12 * 100), w = Math.max(1, (Math.min(20, en) - Math.max(8, s)) / 12 * 100);
      return `<i style="left:${l}%;width:${w}%;background:${e.mine ? cfg.color : room.id === "volt" ? "#B9B8C2" : cfg.color + "66"}"></i>`;
    }).join("");
    const sum = room.status === "pending" ? "Venter på SpeedAdmin" : c.evs.length
      ? "Opptatt " + c.evs.map((e) => (e.allDay ? "hele dagen" : `${hm(e.start)}–${hm(e.end)}`) + (e.mine ? " (din booking)" : "")).join(", ")
      : "Ledig hele dagen";
    let btn = "";
    if (c.act) {
      actions.push(c.act.fn);
      const st = room.booking === "request" ? "background:#fff;color:#2E2E36;border:1.5px solid #4A4A55" : `background:${cfg.color}`;
      btn = `<button class="dbtn" style="${st}" data-a="${actions.length - 1}">${room.booking === "request" ? "Send forespørsel til Emilie" : "+ Book " + esc(room.name)}</button>`;
    }
    if (c.lock) btn = `<div class="lock">${lockSvg}${c.lock}</div>`;
    return `<section class="dcard"><div class="dtop"><div class="rname"><i class="dot" style="width:12px;height:12px;background:${cfg.color}"></i>${esc(room.name)}</div><span class="badge" style="background:${cfg.tint};color:${cfg.ink}">${cfg.badge}</span></div><div class="bar">${bars}</div><div class="ticks"><span>08</span><span>11</span><span>14</span><span>17</span><span>20</span></div><div class="dsum">${sum}</div>${btn}</section>`;
  }).join("");

  document.querySelectorAll("[data-a]").forEach((b) => b.onclick = actions[+b.dataset.a]);
  document.querySelectorAll("[data-f]").forEach((b) => b.onclick = () => { state.filter = b.dataset.f; render(); });
  document.querySelectorAll("[data-d]").forEach((b) => b.onclick = () => { state.day = +b.dataset.d; render(); });
}

// ---------- Tider ----------
function timeOptions(sel, from, to, value) {
  const opts = [];
  for (let m = from * 60; m <= to * 60; m += 15) opts.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  sel.innerHTML = opts.map((t) => `<option${t === value ? " selected" : ""}>${t}</option>`).join("");
}
function busyOn(roomId, date) {
  const room = state.rooms.find((r) => r.id === roomId);
  return room ? room.events.filter((e) => e.start.slice(0, 10) === date) : [];
}
function busyText(roomId, date) {
  const b = busyOn(roomId, date);
  return b.length ? "Opptatt denne dagen: " + b.map((e) => (e.allDay ? "hele dagen" : `${hm(e.start)}–${hm(e.end)}`)).join(", ") : "Ledig hele dagen";
}
function overlaps(roomId, date, from, to) {
  return busyOn(roomId, date).some((e) => (e.allDay ? "08:00" : hm(e.start)) < to && (e.allDay ? "20:00" : hm(e.end)) > from);
}
function isWeekday(s) { const d = parseYmd(s).getDay(); return d >= 1 && d <= 5; }

// ---------- Booking ----------
let bookRoom = null;
function openBook(roomId, date) {
  if (!state.user) { openLogin(); return; }
  bookRoom = roomId;
  const f = $("formBook"); const cfg = ROOMS[roomId];
  $("bookRoomTag").innerHTML = `<i class="dot" style="background:${cfg.color}"></i>${esc(state.rooms.find((r) => r.id === roomId).name)}`;
  f.date.value = date; f.date.min = todayStr();
  timeOptions(f.from, 8, 19.75, "09:00"); timeOptions(f.to, 8.25, 20, "10:00");
  f.title.value = ""; $("bookMsg").textContent = ""; $("bookMsg").className = "msg";
  $("bookBusy").textContent = busyText(roomId, date);
  f.date.onchange = () => { $("bookBusy").textContent = busyText(roomId, f.date.value); };
  $("dlgBook").showModal();
}

$("formBook").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = ev.target, msg = $("bookMsg");
  const date = f.date.value, from = f.from.value, to = f.to.value;
  msg.className = "msg bad";
  if (!isWeekday(date)) { msg.textContent = "Velg en hverdag."; return; }
  if (date < todayStr()) { msg.textContent = "Datoen har vært."; return; }
  if (to <= from) { msg.textContent = "Sluttid må være etter starttid."; return; }
  // Sjekk mot uka som vises; databasen stopper uansett dobbeltbooking.
  if (overlaps(bookRoom, date, from, to)) { msg.textContent = "Rommet er opptatt i dette tidsrommet."; return; }
  const btn = f.querySelector("[type=submit]"); btn.disabled = true;
  const { error } = await sb.from(ROOMS[bookRoom].table).insert({ title: f.title.value.trim(), starts_at: `${date}T${from}:00`, ends_at: `${date}T${to}:00` });
  btn.disabled = false;
  if (error) {
    msg.textContent = error.code === "23P01" ? "Noen har nettopp booket dette tidsrommet. Velg en annen tid."
      : error.code === "42501" ? "Du har ikke tilgang til å booke dette rommet. Ta kontakt med Tine."
      : error.code === "23514" ? "Velg hverdag mellom kl. 08 og 20."
      : "Bookingen ble ikke lagret. Prøv igjen.";
    return;
  }
  $("dlgBook").close();
  const d = parseYmd(date);
  if (date < ymd(state.week) || date > ymd(addDays(state.week, 4))) state.week = monday(d);
  load();
});

// ---------- Volt-forespørsel ----------
function openVolt(date) {
  const f = $("formVolt");
  f.dato.value = date; f.dato.min = todayStr(); f.dato.max = ymd(addDays(new Date(), VOLT_DAYS));
  timeOptions(f.fra, 8, 19.75, "17:00"); timeOptions(f.til, 8.25, 20, "19:00");
  if (state.user) { f.epost.value = state.user.email || ""; if (state.name) f.navn.value = state.name; }
  $("voltMsg").textContent = ""; $("voltMsg").className = "msg";
  $("voltBusy").textContent = busyText("volt", date);
  f.dato.onchange = () => { $("voltBusy").textContent = busyText("volt", f.dato.value); };
  $("dlgVolt").showModal();
}

$("formVolt").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = ev.target, msg = $("voltMsg");
  msg.className = "msg bad";
  if (f.til.value <= f.fra.value) { msg.textContent = "Sluttid må være etter starttid."; return; }
  if (f.dato.value > f.dato.max) { msg.textContent = `Forespørsler kan sendes tidligst ${VOLT_DAYS} dager før.`; return; }
  if (overlaps("volt", f.dato.value, f.fra.value, f.til.value)) { msg.textContent = "Volt scene er opptatt i dette tidsrommet."; return; }
  const btn = f.querySelector("[type=submit]"); btn.disabled = true;
  try {
    const res = await fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(new FormData(f)).toString() });
    if (!res.ok) throw new Error(res.status);
    msg.className = "msg good";
    msg.textContent = "Forespørselen er sendt til Emilie. Du får svar på e-post.";
    setTimeout(() => $("dlgVolt").close(), 2500);
  } catch {
    msg.textContent = "Forespørselen ble ikke sendt. Prøv igjen, eller send e-post til emikon@lorenskog.kommune.no.";
  } finally { btn.disabled = false; }
});

// ---------- Innlogging ----------
function openLogin() { $("loginMsg").textContent = ""; $("dlgLogin").showModal(); }
$("btnLogin").onclick = openLogin;
$("btnLogout").onclick = async () => { await sb.auth.signOut(); };
$("formLogin").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const email = ev.target.email.value.trim().toLowerCase(), msg = $("loginMsg");
  const btn = $("loginSubmit"); btn.disabled = true;
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + "/" } });
  btn.disabled = false;
  msg.className = error ? "msg bad" : "msg good";
  msg.textContent = !error ? "Sjekk innboksen din (og søppelpost) og trykk på lenken. Bare den nyeste lenken virker."
    : error.status === 429 ? "Lenken er allerede sendt – sjekk innboksen. Vil du ha en ny, vent ett minutt."
    : "Kunne ikke sende lenken. Sjekk e-postadressen og prøv igjen.";
});

async function onSession(session) {
  state.user = session?.user || null;
  state.name = "";
  if (state.user) {
    const { data } = await sb.from("elefantrommet_members").select("display_name").maybeSingle();
    const g = data ? null : (await sb.from("glassrommet_members").select("display_name").maybeSingle()).data;
    state.name = (data || g)?.display_name || "";
  }
  $("whoName").textContent = state.user ? (state.name || state.user.email) : "";
  $("btnLogin").hidden = !!state.user;
  $("btnLogout").hidden = !state.user;
  $("btnMine").hidden = !state.user;
  // Admin-knappen vises bare hvis databasen godtar admin-kallet (kun Tine).
  state.admin = false;
  if (state.user) { const { error } = await sb.rpc("elefantrommet_list_members"); state.admin = !error; }
  $("btnAdmin").hidden = !state.admin;
  await loadMine();
  render();
}
sb.auth.onAuthStateChange((_e, session) => { setTimeout(() => onSession(session), 0); });

// ---------- Dine bookinger ----------
function renderMine() {
  const list = $("mineList");
  if (!state.mine.length) { list.innerHTML = `<p class="muted">Du har ingen kommende bookinger.</p>`; return; }
  list.innerHTML = state.mine.map((b, i) => {
    const d = b.start.slice(0, 10), dn = DAYNAMES[(parseYmd(d).getDay() + 6) % 7] || "";
    return `<div class="mrow"><div><div style="font-weight:700"><i class="dot" style="background:${ROOMS[b.room].color};margin-right:6px"></i>${esc(state.rooms.find((r) => r.id === b.room)?.name || b.room)}</div><div class="small muted">${dn} ${nice(d)} · ${hm(b.start)}–${hm(b.end)} · ${esc(b.title)}</div></div><button class="btn ghost sm" data-c="${i}">Avbestill</button></div>`;
  }).join("");
  list.querySelectorAll("[data-c]").forEach((btn) => btn.onclick = async () => {
    if (btn.dataset.sure !== "1") { btn.dataset.sure = "1"; btn.textContent = "Bekreft avbestilling"; return; }
    const b = state.mine[+btn.dataset.c];
    btn.disabled = true;
    const { error } = await sb.from(ROOMS[b.room].table).update({ cancelled_at: new Date().toISOString() }).eq("id", b.id);
    if (error) { btn.disabled = false; btn.textContent = "Prøv igjen"; return; }
    await load(); renderMine();
  });
}
$("btnMine").onclick = () => { renderMine(); $("dlgMine").showModal(); };

// ---------- Administrer brukere ----------
const MEMBER_ROOMS = ["elefantrommet", "glassrommet"];
const ROOM_NAMES = { elefantrommet: "Elefantrommet", glassrommet: "Glassrommet" };
const ADMIN_EMAIL = "tjohnsgaard@gmail.com";
let members = [];

async function loadMembers() {
  const map = new Map();
  for (const id of MEMBER_ROOMS) {
    const { data, error } = await sb.rpc(`${id}_list_members`);
    if (error) throw error;
    (data || []).forEach((m) => {
      const u = map.get(m.email) || { email: m.email, name: m.display_name, rooms: [] };
      u.rooms.push(id); map.set(m.email, u);
    });
  }
  members = [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "nb") || a.email.localeCompare(b.email));
}

function renderMembers() {
  const q = $("memberSearch").value.trim().toLowerCase();
  const list = members.filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.includes(q));
  $("memberCount").textContent = `Brukere (${members.length})`;
  const box = $("memberList");
  if (!list.length) { box.innerHTML = `<p class="muted" style="padding:12px 0">Ingen treff.</p>`; return; }
  box.innerHTML = list.map((u) => {
    const tags = MEMBER_ROOMS.map((id) => u.rooms.includes(id)
      ? `<span class="tag" style="background:${ROOMS[id].tint};color:${ROOMS[id].ink}">${ROOM_NAMES[id]}</span>`
      : `<button class="tag add" data-grant="${esc(u.email)}" data-room="${id}">+ ${ROOM_NAMES[id]}</button>`).join("");
    const rm = u.email === ADMIN_EMAIL ? `<span class="small muted">Administrator</span>` : `<button class="btn ghost sm" data-rm="${esc(u.email)}">Fjern</button>`;
    return `<div class="urow"><div class="who2"><div style="font-weight:700">${esc(u.name)}</div><div class="small muted">${esc(u.email)}</div><div class="tags">${tags}</div></div>${rm}</div>`;
  }).join("");
  box.querySelectorAll("[data-grant]").forEach((b) => b.onclick = async () => {
    const u = members.find((m) => m.email === b.dataset.grant);
    b.disabled = true;
    const { error } = await sb.rpc(`${b.dataset.room}_add_member`, { p_email: u.email, p_name: u.name });
    if (error) { b.disabled = false; b.textContent = "Prøv igjen"; return; }
    await refreshMembers();
  });
  box.querySelectorAll("[data-rm]").forEach((b) => b.onclick = async () => {
    if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "Bekreft – fjern fra begge rom"; return; }
    b.disabled = true;
    const u = members.find((m) => m.email === b.dataset.rm);
    for (const id of u.rooms) {
      const { error } = await sb.rpc(`${id}_remove_member`, { p_email: u.email });
      if (error) { b.disabled = false; b.textContent = "Prøv igjen"; return; }
    }
    await refreshMembers();
  });
}

async function refreshMembers() {
  try { await loadMembers(); renderMembers(); }
  catch { $("memberList").innerHTML = `<p class="msg bad" style="padding:12px 0">Fikk ikke hentet brukerlisten. Logg inn på nytt og prøv igjen.</p>`; }
}

$("btnAdmin").onclick = async () => {
  $("addMsg").textContent = ""; $("memberSearch").value = "";
  $("memberList").innerHTML = `<p class="muted" style="padding:12px 0">Henter brukere …</p>`;
  $("dlgAdmin").showModal();
  await refreshMembers();
};
$("memberSearch").oninput = renderMembers;

$("formAdd").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = ev.target, msg = $("addMsg");
  const name = f.fullname.value.trim(), email = f.email.value.trim().toLowerCase();
  const rooms = MEMBER_ROOMS.filter((id) => f[id].checked);
  msg.className = "msg bad";
  if (!rooms.length) { msg.textContent = "Velg minst ett rom."; return; }
  const btn = f.querySelector("[type=submit]"); btn.disabled = true;
  const added = [], already = [];
  for (const id of rooms) {
    const { data, error } = await sb.rpc(`${id}_add_member`, { p_email: email, p_name: name });
    if (error) {
      btn.disabled = false;
      msg.textContent = error.code === "22023" ? "Sjekk navn og e-postadresse." : "Brukeren ble ikke lagt til. Prøv igjen.";
      await refreshMembers(); return;
    }
    (data ? added : already).push(ROOM_NAMES[id]);
  }
  btn.disabled = false;
  msg.className = "msg good";
  msg.textContent = (added.length ? `${name} er lagt til i ${added.join(" og ")}.` : "")
    + (already.length ? ` Var allerede registrert i ${already.join(" og ")}.` : "");
  f.fullname.value = ""; f.email.value = "";
  await refreshMembers();
});

// ---------- Navigasjon ----------
document.querySelectorAll("[data-close]").forEach((b) => b.onclick = () => b.closest("dialog").close());
$("prev").onclick = () => { state.week = addDays(state.week, -7); state.day = 0; load(); };
$("next").onclick = () => { state.week = addDays(state.week, 7); state.day = 0; load(); };
$("today").onclick = () => {
  const n = new Date(); const wd = (n.getDay() + 6) % 7;
  state.week = monday(wd >= 5 ? addDays(n, 7) : n); state.day = wd < 5 ? wd : 0; load();
};
{ const wd = (new Date().getDay() + 6) % 7; state.day = wd < 5 ? wd : 0; }

load();
