# Familien-Wichteln / Secret Santa / Quà bí mật

Static web app for a family Secret Santa across countries, in German, English and Vietnamese.

- Organiser creates a round, adds family members and sends each person a private link (WhatsApp, Zalo, QR code).
- Everyone adds at least 3 wishes plus optional sizes, likes and a delivery address.
- The draw runs server-side and creates one single gift chain; couples/households never draw each other.
- Only the person who drew you sees your wishes. Not even the organiser can read them.
- Extras: anonymous questions between giver and recipient, gift progress, budget in every family currency, family clock across time zones, guessing game and a big reveal, optional PIN per person.
- Budget per gift in EUR or GBP, with approximate conversions into each family member's local currency.
- Organiser reminders: one-tap reminder per person in their language, plus a combined message for the family group.
- Next year: copy a round with the same family; nobody draws the same person as last time.
- Organiser who takes part marks themselves once ("That's me"); the organiser page then links to their own page and back.
- In-person mode hides shipping tips and delivery address.
- Three layouts: Luftpost (airmail), Nordisch (nordic), Đèn lồng (lanterns).
- Guided by design: participants see three stations (wishes → draw → gift exchange) and the next step right under a compact header; the organiser page follows the phases prepare → running → gift exchange, with settings folded away.
- Wishes save themselves while typing; link, price and note fold out per wish; a pasted shop link suggests the title.
- Messages have their own tab with both anonymous conversations. Organisers add several names at once, pick households by tapping ("lives with …") and send all links one after another. Optional large text.
- Push notifications (opt-in per device): draw done, a question or answer from your Secret Santa, gift shipped, big reveal. Texts never contain names. On iPhone they need the home screen app; the page shows how to add it.
- Privacy: in-app privacy notice (DE/EN/VI) and a link to the legal notice. Fonts and the QR library are self-hosted (no Google, no CDN). 60 days after the exchange, wishes, addresses and messages are deleted automatically; 15 months after it the whole round (names and pairs stay until then so next year avoids repeat pairs).
- Home screen app (PWA): the manifest is built in app.js for the open page, so the icon reopens the personal link (`#p=…`) instead of the start page; checked on iOS 26.5. `sw.js` keeps the app itself available offline (network first); round data is never cached.

## Stack

- Plain HTML/CSS/JS, no build step. Deploy the repo root as a static site (Vercel framework preset "Other").
- Data: Supabase project `pixelpost`, private schema `wichteln`. The browser only calls token-checked RPC functions `public.wichteln_*` with the publishable key.
- Exchange rates: open.er-api.com with fallback to fawazahmed0/exchange-api.
- Push: events write to `wichteln.push_outbox` (triggers on messages, groups, participants); a trigger pings the edge function `wichteln-push` via pg_net, which sends Web Push (VAPID key pair created by the function and kept in `wichteln.push_config`). Source: `supabase/functions/wichteln-push/index.ts`.
- Clean-up: `wichteln.cleanup()` runs daily via pg_cron (job `wichteln-cleanup`).
