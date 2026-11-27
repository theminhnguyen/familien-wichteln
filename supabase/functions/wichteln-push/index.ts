// Sends the queued push notifications of Familien-Wichteln.
// Called by the database (pg_net) whenever wichteln.push_outbox gets new rows; it must
// present the shared secret from wichteln.push_config. On the first call it creates the
// VAPID key pair and stores it there, so the private key never leaves the server.
import postgres from 'npm:postgres@3.4.5';
import webpush from 'npm:web-push@3.6.7';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 1 });

type Kind = 'drawn' | 'msg_in' | 'msg_reply' | 'shipped' | 'reveal';
// Texts never name anybody: they can show on a locked screen next to other people.
const TEXT: Record<string, Record<Kind, string>> = {
  de: {
    drawn: 'Die Auslosung ist da! Öffne dein Los und schau, wen du beschenkst.',
    msg_in: 'Dein Wichtel hat dir eine Frage geschickt.',
    msg_reply: 'Auf deine Frage gibt es eine Antwort.',
    shipped: 'Dein Geschenk ist unterwegs 📦',
    reveal: 'Die Auflösung ist da: Wer hat wen beschenkt?',
  },
  en: {
    drawn: 'Names have been drawn! Open yours to see who you are giving to.',
    msg_in: 'Your Secret Santa sent you a question.',
    msg_reply: 'Your question has an answer.',
    shipped: 'Your gift is on its way 📦',
    reveal: 'The big reveal is here: who gave to whom?',
  },
  vi: {
    drawn: 'Đã bốc thăm xong! Mở lá thăm để xem bạn tặng quà cho ai.',
    msg_in: 'Ông già Noel bí mật vừa gửi cho bạn một câu hỏi.',
    msg_reply: 'Câu hỏi của bạn đã có câu trả lời.',
    shipped: 'Quà của bạn đang trên đường đến 📦',
    reveal: 'Đã bật mí: ai tặng quà cho ai?',
  },
};

const b64u = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function ensureKeys(cfg: Record<string, string>) {
  if (cfg.vapid_public && cfg.vapid_private) return cfg;
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = b64u(await crypto.subtle.exportKey('raw', pair.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const [row] = await sql`update wichteln.push_config set vapid_public = ${pub}, vapid_private = ${jwk.d!}
    where id = 1 and vapid_private is null returning *`;
  return row ?? (await sql`select * from wichteln.push_config where id = 1`)[0];
}

Deno.serve(async (req) => {
  let [cfg] = await sql`select * from wichteln.push_config where id = 1`;
  if (!cfg || req.headers.get('x-hook-secret') !== cfg.hook_secret) return new Response('forbidden', { status: 403 });
  cfg = await ensureKeys(cfg);
  webpush.setVapidDetails(cfg.subject, cfg.vapid_public, cfg.vapid_private);

  const jobs = await sql`update wichteln.push_outbox set sent_at = now()
    where id in (select id from wichteln.push_outbox where sent_at is null order by id limit 200 for update skip locked)
    returning participant_id, kind`;
  if (!jobs.length) return Response.json({ sent: 0 });

  const ids = [...new Set(jobs.map((j) => j.participant_id))];
  const rows = await sql`select p.id, p.token, p.lang, g.name as group_name, s.endpoint, s.p256dh, s.auth
    from wichteln.participants p
    join wichteln.groups g on g.id = p.group_id
    join wichteln.push_subs s on s.participant_id = p.id
    where p.id = any(${ids})`;

  let sent = 0, gone = 0, failed = 0;
  const seen = new Set<string>();
  for (const job of jobs) {
    const key = job.participant_id + job.kind;
    if (seen.has(key)) continue; // several equal events at once: one notification is enough
    seen.add(key);
    for (const r of rows.filter((x) => x.id === job.participant_id)) {
      const lang = TEXT[r.lang] ? r.lang : 'en';
      const payload = JSON.stringify({
        title: r.group_name,
        body: TEXT[lang][job.kind as Kind],
        url: `${cfg.app_url}#p=${r.token}`,
        tag: `${job.kind}-${r.id}`,
      });
      try {
        await webpush.sendNotification({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, payload, { TTL: 86400 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) { await sql`delete from wichteln.push_subs where endpoint = ${r.endpoint}`; gone++; }
        else { failed++; console.error('push failed', code, String(e).slice(0, 200)); }
      }
    }
  }
  return Response.json({ sent, gone, failed });
});
