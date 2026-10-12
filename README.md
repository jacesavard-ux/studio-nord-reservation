# Réservation — Jace Savard Studio Nord (prototype)
Node/Express + SQLite (sql.js, WASM) + HTML/CSS. Mobile-first, en français.

## Lancer
    npm install
    ADMIN_PASSWORD=monmotdepasse node server.js     # http://localhost:3000  · admin: /admin (n'importe quel nom d'usager)
Sans STRIPE_SECRET_KEY → **mode démo** (paiement simulé, bandeau jaune).

## Variables
STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY (Stripe Checkout réel), BASE_URL (URL publique), ADMIN_PASSWORD, PORT, DB_PATH, SALON_NAME,
GOOGLE_CALENDAR_ID + GOOGLE_SERVICE_ACCOUNT_JSON (futur, voir lib/calendar.js).

## Fichiers
- lib/config.js — services, prix, dépôts, heures, temps de pause
- lib/slots.js — logique de disponibilité (tranches de 30 min; une coupe de 30 min peut tomber dans le temps de pause)
- lib/calendar.js — point d'accroche Google Agenda
- test.js — tests bout en bout (serveur démarré, base vide) · shots.js — captures d'écran

## Déploiement Render
`render.yaml` (Blueprint): service web Node, plan Starter, disque persistant 1 Go monté sur /var/data (DATA_DIR).
À saisir dans Render: STRIPE_SECRET_KEY, ADMIN_PASSWORD, BASE_URL (ex. https://studio-nord-reservation.onrender.com ou votre domaine).
