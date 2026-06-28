// Optional AI extraction. Calls a Supabase Edge Function ("extract-items") that
// holds the Gemini key server-side. Until that function is deployed this throws,
// and the UI falls back to manual entry.

import { getSupabase } from "./supabaseClient.js";

export async function extractItems(text, childrenNames) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.functions.invoke("extract-items", {
    body: { text, children: childrenNames },
  });
  if (error) throw error;
  return data;
}

// Normalize whatever the function returns into a flat array of item strings.
// Accepts { items: [...] } or [{ child_name, items: [...] }] shapes.
export function normalizeAi(result) {
  if (!result) return [];
  if (Array.isArray(result.items)) return result.items;
  if (Array.isArray(result)) {
    return result.flatMap((r) =>
      Array.isArray(r.items) ? r.items : (r.item ? [r.item] : []),
    );
  }
  return [];
}
