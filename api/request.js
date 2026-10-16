// POST /api/request
// Validates a studio request, re-checks the room's Outlook calendar, then:
//  1. puts a TENTATIVE hold on the studio mailbox's calendar (never a confirmed booking)
//  2. emails the studio team with the details
//  3. emails the requester a copy with their reference
const crypto = require('crypto');
const { ROOMS, SLOTS, TZ, configured, graph, busyFor, isWeekday } = require('./_graph');

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clip = (s, n) => String(s == null ? '' : s).trim().slice(0, n);

// Light in-memory throttle per IP (best effort on serverless).
const hits = new Map();
function throttled(ip) {
  const now = Date.now(), list = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  list.push(now); hits.set(ip, list);
  return list.length > 5;
}

function workingDaysBetween(a, b) {
  let n = 0;
  for (let d = new Date(a); d < b; d = new Date(d.getTime() + 86400000)) {
    const iso = d.toISOString().slice(0, 10);
    if (d > a && isWeekday(iso)) n++;
  }
  return n;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!configured()) return res.status(503).json({ configured: false, error: 'Online requests are not switched on yet.' });

  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  if (b.website) return res.status(200).json({ reference: 'FFM-000000' }); // honeypot: quietly accept bots
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (throttled(ip)) return res.status(429).json({ error: 'Too many requests from here. Try again in ten minutes.' });

  const room = ROOMS[b.room], slot = SLOTS[b.slot];
  const p = {
    name: clip(b.name, 80), email: clip(b.email, 120), phone: clip(b.phone, 30), project: clip(b.project, 80),
    type: clip(b.type, 40), people: parseInt(b.people, 10), notes: clip(b.notes, 800),
    under18: !!b.under18, guardianName: clip(b.guardianName, 80), guardianEmail: clip(b.guardianEmail, 120), filming: !!b.filming,
  };
  if (!room || !slot) return res.status(400).json({ error: 'Choose a room and a session.' });
  if (!ISO.test(b.date || '') || !isWeekday(b.date)) return res.status(400).json({ error: 'Sessions run Monday to Friday, outside bank holidays.' });
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z'), day = new Date(`${b.date}T00:00:00Z`);
  if (workingDaysBetween(today, new Date(day.getTime() + 1)) < 2) return res.status(400).json({ error: 'Requests need at least two working days\' notice.' });
  if ((day - today) / 86400000 > 95) return res.status(400).json({ error: 'Requests can be made up to three months ahead.' });
  if (!p.name || !EMAIL.test(p.email) || !p.project || !p.type) return res.status(400).json({ error: 'Some details are missing. Check the form and try again.' });
  if (!(p.people >= 1 && p.people <= room.max)) return res.status(400).json({ error: `${room.name} fits up to ${room.max} people.` });
  if (p.under18 && (!p.guardianName || !EMAIL.test(p.guardianEmail))) return res.status(400).json({ error: 'Add a parent or guardian\'s name and email for anyone under 18.' });

  try {
    const busy = (await busyFor(room.email, b.date, b.date))[b.date] || [];
    const clash = b.slot === 'day' ? busy.length > 0 : busy.includes(b.slot);
    if (clash) return res.status(409).json({ error: 'That session has just been taken. Pick another.' });

    const reference = 'FFM-' + crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
    const mailbox = encodeURIComponent(process.env.STUDIO_MAILBOX);
    const when = new Date(`${b.date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' });
    const rows = [
      ['Reference', reference], ['Room', room.name], ['Day', when], ['Session', `${slot.name}, ${slot.start} to ${slot.end}`],
      ['Name', p.name], ['Email', p.email], ['Phone', p.phone || 'Not given'], ['Project', p.project], ['Making', p.type], ['People', p.people],
      ['Under 18', p.under18 ? `Yes. Guardian: ${p.guardianName} (${p.guardianEmail}). Supervising adult and guardian consent required before confirming.` : 'No'],
      ['Filming consent', p.filming ? 'Yes, opted in' : 'No. Do not film or photograph'], ['Notes', p.notes || 'None'],
    ];
    const table = '<table cellpadding="6" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">' +
      rows.map(([k, v]) => `<tr><td style="color:#666;border-bottom:1px solid #eee">${esc(k)}</td><td style="border-bottom:1px solid #eee"><b>${esc(v)}</b></td></tr>`).join('') + '</table>';

    // 1. Tentative hold on the studio calendar. The room is only added once the team approves,
    //    unless ATTACH_ROOM_ON_REQUEST is "true" (rooms that auto-accept would confirm instantly).
    const attendees = process.env.ATTACH_ROOM_ON_REQUEST === 'true'
      ? [{ emailAddress: { address: room.email, name: room.name }, type: 'resource' }] : [];
    await graph(`/users/${mailbox}/events`, {
      method: 'POST',
      body: JSON.stringify({
        subject: `REQUEST · ${room.name} · ${p.project} (${p.name}) · ${reference}`,
        start: { dateTime: `${b.date}T${slot.start}:00`, timeZone: TZ },
        end: { dateTime: `${b.date}T${slot.end}:00`, timeZone: TZ },
        showAs: 'tentative', isReminderOn: false, categories: ['Flavour FM request'],
        location: { displayName: `Flavour FM Studios · ${room.name}` },
        attendees, transactionId: reference,
        body: { contentType: 'HTML', content: `<p><b>New studio request.</b> Review it, then accept or decline with the requester by email. Add the room to this event to hold it.</p>${table}` },
      }),
    });

    // 2. Team notification.
    await graph(`/users/${mailbox}/sendMail`, {
      method: 'POST',
      body: JSON.stringify({
        message: {
          subject: `Studio request ${reference}: ${room.name}, ${when}, ${slot.name}`,
          body: { contentType: 'HTML', content: `<p>A new Flavour FM studio request has come in and a tentative hold is on the studio calendar.</p>${table}` },
          toRecipients: [{ emailAddress: { address: process.env.STUDIO_NOTIFY_EMAIL || process.env.STUDIO_MAILBOX } }],
          replyTo: [{ emailAddress: { address: p.email, name: p.name } }],
        },
        saveToSentItems: false,
      }),
    });

    // 3. Copy to the requester (and guardian where relevant).
    if (process.env.SEND_REQUESTER_COPY !== 'false') {
      const to = [{ emailAddress: { address: p.email, name: p.name } }];
      if (p.under18) to.push({ emailAddress: { address: p.guardianEmail, name: p.guardianName } });
      await graph(`/users/${mailbox}/sendMail`, {
        method: 'POST',
        body: JSON.stringify({
          message: {
            subject: `We've got your Flavour FM studio request (${reference})`,
            body: { contentType: 'HTML', content:
              `<p>Hi ${esc(p.name.split(' ')[0])},</p><p>Thanks for asking to use the Flavour FM studio. This is a <b>request</b>, not a confirmed booking yet. We'll come back to you by email, usually within three working days.</p>${table}<p>Flavour FM Studios, Wingstop HQ</p>` },
            toRecipients: to,
          },
          saveToSentItems: true,
        }),
      });
    }

    return res.status(200).json({ reference });
  } catch (e) {
    console.error('request', e.status || '', e.detail || e.message);
    return res.status(502).json({ error: 'We couldn\'t reach the studio calendar just now. Try again in a minute, or email flavourfm@lemon-pepper.co.uk.' });
  }
};
