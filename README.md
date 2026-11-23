# Familien-Wichteln / Secret Santa / Quà bí mật

Static web app for a family Secret Santa across countries, in German, English and Vietnamese.

- Organiser creates a round, adds family members and sends each person a private link (WhatsApp, Zalo, QR code).
- Everyone adds at least 3 wishes plus optional sizes, likes and a delivery address.
- The draw runs server-side and creates one single gift chain; couples/households never draw each other.
- Only the person who drew you sees your wishes. Not even the organiser can read them.
- Extras: anonymous questions between giver and recipient, gift progress, budget in every family currency, family clock across time zones, guessing game and a big reveal, optional PIN per person.
- Three layouts: Luftpost (airmail), Nordisch (nordic), Đèn lồng (lanterns).

## Stack

- Plain HTML/CSS/JS, no build step. Deploy the repo root as a static site (Vercel framework preset "Other").
- Data: Supabase project `pixelpost`, private schema `wichteln`. The browser only calls token-checked RPC functions `public.wichteln_*` with the publishable key.
- Exchange rates: open.er-api.com with fallback to fawazahmed0/exchange-api.
