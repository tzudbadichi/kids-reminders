// Telegram webhook: links a Telegram chat to an app user via "/start <code>".
//
// Deploy in the Supabase Dashboard (Edge Functions -> create "telegram-webhook").
// Required secrets (Project Settings -> Edge Functions -> Secrets):
//   TELEGRAM_BOT_TOKEN     - from BotFather
//   TELEGRAM_WEBHOOK_SECRET - any random string; also passed to Telegram setWebhook
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//
// The service role is used on purpose: Telegram calls this function unauthenticated,
// so it must bypass RLS to look up the profile by its one-time link code.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function sendMessage(chatId: number | string, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");

  // Reject anything that is not Telegram calling with our shared secret.
  if (WEBHOOK_SECRET &&
      req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== WEBHOOK_SECRET) {
    return new Response("forbidden", { status: 403 });
  }

  let update: any;
  try { update = await req.json(); } catch { return new Response("ok"); }

  const message = update.message ?? update.edited_message;
  const chatId = message?.chat?.id;
  const text: string = message?.text ?? "";
  if (!chatId) return new Response("ok");

  if (text.startsWith("/start")) {
    const code = text.split(/\s+/)[1]?.trim();
    if (!code) {
      await sendMessage(chatId,
        'כדי לחבר את החשבון, פתח/י את האפליקציה והקש/י על "חבר טלגרם".');
      return new Response("ok");
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: profile } = await supabase
      .from("profiles").select("id").eq("telegram_link_code", code).maybeSingle();

    if (!profile) {
      await sendMessage(chatId,
        "קוד החיבור פג או שגוי. נסה/י שוב מתוך האפליקציה.");
      return new Response("ok");
    }

    await supabase.from("profiles")
      .update({ telegram_chat_id: String(chatId), telegram_link_code: null })
      .eq("id", profile.id);

    await sendMessage(chatId,
      "מעולה! טלגרם חובר בהצלחה. כאן תקבל/י את התזכורות בכל בוקר.");
    return new Response("ok");
  }

  return new Response("ok");
});
