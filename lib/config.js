// Configuration du salon — modifiez ici services, heures et dépôts.
module.exports = {
  salonName: process.env.SALON_NAME || 'Jace Savard Studio Nord',
  address: '331 rue Richard, Joliette (QC)',
  timezone: 'America/Toronto',
  openDays: [3, 4, 5], // Luxon: 1=lundi ... 3=mercredi, 4=jeudi, 5=vendredi
  open: '08:30', close: '19:30',
  step: 30, // minutes
  // Pauses récurrentes chaque jour ouvert (aucun RDV ne peut commencer ni chevaucher, même une coupe courte)
  breaks: [{ from: '12:00', to: '13:00', label: 'Dîner' }],
  bookingHorizonDays: 60,
  taxes: { TPS: 0.05, TVQ: 0.09975 },
  services: [
    { id: 'coupe-homme', name: 'Coupe homme', price: 25, duration: 30, deposit: 10, short: true },
    { id: 'coupe-enfant', name: 'Coupe enfant', price: 25, duration: 30, deposit: 10, short: true },
    { id: 'coupe-femme', name: 'Coupe femme', price: 30, duration: 30, deposit: 10, short: true },
    { id: 'coupe-femme-plis', name: 'Coupe femme et mise en plis', price: 40, duration: 60, deposit: 10 },
    { id: 'coloration', name: 'Coloration', priceFrom: 40, priceNote: 'Racine à partir de 40 $ · complète 60 $ à 80 $', duration: 120, deposit: 40, gap: { offset: 30, length: 30 } },
    { id: 'coloration-meches', name: 'Coloration et mèches', priceFrom: 100, priceNote: '100 $ à 200 $', duration: 240, deposit: 40, gap: { offset: 60, length: 30 } },
    { id: 'coloration-deco', name: 'Coloration et décoloration', priceFrom: 100, priceNote: '100 $ à 200 $', duration: 240, deposit: 40, gap: { offset: 60, length: 30 } },
    { id: 'permanente', name: 'Permanente', priceFrom: 100, priceNote: '100 $ et plus', duration: 90, deposit: 40, gap: { offset: 30, length: 30 } },
    { id: 'piercing', name: 'Piercing', priceFrom: 60, priceNote: 'dès 60 $ (2 pour 100 $), bijou inclus', duration: 30, deposit: 10, short: true },
    { id: 'botox-capillaire', name: 'Botox capillaire', priceFrom: 80, priceNote: 'dès 80 $', duration: 90, deposit: 40 },
  ],
};
