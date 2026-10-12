// Synchronisation Google Agenda — branchement futur.
// Pour l'activer: créer un compte de service Google (ou OAuth), partager l'agenda,
// définir GOOGLE_CALENDAR_ID + GOOGLE_SERVICE_ACCOUNT_JSON, puis implémenter avec `googleapis`:
//   calendar.events.insert({ calendarId, requestBody: { summary, description, start, end } })
const enabled = () => !!(process.env.GOOGLE_CALENDAR_ID && process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
async function pushBooking(booking, service) {
  if (!enabled()) { console.log(`[calendar] (désactivé) ${service.name} — ${booking.name} @ ${new Date(booking.start_ms).toISOString()}`); return null; }
  // TODO: implémentation googleapis; retourner event.id pour l'enregistrer dans bookings.calendar_event_id
  return null;
}
async function removeBooking(booking) { if (!enabled()) return; }
module.exports = { pushBooking, removeBooking, enabled };
