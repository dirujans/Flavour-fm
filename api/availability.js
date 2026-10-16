// GET /api/availability?room=control&from=2026-11-01&to=2026-11-30
// Reads the room's Outlook calendar and returns which weekday sessions are already taken.
const { ROOMS, configured, busyFor } = require('./_graph');

const ISO = /^\d{4}-\d{2}-\d{2}$/;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!configured()) return res.status(200).json({ configured: false, busy: {} });

  const { room, from, to } = req.query || {};
  const r = ROOMS[room];
  if (!r || !ISO.test(from || '') || !ISO.test(to || '')) return res.status(400).json({ error: 'Choose a room and a date range.' });
  const span = (new Date(to) - new Date(from)) / 86400000;
  if (span < 0 || span > 45) return res.status(400).json({ error: 'Ask for one month at a time.' });

  try {
    const busy = await busyFor(r.email, from, to);
    return res.status(200).json({ configured: true, busy });
  } catch (e) {
    console.error('availability', e.status || '', e.detail || e.message);
    // Fail open: the form still works, the team still reviews every request.
    return res.status(200).json({ configured: true, busy: {}, degraded: true });
  }
};
