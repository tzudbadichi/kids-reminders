// Settings: display name and daily notification time (Israel time).

import { getSupabase } from "./supabaseClient.js";
import { el, clear, toast } from "./ui.js";

export async function renderSettings(container) {
  clear(container);
  container.append(el("div", { class: "loading" }, "טוען..."));

  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.from("profiles").upsert({ id: user.id });
    profile = { display_name: "", notification_time: "06:30" };
  }

  clear(container);
  const name = el("input", { class: "field", value: profile.display_name || "" });
  const time = el("input", {
    type: "time", class: "field",
    value: (profile.notification_time || "06:30").slice(0, 5),
  });

  async function save() {
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      display_name: name.value.trim(),
      notification_time: time.value,
    });
    if (error) { toast("שגיאה: " + error.message, "error"); return; }
    toast("נשמר");
  }

  container.append(
    el("h2", {}, "הגדרות"),
    el("label", { class: "lbl" }, "שם תצוגה"), name,
    el("label", { class: "lbl" }, "שעת התראה יומית"), time,
    el("button", { class: "btn primary", onClick: save }, "שמירה"),
    el("div", { class: "note-box" }, "התראות לנייד וטלגרם יתווספו בשלב הבא."),
    el("p", { class: "muted" }, "כל השעות לפי שעון ישראל."),
  );
}
