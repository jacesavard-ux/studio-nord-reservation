// Vérification Stripe sans débit: mode de la clé, statut du compte, création + expiration d'une session Checkout.
// N'affiche jamais la clé.
const k = process.env.STRIPE_SECRET_KEY;
if (!k) { console.log('STRIPE_SECRET_KEY absente'); process.exit(1); }
const mode = /^(sk|rk)_live_/.test(k) ? 'LIVE' : /^(sk|rk)_test_/.test(k) ? 'TEST' : 'inconnu';
const stripe = require('stripe')(k);
(async () => {
  console.log('Mode de la clé:', mode);
  const a = await stripe.accounts.retrieve();
  console.log({ country: a.country, default_currency: a.default_currency, business_name: a.business_profile?.name || a.settings?.dashboard?.display_name,
    charges_enabled: a.charges_enabled, payouts_enabled: a.payouts_enabled, details_submitted: a.details_submitted,
    currently_due: a.requirements?.currently_due, past_due: a.requirements?.past_due, disabled_reason: a.requirements?.disabled_reason });
  const s = await stripe.checkout.sessions.create({ mode: 'payment', locale: 'fr-CA',
    line_items: [{ quantity: 1, price_data: { currency: 'cad', unit_amount: 1000, product_data: { name: 'Jace Savard Studio Nord — Dépôt — Test de vérification' } } }],
    success_url: 'http://localhost:3000/confirmation.html', cancel_url: 'http://localhost:3000/' });
  console.log('Session Checkout créée:', !!s.url, s.url ? new URL(s.url).host : '');
  const e = await stripe.checkout.sessions.expire(s.id);
  console.log('Session expirée:', e.status);
})().catch(err => { console.log('Erreur Stripe:', err.type, err.code || '', err.message); process.exit(1); });
