// Optional AI extraction. Takes a free-text WhatsApp message and returns the list
// of items the child needs to bring AND a date if the message mentions one
// (relative expressions like "מחר" / "ביום שני" are resolved to an absolute date,
// Israel time). Uses Google Gemini (free tier).
//
// Always returns HTTP 200 with a structured body so the client can show a relevant
// message:
//   { ok:true, items:[...], date:"YYYY-MM-DD"|"" }
//   { ok:false, reason:"unauthorized"|"quota"|"ai_error" }
//
// Deploy in the Supabase Dashboard (Edge Functions -> "extract-items"), Verify JWT
// OFF (CORS preflight + our own JWT check). Secret: GEMINI_API_KEY. Optional:
// GEMINI_MODEL (default "gemini-2.5-flash").

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
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

function israelToday(): { date: string; weekday: string } {
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(now);
  const weekday = new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", weekday: "long" }).format(now);
  return { date, weekday };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!jwt) return json({ ok: false, reason: "unauthorized" });
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: u, error: ue } = await supabase.auth.getUser(jwt);
  if (ue || !u.user) return json({ ok: false, reason: "unauthorized" });

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const text = (body.text ?? "").toString().trim();
  const model = (body.model ?? "").toString().trim() || GEMINI_MODEL;
  const debug = body.debug === true;
  if (!text) return json({ ok: true, items: [], date: "" });

  const { date: today, weekday } = israelToday();
  const prompt = `קראת הודעה מהגן או מבית הספר. החזר שני דברים: רשימת הפריטים הפיזיים שצריך לשלוח עם הילד, ותאריך אם מצוין בהודעה.
- כלול כל פריט שההודעה מבקשת להביא (בגדים, אוכל, ציוד, חפצים). אל תכלול הסברים, ברכות או שמות אירועים - רק שמות פריטים, בקצרה.
- היום הוא ${weekday}, ${today} (שעון ישראל). אם ההודעה מציינת יום או תאריך (למשל "מחר", "ביום שני", "ב-15/6"), המר אותו לתאריך מוחלט בפורמט YYYY-MM-DD - היום הקרוב המתאים שאינו בעבר. אם אין תאריך, החזר מחרוזת ריקה.
- אם אין פריטים, החזר רשימה ריקה.

ההודעה:
${text}`;

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              items: { type: "ARRAY", items: { type: "STRING" } },
              date: { type: "STRING" },
            },
            required: ["items", "date"],
          },
        },
      }),
    });
  } catch (e) {
    return json({ ok: false, reason: "ai_error", ...(debug ? { detail: String(e) } : {}) });
  }

  if (!resp.ok) {
    const detail = await resp.text();
    const quota = resp.status === 429 || /RESOURCE_EXHAUSTED|quota|limit:\s*0/i.test(detail);
    return json({ ok: false, reason: quota ? "quota" : "ai_error", ...(debug ? { detail } : {}) });
  }

  const data = await resp.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  let items: unknown[] = [];
  let date = "";
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.items)) items = parsed.items;
    if (typeof parsed.date === "string") date = parsed.date.trim();
  } catch { /* leave defaults */ }

  const clean = items.map((s) => String(s).trim()).filter(Boolean).slice(0, 50);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today) date = "";

  return json({ ok: true, items: clean, date, ...(debug ? { raw, model, today } : {}) });
});
