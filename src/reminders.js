// Reminders: data access, the "add reminder" view, and the "what to bring" view.

import { getSupabase } from "./supabaseClient.js";
import { el, clear, toast, avatar } from "./ui.js";
import { listChildren } from "./children.js";
import { extractItems, normalizeAi } from "./ai.js";

// Local date as YYYY-MM-DD (device is assumed to be on Israel time).
export function todayISO() {
  const d = new Date();
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export async function addReminder({ child_id, due_date, items, source_text }) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("reminders")
    .insert({ user_id: user.id, child_id, due_date, items, source_text })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listByDate(date) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("reminders")
    .select("*, children(name)")
    .eq("due_date", date)
    .order("created_at");
  if (error) throw error;
  return data;
}

// ---- Add reminder view ----
export async function renderAdd(container) {
  clear(container);
  container.append(el("div", { class: "loading" }, "טוען..."));

  let kids;
  try {
    kids = await listChildren();
  } catch (e) {
    clear(container);
    container.append(el("div", { class: "error" }, "שגיאה בטעינה"));
    return;
  }

  clear(container);
  if (kids.length === 0) {
    container.append(el("div", { class: "empty" }, 'קודם הוסף/י ילדים בלשונית "ילדים".'));
    return;
  }

  const childSelect = el("select", { class: "field" },
    ...kids.map((k) => el("option", { value: k.id }, k.name)));
  const dateInput = el("input", { type: "date", class: "field", value: todayISO() });
  const sourceText = el("textarea", {
    class: "field", rows: "4",
    placeholder: "הדבק/י כאן את הודעת הווצאפ (לא חובה)",
  });

  // Manual item entry is the primary path; AI just pre-fills this same list.
  const items = [];
  const chips = el("div", { class: "chips" });
  function renderChips() {
    clear(chips);
    items.forEach((it, idx) => {
      chips.append(el("span", { class: "chip" }, it,
        el("button", {
          class: "chip-x",
          title: "הסרה",
          onClick: () => { items.splice(idx, 1); renderChips(); },
        }, "x")));
    });
  }

  const itemInput = el("input", { class: "field", placeholder: "פריט (למשל: חולצה לבנה)" });
  function addItem() {
    const value = itemInput.value.trim();
    if (!value) return;
    items.push(value);
    itemInput.value = "";
    renderChips();
    itemInput.focus();
  }
  itemInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); addItem(); }
  });

  const aiBtn = el("button", { class: "btn" }, "חלץ עם AI");
  aiBtn.addEventListener("click", async () => {
    const text = sourceText.value.trim();
    if (!text) { toast("אין טקסט לשליחה"); return; }
    aiBtn.disabled = true;
    aiBtn.textContent = "מחלץ...";
    try {
      const result = await extractItems(text, kids.map((k) => k.name));
      const extracted = normalizeAi(result);
      if (extracted.length === 0) {
        toast("ה-AI לא זיהה פריטים. אפשר להזין ידנית.");
      } else {
        extracted.forEach((i) => items.push(i));
        renderChips();
        toast("נוספו פריטים מה-AI. אפשר לערוך לפני שמירה.");
      }
    } catch (e) {
      toast("ה-AI עדיין לא מחובר. אפשר להזין ידנית.", "error");
    } finally {
      aiBtn.disabled = false;
      aiBtn.textContent = "חלץ עם AI";
    }
  });

  const saveBtn = el("button", { class: "btn primary" }, "שמירה");
  saveBtn.addEventListener("click", async () => {
    if (items.length === 0) { toast("אין פריטים לשמירה"); return; }
    saveBtn.disabled = true;
    try {
      await addReminder({
        child_id: childSelect.value,
        due_date: dateInput.value,
        items: [...items],
        source_text: sourceText.value.trim() || null,
      });
      toast("נשמר");
      items.length = 0;
      renderChips();
      sourceText.value = "";
    } catch (e) {
      toast("שגיאה: " + e.message, "error");
    } finally {
      saveBtn.disabled = false;
    }
  });

  container.append(
    el("h2", {}, "הוספת תזכורת"),
    el("label", { class: "lbl" }, "ילד/ה"), childSelect,
    el("label", { class: "lbl" }, "תאריך"), dateInput,
    el("label", { class: "lbl" }, "הודעת ווצאפ (לא חובה)"), sourceText,
    el("div", { class: "row gap", style: "margin-bottom:14px" }, aiBtn),
    el("label", { class: "lbl" }, "פריטים"),
    el("div", { class: "row gap" },
      itemInput,
      el("button", { class: "btn", onClick: addItem }, "הוספה"),
    ),
    chips,
    saveBtn,
  );
  renderChips();
}

// ---- "What to bring" view ----
export async function renderToday(container) {
  clear(container);
  const dateInput = el("input", { type: "date", class: "field", value: todayISO() });
  const listWrap = el("div", {});

  async function load() {
    clear(listWrap);
    listWrap.append(el("div", { class: "loading" }, "טוען..."));
    let rows;
    try {
      rows = await listByDate(dateInput.value);
    } catch (e) {
      clear(listWrap);
      listWrap.append(el("div", { class: "error" }, "שגיאה בטעינה"));
      return;
    }
    clear(listWrap);
    if (rows.length === 0) {
      listWrap.append(el("div", { class: "empty" }, "אין פריטים ליום זה."));
      return;
    }
    for (const r of rows) {
      const childName = r.children ? r.children.name : "";
      listWrap.append(
        el("div", { class: "card-row" },
          el("div", { class: "card-head" },
            avatar(childName, r.child_id),
            el("div", { class: "child-name" }, childName),
          ),
          el("ul", { class: "items" },
            ...(r.items || []).map((it) => el("li", {}, it))),
        ),
      );
    }
  }
  dateInput.addEventListener("change", load);

  container.append(
    el("h2", {}, "מה צריך להביא"),
    el("div", { class: "row gap", style: "margin-bottom:14px" },
      el("label", { class: "lbl", style: "margin:0" }, "תאריך"),
      dateInput,
    ),
    listWrap,
  );
  load();
}
