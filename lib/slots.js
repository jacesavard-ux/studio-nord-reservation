const { DateTime } = require('luxon');
const cfg = require('./config');
const svc = id => cfg.services.find(s => s.id === id);
const toMin = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

// Découpe un rendez-vous en tranches de 30 min: 'busy' (coiffeuse occupée) ou 'gap' (temps de pause)
function steps(serviceId, startMs) {
  const s = svc(serviceId); const out = [];
  for (let o = 0; o < s.duration; o += cfg.step) {
    const inGap = s.gap && o >= s.gap.offset && o < s.gap.offset + s.gap.length;
    out.push({ t: startMs + o * 60000, type: inGap ? 'gap' : 'busy', short: !!s.short });
  }
  return out;
}

// Seul chevauchement permis: une coupe courte (30 min) dans le temps de pause d'un autre service.
function conflicts(cand, existing) {
  for (const c of cand) for (const e of existing) {
    if (c.t !== e.t) continue;
    if (e.type === 'block') return true;
    const ok = (e.type === 'gap' && c.type === 'busy' && c.short) || (c.type === 'gap' && e.type === 'busy' && e.short);
    if (!ok) return true;
  }
  return false;
}

const INTERAC_HOLD_MS = 48 * 3600000; // Virement Interac: plage retenue 48 h
function existingSteps(db, dayStart, dayEnd) {
  const out = [];
  db.prepare("SELECT service_id, start_ms FROM bookings WHERE status IN ('confirmed','pending','interac') AND start_ms >= ? AND start_ms < ? AND (status='confirmed' OR (status='pending' AND created_ms > ?) OR (status='interac' AND created_ms > ?))")
    .all(dayStart - 86400000, dayEnd, Date.now() - 15 * 60000, Date.now() - INTERAC_HOLD_MS).forEach(b => out.push(...steps(b.service_id, b.start_ms)));
  db.prepare('SELECT start_ms, end_ms FROM blocks WHERE end_ms > ? AND start_ms < ?').all(dayStart, dayEnd).forEach(b => {
    for (let t = b.start_ms; t < b.end_ms; t += cfg.step * 60000) out.push({ t, type: 'block' });
  });
  return out;
}

function availableSlots(db, serviceId, dateISO) {
  const s = svc(serviceId); if (!s) return [];
  const day = DateTime.fromISO(dateISO, { zone: cfg.timezone }).startOf('day');
  if (!day.isValid || !cfg.openDays.includes(day.weekday)) return [];
  const open = day.plus({ minutes: toMin(cfg.open) }), close = day.plus({ minutes: toMin(cfg.close) });
  const ex = existingSteps(db, day.toMillis(), day.plus({ days: 1 }).toMillis());
  const res = [];
  for (let t = open; t.plus({ minutes: s.duration }) <= close; t = t.plus({ minutes: cfg.step })) {
    if (t.toMillis() < Date.now() + 60 * 60000) continue; // au moins 1 h d'avance
    const cand = steps(serviceId, t.toMillis());
    if (!conflicts(cand, ex)) {
      const inGap = ex.some(e => e.type === 'gap' && e.t === t.toMillis());
      res.push({ time: t.toFormat('HH:mm'), start: t.toISO(), inGap });
    }
  }
  return res;
}
module.exports = { availableSlots, steps, conflicts, existingSteps, svc };
