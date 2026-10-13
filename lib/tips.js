// Calcul du pourboire (partagé serveur + navigateur via /tips.js). Montants en cents.
(function (root) {
  const PCTS = [15, 18, 20], MAX_CENTS = 50000;
  function tipCents(base, choice, custom) {
    if (!choice || choice === 'none' || choice === '0') return 0;
    if (choice === 'custom') {
      const v = Number(String(custom ?? '').replace(',', '.').replace(/[\s$]/g, ''));
      if (!isFinite(v) || v <= 0) return 0;
      return Math.min(Math.round(v * 100), MAX_CENTS);
    }
    const p = Number(choice);
    if (!PCTS.includes(p) || !(Number(base) > 0)) return 0;
    return Math.round(Number(base) * p);   // base $ × p % = base*p cents
  }
  const fmt = c => (c / 100).toFixed(2).replace('.', ',') + ' $';
  const api = { PCTS, MAX_CENTS, tipCents, fmt };
  if (typeof module !== 'undefined') module.exports = api; else root.Tips = api;
})(this);
