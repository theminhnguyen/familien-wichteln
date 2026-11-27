'use strict';
/*
 * Wichteln / Secret Santa / Quà bí mật
 * Static single-page app. All data lives in Supabase (project "pixelpost", private schema "wichteln")
 * and is only reachable through token-checked RPC functions (public.wichteln_*).
 */

const CFG = {
  url: 'https://moezhswmybxxeplncgyy.supabase.co',
  key: 'sb_publishable_XNkGqoR-HyQmi5mjAXXt_A_u6gL1P-f',
};

const LAYOUTS = ['classic', 'nordic', 'lantern'];
const LANGS = ['de', 'en', 'vi'];
const LOCALES = { de: 'de-DE', en: 'en-GB', vi: 'vi-VN' };
const THEME_COLOR = { classic: '#EEF2F8', nordic: '#F7F9F8', lantern: '#FFF5EF' };
const COUNTRIES = {
  DE: ['EUR', 'Europe/Berlin'], VN: ['VND', 'Asia/Ho_Chi_Minh'], AT: ['EUR', 'Europe/Vienna'],
  CH: ['CHF', 'Europe/Zurich'], NL: ['EUR', 'Europe/Amsterdam'], BE: ['EUR', 'Europe/Brussels'],
  LU: ['EUR', 'Europe/Luxembourg'], FR: ['EUR', 'Europe/Paris'], IT: ['EUR', 'Europe/Rome'],
  ES: ['EUR', 'Europe/Madrid'], PT: ['EUR', 'Europe/Lisbon'], IE: ['EUR', 'Europe/Dublin'],
  FI: ['EUR', 'Europe/Helsinki'], GB: ['GBP', 'Europe/London'], DK: ['DKK', 'Europe/Copenhagen'],
  SE: ['SEK', 'Europe/Stockholm'], NO: ['NOK', 'Europe/Oslo'], PL: ['PLN', 'Europe/Warsaw'],
  CZ: ['CZK', 'Europe/Prague'], HU: ['HUF', 'Europe/Budapest'], RO: ['RON', 'Europe/Bucharest'],
  US: ['USD', 'America/New_York'], CA: ['CAD', 'America/Toronto'], AU: ['AUD', 'Australia/Sydney'],
  NZ: ['NZD', 'Pacific/Auckland'], JP: ['JPY', 'Asia/Tokyo'], KR: ['KRW', 'Asia/Seoul'],
  CN: ['CNY', 'Asia/Shanghai'], TW: ['TWD', 'Asia/Taipei'], HK: ['HKD', 'Asia/Hong_Kong'],
  SG: ['SGD', 'Asia/Singapore'], TH: ['THB', 'Asia/Bangkok'], MY: ['MYR', 'Asia/Kuala_Lumpur'],
  ID: ['IDR', 'Asia/Jakarta'], PH: ['PHP', 'Asia/Manila'], KH: ['KHR', 'Asia/Phnom_Penh'],
  LA: ['LAK', 'Asia/Vientiane'], AE: ['AED', 'Asia/Dubai'],
};
const BUDGET_CURRENCIES = { EUR: '€', GBP: '£' };
const IMPRINT_URL = 'https://theminhnguyen.github.io/impressum/';
const EMOJIS = ['🎅', '🤶', '🧑‍🎄', '🦌', '⛄', '🎄', '🌟', '🍪', '🏮', '🧧', '🌸', '🐼', '🐯', '🦊', '🐻', '🐧', '🐶', '🐱', '🐲', '👵', '👴', '👩', '👨', '👧', '👦', '👶'];
const GIFT_STATES = ['none', 'idea', 'bought', 'wrapped', 'shipped'];
const DOOR_ORDER = [7, 18, 3, 22, 11, 1, 15, 9, 24, 5, 13, 20, 2, 17, 8, 21, 12, 4, 19, 6, 23, 10, 16, 14];
const MIN_WISHES = 3;
const MAX_WISHES = 10;
const POLL_MS = 30000;

/* ---------------- storage (never throws) ---------------- */
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  json(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  setJson(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  keys() { try { return Object.keys(localStorage); } catch { return []; } },
};
const sess = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } },
  del(k) { try { sessionStorage.removeItem(k); } catch { /* ignore */ } },
};

/* ---------------- state ---------------- */
const S = {
  mode: 'landing', token: null, admin: null, pin: null,
  me: null, A: null, err: null, net: false, loading: false,
  lang: 'de', layout: 'classic', tab: 'home',
  rates: null, ratesBase: null, ratesSrc: null,
  draft: null, draftDirty: false, formDirty: false, revealing: false,
  push: null, pushKey: null,
};

/* ---------------- small helpers ---------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function tl(lang, key, vars) {
  const d = I18N[lang] || I18N.en;
  let s = d[key] ?? I18N.en[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? ''));
  return s;
}
function t(key, vars) { return tl(S.lang, key, vars); }
function loc() { return LOCALES[S.lang] || 'en-GB'; }
function flag(cc) {
  if (!cc || cc.length !== 2) return '';
  return String.fromCodePoint(...[...cc.toUpperCase()].map(c => 127397 + c.charCodeAt(0)));
}
function countryName(cc) { try { return new Intl.DisplayNames([loc()], { type: 'region' }).of(cc) || cc; } catch { return cc; } }
function langName(l) { try { return new Intl.DisplayNames([loc()], { type: 'language' }).of(l) || l; } catch { return l; } }
function curOf(cc) { return (COUNTRIES[cc] || [])[0] || 'EUR'; }
function tzOf(p) { return (p && p.tz) || (COUNTRIES[p && p.country] || [])[1] || 'UTC'; }
function deviceTz() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } }
function tzCity(tz) { return String(tz).split('/').pop().replace(/_/g, ' '); }
function langForCountry(cc) { return cc === 'VN' ? 'vi' : (['DE', 'AT', 'CH', 'LU'].includes(cc) ? 'de' : 'en'); }
function wishCount(w) { return (Array.isArray(w) ? w : []).filter(x => x && String(x.title || '').trim()).length; }
function clone(x) { return JSON.parse(JSON.stringify(x)); }
function linkFor(token) { return `${location.origin}${location.pathname}#p=${token}`; }
function adminLink() { return `${location.origin}${location.pathname}#a=${S.admin}`; }
/* The organiser can mark which participant they are (stored per round on the server). */
function organiser(A) { return A && A.organiser_id ? A.participants.find(p => p.id === A.organiser_id) || null : null; }
function meSkipKey() { return 'wl_me_skip_' + S.admin; }
/* Devices that open the organiser page remember which personal page belongs to the organiser,
 * so only those devices show a way back from that personal page to the organiser page. */
function ownerKey(token) { return 'wl_owner_' + token; }
function syncOwner(keep) {
  store.keys().forEach(k => { if (k.startsWith('wl_owner_') && k !== keep && store.get(k) === S.admin) store.del(k); });
  if (keep && store.get(keep) !== S.admin) store.set(keep, S.admin);
}
function reducedMotion() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } }
function safeUrl(u) {
  let s = String(u || '').trim();
  if (!s) return null;
  if (!/^[a-z]+:\/\//i.test(s)) s = 'https://' + s;
  try { const x = new URL(s); return (x.protocol === 'https:' || x.protocol === 'http:') ? x.href : null; } catch { return null; }
}
function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } }

/* ---------------- dates & time zones ---------------- */
function fmtDT(iso, tz) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(loc(), { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: tz || undefined }).format(new Date(iso));
  } catch { return new Date(iso).toLocaleString(); }
}
function fmtShort(iso) {
  try { return new Intl.DateTimeFormat(loc(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); } catch { return ''; }
}
function fmtDate(d) {
  if (!d) return '';
  const [y, m, dd] = String(d).split('-').map(Number);
  try { return new Intl.DateTimeFormat(loc(), { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, dd))); } catch { return d; }
}
function fmtTime(tz) {
  try { return new Intl.DateTimeFormat(loc(), { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(new Date()); } catch { return ''; }
}
function fmtDayYear(iso) {
  try { return new Intl.DateTimeFormat(loc(), { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso)); } catch { return ''; }
}
function fmtDay(ms) {
  try { return new Intl.DateTimeFormat(loc(), { day: 'numeric', month: 'short' }).format(new Date(Number(ms))); } catch { return ''; }
}
function fmtDateIn(lang, d) {
  try { return new Intl.DateTimeFormat(LOCALES[lang] || 'en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z')); } catch { return d; }
}
function ymd(tz, date) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date || new Date()); } catch { return ''; }
}
function dayOffset(tz, baseTz) {
  const a = Date.parse(ymd(tz)), b = Date.parse(ymd(baseTz));
  return (isNaN(a) || isNaN(b)) ? 0 : Math.round((a - b) / 864e5);
}
function tzOffsetMin(tz) {
  try {
    const d = new Date();
    const a = new Date(d.toLocaleString('en-US', { timeZone: tz }));
    const b = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
    return Math.round((a - b) / 6e4);
  } catch { return 0; }
}
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function defaultExchangeLocal() {
  const now = new Date();
  let y = now.getFullYear();
  if (now > new Date(y, 11, 24, 18, 0)) y += 1;
  return `${y}-12-24T18:00`;
}
/* days = calendar days until the exchange in this device's time zone (0 = today, < 0 = over);
 * d/h = exact time left, for screen readers. */
function countdown(iso) {
  if (!iso) return null;
  const at = new Date(iso);
  if (isNaN(at)) return null;
  const tz = deviceTz();
  const days = Math.round((Date.parse(ymd(tz, at)) - Date.parse(ymd(tz))) / 864e5);
  if (isNaN(days)) return null;
  const ms = Math.max(0, at - Date.now());
  return { days, d: Math.floor(ms / 864e5), h: Math.floor((ms % 864e5) / 36e5) };
}

/* ---------------- money & exchange rates ---------------- */
function roundSig(v, n) { if (!v) return 0; const p = Math.pow(10, n - Math.ceil(Math.log10(Math.abs(v)))); return Math.round(v * p) / p; }
function fmtMoney(v, cur, approx) {
  if (v == null || isNaN(v)) return '';
  let x = Number(v);
  const o = { style: 'currency', currency: cur };
  if (approx) { x = roundSig(x, 3); o.minimumFractionDigits = 0; o.maximumFractionDigits = x >= 10 ? 0 : 2; }
  else { o.minimumFractionDigits = Number.isInteger(x) ? 0 : 2; o.maximumFractionDigits = 2; }
  try { return new Intl.NumberFormat(loc(), o).format(x); } catch { return `${x} ${cur}`; }
}
function convert(amount, from, to) {
  if (amount == null || isNaN(amount)) return null;
  if (from === to) return Number(amount);
  if (!S.rates) return null;
  const rf = from === S.ratesBase ? 1 : S.rates[from];
  const rt = to === S.ratesBase ? 1 : S.rates[to];
  if (!rf || !rt) return null;
  return Number(amount) / rf * rt;
}
async function ensureRates(base) {
  if (!base || (S.ratesBase === base && S.rates)) return;
  const ck = 'wl_rates_' + base;
  const cached = store.json(ck, null);
  if (cached && Date.now() - cached.at < 12 * 3600e3) {
    S.rates = cached.rates; S.ratesBase = base; S.ratesSrc = cached.src; softRender(); return;
  }
  let rates = null, src = null;
  try {
    const r = await fetch(`https://open.er-api.com/v6/latest/${base}`);
    const j = await r.json();
    if (j && j.result === 'success' && j.rates) { rates = j.rates; src = 'er'; }
  } catch { /* try fallback */ }
  if (!rates) {
    const urls = [
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base.toLowerCase()}.min.json`,
      `https://latest.currency-api.pages.dev/v1/currencies/${base.toLowerCase()}.min.json`,
    ];
    for (const u of urls) {
      try {
        const r = await fetch(u);
        const j = await r.json();
        const obj = j && j[base.toLowerCase()];
        if (obj) { rates = {}; for (const k in obj) rates[k.toUpperCase()] = obj[k]; src = 'fa'; break; }
      } catch { /* next */ }
    }
  }
  if (rates) {
    S.rates = rates; S.ratesBase = base; S.ratesSrc = src;
    store.setJson(ck, { at: Date.now(), rates, src });
    softRender();
  }
}

/* ---------------- API ---------------- */
async function rpc(fn, args) {
  const r = await fetch(`${CFG.url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: CFG.key, Authorization: `Bearer ${CFG.key}` },
    body: JSON.stringify(args || {}),
  });
  if (!r.ok) {
    let msg = String(r.status);
    try { const j = await r.json(); msg = j.message || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return r.json();
}
function pArgs(extra) { return Object.assign({ p_token: S.token, p_pin: S.pin || null }, extra || {}); }
function authFailed(r) {
  if (r && r.error && ['pin_required', 'pin_wrong', 'locked', 'not_found'].includes(r.error)) {
    S.err = r; S.me = null; render(); return true;
  }
  return false;
}

/* ---------------- routing & loading ---------------- */
function parseHash() {
  const p = new URLSearchParams(location.hash.replace(/^#/, ''));
  return { a: p.get('a'), p: p.get('p') };
}
function pinKey(tok) { return 'wl_pin_' + tok; }
function getPin(tok) { return sess.get(pinKey(tok)) || store.get(pinKey(tok)); }
function setPin(tok, pin, remember) {
  if (!pin) { sess.del(pinKey(tok)); store.del(pinKey(tok)); return; }
  sess.set(pinKey(tok), pin);
  if (remember || store.get(pinKey(tok))) store.set(pinKey(tok), pin);
}
function remember(entry) {
  const list = store.json('wl_recent', []).filter(e => !(e.kind === entry.kind && e.token === entry.token));
  list.unshift(Object.assign({}, entry, { at: Date.now() }));
  store.setJson('wl_recent', list.slice(0, 8));
}
function forgetRecent(kind, token) {
  store.setJson('wl_recent', store.json('wl_recent', []).filter(e => !(e.kind === kind && e.token === token)));
}

async function route() {
  const h = parseHash();
  S.err = null; S.net = false; S.me = null; S.A = null; S.draft = null; S.draftDirty = false; S.formDirty = false;
  closeModal();
  if (h.a) {
    S.mode = 'admin'; S.admin = h.a; S.token = null;
    S.lang = store.get('wl_lang') || S.lang;
    await loadAdmin();
  } else if (h.p) {
    S.mode = 'p'; S.token = h.p; S.admin = null; S.pin = getPin(h.p); S.tab = 'home';
    await loadMe();
  } else {
    S.mode = 'landing'; S.token = null; S.admin = null;
    S.lang = store.get('wl_lang') || guessLang();
    S.layout = store.get('wl_layout') || S.layout;
    render();
  }
  window.scrollTo(0, 0);
}
function guessLang() {
  const n = (navigator.language || 'en').toLowerCase();
  if (n.startsWith('vi')) return 'vi';
  if (n.startsWith('de')) return 'de';
  return 'en';
}
async function loadMe(silent) {
  if (!silent) { S.loading = true; render(); }
  try {
    const r = await rpc('wichteln_me', { p_token: S.token, p_pin: S.pin || null, p_tz: deviceTz() });
    S.loading = false; S.net = false;
    if (r.error) { S.err = r; S.me = null; render(); return; }
    S.err = null; S.me = r;
    if (!S.draftDirty) S.draft = null; // untouched wish form follows the server (e.g. edits from another device)
    S.lang = r.me.lang || S.lang;
    if (!store.get('wl_layout')) S.layout = r.group.layout || S.layout;
    remember({ kind: 'p', token: S.token, name: r.group.name, who: r.me.name });
    refreshPushState();
    if (S.tab === 'draw') markSeen('out');
    if (S.tab === 'wishes') markSeen('in');
    render();
    ensureRates(r.group.currency);
  } catch (e) {
    S.loading = false;
    if (!silent) { S.net = true; render(); }
  }
}
async function loadAdmin(silent) {
  if (!silent) { S.loading = true; render(); }
  try {
    const r = await rpc('wichteln_admin_get', { p_admin: S.admin });
    S.loading = false; S.net = false;
    if (r.error) { S.err = r; S.A = null; render(); return; }
    S.err = null; S.A = r;
    if (!store.get('wl_layout')) S.layout = r.group.layout || S.layout;
    if (!store.get('wl_lang')) S.lang = r.group.default_lang || S.lang;
    remember({ kind: 'admin', token: S.admin, name: r.group.name });
    const me = organiser(r);
    syncOwner(me ? ownerKey(me.token) : null);
    render();
    ensureRates(r.group.currency);
  } catch (e) {
    S.loading = false;
    if (!silent) { S.net = true; render(); }
  }
}
async function poll() {
  if (document.visibilityState !== 'visible' || S.formDirty || S.revealing) return;
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
  if ($('#modal').open) return;
  if (S.mode === 'p' && S.me) await loadMe(true);
  else if (S.mode === 'admin' && S.A) await loadAdmin(true);
}
function tick() {
  $$('.z-time[data-tz]').forEach(el => { el.textContent = fmtTime(el.dataset.tz); });
}

/* ---------------- unread tracking ---------------- */
function seenKey(dir) { return `wl_seen_${S.token}_${dir}`; }
function othersCount(dir) {
  const list = (S.me && (dir === 'in' ? S.me.thread_in : S.me.thread_out)) || [];
  return list.filter(m => !m.mine).length;
}
function unread(dir) { return Math.max(0, othersCount(dir) - Number(store.get(seenKey(dir)) || 0)); }
function markSeen(dir) { if (S.me) store.set(seenKey(dir), String(othersCount(dir))); }

/* ---------------- icons ---------------- */
const ICON = {
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/></svg>',
  gift: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="10" width="17" height="10.5" rx="1.5"/><path d="M2.5 6.5h19V10h-19z"/><path d="M12 6.5v14"/><path d="M12 6.5C10.6 3.2 7 3 7 5.1s3.4 1.4 5 1.4 5 .7 5-1.4-3.6-1.9-5 1.4"/></svg>',
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10.1A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.3C19.5 15.4 12 20 12 20z"/></svg>',
  people: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3 19.5c.6-3.4 3-5.5 6-5.5s5.4 2.1 6 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16.2 14.2c2.5.2 4.2 2 4.8 4.8"/></svg>',
  gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/></svg>',
  layout: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M3.5 9h17M10 9v11"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3.5"/><path d="M7.5 8 12 3.5 16.5 8"/><path d="M5 12v7.5h14V12"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2"/><path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>',
  send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5 20 4l-5 16-3.5-6.5z"/><path d="M11.5 13.5 20 4"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5"/><path d="m11 6-6 6 6 6"/></svg>',
};

/* ---------------- render core ---------------- */
function applyTheme() {
  const cls = `layout-${S.layout}`;
  if (document.body.className !== cls) document.body.className = cls;
  document.documentElement.lang = S.lang;
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[S.layout] || '#ffffff');
  updateAppManifest();
}
/* Home screen app: the manifest is built for the page that is open, with that page's full link
 * (including #p=… / #a=…) as start_url. A fixed manifest would make the icon open the start page
 * and lose the personal link. */
function updateAppManifest() {
  const scope = new URL('.', location.href).href;
  const h = parseHash();
  const brand = t('brand');
  const group = (S.me && S.me.group.name) || (S.A && S.A.group.name) || '';
  const color = THEME_COLOR[S.layout] || '#ffffff';
  const m = {
    id: scope + (h.a ? '?a=' + h.a : h.p ? '?p=' + h.p : ''),
    name: group ? `${brand}: ${group}` : brand,
    short_name: brand,
    lang: S.lang,
    start_url: location.href,
    scope,
    display: 'standalone',
    background_color: color,
    theme_color: color,
    icons: [
      { src: scope + 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: scope + 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: scope + 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  const href = 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(m));
  const link = $('#manifest');
  if (link && link.getAttribute('href') !== href) link.setAttribute('href', href);
  const title = $('meta[name="apple-mobile-web-app-title"]');
  if (title && title.getAttribute('content') !== brand) title.setAttribute('content', brand);
}
function render() {
  const app = $('#app');
  const active = document.activeElement;
  const aid = active && active.id && app.contains(active) ? active.id : null;
  let sel = null;
  if (aid) { try { sel = [active.selectionStart, active.selectionEnd]; } catch { sel = null; } }
  const keep = {};
  $$('[data-keep]', app).forEach(el => {
    if (!el.id) return;
    keep[el.id] = (el.type === 'checkbox' || el.type === 'radio') ? { c: el.checked } : { v: el.value };
  });
  applyTheme();
  app.innerHTML = view();
  for (const id in keep) {
    const el = document.getElementById(id);
    if (!el) continue;
    if ('c' in keep[id]) el.checked = keep[id].c; else el.value = keep[id].v;
  }
  if (aid) {
    const el = document.getElementById(aid);
    if (el) {
      el.focus({ preventScroll: true });
      if (sel && sel[0] != null) { try { el.setSelectionRange(sel[0], sel[1]); } catch { /* not a text field */ } }
    }
  }
}
function softRender() {
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
  if (S.revealing) return;
  render();
}
function view() {
  if (S.mode === 'landing') return vLanding();
  if (S.loading && !S.me && !S.A) return vLoading();
  if (S.net && !S.me && !S.A) return vNet();
  if (S.mode === 'admin') return S.err ? vBadLink() : (S.A ? vAdmin() : vLoading());
  if (S.err) return ['pin_required', 'pin_wrong', 'locked'].includes(S.err.error) ? vPin() : vBadLink();
  return S.me ? vParticipant() : vLoading();
}

/* ---------------- shared pieces ---------------- */
function vTop(sub) {
  const showSettings = S.mode === 'p' && S.me;
  return `<header class="topbar">
    <div class="brand">
      <span class="brand-mark" aria-hidden="true">${ICON.gift}</span>
      <span class="brand-text"><span class="brand-name">${esc(t('brand'))}</span>${sub ? `<span class="brand-group">${esc(sub)}</span>` : ''}</span>
    </div>
    <div class="top-actions">
      <div class="seg" role="group" aria-label="${esc(t('language'))}">
        ${LANGS.map(l => `<button type="button" data-act="lang" data-lang="${l}" aria-pressed="${S.lang === l}" lang="${l}" title="${esc(tl(l, 'lang_self'))}">${l.toUpperCase()}</button>`).join('')}
      </div>
      <button type="button" class="icon-btn" data-act="layouts" aria-label="${esc(t('layout'))}" title="${esc(t('layout'))}">${ICON.layout}</button>
      ${showSettings ? `<button type="button" class="icon-btn" data-act="settings" aria-label="${esc(t('my_settings'))}" title="${esc(t('my_settings'))}">${ICON.gear}</button>` : ''}
    </div>
  </header>`;
}
function vFoot() {
  let rates = '';
  if (S.ratesSrc === 'er') rates = `<a href="https://www.exchangerate-api.com" target="_blank" rel="noopener">Rates By Exchange Rate API</a>`;
  else if (S.ratesSrc === 'fa') rates = `<a href="https://github.com/fawazahmed0/exchange-api" target="_blank" rel="noopener">${esc(t('rates_src'))}</a>`;
  return `<footer class="foot"><p>${esc(t('foot_privacy'))}</p>${rates ? `<p>${rates}</p>` : ''}
    <p class="foot-links"><button type="button" class="linkbtn" data-act="privacy">${esc(t('privacy_link'))}</button> · <a href="${IMPRINT_URL}" target="_blank" rel="noopener">${esc(t('imprint_link'))}</a></p></footer>`;
}
function vLoading() {
  return `<div class="shell">${vTop('')}<main class="main narrow"><div class="loading" role="status"><span class="spinner" aria-hidden="true"></span>${esc(t('loading'))}</div></main></div>`;
}
function vNet() {
  return `<div class="shell">${vTop('')}<main class="main narrow"><section class="card center"><h1>${esc(t('net_title'))}</h1><p>${esc(t('net_text'))}</p><button type="button" class="btn" data-act="retry">${esc(t('retry'))}</button></section></main></div>`;
}
function vBadLink() {
  return `<div class="shell">${vTop('')}<main class="main narrow"><section class="card center"><h1>${esc(t('bad_link_title'))}</h1><p>${esc(t(S.mode === 'admin' ? 'bad_admin_text' : 'bad_link_text'))}</p><a class="btn" href="#">${esc(t('go_home'))}</a></section></main></div>`;
}
function field(id, label, value, opts) {
  const o = opts || {};
  return `<div class="field"><label for="${id}">${esc(label)}</label><input id="${id}" type="${o.type || 'text'}" ${o.attrs || ''} value="${esc(value ?? '')}" ${o.ph ? `placeholder="${esc(o.ph)}"` : ''} ${o.keep === false ? '' : 'data-keep'}>${o.hint ? `<span class="hint">${esc(o.hint)}</span>` : ''}</div>`;
}
function area(id, label, value, ph, attrs) {
  return `<div class="field"><label for="${id}">${esc(label)}</label><textarea id="${id}" rows="3" ${attrs || ''} ${ph ? `placeholder="${esc(ph)}"` : ''} data-keep>${esc(value ?? '')}</textarea></div>`;
}
function countrySelect(id, value, label) {
  const list = Object.keys(COUNTRIES).map(cc => [cc, countryName(cc)]).sort((a, b) => a[1].localeCompare(b[1], loc()));
  return `<div class="field"><label for="${id}">${esc(label || t('country'))}</label><select id="${id}" data-keep>${list.map(([cc, n]) => `<option value="${cc}" ${cc === value ? 'selected' : ''}>${flag(cc)} ${esc(n)}</option>`).join('')}</select></div>`;
}
function langSelect(id, value, label) {
  return `<div class="field"><label for="${id}">${esc(label || t('lang_label'))}</label><select id="${id}" data-keep>${LANGS.map(l => `<option value="${l}" ${l === value ? 'selected' : ''}>${esc(tl(l, 'lang_self'))}</option>`).join('')}</select></div>`;
}
function curName(c) { try { return new Intl.DisplayNames([loc()], { type: 'currency' }).of(c) || c; } catch { return c; } }
function currencySelect(name, value) {
  const v = BUDGET_CURRENCIES[value] ? value : 'EUR';
  return `<fieldset class="field field-cur"><legend>${esc(t('currency'))}</legend><div class="seg-cur" role="radiogroup" aria-label="${esc(t('currency'))}">${Object.keys(BUDGET_CURRENCIES).map(c => `<label title="${esc(curName(c))}"><input type="radio" name="${name}" id="${name}-${c}" value="${c}" ${c === v ? 'checked' : ''} data-keep><span>${BUDGET_CURRENCIES[c]} ${c}</span></label>`).join('')}</div></fieldset>`;
}
function checkedCurrency(form, name) { return (form.querySelector(`input[name="${name}"]:checked`) || {}).value || 'EUR'; }
function layoutPicker(name, current) {
  return `<div class="layout-pick" role="radiogroup" aria-label="${esc(t('layout'))}">${LAYOUTS.map(l => `
    <label class="lp lp-${l}">
      <input type="radio" name="${name}" value="${l}" ${current === l ? 'checked' : ''}>
      <span class="lp-swatch" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="lp-text"><span class="lp-name">${esc(t('layout_' + l))}</span><span class="lp-desc">${esc(t('layout_' + l + '_desc'))}</span></span>
    </label>`).join('')}</div>`;
}

/* ---------------- hero art (one per layout) ---------------- */
function vHero(kicker, title, sub, iso) {
  const cd = countdown(iso);
  return `<section class="hero">
    <div class="hero-copy">
      ${kicker ? `<p class="hero-kicker">${esc(kicker)}</p>` : ''}
      <h1>${esc(title)}</h1>
      ${sub ? `<p class="hero-sub">${esc(sub)}</p>` : ''}
    </div>
    ${S.layout === 'nordic' ? heroAdvent(cd) : S.layout === 'lantern' ? heroLanterns(cd) : heroPostmark(cd)}
  </section>`;
}
function cdText(cd) {
  if (!cd) return { big: '?', small: t('cd_tbd'), aria: t('cd_tbd') };
  if (cd.days < 0) return { big: '★', small: t('cd_over'), aria: t('cd_over') };
  if (cd.days === 0) return { big: '★', small: t('cd_today'), aria: t('cd_today') };
  return { big: String(cd.days), small: t(cd.days === 1 ? 'cd_day' : 'cd_days'), aria: t('cd_aria', { d: cd.d, h: cd.h }) };
}
function heroPostmark(cd) {
  const c = cdText(cd);
  const waves = [46, 64, 82, 100, 118].map(y => `<path d="M0 ${y} q 11 -7 22 0 t 22 0 t 22 0 t 22 0"/>`).join('');
  return `<div class="postmark" role="img" aria-label="${esc(c.aria)}">
    <svg viewBox="0 0 230 164" aria-hidden="true">
      <g class="pm-waves">${waves}</g>
      <circle class="pm-ring" cx="156" cy="82" r="70"/>
      <circle class="pm-ring thin" cx="156" cy="82" r="52"/>
      <defs><path id="pmArc" d="M 95 82 a 61 61 0 1 1 122 0 a 61 61 0 1 1 -122 0"/></defs>
      <text class="pm-text"><textPath href="#pmArc" textLength="376" lengthAdjust="spacing">${esc(t('postmark_ring'))}</textPath></text>
    </svg>
    <div class="pm-center"><span class="pm-big">${esc(c.big)}</span><span class="pm-small">${esc(c.small)}</span></div>
  </div>`;
}
function heroAdvent(cd) {
  const c = cdText(cd);
  const now = new Date();
  const today = now.getMonth() === 11 ? now.getDate() : (now.getMonth() === 0 ? 32 : 0);
  const doors = DOOR_ORDER.map(d => `<span class="door ${d < today ? 'open' : ''} ${d === today ? 'today' : ''}"><span>${d}</span></span>`).join('');
  return `<div class="advent" role="img" aria-label="${esc(c.aria)}">
    <div class="doors" aria-hidden="true">${doors}</div>
    <p class="advent-cap" aria-hidden="true"><span class="ac-big">${esc(c.big)}</span><span class="ac-small">${esc(c.small)}</span></p>
  </div>`;
}
function lantern(cls, inner) {
  return `<span class="lantern ${cls}"><i class="l-string"></i><i class="l-cap"></i><span class="l-body">${inner || ''}</span><i class="l-cap"></i><i class="l-tassel"></i></span>`;
}
function heroLanterns(cd) {
  const c = cdText(cd);
  return `<div class="lanterns" role="img" aria-label="${esc(c.aria)}">
    ${lantern('lt-side lt-a')}
    ${lantern('lt-main', `<span class="lt-big">${esc(c.big)}</span><span class="lt-small">${esc(c.small)}</span>`)}
    ${lantern('lt-side lt-b')}
  </div>`;
}

/* ---------------- landing ---------------- */
function vLanding() {
  const recent = store.json('wl_recent', []);
  const year = Number(defaultExchangeLocal().slice(0, 4));
  return `<div class="shell landing">${vTop('')}
  <main class="main">
    ${vHero(t('landing_kicker'), t('landing_title'), t('landing_sub'), new Date(defaultExchangeLocal()).toISOString())}
    <div class="grid2">
      <section class="card create-card">
        <h2>${esc(t('create_title'))}</h2>
        <form data-form="create" novalidate>
          ${field('c-name', t('group_name'), t('default_group_name', { year }), { attrs: 'maxlength="80" required' })}
          <div class="row">
            ${field('c-budget', t('budget_amount'), '30', { type: 'number', attrs: 'min="0" step="any" inputmode="decimal"' })}
            ${currencySelect('c-cur', 'EUR')}
          </div>
          ${field('c-ex', t('exchange_time'), defaultExchangeLocal(), { type: 'datetime-local', hint: t('exchange_time_hint') })}
          ${langSelect('c-lang', S.lang, t('default_language'))}
          <fieldset class="field"><legend>${esc(t('layout'))}</legend>${layoutPicker('c-layout', S.layout)}</fieldset>
          <button type="submit" class="btn wide">${esc(t('create_btn'))}</button>
          <p class="hint">${esc(t('create_hint'))}</p>
        </form>
      </section>
      <section class="card how">
        <h2>${esc(t('how_title'))}</h2>
        <ol class="how-list">${[1, 2, 3, 4].map(i => `<li><strong>${esc(t('how_' + i + '_t'))}</strong><span>${esc(t('how_' + i))}</span></li>`).join('')}</ol>
        <h3>${esc(t('extras_title'))}</h3>
        <ul class="extras">${t('extras_list').split('|').map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      </section>
    </div>
    ${recent.length ? `<section class="card recent"><h2>${esc(t('recent_title'))}</h2><ul class="recent-list">${recent.map(r => `
      <li><a href="#${r.kind === 'admin' ? 'a' : 'p'}=${esc(r.token)}"><strong>${esc(r.name)}</strong><span class="hint">${esc(r.kind === 'admin' ? t('recent_admin') : t('recent_p', { name: r.who || '' }))}</span></a>
      <button type="button" class="icon-btn" data-act="forget-recent" data-kind="${esc(r.kind)}" data-token="${esc(r.token)}" aria-label="${esc(t('forget'))}">${ICON.close}</button></li>`).join('')}</ul></section>` : ''}
  </main>${vFoot()}</div>`;
}

/* ---------------- participant ---------------- */
function vTabs() {
  const D = S.me;
  const drawBadge = unread('out') + (D.group.status === 'drawn' && D.assignment && !D.me.viewed_at ? 1 : 0);
  const tabs = [['home', ICON.home, t('tab_home'), 0], ['draw', ICON.gift, t('tab_draw'), drawBadge], ['wishes', ICON.heart, t('tab_wishes'), unread('in')], ['family', ICON.people, t('tab_family'), 0]];
  return `<nav class="tabs" aria-label="${esc(t('nav'))}">${tabs.map(([k, ic, label, b]) => `
    <button type="button" class="tab" data-act="tab" data-tab="${k}" ${S.tab === k ? 'aria-current="page"' : ''}>
      <span class="ico">${ic}</span><span class="tab-label">${esc(label)}</span>${b ? `<span class="badge"><span class="sr-only">${esc(t('new_items'))}</span>${b}</span>` : ''}
    </button>`).join('')}</nav>`;
}
function vParticipant() {
  const body = S.tab === 'draw' ? vDraw() : S.tab === 'wishes' ? vWishes() : S.tab === 'family' ? vFamily() : vHome();
  return `<div class="shell participant">${vTop(S.me.group.name)}${vTabs()}<main class="main" id="main">${vOwnerBar()}${body}</main>${vFoot()}</div>`;
}
function vOwnerBar() {
  const adm = store.get(ownerKey(S.token));
  return adm ? `<div class="owner-bar"><a class="btn small secondary" href="#a=${esc(adm)}" data-act="nav">${ICON.back}<span>${esc(t('to_admin'))}</span></a></div>` : '';
}
function vHome() {
  const D = S.me, g = D.group, me = D.me;
  const sub = g.exchange_at ? t('exchange_on', { date: fmtDT(g.exchange_at, tzOf(me)) }) : t('exchange_tbd');
  return `${vHero(t('hello', { name: me.name }) + ' ' + me.emoji, g.name, sub, g.exchange_at)}
    ${vNextSteps()}
    ${vAppCard()}
    <div class="grid2">${vFacts()}${g.notes ? vNotes(g.notes) : vProgress()}</div>
    ${g.notes ? vProgress() : ''}`;
}
function vNextSteps() {
  const D = S.me, g = D.group, me = D.me, wc = wishCount(me.wishes);
  const items = [];
  if (g.revealed) items.push({ tone: 'hot', title: t('ns_reveal_title'), text: t('ns_reveal_text'), tab: 'family', btn: t('ns_reveal_btn') });
  if (g.status === 'drawn' && D.assignment && !me.viewed_at) items.push({ tone: 'hot', title: t('ns_draw_title'), text: t('ns_draw_text'), tab: 'draw', btn: t('ns_draw_btn') });
  if (wc < MIN_WISHES) items.push({ tone: 'warn', title: t('ns_wishes_title', { n: MIN_WISHES - wc }), text: g.wish_deadline ? t('ns_wishes_deadline', { date: fmtDate(g.wish_deadline) }) : t('ns_wishes_text'), tab: 'wishes', btn: t('ns_wishes_btn') });
  if (unread('in')) items.push({ tone: 'hot', title: t('ns_msg_title'), text: t('ns_msg_text'), tab: 'wishes', btn: t('ns_msg_btn') });
  if (unread('out') && D.assignment) items.push({ tone: 'hot', title: t('ns_reply_title', { name: D.assignment.name }), text: t('ns_reply_text'), tab: 'draw', btn: t('ns_reply_btn') });
  if (g.status === 'drawn' && me.viewed_at && D.assignment) items.push({ tone: 'calm', title: t('ns_you_gift', { name: D.assignment.name }), text: t('gs_' + me.gift_status + '_me'), tab: 'draw', btn: t('ns_open_draw') });
  if (D.santa && D.santa.gift_status !== 'none') items.push({ tone: 'calm', title: t('santa_status_title'), text: t('santa_status_' + D.santa.gift_status) });
  if (g.status !== 'drawn' && wc >= MIN_WISHES) items.push({ tone: 'calm', title: t('ns_wait_title'), text: t('ns_wait_text') });
  if (!items.length) return '';
  return `<section class="steps">${items.map((i, n) => `
    <div class="step ${i.tone}"><div class="step-text"><h2>${esc(i.title)}</h2><p>${esc(i.text)}</p></div>
    ${i.btn ? `<button type="button" class="btn ${n === 0 && i.tone !== 'calm' ? '' : 'secondary'}" data-act="tab" data-tab="${i.tab}">${esc(i.btn)}</button>` : ''}</div>`).join('')}</section>`;
}
function familyCurrencies() {
  const people = S.me ? S.me.people : (S.A ? S.A.participants : []);
  return [...new Set(people.map(p => curOf(p.country)))];
}
function budgetBlock(g) {
  if (g.budget == null) return `<span class="hint">${esc(t('no_budget'))}</span>`;
  const conv = familyCurrencies().filter(c => c !== g.currency).map(c => {
    const v = convert(Number(g.budget), g.currency, c);
    return v == null ? '' : `<span class="pill">≈ ${esc(fmtMoney(v, c, true))}</span>`;
  }).join('');
  return `<strong class="money">${esc(fmtMoney(Number(g.budget), g.currency))}</strong>${conv ? `<span class="pills">${conv}</span>` : ''}`;
}
function uniqueZones() {
  const people = S.me ? S.me.people : (S.A ? S.A.participants : []);
  const map = new Map();
  for (const p of people) {
    const tz = tzOf(p);
    if (!map.has(tz)) map.set(tz, { tz, countries: new Set(), people: [] });
    const z = map.get(tz); z.countries.add(p.country); z.people.push(p);
  }
  const mine = S.me ? tzOf(S.me.me) : deviceTz();
  const zones = [...map.values()];
  // A zone with people from one country is named after that country (in the reader's language);
  // the time zone's city is added only where it is needed to tell two zones apart.
  const solo = z => z.countries.size === 1 ? [...z.countries][0] : null;
  const soloCount = {};
  zones.forEach(z => { const cc = solo(z); if (cc) soloCount[cc] = (soloCount[cc] || 0) + 1; });
  const place = z => {
    const cc = solo(z);
    if (!cc) return [...z.countries].map(countryName).join(' · ');
    return soloCount[cc] > 1 ? `${countryName(cc)} (${tzCity(z.tz)})` : countryName(cc);
  };
  return zones
    .map(z => Object.assign(z, { label: `${[...z.countries].map(flag).join(' ')} ${place(z)}`, off: tzOffsetMin(z.tz) }))
    .sort((a, b) => (b.tz === mine) - (a.tz === mine) || a.off - b.off);
}
function vExchangeTimes(iso) {
  const zones = uniqueZones();
  if (!zones.length) return `<strong>${esc(fmtDT(iso))}</strong>`;
  return `<ul class="tzlist">${zones.map(z => `<li><span class="tz-label">${esc(z.label)}</span><strong>${esc(fmtDT(iso, z.tz))}</strong></li>`).join('')}</ul>`;
}
function vFacts() {
  const g = S.me.group;
  const rows = [[t('budget'), budgetBlock(g)]];
  if (g.exchange_at) rows.push([t('exchange'), vExchangeTimes(g.exchange_at)]);
  if (g.wish_deadline) rows.push([t('wish_deadline'), esc(fmtDate(g.wish_deadline))]);
  if (g.ship_by && !g.in_person) rows.push([t('ship_by'), esc(fmtDate(g.ship_by))]);
  return `<section class="card facts"><h2>${esc(t('facts_title'))}</h2><dl>${rows.map(([k, v]) => `<div class="fact"><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl></section>`;
}
function vNotes(notes) {
  return `<section class="card notes"><h2>${esc(t('notes_title'))}</h2><p class="prewrap">${esc(notes)}</p></section>`;
}
function vProgress() {
  const ppl = S.me.people, ok = ppl.filter(p => p.wishes_ok).length;
  return `<section class="card progress"><h2>${esc(t('progress_title'))}</h2>
    <p class="hint">${esc(t('progress_text', { ok, n: ppl.length }))}</p>
    <div class="meter" role="meter" aria-valuemin="0" aria-valuemax="${ppl.length}" aria-valuenow="${ok}" aria-label="${esc(t('progress_title'))}"><i style="width:${ppl.length ? ok / ppl.length * 100 : 0}%"></i></div>
    <ul class="people">${ppl.map(p => `<li class="${p.wishes_ok ? 'done' : ''}"><span class="avatar" aria-hidden="true">${esc(p.emoji)}</span><span class="pname">${esc(p.name)}</span><span class="pflag" title="${esc(countryName(p.country))}">${flag(p.country)}</span><span class="pill ${p.wishes_ok ? 'ok' : ''}">${esc(p.wishes_ok ? t('wishes_ready') : t('wishes_pending'))}</span></li>`).join('')}</ul>
  </section>`;
}

function vDraw() {
  const D = S.me;
  if (D.group.status !== 'drawn' || !D.assignment) {
    return `<section class="card center empty-state"><span class="empty-ico" aria-hidden="true">${ICON.gift}</span><h1>${esc(t('draw_wait_title'))}</h1><p>${esc(t('draw_wait_text'))}</p></section>`;
  }
  if (!D.me.viewed_at) return vRevealCover();
  return vGiftee();
}
function coverArt(a) {
  const name = `<span class="reveal-name"><span class="rn-emoji">${esc(a.emoji)}</span><span class="rn-name">${esc(a.name)}</span></span>`;
  if (S.layout === 'nordic') {
    return `<span class="bigdoor"><span class="bigdoor-inside">${name}</span><span class="bigdoor-leaf"><span class="bd-num">24</span><i class="bd-knob"></i></span></span>`;
  }
  if (S.layout === 'lantern') {
    return `<span class="biglantern">${lantern('lt-reveal', name)}</span>`;
  }
  const initial = (S.me.group.name || 'W').trim().charAt(0).toUpperCase();
  return `<span class="env"><span class="env-back"></span><span class="env-letter">${name}</span><span class="env-front"></span><span class="env-flap"></span><span class="env-seal">${esc(initial)}</span></span>`;
}
function vRevealCover() {
  const a = S.me.assignment;
  return `<section class="reveal" id="reveal">
    <h1 class="reveal-lead">${esc(t('reveal_lead'))}</h1>
    <button type="button" class="reveal-cover" data-act="reveal" aria-label="${esc(t('reveal_btn'))}">${coverArt(a)}</button>
    <p class="reveal-cta">${esc(t('reveal_btn'))}</p>
    <p class="hint">${esc(t('reveal_hint'))}</p>
  </section>`;
}
function stamp(cc) {
  return `<span class="stamp" aria-hidden="true"><span class="stamp-in"><span class="stamp-flag">${flag(cc)}</span><span class="stamp-cc">${esc(cc)}</span></span></span>`;
}
function vGiftee() {
  const D = S.me, a = D.assignment, me = D.me, g = D.group;
  const myCur = curOf(me.country), theirCur = curOf(a.country);
  const list = (a.wishes || []).map((w, i) => Object.assign({}, w, { i })).filter(w => String(w.title || '').trim());
  const prof = a.profile || {};
  const profRows = [
    ['size_top', prof.size_top], ['size_bottom', prof.size_bottom], ['size_shoe', prof.size_shoe],
    ['likes', prof.likes], ['dislikes', prof.dislikes], ['address', g.in_person ? '' : prof.address],
  ].filter(r => r[1] && String(r[1]).trim());
  const wishItems = list.map(w => {
    const cur = w.cur || theirCur;
    let price = '';
    if (w.price != null && w.price !== '') {
      price = `<span class="w-price">${esc(fmtMoney(Number(w.price), cur))}`;
      if (cur !== myCur) { const v = convert(Number(w.price), cur, myCur); if (v != null) price += ` <span class="hint">≈ ${esc(fmtMoney(v, myCur, true))}</span>`; }
      price += '</span>';
    }
    const url = safeUrl(w.link);
    const link = url ? `<a class="w-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(t('open_link'))} (${esc(hostOf(url))})</a>` : '';
    const chosen = me.gift_wish === w.i;
    return `<li class="wish ${w.fav ? 'fav' : ''} ${chosen ? 'chosen' : ''}">
      <div class="w-main">
        <span class="w-title">${w.fav ? `<span class="w-star" title="${esc(t('fav'))}">★</span>` : ''}${esc(w.title)}</span>
        ${w.note ? `<span class="w-note">${esc(w.note)}</span>` : ''}
        ${price || link ? `<span class="w-meta">${price}${link}</span>` : ''}
      </div>
      <button type="button" class="btn small ${chosen ? '' : 'secondary'}" data-act="pick-wish" data-i="${w.i}" aria-pressed="${chosen}">${esc(chosen ? t('picked') : t('pick'))}</button>
    </li>`;
  }).join('');
  let budget = '';
  if (g.budget != null) {
    const inTheirs = theirCur !== g.currency ? convert(Number(g.budget), g.currency, theirCur) : null;
    const inMine = myCur !== g.currency ? convert(Number(g.budget), g.currency, myCur) : null;
    budget = `<section class="card"><h2>${esc(t('budget'))}</h2><p><strong class="money">${esc(fmtMoney(Number(g.budget), g.currency))}</strong></p>
      ${inMine != null ? `<p class="hint">${esc(t('budget_mine', { v: fmtMoney(inMine, myCur, true) }))}</p>` : ''}
      ${inTheirs != null ? `<p class="hint">${esc(t('budget_theirs', { v: fmtMoney(inTheirs, theirCur, true), name: a.name }))}</p>` : ''}</section>`;
  }
  const ship = !g.in_person && a.country !== me.country ? `<section class="card ship"><h2>${esc(t('ship_title', { country: countryName(a.country) }))}</h2><p>${esc(t('ship_text'))}</p>${g.ship_by ? `<p><strong>${esc(t('ship_by_line', { date: fmtDate(g.ship_by) }))}</strong></p>` : ''}</section>` : '';
  return `<section class="giftee">
      <p class="giftee-lead">${esc(t('you_gift'))}</p>
      <div class="giftee-card">
        ${S.layout === 'classic' ? stamp(a.country) : ''}
        <span class="giftee-emoji" aria-hidden="true">${esc(a.emoji)}</span>
        <h1 class="giftee-name">${esc(a.name)}</h1>
        <ul class="giftee-meta">
          <li>${flag(a.country)} ${esc(countryName(a.country))}</li>
          <li>${esc(t('local_time', { time: fmtTime(tzOf(a)) }))}</li>
          <li>${esc(t('speaks', { lang: langName(a.lang) }))}</li>
        </ul>
      </div>
    </section>
    <div class="grid2">
      <section class="card wishes-card">
        <h2>${esc(t('their_wishes', { name: a.name }))}</h2>
        ${list.length ? `<ol class="wishlist">${wishItems}</ol>` : `<p>${esc(t('no_wishes_yet', { name: a.name }))}</p>`}
        ${list.length && list.length < MIN_WISHES ? `<p class="hint">${esc(t('few_wishes', { name: a.name }))}</p>` : ''}
      </section>
      <div class="stack">
        ${vGiftStatus()}
        ${budget}
        ${ship}
        ${profRows.length ? `<section class="card"><h2>${esc(t('profile_title', { name: a.name }))}</h2><dl class="profile">${profRows.map(([k, v]) => `<div><dt>${esc(t(k))}</dt><dd class="prewrap">${esc(v)}</dd></div>`).join('')}</dl></section>` : ''}
      </div>
    </div>
    ${vThread('out')}`;
}
function vGiftStatus() {
  const me = S.me.me;
  return `<section class="card"><h2>${esc(t('gift_status_title'))}</h2>
    <div class="status-steps" role="group" aria-label="${esc(t('gift_status_title'))}">${GIFT_STATES.map(s => `<button type="button" class="st ${me.gift_status === s ? 'on' : ''}" data-act="gift" data-s="${s}" aria-pressed="${me.gift_status === s}">${esc(t('gs_' + s))}</button>`).join('')}</div>
    <p class="hint">${esc(t('gift_status_hint'))}</p></section>`;
}
function vThread(dir) {
  const D = S.me;
  const msgs = (dir === 'out' ? D.thread_out : D.thread_in) || [];
  const other = dir === 'out' ? D.assignment.name : t('your_santa');
  const id = 'msg-' + dir;
  return `<section class="card thread-card">
    <h2>${esc(dir === 'out' ? t('thread_out_title', { name: D.assignment.name }) : t('thread_in_title'))}</h2>
    <p class="hint">${esc(dir === 'out' ? t('thread_out_hint', { name: D.assignment.name }) : t('thread_in_hint'))}</p>
    <div class="thread">${msgs.length ? msgs.map(m => `<div class="msg ${m.mine ? 'mine' : 'theirs'}"><span class="who">${esc(m.mine ? t('you') : other)}</span><p>${esc(m.body)}</p><time datetime="${esc(m.at)}">${esc(fmtShort(m.at))}</time></div>`).join('') : `<p class="thread-empty">${esc(t('thread_empty'))}</p>`}</div>
    <form class="composer" data-form="send" data-to="${dir === 'out' ? 'recipient' : 'santa'}">
      <label class="sr-only" for="${id}">${esc(t('message'))}</label>
      <input id="${id}" data-keep type="text" maxlength="1000" autocomplete="off" placeholder="${esc(dir === 'out' ? t('ask_placeholder') : t('reply_placeholder'))}">
      <button class="btn" type="submit">${ICON.send}<span>${esc(t('send'))}</span></button>
    </form>
  </section>`;
}

function initDraft() {
  const me = S.me.me;
  const wishes = clone(Array.isArray(me.wishes) ? me.wishes : []).map(w => ({
    title: w.title || '', link: w.link || '', price: w.price ?? '', cur: w.cur || curOf(me.country), note: w.note || '', fav: !!w.fav,
  }));
  while (wishes.length < MIN_WISHES) wishes.push({ title: '', link: '', price: '', cur: curOf(me.country), note: '', fav: false });
  const p = me.profile || {};
  S.draft = { wishes, profile: { size_top: p.size_top || '', size_bottom: p.size_bottom || '', size_shoe: p.size_shoe || '', likes: p.likes || '', dislikes: p.dislikes || '', address: p.address || '' } };
  S.draftDirty = false;
}
function vWishRow(w, i) {
  return `<li class="wish-row">
    <div class="wr-top">
      <span class="wr-num" aria-hidden="true">${i + 1}</span>
      <input id="w-${i}-title" class="wr-title" type="text" maxlength="140" data-w="${i}" data-f="title" value="${esc(w.title)}" placeholder="${esc(t('wish_title_ph'))}" aria-label="${esc(t('wish_title'))} ${i + 1}">
      <button type="button" class="icon-btn star-btn ${w.fav ? 'on' : ''}" data-act="fav" data-i="${i}" aria-pressed="${!!w.fav}" aria-label="${esc(t('fav'))}" title="${esc(t('fav'))}">${ICON.star}</button>
      <button type="button" class="icon-btn" data-act="del-wish" data-i="${i}" aria-label="${esc(t('remove'))}" title="${esc(t('remove'))}">${ICON.trash}</button>
    </div>
    <div class="wr-more">
      <input id="w-${i}-link" type="url" inputmode="url" maxlength="500" data-w="${i}" data-f="link" value="${esc(w.link)}" placeholder="${esc(t('wish_link_ph'))}" aria-label="${esc(t('wish_link'))}">
      <span class="wr-price"><input id="w-${i}-price" type="number" min="0" step="any" inputmode="decimal" data-w="${i}" data-f="price" value="${esc(w.price)}" placeholder="${esc(t('wish_price_ph'))}" aria-label="${esc(t('wish_price'))}"><span class="cur">${esc(w.cur)}</span></span>
      <input id="w-${i}-note" type="text" maxlength="200" data-w="${i}" data-f="note" value="${esc(w.note)}" placeholder="${esc(t('wish_note_ph'))}" aria-label="${esc(t('wish_note'))}">
    </div>
  </li>`;
}
function vWishes() {
  const D = S.me;
  if (!S.draft) initDraft();
  const d = S.draft;
  const count = wishCount(d.wishes);
  const pf = (key, label, ph) => `<div class="field"><label for="pf-${key}">${esc(label)}</label><input id="pf-${key}" type="text" maxlength="60" data-pf="${key}" value="${esc(d.profile[key])}" ${ph ? `placeholder="${esc(ph)}"` : ''}></div>`;
  const pa = (key, label, ph) => `<div class="field"><label for="pf-${key}">${esc(label)}</label><textarea id="pf-${key}" rows="3" maxlength="600" data-pf="${key}" ${ph ? `placeholder="${esc(ph)}"` : ''}>${esc(d.profile[key])}</textarea></div>`;
  return `${D.santa ? vThread('in') : ''}
    <form data-form="wishes" class="wish-form" novalidate>
      <section class="card">
        <div class="card-head"><h2>${esc(t('my_wishes'))}</h2><span class="pill ${count >= MIN_WISHES ? 'ok' : 'warn'}">${esc(t('wish_count', { n: count, min: MIN_WISHES }))}</span></div>
        <p class="hint">${esc(t('wishes_privacy'))}</p>
        <ol class="wish-edit">${d.wishes.map((w, i) => vWishRow(w, i)).join('')}</ol>
        ${d.wishes.length < MAX_WISHES ? `<button type="button" class="btn secondary" data-act="add-wish">${ICON.plus}<span>${esc(t('add_wish'))}</span></button>` : ''}
        <div class="inspire"><p class="hint">${esc(t('inspire_title'))}</p><div class="chips">${t('inspire_list').split('|').map(x => `<button type="button" class="chip" data-act="inspire" data-v="${esc(x)}">${esc(x)}</button>`).join('')}</div></div>
      </section>
      <section class="card">
        <h2>${esc(t('about_me'))}</h2>
        <p class="hint">${esc(t('about_me_hint'))}</p>
        <div class="row three">${pf('size_top', t('size_top'), 'M')}${pf('size_bottom', t('size_bottom'), '32/32')}${pf('size_shoe', t('size_shoe'), '42')}</div>
        ${pa('likes', t('likes'), t('likes_ph'))}
        ${pa('dislikes', t('dislikes'), t('dislikes_ph'))}
        ${D.group.in_person ? '' : `${pa('address', t('address'), t('address_ph'))}<p class="hint">${esc(t('address_hint'))}</p>`}
      </section>
      <div class="savebar"><span class="hint" id="save-state">${esc(S.draftDirty ? t('unsaved') : t('saved_state'))}</span><button class="btn" type="submit">${esc(t('save'))}</button></div>
    </form>`;
}

function vFamily() {
  const D = S.me, g = D.group;
  return `${vClock()}
    ${g.status === 'drawn' && !g.revealed ? vGuess() : ''}
    ${g.revealed && D.reveal ? vChain(D.reveal, D.people) : ''}
    ${vProgress()}`;
}
function vClock() {
  const zones = uniqueZones();
  const base = S.me ? tzOf(S.me.me) : deviceTz();
  return `<section class="card clock"><h2>${esc(t('clock_title'))}</h2><p class="hint">${esc(t('clock_hint'))}</p>
    <ul class="zones">${zones.map(z => {
      const off = dayOffset(z.tz, base);
      return `<li><span class="z-time" data-tz="${esc(z.tz)}">${esc(fmtTime(z.tz))}</span>
        <span class="z-info"><strong>${esc(z.label)}</strong>${off ? `<span class="pill">${esc(off > 0 ? t('tomorrow') : t('yesterday'))}</span>` : ''}
        <span class="z-people">${z.people.map(p => esc(`${p.emoji} ${p.name}`)).join(', ')}</span></span></li>`;
    }).join('')}</ul></section>`;
}
function vGuess() {
  const D = S.me;
  const others = D.people.filter(p => p.id !== D.me.id && (!D.assignment || p.id !== D.assignment.id));
  return `<section class="card guess"><h2>${esc(t('guess_title'))}</h2><p class="hint">${esc(t('guess_text'))}</p>
    <div class="chips">${others.map(p => `<button type="button" class="chip ${D.me.guess_id === p.id ? 'on' : ''}" data-act="guess" data-id="${esc(p.id)}" aria-pressed="${D.me.guess_id === p.id}">${esc(p.emoji)} ${esc(p.name)}</button>`).join('')}</div>
    ${D.me.guess_id ? `<p class="hint">${esc(t('guess_saved'))}</p>` : ''}</section>`;
}
function vChain(rev, people) {
  const byId = Object.fromEntries(people.map(p => [p.id, p]));
  const rowOf = id => rev.find(x => x.id === id);
  let right = 0;
  const items = rev.map(r => {
    const giver = byId[r.id], rec = byId[r.to];
    if (!giver || !rec) return '';
    const guess = (rowOf(r.to) || {}).guess;
    const ok = guess === r.id;
    if (ok) right++;
    const txt = !guess ? t('no_guess', { name: rec.name }) : ok ? t('guessed_right', { name: rec.name }) : t('guessed_wrong', { name: rec.name, guess: (byId[guess] || {}).name || '?' });
    return `<li><span class="c-pair"><span class="c-giver">${esc(giver.emoji)} ${esc(giver.name)}</span><span class="c-arrow" aria-hidden="true">${ICON.gift}</span><span class="sr-only">${esc(t('gifts_to'))}</span><span class="c-rec">${esc(rec.emoji)} ${esc(rec.name)}</span></span><span class="c-guess ${ok ? 'right' : ''}">${esc(txt)}</span></li>`;
  }).join('');
  return `<section class="card chain"><h2>${esc(t('chain_title'))}</h2><p class="hint">${esc(t('chain_text'))}</p><ol class="chain-list">${items}</ol><p class="score">${esc(t('score', { right, n: rev.length }))}</p></section>`;
}

function vPin() {
  const e = S.err.error;
  return `<div class="shell">${vTop('')}<main class="main narrow"><section class="card center pin-card">
    <span class="empty-ico" aria-hidden="true">${ICON.lock}</span>
    <h1>${esc(t('pin_title'))}</h1><p>${esc(t('pin_text'))}</p>
    ${e === 'pin_wrong' ? `<p class="error" role="alert">${esc(t('pin_wrong'))}</p>` : ''}
    ${e === 'locked' ? `<p class="error" role="alert">${esc(t('pin_locked'))}</p>` : ''}
    <form data-form="pin" class="pin-form">
      <label for="pin-in">${esc(t('pin_label'))}</label>
      <input id="pin-in" class="pin-input" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="current-password" minlength="4" maxlength="8" required>
      <label class="check"><input type="checkbox" id="pin-remember"> ${esc(t('pin_remember'))}</label>
      <button class="btn wide" type="submit">${esc(t('pin_unlock'))}</button>
    </form>
    <p class="hint">${esc(t('pin_forgot'))}</p>
  </section></main></div>`;
}

/* ---------------- admin ---------------- */
function vAdmin() {
  const A = S.A, g = A.group, ps = A.participants;
  const ok = ps.filter(p => p.wish_count >= MIN_WISHES).length;
  const viewed = ps.filter(p => p.viewed).length;
  const sub = g.status === 'drawn' ? t('admin_sub_drawn', { n: ps.length, viewed }) : t('admin_sub', { n: ps.length, ok });
  return `<div class="shell admin">${vTop(g.name)}
  <main class="main">
    ${vHero(t('admin_kicker'), g.name, sub, g.exchange_at)}
    ${store.get('wl_admin_saved_' + S.admin) ? '' : vAdminLink(true)}
    ${vMeCard()}
    <div class="grid2">
      <section class="card people-card">
        <div class="card-head"><h2>${esc(t('participants'))}</h2><span class="pill">${ps.length}</span></div>
        ${ps.length ? `<ul class="plist">${ps.map(vAdminPerson).join('')}</ul>` : `<p class="hint">${esc(t('no_participants'))}</p>`}
        ${g.status === 'open' ? vAddPerson() : `<p class="hint">${esc(t('locked_after_draw'))}</p>`}
      </section>
      <div class="stack">${vAdminReminders()}${vAdminDraw()}${vAdminSettings()}</div>
    </div>
    ${g.revealed && A.reveal ? vChain(A.reveal, ps) : ''}
    ${store.get('wl_admin_saved_' + S.admin) ? vAdminLink(false) : ''}
    ${vNextYear()}
    ${vDanger()}
  </main>${vFoot()}</div>`;
}
function vAdminLink(prominent) {
  const link = adminLink();
  return `<section class="card admin-link ${prominent ? 'prominent' : ''}">
    <h2>${esc(t('admin_link_title'))}</h2><p>${esc(t('admin_link_text'))}</p>
    <p class="linkbox"><code>${esc(link)}</code></p>
    <div class="btn-row">
      <button type="button" class="btn" data-act="copy" data-text="${esc(link)}">${ICON.copy}<span>${esc(t('copy_link'))}</span></button>
      ${prominent ? `<button type="button" class="btn secondary" data-act="admin-saved">${esc(t('admin_link_done'))}</button>` : ''}
    </div>
  </section>`;
}
function vMeCard() {
  if (!S.A.participants.length) return '';
  const me = organiser(S.A);
  if (me) {
    return `<section class="card me-card">
      <div class="me-head"><span class="avatar" aria-hidden="true">${esc(me.emoji)}</span>
        <div><h2>${esc(t('me_card_title'))}</h2><p class="hint">${esc(t('me_card_text', { name: me.name }))}</p></div></div>
      <div class="btn-row">
        <a class="btn" href="#p=${esc(me.token)}" data-act="nav">${ICON.gift}<span>${esc(t('me_open'))}</span></a>
        <button type="button" class="btn ghost" data-act="pick-me">${esc(t('me_change'))}</button>
      </div>
    </section>`;
  }
  if (store.get(meSkipKey())) return '';
  return `<section class="card me-card">
    <h2>${esc(t('me_card_title'))}</h2><p class="hint">${esc(t('me_ask_text'))}</p>
    <div class="btn-row">
      <button type="button" class="btn" data-act="pick-me">${esc(t('me_pick_btn'))}</button>
      <button type="button" class="btn ghost" data-act="me-skip">${esc(t('me_not_playing'))}</button>
    </div>
  </section>`;
}
function openPickMe() {
  const A = S.A;
  openModal(`<h2 id="modal-title">${esc(t('me_pick_title'))}</h2><p class="hint">${esc(t('me_pick_hint'))}</p>
    <div class="chips">${A.participants.map(p => `<button type="button" class="chip" data-act="set-me" data-id="${esc(p.id)}" aria-pressed="${p.id === A.organiser_id}">${esc(p.emoji)} ${esc(p.name)}</button>`).join('')}</div>
    <div class="btn-row"><button type="button" class="btn ghost" data-act="set-me" data-id="">${esc(t('me_not_playing'))}</button></div>`);
}
function reminderKind(p, g) {
  if (!p.last_seen_at) return 'invite';
  if (g.status === 'drawn' && !p.viewed) return 'draw';
  if (p.wish_count < MIN_WISHES) return 'wishes';
  return null;
}
function remKey(id) { return `wl_rem_${S.admin}_${id}`; }
function markReminded(id) { if (id) store.set(remKey(id), String(Date.now())); }
function vAdminPerson(p) {
  const g = S.A.group;
  const isMe = p.id === S.A.organiser_id;
  const kind = isMe ? null : reminderKind(p, g);
  const remAt = store.get(remKey(p.id));
  const label = kind === 'invite' ? t('invite') : kind ? t('remind') : t('share_link');
  const icon = kind && kind !== 'invite' ? ICON.bell : ICON.share;
  const main = isMe
    ? `<a class="btn small" href="#p=${esc(p.token)}" data-act="nav">${ICON.gift}<span>${esc(t('me_open_short'))}</span></a>`
    : `<button type="button" class="btn small ${kind ? '' : 'secondary'}" data-act="invite" data-id="${esc(p.id)}" data-kind="${kind || 'link'}">${icon}<span>${esc(label)}</span></button>`;
  return `<li class="prow">
    <span class="avatar" aria-hidden="true">${esc(p.emoji)}</span>
    <div class="prow-main">
      <strong>${esc(p.name)}</strong>
      <span class="prow-meta">${flag(p.country)} ${esc(countryName(p.country))}, ${esc(langName(p.lang))}${p.household ? `, ${esc(t('household_short', { h: p.household }))}` : ''}</span>
      <span class="pills">
        ${isMe ? `<span class="pill me">${esc(t('you'))}</span>` : ''}
        <span class="pill ${p.wish_count >= MIN_WISHES ? 'ok' : 'warn'}">${esc(t('wish_count', { n: p.wish_count, min: MIN_WISHES }))}</span>
        ${p.has_pin ? `<span class="pill">${esc(t('pin_on'))}</span>` : ''}
        ${!p.last_seen_at ? `<span class="pill">${esc(t('never_opened_link'))}</span>` : ''}
        ${g.status === 'drawn' ? `<span class="pill ${p.viewed ? 'ok' : ''}">${esc(p.viewed ? t('opened') : t('not_opened'))}</span><span class="pill">${esc(t('gs_' + p.gift_status))}</span>` : ''}
        ${remAt && kind ? `<span class="pill">${esc(t('reminded_at', { date: fmtDay(remAt) }))}</span>` : ''}
      </span>
    </div>
    <div class="prow-actions">
      ${main}
      <button type="button" class="icon-btn" data-act="edit-person" data-id="${esc(p.id)}" aria-label="${esc(t('edit'))}: ${esc(p.name)}" title="${esc(t('edit'))}">${ICON.edit}</button>
    </div>
  </li>`;
}
function vAddPerson() {
  const lastCc = store.get('wl_last_cc') || 'DE';
  return `<form data-form="add-person" class="add-person" novalidate>
    <h3>${esc(t('add_person'))}</h3>
    ${field('ap-name', t('name'), '', { attrs: 'maxlength="60" required autocomplete="off"' })}
    <div class="row">${countrySelect('ap-country', lastCc)}${langSelect('ap-lang', langForCountry(lastCc))}</div>
    ${field('ap-house', t('household'), '', { attrs: 'maxlength="60" autocomplete="off"', hint: t('household_hint'), ph: t('household_ph') })}
    <button type="submit" class="btn">${ICON.plus}<span>${esc(t('add'))}</span></button>
  </form>`;
}
function vAdminDraw() {
  const A = S.A, g = A.group, ps = A.participants;
  if (g.status === 'open') {
    const enough = ps.length >= 3;
    const missing = ps.filter(p => p.wish_count < MIN_WISHES);
    return `<section class="card draw-card"><h2>${esc(t('draw_title'))}</h2>
      <ul class="checks">
        <li class="${enough ? 'ok' : 'no'}">${esc(t('check_people', { n: ps.length }))}</li>
        <li class="${missing.length ? 'warn' : 'ok'}">${esc(missing.length ? t('check_wishes_missing', { names: missing.map(p => p.name).join(', ') }) : t('check_wishes_ok'))}</li>
        <li class="ok">${esc(t('check_households'))}</li>
        ${A.has_history ? `<li class="ok">${esc(t('check_history'))}</li>` : ''}
      </ul>
      <p class="hint">${esc(t('draw_hint'))}</p>
      <button class="btn wide" type="button" data-act="draw" ${enough ? '' : 'disabled'}>${esc(t('draw_btn'))}</button></section>`;
  }
  const viewed = ps.filter(p => p.viewed).length;
  const guessed = ps.filter(p => p.guessed).length;
  return `<section class="card draw-card"><h2>${esc(t('draw_done_title'))}</h2>
    <p>${esc(t('draw_done_text', { date: fmtDT(g.drawn_at), viewed, n: ps.length }))}</p>
    <div class="meter" role="meter" aria-valuemin="0" aria-valuemax="${ps.length}" aria-valuenow="${viewed}" aria-label="${esc(t('opened'))}"><i style="width:${ps.length ? viewed / ps.length * 100 : 0}%"></i></div>
    <h3>${esc(t('reveal_title'))}</h3>
    <p class="hint">${esc(t('reveal_admin_hint', { guessed, n: ps.length }))}</p>
    ${g.revealed ? `<button class="btn secondary" type="button" data-act="reveal-off">${esc(t('reveal_off'))}</button>` : `<button class="btn" type="button" data-act="reveal-on">${esc(t('reveal_on'))}</button>`}
  </section>`;
}
function vAdminSettings() {
  const g = S.A.group;
  return `<section class="card"><h2>${esc(t('round_settings'))}</h2>
    <form data-form="group" novalidate>
      ${field('g-name', t('group_name'), g.name, { attrs: 'maxlength="80" required' })}
      <div class="row">${field('g-budget', t('budget_amount'), g.budget ?? '', { type: 'number', attrs: 'min="0" step="any" inputmode="decimal"' })}${currencySelect('g-cur', g.currency)}</div>
      ${field('g-ex', t('exchange_time'), toLocalInput(g.exchange_at), { type: 'datetime-local', hint: t('exchange_time_hint') })}
      <div class="field"><label class="check"><input type="checkbox" id="g-inperson" ${g.in_person ? 'checked' : ''} data-keep> ${esc(t('in_person'))}</label><span class="hint">${esc(t('in_person_hint'))}</span></div>
      <div class="row">${field('g-wd', t('wish_deadline'), g.wish_deadline || '', { type: 'date' })}${field('g-sb', t('ship_by'), g.ship_by || '', { type: 'date', hint: t('ship_by_hint') }).replace('<div class="field">', `<div class="field" id="g-sb-wrap" ${g.in_person ? 'hidden' : ''}>`)}</div>
      ${area('g-notes', t('notes_title'), g.notes, t('notes_ph'), 'maxlength="4000" rows="4"')}
      ${langSelect('g-lang', g.default_lang, t('default_language'))}
      <fieldset class="field"><legend>${esc(t('layout_default'))}</legend>${layoutPicker('g-layout', g.layout)}</fieldset>
      <button class="btn" type="submit">${esc(t('save'))}</button>
    </form></section>`;
}
/* Names per reminder reason. The organiser is left out: nobody needs to remind themselves. */
function reminderBuckets() {
  const g = S.A.group, b = { invite: [], wishes: [], draw: [] };
  S.A.participants.forEach(p => { const k = p.id === S.A.organiser_id ? null : reminderKind(p, g); if (k) b[k].push(p.name); });
  return b;
}
function vAdminReminders() {
  const b = reminderBuckets();
  const keys = ['invite', 'draw', 'wishes'].filter(k => b[k].length);
  if (!keys.length) return '';
  return `<section class="card reminders"><h2>${esc(t('reminders_title'))}</h2>
    <ul class="rem-list">${keys.map(k => `<li>${esc(t('reminders_' + k, { names: b[k].join(', ') }))}</li>`).join('')}</ul>
    <p class="hint">${esc(t('reminders_hint'))}</p>
    <button type="button" class="btn secondary" data-act="group-msg">${ICON.share}<span>${esc(t('group_msg_btn'))}</span></button>
  </section>`;
}
function nextYearName(g) {
  const m = String(g.name).match(/\b(20\d\d)\b/);
  if (m) return g.name.replace(m[1], String(Number(m[1]) + 1));
  const base = g.exchange_at ? new Date(g.exchange_at).getFullYear() : new Date().getFullYear();
  return `${g.name} ${base + 1}`.slice(0, 80);
}
function vNextYear() {
  const g = S.A.group;
  if (g.status !== 'drawn') return '';
  const name = nextYearName(g);
  if (g.has_next) {
    return `<section class="card next-year"><h2>${esc(t('next_year_title'))}</h2><p>${esc(t('next_year_exists'))}</p>
    <button type="button" class="btn secondary" data-act="copy-round" data-name="${esc(name)}">${esc(t('next_year_open'))}</button></section>`;
  }
  return `<section class="card next-year"><h2>${esc(t('next_year_title'))}</h2><p>${esc(t('next_year_text'))}</p>
    <button type="button" class="btn secondary" data-act="copy-round" data-name="${esc(name)}">${esc(t('next_year_btn', { name }))}</button></section>`;
}
function vDanger() {
  const g = S.A.group;
  const keep = g.purged ? t('retention_done', { del: fmtDayYear(g.delete_at) })
    : t('retention_text', { purge: fmtDayYear(g.purge_at), del: fmtDayYear(g.delete_at) });
  return `<section class="card danger-zone"><h2>${esc(t('danger_title'))}</h2>
    ${g.purge_at ? `<p class="hint">${esc(keep)}</p>` : ''}
    ${g.status === 'drawn' ? `<div class="dz-row"><div><strong>${esc(t('reset_draw'))}</strong><p class="hint">${esc(t('reset_draw_hint'))}</p></div><button class="btn danger" type="button" data-act="reset-draw">${esc(t('reset_draw'))}</button></div>` : ''}
    <div class="dz-row"><div><strong>${esc(t('delete_group'))}</strong><p class="hint">${esc(t('delete_group_hint'))}</p></div><button class="btn danger" type="button" data-act="delete-group">${esc(t('delete_group'))}</button></div>
  </section>`;
}

/* ---------------- modal, toast, confirm ---------------- */
function openModal(html) {
  const m = $('#modal');
  m.innerHTML = `<div class="modal-inner">${html}<button type="button" class="icon-btn modal-x" data-act="close-modal" aria-label="${esc(t('close'))}">${ICON.close}</button></div>`;
  if (!m.open) { try { m.showModal(); } catch { m.setAttribute('open', ''); } }
}
function closeModal() {
  const m = $('#modal');
  if (m && m.open) { try { m.close(); } catch { m.removeAttribute('open'); } }
}
function askConfirm(title, text, okLabel, danger) {
  return new Promise(resolve => {
    openModal(`<h2 id="modal-title">${esc(title)}</h2><p>${esc(text)}</p>
      <div class="btn-row end"><button type="button" class="btn secondary" data-confirm="0">${esc(t('cancel'))}</button><button type="button" class="btn ${danger ? 'danger' : ''}" data-confirm="1">${esc(okLabel)}</button></div>`);
    const m = $('#modal');
    const onClick = e => {
      const b = e.target.closest('[data-confirm],[data-act="close-modal"]');
      if (!b) return;
      cleanup(); closeModal(); resolve(b.dataset.confirm === '1');
    };
    const onClose = () => { cleanup(); resolve(false); };
    function cleanup() { m.removeEventListener('click', onClick, true); m.removeEventListener('close', onClose); }
    m.addEventListener('click', onClick, true);
    m.addEventListener('close', onClose);
  });
}
let toastTimer = null;
function toast(msg, bad) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'show' + (bad ? ' bad' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, 2800);
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast(t('copied')); return; } catch { /* fallback */ }
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); toast(t('copied')); } catch { toast(t('copy_failed'), true); }
  ta.remove();
}
function confetti() {
  if (reducedMotion()) return;
  const cs = getComputedStyle(document.body);
  const colors = ['--accent', '--accent-2', '--accent-3'].map(v => cs.getPropertyValue(v).trim() || '#c00');
  const box = document.createElement('div');
  box.className = 'confetti';
  box.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 70; i++) {
    const s = document.createElement('i');
    s.style.left = Math.random() * 100 + 'vw';
    s.style.background = colors[i % colors.length];
    s.style.animationDelay = (Math.random() * 0.6) + 's';
    s.style.animationDuration = (1.8 + Math.random() * 1.4) + 's';
    s.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
    s.style.setProperty('--x', (Math.random() * 120 - 60) + 'px');
    box.appendChild(s);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3600);
}
function loadQR() {
  return new Promise((resolve, reject) => {
    if (window.qrcode) return resolve();
    const s = document.createElement('script');
    s.src = 'vendor/qrcode.js'; // qrcode-generator 1.4.4 (MIT), hosted here instead of a CDN
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/* ---------------- modals with content ---------------- */
function openLayouts() {
  const isAdmin = S.mode === 'admin' && S.A;
  openModal(`<h2 id="modal-title">${esc(t('layout_title'))}</h2><p class="hint">${esc(t('layout_hint'))}</p>
    ${layoutPicker('m-layout', S.layout)}
    ${store.get('wl_layout') ? `<button type="button" class="btn ghost" data-act="layout-reset">${esc(t('layout_follow_group'))}</button>` : ''}
    ${isAdmin ? `<p class="hint">${esc(t('layout_admin_hint'))}</p>` : ''}`);
}
function personMessage(p, kind, link) {
  const g = S.A.group;
  const deadline = g.wish_deadline ? tl(p.lang, 'invite_deadline', { date: fmtDateIn(p.lang, g.wish_deadline) }) : '';
  if (kind === 'wishes') return tl(p.lang, 'remind_wishes_msg', { name: p.name, group: g.name, link, deadline });
  if (kind === 'draw') return tl(p.lang, 'remind_draw_msg', { name: p.name, group: g.name, link });
  return tl(p.lang, 'invite_msg', { name: p.name, group: g.name, link, deadline });
}
function shareButtons(msg, remId, extra) {
  const canShare = typeof navigator.share === 'function';
  const rem = remId ? ` data-rem="${esc(remId)}"` : '';
  return `<div class="btn-row">
      ${canShare ? `<button type="button" class="btn" data-act="share" data-text="${esc(msg)}"${rem}>${ICON.share}<span>${esc(t('share'))}</span></button>` : ''}
      <a class="btn ${canShare ? 'secondary' : ''}" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener" data-act="mark-reminded"${rem}>WhatsApp</a>
      <button type="button" class="btn secondary" data-act="copy" data-text="${esc(msg)}"${rem}>${ICON.copy}<span>${esc(t('copy_msg'))}</span></button>
      ${extra || ''}
    </div>`;
}
async function openInvite(id, kindIn) {
  const p = S.A.participants.find(x => x.id === id);
  if (!p) return;
  const kind = ['invite', 'wishes', 'draw', 'link'].includes(kindIn) ? kindIn : (reminderKind(p, S.A.group) || 'link');
  const link = linkFor(p.token);
  const msg = personMessage(p, kind, link);
  const isRem = kind === 'wishes' || kind === 'draw';
  const title = isRem ? t('remind_title', { name: p.name }) : t('invite_title', { name: p.name });
  const hint = isRem ? t('remind_hint', { reason: t('reason_' + kind), lang: langName(p.lang) }) : t('invite_hint', { lang: langName(p.lang) });
  openModal(`<h2 id="modal-title">${esc(title)}</h2>
    <p class="hint">${esc(hint)}</p>
    <textarea class="invite-text" rows="8" readonly aria-label="${esc(title)}">${esc(msg)}</textarea>
    ${shareButtons(msg, kind === 'link' ? null : p.id, `<button type="button" class="btn ghost" data-act="copy" data-text="${esc(link)}">${esc(t('copy_link'))}</button>`)}
    <div class="qr-wrap"><div class="qr" id="qr-box" role="img" aria-label="${esc(t('qr_label', { name: p.name }))}"></div><p class="hint">${esc(t('qr_hint'))}</p></div>`);
  try {
    await loadQR();
    const q = window.qrcode(0, 'M');
    q.addData(link); q.make();
    const box = $('#qr-box');
    if (box) box.innerHTML = q.createSvgTag(5, 10);
  } catch { const box = $('#qr-box'); if (box) box.closest('.qr-wrap').remove(); }
}
function groupMsgText(lang) {
  const g = S.A.group, b = reminderBuckets();
  const lines = [];
  if (b.invite.length) lines.push(tl(lang, 'group_msg_invite', { names: b.invite.join(', ') }));
  if (b.draw.length) lines.push(tl(lang, 'group_msg_draw', { names: b.draw.join(', ') }));
  if (b.wishes.length) lines.push(tl(lang, 'group_msg_wishes', { names: b.wishes.join(', '), deadline: g.wish_deadline ? tl(lang, 'group_msg_deadline', { date: fmtDateIn(lang, g.wish_deadline) }) : '' }));
  return `${tl(lang, 'group_msg_head', { group: g.name })}\n\n${lines.join('\n')}\n\n${tl(lang, 'group_msg_foot')}`;
}
function openGroupMsg(lang) {
  const l = LANGS.includes(lang) ? lang : (S.A.group.default_lang || S.lang);
  const msg = groupMsgText(l);
  openModal(`<h2 id="modal-title">${esc(t('group_msg_title'))}</h2>
    <p class="hint">${esc(t('group_msg_hint'))}</p>
    <div class="seg modal-seg" role="group" aria-label="${esc(t('language'))}">${LANGS.map(x => `<button type="button" data-act="group-msg" data-lang="${x}" aria-pressed="${x === l}" lang="${x}">${esc(tl(x, 'lang_self'))}</button>`).join('')}</div>
    <textarea class="invite-text" rows="8" readonly aria-label="${esc(t('group_msg_title'))}">${esc(msg)}</textarea>
    ${shareButtons(msg, null)}`);
}
function openEditPerson(id) {
  const p = S.A.participants.find(x => x.id === id);
  if (!p) return;
  const open = S.A.group.status === 'open';
  openModal(`<h2 id="modal-title">${esc(t('edit_title', { name: p.name }))}</h2>
    <form data-form="edit-person" data-id="${esc(p.id)}" novalidate>
      ${field('ep-name', t('name'), p.name, { attrs: 'maxlength="60" required', keep: false })}
      <div class="row">${countrySelect('ep-country', p.country)}${langSelect('ep-lang', p.lang)}</div>
      ${open ? field('ep-house', t('household'), p.household || '', { attrs: 'maxlength="60"', hint: t('household_hint'), keep: false }) : ''}
      <div class="field"><span class="label">${esc(t('emoji'))}</span>${emojiGrid('ep-emoji', p.emoji)}</div>
      <button type="submit" class="btn">${esc(t('save'))}</button>
    </form>
    <div class="modal-more">
      ${p.id === S.A.organiser_id
        ? `<button type="button" class="btn secondary" data-act="invite" data-id="${esc(p.id)}" data-kind="link">${esc(t('share_link'))}</button>
           <button type="button" class="btn secondary" data-act="set-me" data-id="">${esc(t('me_not_me'))}</button>`
        : `<button type="button" class="btn secondary" data-act="set-me" data-id="${esc(p.id)}">${esc(t('me_this_is_me'))}</button>`}
      ${p.has_pin ? `<button type="button" class="btn secondary" data-act="reset-pin" data-id="${esc(p.id)}">${esc(t('reset_pin'))}</button>` : ''}
      <button type="button" class="btn secondary" data-act="new-link" data-id="${esc(p.id)}">${esc(t('new_link'))}</button>
      ${open ? `<button type="button" class="btn danger" data-act="remove-person" data-id="${esc(p.id)}">${esc(t('remove_person'))}</button>` : ''}
    </div>`);
}
function emojiGrid(name, current) {
  return `<div class="emoji-grid" role="radiogroup">${EMOJIS.map((e, i) => `<label class="emo"><input type="radio" name="${name}" value="${e}" ${e === current ? 'checked' : ''} aria-label="${e}"><span>${e}</span></label>`).join('')}</div>`;
}
function tzOptions(current) {
  let zones = [];
  try { zones = Intl.supportedValuesOf('timeZone'); } catch { zones = [...new Set(Object.values(COUNTRIES).map(c => c[1]))].sort(); }
  if (current && !zones.includes(current)) zones.unshift(current);
  return zones.map(z => `<option value="${esc(z)}" ${z === current ? 'selected' : ''}>${esc(z.replace(/_/g, ' '))}</option>`).join('');
}
function openSettings() {
  const me = S.me.me;
  openModal(`<h2 id="modal-title">${esc(t('my_settings'))}</h2>
    <form data-form="settings" novalidate>
      ${field('s-name', t('name'), me.name, { attrs: 'maxlength="60" required', keep: false })}
      <div class="field"><span class="label">${esc(t('emoji'))}</span>${emojiGrid('s-emoji', me.emoji)}</div>
      <div class="row">${countrySelect('s-country', me.country)}${langSelect('s-lang', me.lang)}</div>
      <div class="field"><label for="s-tz">${esc(t('timezone'))}</label><select id="s-tz">${tzOptions(tzOf(me))}</select>
        <button type="button" class="btn ghost small" data-act="use-device-tz">${esc(t('use_device_tz', { tz: deviceTz().replace(/_/g, ' ') }))}</button></div>
      <button type="submit" class="btn">${esc(t('save'))}</button>
    </form>
    <section class="modal-section">
      <h3>${esc(t('pin_section'))}</h3>
      <p class="hint">${esc(me.has_pin ? t('pin_active') : t('pin_inactive'))}</p>
      <form data-form="set-pin" class="row end" novalidate>
        <div class="field"><label for="s-pin">${esc(me.has_pin ? t('pin_change') : t('pin_new'))}</label><input id="s-pin" type="password" inputmode="numeric" pattern="[0-9]*" minlength="4" maxlength="8" autocomplete="new-password"></div>
        <button type="submit" class="btn secondary">${esc(t('pin_set'))}</button>
      </form>
      ${me.has_pin ? `<button type="button" class="btn ghost" data-act="remove-pin">${esc(t('pin_remove'))}</button>` : ''}
    </section>
    <section class="modal-section">
      <h3>${esc(t('push_section'))}</h3>
      ${vPushControls()}
    </section>
    <section class="modal-section">
      <h3>${esc(t('layout'))}</h3>
      ${layoutPicker('m-layout', S.layout)}
    </section>
    <section class="modal-section">
      <h3>${esc(t('forget_device'))}</h3><p class="hint">${esc(t('forget_device_hint'))}</p>
      <button type="button" class="btn ghost" data-act="forget-device">${esc(t('forget_device'))}</button>
    </section>`);
}

/* ---------------- home screen app & notifications ---------------- */
const PUSH_OK = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
function isStandalone() { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch { return false; } }
function pushKey(token) { return 'wl_push_' + (token || S.token); }
function hintKey() { return 'wl_apphint_' + S.token; }
function b64uToBytes(s) {
  const b = atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, c => c.charCodeAt(0));
}
async function currentSub() {
  try { const reg = await navigator.serviceWorker.getRegistration(); return reg ? await reg.pushManager.getSubscription() : null; } catch { return null; }
}
/* S.push: 'install' (iPhone in Safari: add to the home screen first), 'off', 'on', 'denied' or null (no notifications here) */
async function refreshPushState() {
  let st = null;
  if (S.mode === 'p' && S.me) {
    if (isIOS() && !isStandalone()) st = 'install'; // iOS offers notifications only to home screen apps
    else if (PUSH_OK) {
      if (Notification.permission === 'denied') st = 'denied';
      else {
        const sub = await currentSub();
        st = sub && store.get(pushKey()) === sub.endpoint && Notification.permission === 'granted' ? 'on' : 'off';
        if (st === 'off' && !S.pushKey) rpc('wichteln_push_key', {}).then(k => { S.pushKey = k || null; }).catch(() => {});
      }
    }
  }
  if (st !== S.push) { S.push = st; if (S.mode === 'p' && S.me && !S.loading) render(); }
}
async function pushOn() {
  // ask first, straight from the tap: Safari only shows the question during a user gesture
  const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (perm !== 'granted') { await refreshPushState(); toast(t('push_denied'), true); return; }
  const key = S.pushKey || await rpc('wichteln_push_key', {});
  if (!key) throw new Error('push_key');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(key) });
  const r = await rpc('wichteln_push_subscribe', pArgs({ p_sub: sub.toJSON() }));
  if (authFailed(r)) return;
  if (r.error) throw new Error(r.error);
  store.set(pushKey(), sub.endpoint);
  if ($('#modal').open) closeModal();
  await refreshPushState();
  render(); toast(t('push_on_done'));
}
async function pushOff(quiet) {
  // remember the link now: "forget this device" leaves the page while this is still running
  const token = S.token, pin = S.pin || null;
  const sub = await currentSub();
  const endpoint = (sub && sub.endpoint) || store.get(pushKey(token));
  if (endpoint) await rpc('wichteln_push_unsubscribe', { p_token: token, p_pin: pin, p_endpoint: endpoint }).catch(() => {});
  store.del(pushKey(token));
  // the browser subscription is shared by all links on this device; drop it only when no other link uses it
  if (sub && !store.keys().some(k => k.startsWith('wl_push_') && store.get(k) === sub.endpoint)) await sub.unsubscribe().catch(() => {});
  if (quiet === true) return;
  if ($('#modal').open) closeModal();
  await refreshPushState();
  render(); toast(t('push_off_done'));
}
function vPushControls() {
  if (S.push === 'install') return `<p class="hint">${esc(t('push_needs_app'))}</p>`;
  if (S.push === 'denied') return `<p class="hint">${esc(t('push_denied'))}</p>`;
  if (S.push === 'on') return `<p class="hint">${esc(t('push_on_text'))}</p><button type="button" class="btn ghost" data-act="push-off">${esc(t('push_off'))}</button>`;
  if (S.push === 'off') return `<p class="hint">${esc(t('push_text'))}</p><button type="button" class="btn secondary" data-act="push-on">${ICON.bell}<span>${esc(t('push_on'))}</span></button>`;
  return `<p class="hint">${esc(t('push_unsupported'))}</p>`;
}
function vAppCard() {
  if (store.get(hintKey()) === 'no') return '';
  if (S.push === 'install') {
    return `<section class="card app-card"><h2>${esc(t('app_title'))}</h2><p>${esc(t('app_text'))}</p>
      <ol class="how-list">${['app_step1', 'app_step2', 'app_step3'].map(k => `<li>${esc(t(k))}</li>`).join('')}</ol>
      <button type="button" class="btn ghost small" data-act="app-hint-no">${esc(t('app_hint_no'))}</button></section>`;
  }
  if (S.push === 'off') {
    return `<section class="card app-card"><h2>${esc(t('push_title'))}</h2><p>${esc(t('push_text'))}</p>
      <div class="btn-row"><button type="button" class="btn" data-act="push-on">${ICON.bell}<span>${esc(t('push_on'))}</span></button>
      <button type="button" class="btn ghost" data-act="app-hint-no">${esc(t('push_later'))}</button></div></section>`;
  }
  return '';
}
function openPrivacy() {
  const doc = (typeof PRIVACY !== 'undefined' && (PRIVACY[S.lang] || PRIVACY.de)) || [];
  openModal(`<h2 id="modal-title">${esc(t('privacy_link'))}</h2>
    <div class="privacy">${doc.map(([h, p]) => `<h3>${esc(h)}</h3><p>${esc(p)}</p>`).join('')}
    <p><a href="${IMPRINT_URL}" target="_blank" rel="noopener">${esc(t('imprint_link'))}</a></p></div>`);
}

/* ---------------- actions ---------------- */
async function safely(fn) {
  try { await fn(); } catch (e) { console.error(e); toast(t('err_generic'), true); }
}
function setLang(l) {
  if (!LANGS.includes(l)) return;
  S.lang = l;
  if (S.mode !== 'p') store.set('wl_lang', l);
  render();
  if (S.mode === 'p' && S.me) {
    S.me.me.lang = l;
    rpc('wichteln_save_me', pArgs({ p_patch: { lang: l } })).catch(() => {});
  }
}
function setLayout(l) {
  if (!LAYOUTS.includes(l)) return;
  S.layout = l;
  store.set('wl_layout', l);
  render();
}
async function doReveal() {
  if (S.revealing) return;
  S.revealing = true;
  const box = $('#reveal');
  if (box) box.classList.add('opening');
  const wait = reducedMotion() ? 200 : 1700;
  setTimeout(async () => {
    confetti();
    try { await rpc('wichteln_mark_viewed', pArgs()); } catch { /* shown anyway */ }
    S.me.me.viewed_at = new Date().toISOString();
    S.revealing = false;
    render();
  }, wait);
}
async function setGift(status, wish) {
  const me = S.me.me;
  const r = await rpc('wichteln_set_gift', pArgs({ p_status: status, p_wish: wish ?? null }));
  if (authFailed(r)) return;
  if (r.error) { toast(t('err_generic'), true); return; }
  me.gift_status = status; me.gift_wish = wish ?? null;
  render();
}

async function onClick(e) {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  switch (act) {
    case 'tab':
      if (S.tab === 'wishes' && el.dataset.tab !== 'wishes' && S.draftDirty) {
        const go = await askConfirm(t('unsaved_title'), t('unsaved_text'), t('discard'), true);
        if (!go) return;
        S.draft = null; S.draftDirty = false;
      }
      S.tab = el.dataset.tab;
      if (S.tab === 'draw') markSeen('out');
      if (S.tab === 'wishes') markSeen('in');
      render(); window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
      break;
    case 'lang': setLang(el.dataset.lang); break;
    case 'layouts': openLayouts(); break;
    case 'layout-reset':
      store.del('wl_layout');
      S.layout = (S.me && S.me.group.layout) || (S.A && S.A.group.layout) || 'classic';
      render(); closeModal(); break;
    case 'settings': openSettings(); break;
    case 'privacy': openPrivacy(); break;
    case 'push-on': safely(pushOn); break;
    case 'push-off': safely(pushOff); break;
    case 'app-hint-no': store.set(hintKey(), 'no'); render(); break;
    case 'close-modal': closeModal(); break;
    case 'retry': route(); break;
    case 'nav': {
      e.preventDefault();
      const dirty = S.draftDirty || (S.mode === 'admin' && S.formDirty);
      if (dirty && !await askConfirm(t('unsaved_title'), t(S.draftDirty ? 'unsaved_text' : 'unsaved_form_text'), t('discard'), true)) return;
      S.draftDirty = false; S.formDirty = false;
      location.hash = el.getAttribute('href').slice(1);
      break;
    }
    case 'copy':
      copyText(el.dataset.text || '');
      if (el.dataset.rem) { markReminded(el.dataset.rem); render(); }
      break;
    case 'share':
      try {
        await navigator.share({ text: el.dataset.text || '' });
        if (el.dataset.rem) { markReminded(el.dataset.rem); render(); }
      } catch { /* cancelled */ }
      break;
    case 'mark-reminded':
      if (el.dataset.rem) { markReminded(el.dataset.rem); setTimeout(render, 0); }
      break;
    case 'group-msg': openGroupMsg(el.dataset.lang); break;
    case 'copy-round': safely(async () => {
      const name = el.dataset.name;
      if (!S.A.group.has_next && !await askConfirm(t('next_year_confirm_title'), t('next_year_confirm_text', { name }), t('next_year_btn', { name }))) return;
      const r = await rpc('wichteln_admin_copy_group', { p_admin: S.admin, p_name: name });
      if (r.error || !r.admin_token) throw new Error(r.error || 'copy');
      if (!r.existing) remember({ kind: 'admin', token: r.admin_token, name });
      location.hash = 'a=' + r.admin_token;
      toast(t(r.existing ? 'next_year_opened' : 'next_year_done'));
    }); break;
    case 'forget-recent': forgetRecent(el.dataset.kind, el.dataset.token); render(); break;
    case 'reveal': doReveal(); break;
    case 'gift': safely(() => setGift(el.dataset.s, S.me.me.gift_wish)); break;
    case 'pick-wish': {
      const i = Number(el.dataset.i);
      const me = S.me.me;
      const same = me.gift_wish === i;
      const status = same ? me.gift_status : (me.gift_status === 'none' ? 'idea' : me.gift_status);
      safely(() => setGift(status, same ? null : i));
      break;
    }
    case 'guess': safely(async () => {
      const id = el.dataset.id === S.me.me.guess_id ? null : el.dataset.id;
      const r = await rpc('wichteln_guess', pArgs({ p_guess: id }));
      if (authFailed(r)) return;
      if (r.error) { toast(t('err_generic'), true); return; }
      S.me.me.guess_id = id; render(); toast(t('guess_saved'));
    }); break;
    case 'add-wish':
      if (S.draft.wishes.length < MAX_WISHES) {
        S.draft.wishes.push({ title: '', link: '', price: '', cur: curOf(S.me.me.country), note: '', fav: false });
        S.draftDirty = true; render();
        const inp = document.getElementById(`w-${S.draft.wishes.length - 1}-title`);
        if (inp) inp.focus();
      }
      break;
    case 'del-wish':
      S.draft.wishes.splice(Number(el.dataset.i), 1);
      if (!S.draft.wishes.length) S.draft.wishes.push({ title: '', link: '', price: '', cur: curOf(S.me.me.country), note: '', fav: false });
      S.draftDirty = true; render(); break;
    case 'fav': {
      const w = S.draft.wishes[Number(el.dataset.i)];
      if (w) { w.fav = !w.fav; S.draftDirty = true; render(); }
      break;
    }
    case 'inspire': {
      const v = el.dataset.v;
      let slot = S.draft.wishes.findIndex(w => !w.title.trim());
      if (slot < 0 && S.draft.wishes.length < MAX_WISHES) { S.draft.wishes.push({ title: '', link: '', price: '', cur: curOf(S.me.me.country), note: '', fav: false }); slot = S.draft.wishes.length - 1; }
      if (slot >= 0) {
        S.draft.wishes[slot].title = v + ': ';
        S.draftDirty = true; render();
        const inp = document.getElementById(`w-${slot}-title`);
        if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
      }
      break;
    }
    case 'use-device-tz': { const s = $('#s-tz'); if (s) { const tz = deviceTz(); if (![...s.options].some(o => o.value === tz)) s.insertAdjacentHTML('afterbegin', `<option value="${esc(tz)}">${esc(tz)}</option>`); s.value = tz; } break; }
    case 'remove-pin': safely(async () => {
      const r = await rpc('wichteln_set_pin', pArgs({ p_new_pin: null }));
      if (authFailed(r)) { closeModal(); return; }
      setPin(S.token, null); S.pin = null; S.me.me.has_pin = false; closeModal(); toast(t('pin_removed')); render();
    }); break;
    case 'forget-device':
      pushOff(true).catch(() => {});
      setPin(S.token, null); forgetRecent('p', S.token);
      store.del(seenKey('in')); store.del(seenKey('out')); store.del(ownerKey(S.token));
      closeModal(); location.hash = ''; break;
    /* admin */
    case 'admin-saved': store.set('wl_admin_saved_' + S.admin, '1'); render(); break;
    case 'pick-me': openPickMe(); break;
    case 'me-skip': store.set(meSkipKey(), '1'); render(); break;
    case 'set-me': safely(async () => {
      const id = el.dataset.id || null;
      const r = await rpc('wichteln_admin_set_organiser', { p_admin: S.admin, p_id: id });
      if (r.error) throw new Error(r.error);
      if (id) store.del(meSkipKey()); else store.set(meSkipKey(), '1');
      closeModal(); toast(t(id ? 'me_set_done' : 'saved'));
      await loadAdmin(true);
    }); break;
    case 'invite': openInvite(el.dataset.id, el.dataset.kind); break;
    case 'edit-person': openEditPerson(el.dataset.id); break;
    case 'reset-pin': safely(async () => {
      const r = await rpc('wichteln_admin_reset_pin', { p_admin: S.admin, p_id: el.dataset.id });
      if (r.error) throw new Error(r.error);
      closeModal(); toast(t('pin_reset_done')); await loadAdmin(true);
    }); break;
    case 'new-link': safely(async () => {
      const id = el.dataset.id;
      closeModal();
      if (!await askConfirm(t('new_link'), t('new_link_confirm'), t('new_link'))) return;
      const r = await rpc('wichteln_admin_new_link', { p_admin: S.admin, p_id: id });
      if (r.error) throw new Error(r.error);
      await loadAdmin(true); openInvite(id);
    }); break;
    case 'remove-person': safely(async () => {
      const id = el.dataset.id;
      const p = S.A.participants.find(x => x.id === id);
      closeModal();
      if (!await askConfirm(t('remove_person'), t('remove_confirm', { name: p ? p.name : '' }), t('remove_person'), true)) return;
      const r = await rpc('wichteln_admin_remove_participant', { p_admin: S.admin, p_id: id });
      if (r.error) throw new Error(r.error);
      await loadAdmin(true);
    }); break;
    case 'draw': safely(async () => {
      if (!await askConfirm(t('draw_confirm_title'), t('draw_confirm_text'), t('draw_btn'))) return;
      let r = await rpc('wichteln_admin_draw', { p_admin: S.admin });
      if (r.error === 'impossible_history') {
        if (!await askConfirm(t('history_conflict_title'), t('history_conflict_text'), t('draw_anyway'))) return;
        r = await rpc('wichteln_admin_draw_ignore_history', { p_admin: S.admin });
      }
      if (r.error) { toast(t(r.error === 'impossible' ? 'err_impossible' : r.error === 'too_few' ? 'err_too_few' : 'err_generic'), true); return; }
      confetti(); toast(t('drawn_toast')); await loadAdmin(true);
    }); break;
    case 'reveal-on': safely(async () => {
      if (!await askConfirm(t('reveal_confirm_title'), t('reveal_confirm_text'), t('reveal_on'))) return;
      const r = await rpc('wichteln_admin_set_reveal', { p_admin: S.admin, p_on: true });
      if (r.error) throw new Error(r.error);
      confetti(); await loadAdmin(true);
    }); break;
    case 'reveal-off': safely(async () => {
      const r = await rpc('wichteln_admin_set_reveal', { p_admin: S.admin, p_on: false });
      if (r.error) throw new Error(r.error);
      await loadAdmin(true);
    }); break;
    case 'reset-draw': safely(async () => {
      if (!await askConfirm(t('reset_draw'), t('reset_draw_confirm'), t('reset_draw'), true)) return;
      const r = await rpc('wichteln_admin_reset_draw', { p_admin: S.admin });
      if (r.error) throw new Error(r.error);
      toast(t('reset_done')); await loadAdmin(true);
    }); break;
    case 'delete-group': safely(async () => {
      if (!await askConfirm(t('delete_group'), t('delete_confirm'), t('delete_group'), true)) return;
      const r = await rpc('wichteln_admin_delete_group', { p_admin: S.admin });
      if (r.error) throw new Error(r.error);
      forgetRecent('admin', S.admin); store.del('wl_admin_saved_' + S.admin); store.del(meSkipKey()); syncOwner(null);
      toast(t('deleted')); location.hash = '';
    }); break;
    default: break;
  }
}

function onInput(e) {
  const el = e.target;
  if (el.dataset.w != null && S.draft) {
    const w = S.draft.wishes[Number(el.dataset.w)];
    if (w) { w[el.dataset.f] = el.value; markDraftDirty(); }
    return;
  }
  if (el.dataset.pf && S.draft) { S.draft.profile[el.dataset.pf] = el.value; markDraftDirty(); return; }
  if (el.closest('form[data-form="group"], form[data-form="add-person"], form[data-form="create"]')) S.formDirty = true;
}
function markDraftDirty() {
  if (!S.draftDirty) {
    S.draftDirty = true;
    const s = $('#save-state');
    if (s) s.textContent = t('unsaved');
  }
}
function onChange(e) {
  const el = e.target;
  if (el.name === 'm-layout') { setLayout(el.value); return; }
  if (el.name === 'c-layout') { S.layout = el.value; applyTheme(); render(); return; }
  if (el.id === 'ap-country') { const l = $('#ap-lang'); if (l) l.value = langForCountry(el.value); }
  if (el.id === 'g-inperson') { const w = $('#g-sb-wrap'); if (w) w.hidden = el.checked; }
  if (el.closest && el.closest('form[data-form="group"], form[data-form="add-person"]')) S.formDirty = true;
}

async function onSubmit(e) {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  const kind = form.dataset.form;
  const btn = form.querySelector('[type="submit"]');
  if (btn) btn.disabled = true;
  try {
    await submitForm(kind, form);
  } catch (err) {
    console.error(err);
    toast(t('err_generic'), true);
  } finally {
    if (btn && document.body.contains(btn)) btn.disabled = false;
  }
}
/* Budget field → non-negative number, or null when empty or not a number. */
function budgetValue(raw) {
  const s = String(raw ?? '').trim();
  const n = Number(s);
  return s === '' || !isFinite(n) ? null : Math.max(0, n);
}
async function submitForm(kind, form) {
  switch (kind) {
    case 'create': {
      const name = $('#c-name').value.trim();
      if (!name) { toast(t('err_name'), true); $('#c-name').focus(); return; }
      const budget = $('#c-budget').value;
      const ex = $('#c-ex').value;
      const layout = (form.querySelector('input[name="c-layout"]:checked') || {}).value || S.layout;
      const r = await rpc('wichteln_create_group', {
        p_name: name, p_budget: budgetValue(budget), p_currency: checkedCurrency(form, 'c-cur'),
        p_exchange_at: ex ? new Date(ex).toISOString() : null, p_lang: $('#c-lang').value, p_layout: layout,
      });
      if (r.error || !r.admin_token) throw new Error(r.error || 'create');
      S.formDirty = false;
      remember({ kind: 'admin', token: r.admin_token, name });
      location.hash = 'a=' + r.admin_token;
      return;
    }
    case 'pin': {
      const pin = $('#pin-in').value.trim();
      if (!/^\d{4,8}$/.test(pin)) { toast(t('pin_invalid'), true); return; }
      S.pin = pin;
      setPin(S.token, pin, $('#pin-remember').checked);
      await loadMe();
      if (S.err) setPin(S.token, null);
      return;
    }
    case 'send': {
      const input = form.querySelector('input');
      const body = input.value.trim();
      if (!body) return;
      const r = await rpc('wichteln_send', pArgs({ p_to: form.dataset.to, p_body: body }));
      if (authFailed(r)) return;
      if (r.error) { toast(t(r.error === 'rate' ? 'err_rate' : 'err_generic'), true); return; }
      input.value = '';
      await loadMe(true);
      markSeen(form.dataset.to === 'recipient' ? 'out' : 'in');
      toast(t('sent'));
      return;
    }
    case 'wishes': {
      const d = S.draft;
      const myCur = curOf(S.me.me.country);
      const wishes = d.wishes.map(w => ({
        title: String(w.title || '').trim().slice(0, 140),
        link: String(w.link || '').trim().slice(0, 500),
        price: w.price === '' || w.price == null || isNaN(Number(w.price)) ? null : Math.max(0, Number(w.price)),
        cur: w.cur || myCur,
        note: String(w.note || '').trim().slice(0, 200),
        fav: !!w.fav,
      })).filter(w => w.title);
      const profile = {};
      for (const k in d.profile) profile[k] = String(d.profile[k] || '').trim().slice(0, 600);
      const r = await rpc('wichteln_save_me', pArgs({ p_patch: { wishes, profile } }));
      if (authFailed(r)) return;
      if (r.error) throw new Error(r.error);
      S.draft = null; S.draftDirty = false;
      await loadMe(true);
      const n = wishes.length;
      toast(n >= MIN_WISHES ? t('saved') : t('saved_missing', { n: MIN_WISHES - n }));
      return;
    }
    case 'settings': {
      const name = $('#s-name').value.trim();
      if (!name) { toast(t('err_name'), true); return; }
      const emoji = (form.querySelector('input[name="s-emoji"]:checked') || {}).value;
      const country = $('#s-country').value;
      const patch = { name, country, lang: $('#s-lang').value, tz: $('#s-tz').value };
      if (emoji) patch.emoji = emoji;
      const r = await rpc('wichteln_save_me', pArgs({ p_patch: patch }));
      if (authFailed(r)) { closeModal(); return; }
      if (r.error) throw new Error(r.error);
      closeModal();
      await loadMe(true); toast(t('saved'));
      return;
    }
    case 'set-pin': {
      const np = $('#s-pin').value.trim();
      if (!/^\d{4,8}$/.test(np)) { toast(t('pin_invalid'), true); return; }
      const r = await rpc('wichteln_set_pin', pArgs({ p_new_pin: np }));
      if (authFailed(r)) { closeModal(); return; }
      if (r.error) { toast(t('pin_invalid'), true); return; }
      S.pin = np; setPin(S.token, np); S.me.me.has_pin = true;
      closeModal(); toast(t('pin_saved')); render();
      return;
    }
    case 'add-person': {
      const name = $('#ap-name').value.trim();
      if (!name) { toast(t('err_name'), true); $('#ap-name').focus(); return; }
      const cc = $('#ap-country').value;
      const r = await rpc('wichteln_admin_add_participant', {
        p_admin: S.admin, p_name: name, p_country: cc, p_lang: $('#ap-lang').value,
        p_household: $('#ap-house').value.trim() || null, p_emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
      });
      if (r.error) { toast(t(r.error === 'already_drawn' ? 'locked_after_draw' : 'err_generic'), true); return; }
      store.set('wl_last_cc', cc);
      S.formDirty = false;
      $('#ap-name').value = ''; $('#ap-house').value = '';
      await loadAdmin(true);
      toast(t('added', { name }));
      const inp = $('#ap-name'); if (inp) inp.focus();
      return;
    }
    case 'group': {
      const name = $('#g-name').value.trim();
      if (!name) { toast(t('err_name'), true); return; }
      const ex = $('#g-ex').value;
      const layout = (form.querySelector('input[name="g-layout"]:checked') || {}).value;
      const patch = {
        name, budget: budgetValue($('#g-budget').value) ?? '', currency: checkedCurrency(form, 'g-cur'),
        exchange_at: ex ? new Date(ex).toISOString() : '', wish_deadline: $('#g-wd').value, ship_by: $('#g-sb').value,
        notes: $('#g-notes').value, default_lang: $('#g-lang').value, layout, in_person: $('#g-inperson').checked,
      };
      const r = await rpc('wichteln_admin_update_group', { p_admin: S.admin, p_patch: patch });
      if (r.error) throw new Error(r.error);
      $('#g-budget').value = patch.budget; // show the stored value (e.g. -5 becomes 0), the re-render keeps field contents
      S.formDirty = false;
      if (!store.get('wl_layout') && layout) S.layout = layout;
      S.rates = null; S.ratesBase = null;
      await loadAdmin(true); toast(t('saved'));
      return;
    }
    case 'edit-person': {
      const id = form.dataset.id;
      const name = $('#ep-name').value.trim();
      if (!name) { toast(t('err_name'), true); return; }
      const patch = { name, country: $('#ep-country').value, lang: $('#ep-lang').value };
      const house = $('#ep-house'); if (house) patch.household = house.value.trim();
      const emoji = (form.querySelector('input[name="ep-emoji"]:checked') || {}).value; if (emoji) patch.emoji = emoji;
      const r = await rpc('wichteln_admin_update_participant', { p_admin: S.admin, p_id: id, p_patch: patch });
      if (r.error) throw new Error(r.error);
      closeModal(); await loadAdmin(true); toast(t('saved'));
      return;
    }
    default: return;
  }
}

/* ---------------- boot ---------------- */
function boot() {
  S.lang = store.get('wl_lang') || guessLang();
  S.layout = store.get('wl_layout') || 'classic';
  applyTheme();
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onChange);
  document.addEventListener('submit', onSubmit);
  window.addEventListener('hashchange', route);
  window.addEventListener('online', () => { if (S.net) route(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { /* offline shell is optional */ });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') poll(); });
  window.addEventListener('beforeunload', e => { if (S.draftDirty || S.formDirty) { e.preventDefault(); e.returnValue = ''; } });
  setInterval(poll, POLL_MS);
  setInterval(tick, 20000);
  route();
}
boot();
