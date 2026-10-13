// Taxes du Québec (partagé serveur + navigateur via /taxes.js). Montants en cents.
// Chaque taxe est calculée sur le prix avant taxes et arrondie au cent. Les pourboires ne sont pas taxés.
(function (root) {
  const TPS_RATE = 0.05, TVQ_RATE = 0.09975;
  const TPS_NO = '774132096 RT0001', TVQ_NO = '4027999251 TQ0002';
  function compute(priceCents) {
    const sub = Math.max(0, Math.round(Number(priceCents) || 0));
    const tps = Math.round(sub * TPS_RATE), tvq = Math.round(sub * TVQ_RATE);
    return { subtotal: sub, tps, tvq, taxes: tps + tvq, total: sub + tps + tvq };
  }
  // Solde au salon = total taxes incluses - dépôt (jamais négatif). Le pourboire est en sus.
  const balance = (priceCents, depositCents) => Math.max(0, compute(priceCents).total - Math.round(depositCents || 0));
  const api = { TPS_RATE, TVQ_RATE, TPS_NO, TVQ_NO, compute, balance };
  if (typeof module !== 'undefined') module.exports = api; else root.Taxes = api;
})(this);
