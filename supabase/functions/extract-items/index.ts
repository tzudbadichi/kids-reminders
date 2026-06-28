// Optional AI extraction. Takes a free-text WhatsApp message and returns the list
// of items the child needs to bring, using Google Gemini (free tier). Called from
// the app's "extract with AI" button.
//
// Requires a logged-in user (protects the Gemini quota from anonymous abuse).
//
// Deploy in the Supabase Dashboard (Edge Functions -> create "extract-items"),
// with Verify JWT OFF (CORS preflight + our own JWT check inside). Required secret:
// GEMINI_API_KEY (from Google AI Studio). Optional: GEMINI_MODEL (default
// "gemini-2.0-flash"). SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.0-flash";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // Require a logged-in user.
  const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!jwt) return json({ error: "unauthorized" }, 401);
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: u, error: ue } = await supabase.auth.getUser(jwt);
  if (ue || !u.user) return json({ error: "unauthorized" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const text = (body.text ?? "").toString().trim();
  if (!text) return json({ items: [] });

  const prompt = `אתה עוזר שמחלץ מתוך הודעה מהגן או מבית הספר את רשימת הפריטים שצריך להביא.
הוראות:
- החזר אך ורק פריטים שצריך להביא פיזית (למשל "חולצה לבנה", "בקבוק מים", "חטיף").
- אל תכלול תאריכים, אירועים או הסברים - רק פריטים.
- כל פריט קצר וברור.
- אם אין פריטים, החזר רשימה ריקה.
החזר JSON במבנה: {"items": ["פריט", "פריט"]}

ההודעה:
"""${text}"""`;

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0 },
    }),
  });
  if (!resp.ok) return json({ error: "gemini_failed", detail: await resp.text() }, 502);

  const data = await resp.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  let items: unknown[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) items = parsed;
    else if (Array.isArray(parsed.items)) items = parsed.items;
  } catch { /* leave empty */ }

  const clean = items.map((s) => String(s).trim()).filter(Boolean).slice(0, 50);
  return json({ items: clean });
});
