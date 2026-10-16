// Shared Microsoft Graph helper for the studio booking functions.
// Uses the client-credentials flow with an Entra ID (Azure AD) app registration.
// Nothing here runs until the environment variables below are set in Vercel.

const TZ = process.env.STUDIO_TIMEZONE || 'GMT Standard Time';

const ROOMS = {
  control: { name: 'Control room', email: process.env.ROOM_CONTROL_EMAIL, max: 4 },
  booth:   { name: 'Vocal booth',  email: process.env.ROOM_BOOTH_EMAIL,   max: 3 },
  lounge:  { name: 'The lounge',   email: process.env.ROOM_LOUNGE_EMAIL,  max: 8 },
};

// Session times are London wall-clock times; Graph is told the time zone explicitly.
const SLOTS = {
  am:  { name: 'Morning',   start: '10:00', end: '14:00' },
  pm:  { name: 'Afternoon', start: '14:00', end: '18:00' },
  day: { name: 'Full day',  start: '10:00', end: '18:00' },
};

// England and Wales bank holidays: the studio is closed.
const HOLIDAYS = new Set([
  '2026-12-25', '2026-12-28', '2027-01-01', '2027-03-26', '2027-03-29', '2027-05-03',
  '2027-05-31', '2027-08-30', '2027-12-27', '2027-12-28', '2028-01-03',
]);

function configured() {
  return Boolean(
    process.env.MS_TENANT_ID && process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET &&
    process.env.STUDIO_MAILBOX && ROOMS.control.email && ROOMS.booth.email && ROOMS.lounge.email
  );
}

let cached = { token: null, exp: 0 };
async function token() {
  if (cached.token && Date.now() < cached.exp - 60000) return cached.token;
  const body = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    client_secret: process.env.MS_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });
  const r = await fetch(`https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/oauth2/v2.0/token`, { method: 'POST', body });
  if (!r.ok) throw new Error(`token ${r.status}`);
  const j = await r.json();
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

async function graph(path, opts = {}) {
  const t = await token();
  const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', Prefer: `outlook.timezone="${TZ}"`, ...(opts.headers || {}) },
  });
  if (r.status === 202 || r.status === 204) return {};
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(`graph ${r.status}`); e.status = r.status; e.detail = j && j.error && j.error.code; throw e; }
  return j;
}

// Busy sessions per weekday for one room between two dates (inclusive).
// Returns { 'YYYY-MM-DD': ['am','pm'] }
async function busyFor(roomEmail, from, to) {
  const j = await graph(`/users/${encodeURIComponent(process.env.STUDIO_MAILBOX)}/calendar/getSchedule`, {
    method: 'POST',
    body: JSON.stringify({
      schedules: [roomEmail],
      startTime: { dateTime: `${from}T00:00:00`, timeZone: TZ },
      endTime: { dateTime: `${to}T23:59:59`, timeZone: TZ },
      availabilityViewInterval: 60,
    }),
  });
  const items = (j.value && j.value[0] && j.value[0].scheduleItems) || [];
  const busy = {};
  for (const it of items) {
    if (!['busy', 'tentative', 'oof', 'workingElsewhere'].includes(it.status)) continue;
    // Times come back as London wall-clock strings because of the Prefer header.
    let s = new Date(it.start.dateTime.slice(0, 19) + 'Z'), e = new Date(it.end.dateTime.slice(0, 19) + 'Z');
    for (let d = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate())); d < e; d = new Date(d.getTime() + 86400000)) {
      const day = d.toISOString().slice(0, 10);
      const amS = new Date(`${day}T10:00:00Z`), amE = new Date(`${day}T14:00:00Z`), pmE = new Date(`${day}T18:00:00Z`);
      const list = busy[day] || (busy[day] = []);
      if (s < amE && e > amS && !list.includes('am')) list.push('am');
      if (s < pmE && e > amE && !list.includes('pm')) list.push('pm');
      if (!list.length) delete busy[day];
    }
  }
  return busy;
}

function isWeekday(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  const w = d.getUTCDay();
  return w >= 1 && w <= 5 && !HOLIDAYS.has(iso);
}

module.exports = { ROOMS, SLOTS, TZ, HOLIDAYS, configured, graph, busyFor, isWeekday };
