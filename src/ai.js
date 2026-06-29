// Optional AI extraction. Calls the Supabase Edge Function "extract-items" (which
// holds the Gemini key server-side) and returns { items, date }.
//
// The function returns 200 with { ok, items, date } on success, or { ok:false,
// reason } for handled problems (unauthorized | quota | ai_error). A transport
// failure (function not deployed / network) surfaces as "service_unavailable".
// Errors carry a .code so the UI can show a relevant message.

import { getSupabase } from "./supabaseClient.js";

function aiError(code) {
  const e = new Error(code);
  e.code = code;
  return e;
}

export async function extractItems(text, childrenNames) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.functions.invoke("extract-items", {
    body: { text, children: childrenNames },
  });
  if (error) throw aiError("service_unavailable");
  if (!data || data.ok === false) throw aiError(data?.reason || "ai_error");
  return {
    items: Array.isArray(data.items) ? data.items : [],
    date: typeof data.date === "string" ? data.date : "",
  };
}
