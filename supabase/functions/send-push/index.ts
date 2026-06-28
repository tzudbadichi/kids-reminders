// Web Push morning sender. Triggered by the same GitHub Actions cron as send-morning
// (a second step). Sends a browser push notification with today's reminders to users
// who enabled Web Push, once per day (notification_log channel 'push'). Kept as a
// separate function from send-morning so the web-push dependency never risks the
// (working) Telegram path.
//
// Deploy in the Supabase Dashboard (Edge Functions -> create "send-push"), Verify JWT
// OFF. Secrets: CRON_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@kids-reminders.app";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  });
}

function israelNow(): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jerusalem",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }).formatToParts(new Date()).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
  };
}

function buildBody(rows: any[]): string {
  const parts: string[] = [];
  for (const r of rows) {
    const name = r.children?.name ?? "";
    const items = (r.items ?? []).join(", ");
    if (!items) continue;
    parts.push(name ? `${name}: ${items}` : items);
  }
  return parts.join(" | ");
}

Deno.serve(async (req) => {
  const provided = (req.headers.get("x-cron-secret") ?? "").trim();
  if (!CRON_SECRET || provided !== CRON_SECRET) return json({ ok: false, reason: "forbidden" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { date, time } = israelNow();

  const { data: subs } = await supabase
    .from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth");
  if (!subs?.length) return json({ ok: true, date, time, sent: 0 });

  const userIds = [...new Set(subs.map((s) => s.user_id))];
  const { data: profiles } = await supabase
    .from("profiles").select("id, notification_time").in("id", userIds).lte("notification_time", time);
  const due = new Set((profiles ?? []).map((p) => p.id));
  if (!due.size) return json({ ok: true, date, time, sent: 0 });

  const { data: logs } = await supabase
    .from("notification_log").select("user_id")
    .eq("sent_on", date).eq("channel", "push").in("user_id", [...due]);
  const alreadySent = new Set((logs ?? []).map((l) => l.user_id));
  const pending = [...due].filter((u) => !alreadySent.has(u));
  if (!pending.length) return json({ ok: true, date, time, sent: 0 });

  const { data: reminders } = await supabase
    .from("reminders").select("user_id, items, children(name)")
    .eq("due_date", date).in("user_id", pending).order("created_at");
  const byUser = new Map<string, any[]>();
  for (const r of reminders ?? []) {
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
    byUser.get(r.user_id)!.push(r);
  }

  let sent = 0, failed = 0;
  for (const uid of pending) {
    const rows = byUser.get(uid);
    if (!rows?.length) continue;
    const payload = JSON.stringify({ title: "תזכורות לילדים", body: buildBody(rows) });
    let anyOk = false;
    for (const s of subs.filter((x) => x.user_id === uid)) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        anyOk = true;
      } catch (e: any) {
        failed++;
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", s.id);
        }
      }
    }
    if (anyOk) {
      await supabase.from("notification_log").upsert(
        { user_id: uid, sent_on: date, channel: "push" },
        { onConflict: "user_id,sent_on,channel", ignoreDuplicates: true });
      sent++;
    }
  }

  return json({ ok: true, date, time, sent, failed });
});
