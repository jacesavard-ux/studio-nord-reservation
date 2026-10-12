const express = require('express');
const openDb = require('./lib/db');
const crypto = require('crypto');
const path = require('path');
const { DateTime } = require('luxon');
const cfg = require('./lib/config');
const { availableSlots, steps, conflicts, existingSteps, svc } = require('./lib/slots');
const calendar = require('./lib/calendar');

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD; // admin désactivé si absent
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;
const DEMO = !stripe;

(async () => {
const db = await openDb(process.env.DB_PATH || path.join(process.env.DATA_DIR || __dirname, 'data.db'));
db.exec(`CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY, service_id TEXT, start_ms INTEGER, end_ms INTEGER,
  name TEXT, phone TEXT, email TEXT, note TEXT, deposit INTEGER, status TEXT, stripe_session TEXT, calendar_event_id TEXT, created_ms INTEGER);
  CREATE TABLE IF NOT EXISTS blocks (id INTEGER PRIMARY KEY AUTOINCREMENT, start_ms INTEGER, end_ms INTEGER, reason TEXT);`);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', (req, res) => res.json({ salonName: cfg.salonName, services: cfg.services, openDays: cfg.openDays,
  open: cfg.open, close: cfg.close, horizon: cfg.bookingHorizonDays, taxes: cfg.taxes, demo: DEMO, tz: cfg.timezone }));
app.get('/api/slots', (req, res) => res.json(availableSlots(db, req.query.service, req.query.date)));

const INTERAC_EMAIL = process.env.INTERAC_EMAIL || 'jacesavard@gmail.com';
const INTERAC_HOLD_H = 48;
const ref = id => id.slice(0, 8).toUpperCase();
const fmt = ms => DateTime.fromMillis(ms, { zone: cfg.timezone }).setLocale('fr-CA').toFormat("cccc d LLLL yyyy 'à' HH 'h' mm");

const createPending = db.transaction(b => {
  const day = DateTime.fromMillis(b.start_ms, { zone: cfg.timezone }).startOf('day');
  const ok = availableSlots(db, b.service_id, day.toISODate()).some(s => DateTime.fromISO(s.start).toMillis() === b.start_ms);
  if (!ok) throw new Error('Cette plage n\'est plus disponible.');
  db.prepare(`INSERT INTO bookings VALUES (@id,@service_id,@start_ms,@end_ms,@name,@phone,@email,@note,@deposit,@status,NULL,NULL,@created_ms)`).run(b);
});

app.post('/api/bookings', async (req, res) => {
  try {
    const { service, start, name, phone, email, note, method } = req.body;
    const s = svc(service);
    if (!s || !start || !name?.trim() || !phone?.trim() || !/^\S+@\S+\.\S+$/.test(email || '')) return res.status(400).json({ error: 'Veuillez remplir tous les champs requis.' });
    const start_ms = DateTime.fromISO(start).toMillis();
    const b = { id: crypto.randomUUID(), service_id: s.id, start_ms, end_ms: start_ms + s.duration * 60000, name: name.trim(), phone: phone.trim(),
      email: email.trim(), note: (note || '').trim().slice(0, 500), deposit: s.deposit, created_ms: Date.now(), status: method === 'interac' ? 'interac' : 'pending' };
    createPending(b);
    if (b.status === 'interac') return res.json({ url: `/confirmation.html?id=${b.id}` });
    if (DEMO) return res.json({ url: `/paiement-demo.html?id=${b.id}` });
    const session = await stripe.checkout.sessions.create({
      mode: 'payment', customer_email: b.email, locale: 'fr-CA',
      line_items: [{ quantity: 1, price_data: { currency: 'cad', unit_amount: s.deposit * 100,
        product_data: { name: `${cfg.salonName} — Dépôt — ${s.name}`, description: fmt(start_ms) } } }],
      metadata: { booking_id: b.id },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      success_url: `${BASE_URL}/confirmation.html?id=${b.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/?annule=1`,
    });
    db.prepare('UPDATE bookings SET stripe_session=? WHERE id=?').run(session.id, b.id);
    res.json({ url: session.url });
  } catch (e) { res.status(409).json({ error: e.message }); }
});

async function confirm(id, allowInterac = false) {
  const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(id);
  if (b && (b.status === 'pending' || (allowInterac && b.status === 'interac'))) {
    db.prepare("UPDATE bookings SET status='confirmed' WHERE id=?").run(id);
    const evId = await calendar.pushBooking(b, svc(b.service_id));
    if (evId) db.prepare('UPDATE bookings SET calendar_event_id=? WHERE id=?').run(evId, id);
  }
}
app.post('/api/demo-pay', async (req, res) => {
  if (!DEMO) return res.status(403).json({ error: 'Mode démo désactivé' });
  await confirm(req.body.id); res.json({ ok: true });
});
app.get('/api/bookings/:id', async (req, res) => {
  let b = db.prepare('SELECT * FROM bookings WHERE id=?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Introuvable' });
  if (stripe && b.status === 'pending' && b.stripe_session) {
    const sess = await stripe.checkout.sessions.retrieve(b.stripe_session);
    if (sess.payment_status === 'paid') { await confirm(b.id); b = db.prepare('SELECT * FROM bookings WHERE id=?').get(b.id); }
  }
  const s = svc(b.service_id);
  let status = b.status;
  if (status === 'interac' && b.created_ms < Date.now() - INTERAC_HOLD_H * 3600000) status = 'expired';
  res.json({ ref: ref(b.id), interacEmail: INTERAC_EMAIL, holdHours: INTERAC_HOLD_H, expiresAt: fmt(b.created_ms + INTERAC_HOLD_H * 3600000), service: s.name, when: fmt(b.start_ms), name: b.name, email: b.email, deposit: b.deposit, status, demo: DEMO, priceNote: s.priceNote || `${s.price} $` });
});

// --- Admin ---
const auth = (req, res, next) => {
  const h = req.headers.authorization || '';
  const [u, p] = Buffer.from(h.split(' ')[1] || '', 'base64').toString().split(':');
  if (ADMIN_PASSWORD && p === ADMIN_PASSWORD) return next();
  res.set('WWW-Authenticate', 'Basic realm="admin"').status(401).send('Authentification requise');
};
app.get('/admin', auth, (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/api/admin/data', auth, (req, res) => {
  const now = Date.now() - 86400000;
  const holdCut = Date.now() - INTERAC_HOLD_H * 3600000;
  res.json({
    interac: db.prepare("SELECT * FROM bookings WHERE status='interac' AND created_ms > ? AND end_ms > ? ORDER BY start_ms").all(holdCut, now)
      .map(b => ({ ...b, ref: ref(b.id), service: svc(b.service_id).name, when: fmt(b.start_ms), expires: fmt(b.created_ms + INTERAC_HOLD_H * 3600000) })),
    bookings: db.prepare("SELECT * FROM bookings WHERE status='confirmed' AND end_ms > ? ORDER BY start_ms").all(now)
      .map(b => ({ ...b, ref: ref(b.id), service: svc(b.service_id).name, when: fmt(b.start_ms) })),
    blocks: db.prepare('SELECT * FROM blocks WHERE end_ms > ? ORDER BY start_ms').all(now).map(b => ({ ...b, from: fmt(b.start_ms), to: fmt(b.end_ms) })),
  });
});
app.post('/api/admin/blocks', auth, (req, res) => {
  const { date, from, to, reason } = req.body;
  const s = DateTime.fromISO(`${date}T${from}`, { zone: cfg.timezone }), e = DateTime.fromISO(`${date}T${to}`, { zone: cfg.timezone });
  if (!s.isValid || !e.isValid || e <= s) return res.status(400).json({ error: 'Plage invalide' });
  db.prepare('INSERT INTO blocks (start_ms,end_ms,reason) VALUES (?,?,?)').run(s.toMillis(), e.toMillis(), reason || '');
  res.json({ ok: true });
});
app.delete('/api/admin/blocks/:id', auth, (req, res) => { db.prepare('DELETE FROM blocks WHERE id=?').run(req.params.id); res.json({ ok: true }); });
app.post('/api/admin/bookings/:id/confirm', auth, async (req, res) => {
  const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(req.params.id);
  if (!b || b.status !== 'interac') return res.status(400).json({ error: 'Aucun virement en attente pour ce rendez-vous.' });
  await confirm(b.id, true); res.json({ ok: true });
});
app.post('/api/admin/bookings/:id/cancel', auth, async (req, res) => {
  const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(req.params.id);
  db.prepare("UPDATE bookings SET status='cancelled' WHERE id=?").run(req.params.id);
  if (b) await calendar.removeBooking(b); res.json({ ok: true });
});

app.listen(PORT, () => console.log(`${cfg.salonName} — ${BASE_URL} ${DEMO ? '(MODE DÉMO: paiement simulé)' : '(Stripe actif)'}`));
})();
