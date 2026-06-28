// Sends today's reminders to the logged-in user's Telegram chat.
//
// Invoked from the app ("send test"). The morning cron (a later phase) will call a
// batch sender that loops over all users; this single-user version verifies the
// end-to-end flow now.
//
// Deploy in the Supabase Dashboard (Edge Functions -> create "send-telegram").
// Required secret: TELEGRAM_BOT_TOKEN. SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
// are injected automatically.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Called from the browser (localhost / GitHub Pages), so CORS is required.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// Local date (YYYY-MM-DD) in Israel time, so DST never shifts the day.
function todayInIsrael(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
}

function formatMessage(date: string, rows: any[]): string {
  if (!rows.length) return `בוקר טוב!\nאין פריטים להבאה היום (${date}).`;
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
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!jwt) return json({ ok: false, reason: "unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData.user) return json({ ok: false, reason: "unauthorized" }, 401);
  const userId = userData.user.id;

  const { data: profile } = await supabase
    .from("profiles").select("telegram_chat_id").eq("id", userId).maybeSingle();
  if (!profile?.telegram_chat_id) return json({ ok: false, reason: "not_connected" });

  const date = todayInIsrael();
  const { data: rows } = await supabase
    .from("reminders")
    .select("items, children(name)")
    .eq("user_id", userId)
    .eq("due_date", date)
    .order("created_at");

  const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: profile.telegram_chat_id, text: formatMessage(date, rows ?? []) }),
  });
  if (!resp.ok) return json({ ok: false, reason: "send_failed", detail: await resp.text() });

  return json({ ok: true, sent: (rows ?? []).length });
});
