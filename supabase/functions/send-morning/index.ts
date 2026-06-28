// Morning batch sender. Triggered by the GitHub Actions cron (see
// .github/workflows/morning-notify.yml). Sends each user their reminders for
// today, grouped by child, via Telegram - once per day.
//
// Catch-up design (robust to cron delays/skips): on every run it sends to any
// user whose notification_time has already passed today (Israel time), who has a
// connected Telegram chat, who has items for today, and who has not been sent yet
// today (tracked in notification_log).
//
// Deploy in the Supabase Dashboard (Edge Functions -> create "send-morning"),
// with Verify JWT OFF. Required secrets: TELEGRAM_BOT_TOKEN (already set for the
// other functions) and CRON_SECRET. SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are
// injected automatically.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  });
}

// Current date (YYYY-MM-DD) and time (HH:MM:SS) in Israel, so DST never shifts 6:30.
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

function buildMessage(date: string, rows: any[]): string {
  const lines = [`בוקר טוב! מה צריך להביא היום (${date}):`, ""];
  for (const row of rows) {
    const name = row.children?.name ?? "";
    lines.push(name ? `${name}:` : "תזכורת:");
    for (const item of (row.items ?? [])) lines.push(`• ${item}`);
    lines.push("");
  }
  return lines.join("\n").trim();
}

Deno.serve(async (req) => {
  const provided = (req.headers.get("x-cron-secret") ?? "").trim();
  if (!CRON_SECRET || provided !== CRON_SECRET) {
    return json({ ok: false, reason: "forbidden" }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { date, time } = israelNow();

  // Candidates: connected to Telegram and whose notification time has passed today.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, telegram_chat_id, notification_time")
    .not("telegram_chat_id", "is", null)
    .lte("notification_time", time);
  if (!profiles?.length) return json({ ok: true, date, time, processed: 0, sent: 0 });

  const ids = profiles.map((p) => p.id);

  // Drop anyone already sent today.
  const { data: logs } = await supabase
    .from("notification_log")
    .select("user_id")
    .eq("sent_on", date).eq("channel", "telegram").in("user_id", ids);
  const alreadySent = new Set((logs ?? []).map((l) => l.user_id));
  const pending = profiles.filter((p) => !alreadySent.has(p.id));
  if (!pending.length) return json({ ok: true, date, time, processed: 0, sent: 0 });

  // Today's reminders for the pending users, grouped by user.
  const pendingIds = pending.map((p) => p.id);
  const { data: reminders } = await supabase
    .from("reminders")
    .select("user_id, items, children(name)")
    .eq("due_date", date).in("user_id", pendingIds).order("created_at");
  const byUser = new Map<string, any[]>();
  for (const r of reminders ?? []) {
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
    byUser.get(r.user_id)!.push(r);
  }

  let sent = 0;
  for (const p of pending) {
    const rows = byUser.get(p.id);
    if (!rows?.length) continue; // no items today -> skip (retried on a later run if added)
    const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: p.telegram_chat_id, text: buildMessage(date, rows) }),
    });
    if (resp.ok) {
      await supabase.from("notification_log").upsert(
        { user_id: p.id, sent_on: date, channel: "telegram" },
        { onConflict: "user_id,sent_on,channel", ignoreDuplicates: true },
      );
      sent++;
    }
  }

  return json({ ok: true, date, time, processed: pending.length, sent });
});
