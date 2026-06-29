// Reminders: data access, the "add reminder" view, and the "what to bring" view.

import { getSupabase } from "./supabaseClient.js";
import { el, clear, toast, avatar, icon } from "./ui.js";
import { listChildren } from "./children.js";
import { extractItems } from "./ai.js";

// Text shared into the app (Android share target). Set by app.js on boot, consumed
// once by the add view to prefill the message field.
let pendingSharedText = null;
export function setSharedText(text) { pendingSharedText = text; }
function consumeSharedText() { const t = pendingSharedText; pendingSharedText = null; return t; }
export function hasSharedText() { return !!pendingSharedText; }

// Local date helpers (device is assumed to be on Israel time).
function isoFromDate(d) {
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
export function todayISO() { return isoFromDate(new Date()); }
export function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return isoFromDate(d);
}

// ---- data access ----
export async function addReminder({ child_id, due_date, items, source_text }) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("reminders")
    .insert({ user_id: user.id, child_id, due_date, items, source_text })
    .select().single();
  if (error) throw error;
  return data;
}

export async function updateReminder(id, fields) {
  const supabase = await getSupabase();
  const { error } = await supabase.from("reminders").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteReminders(ids) {
  if (!ids || !ids.length) return;
  const supabase = await getSupabase();
  const { error } = await supabase.from("reminders").delete().in("id", ids);
  if (error) throw error;
}

export async function listByDate(date) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("reminders").select("*, children(name)")
    .eq("due_date", date).order("created_at");
  if (error) throw error;
  return data;
}

async function findByChildDate(child_id, due_date) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("reminders").select("id, items")
    .eq("child_id", child_id).eq("due_date", due_date).order("created_at");
  if (error) throw error;
  return data || [];
}

function dedupe(arr) {
  const seen = new Set();
  const out = [];
  for (const v of arr) {
    const t = String(v).trim();
    if (t && !seen.has(t)) { seen.add(t); out.push(t); }
  }
  return out;
}

// Save items for a child+date, merging into an existing reminder so there is a
// single row per (child, date). Consolidates any pre-existing duplicate rows.
async function saveMerged({ child_id, due_date, items, source_text }) {
  const existing = await findByChildDate(child_id, due_date);
  if (existing.length) {
    const merged = dedupe([...existing.flatMap((r) => r.items || []), ...items]);
    await updateReminder(existing[0].id, { items: merged, ...(source_text ? { source_text } : {}) });
    if (existing.length > 1) await deleteReminders(existing.slice(1).map((r) => r.id));
    return;
  }
  await addReminder({ child_id, due_date, items: dedupe(items), source_text });
}

// ---- shared chip editor (items list with add/remove) ----
function chipEditor(initial) {
  const items = [...(initial || [])];
  const chips = el("div", { class: "chips" });
  const input = el("input", { class: "field", placeholder: "פריט (למשל: חולצה לבנה)" });
  function render() {
    clear(chips);
    items.forEach((it, idx) => chips.append(
      el("span", { class: "chip" }, it,
        el("button", {
          class: "chip-x", title: "הסרה",
          onClick: () => { items.splice(idx, 1); render(); },
        }, "x"))));
  }
  function add() {
    const v = input.value.trim();
    if (!v) return;
    items.push(v); input.value = ""; render(); input.focus();
  }
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); add(); } });
  render();
  const element = el("div", {},
    el("div", { class: "row gap" }, input, el("button", { class: "btn", onClick: add }, "הוספה")),
    chips,
  );
  return {
    element,
    getItems: () => dedupe(items),
    addItems: (arr) => { for (const v of arr) { const t = String(v).trim(); if (t) items.push(t); } render(); },
    setItems: (arr) => { items.length = 0; for (const v of arr) { const t = String(v).trim(); if (t) items.push(t); } render(); },
  };
}

function aiErrorMessage(code) {
  switch (code) {
    case "quota": return "מכסת ה-AI הסתיימה לעת עתה. נסה/י מאוחר יותר או הזן/י ידנית.";
    case "unauthorized": return "צריך להתחבר מחדש.";
    case "service_unavailable": return "שירות ה-AI אינו זמין כרגע. אפשר להזין ידנית.";
    default: return "לא הצלחנו לחלץ מהטקסט. אפשר להזין ידנית.";
  }
}

// ---- Add reminder view ----
export async function renderAdd(container) {
  clear(container);
  container.append(el("div", { class: "loading" }, "טוען..."));

  let kids;
  try { kids = await listChildren(); }
  catch (e) { clear(container); container.append(el("div", { class: "error" }, "שגיאה בטעינה")); return; }

  clear(container);
  if (kids.length === 0) {
    container.append(el("div", { class: "empty" }, 'קודם הוסף/י ילדים בלשונית "ילדים".'));
    return;
  }

  const childSelect = el("select", { class: "field" }, ...kids.map((k) => el("option", { value: k.id }, k.name)));
  const dateInput = el("input", { type: "date", class: "field", value: tomorrowISO() });
  const sourceText = el("textarea", {
    class: "field", rows: "4", placeholder: "הדבק/י כאן את הודעת הווצאפ (לא חובה)",
  });
  const editor = chipEditor([]);

  const aiBtn = el("button", { class: "btn" }, "חלץ עם AI");
  async function runExtract() {
    const text = sourceText.value.trim();
    if (!text) { toast("אין טקסט לשליחה"); return; }
    aiBtn.disabled = true; aiBtn.textContent = "מחלץ...";
    try {
      const { items, date } = await extractItems(text, kids.map((k) => k.name));
      const gotDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date);
      if (gotDate) dateInput.value = date;
      if (!items.length) {
        toast(gotDate ? "עודכן התאריך לפי ההודעה. לא זוהו פריטים - אפשר להזין ידנית." : "ה-AI לא זיהה פריטים. אפשר להזין ידנית.");
      } else {
        editor.addItems(items);
        toast(gotDate ? "נוספו פריטים ועודכן התאריך לפי ההודעה." : "נוספו פריטים מה-AI. אפשר לערוך לפני שמירה.");
      }
    } catch (e) {
      toast(aiErrorMessage(e.code), "error");
    } finally {
      aiBtn.disabled = false; aiBtn.textContent = "חלץ עם AI";
    }
  }
  aiBtn.addEventListener("click", runExtract);

  // "Paste from clipboard" - the practical WhatsApp flow (copy the message -> paste here).
  // Reads the clipboard and runs extraction in one tap. Only shown where supported.
  const canPaste = !!(navigator.clipboard && navigator.clipboard.readText);
  const pasteBtn = canPaste ? el("button", { class: "btn" }, "הדבק מהלוח") : null;
  if (pasteBtn) {
    pasteBtn.addEventListener("click", async () => {
      try {
        const t = await navigator.clipboard.readText();
        if (!t || !t.trim()) { toast("הלוח ריק - העתק/י קודם הודעה בווצאפ"); return; }
        sourceText.value = t.trim();
        runExtract();
      } catch (_) {
        toast("לא ניתן לקרוא מהלוח. הדבק/י ידנית בשדה.", "error");
      }
    });
  }

  // If a WhatsApp message was shared into the app, prefill it and extract automatically.
  const shared = consumeSharedText();
  if (shared) sourceText.value = shared;

  const saveBtn = el("button", { class: "btn primary" }, "שמירה");
  saveBtn.addEventListener("click", async () => {
    const items = editor.getItems();
    if (!items.length) { toast("אין פריטים לשמירה"); return; }
    saveBtn.disabled = true;
    try {
      await saveMerged({
        child_id: childSelect.value,
        due_date: dateInput.value,
        items,
        source_text: sourceText.value.trim() || null,
      });
      toast("נשמר");
      editor.setItems([]);
      sourceText.value = "";
    } catch (e) {
      toast("שגיאה: " + (e.message || e), "error");
    } finally {
      saveBtn.disabled = false;
    }
  });

  container.append(
    el("h2", {}, "הוספת תזכורת"),
    el("label", { class: "lbl" }, "ילד/ה"), childSelect,
    el("label", { class: "lbl" }, "תאריך"), dateInput,
    el("label", { class: "lbl" }, "הודעת ווצאפ (לא חובה)"), sourceText,
    el("div", { class: "row gap", style: "margin-bottom:14px" }, pasteBtn, aiBtn),
    el("label", { class: "lbl" }, "פריטים"),
    editor.element,
    saveBtn,
  );

  if (shared) runExtract(); // auto-extract from shared text
}

// ---- "What to bring" view ----
export async function renderToday(container) {
  clear(container);
  const dateInput = el("input", { type: "date", class: "field", value: todayISO() });
  const listWrap = el("div", {});

  // Merge all reminders of the same child (same date) into one group.
  function groupByChild(rows) {
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.child_id)) {
        map.set(r.child_id, { child_id: r.child_id, name: r.children ? r.children.name : "", items: [], ids: [] });
      }
      const g = map.get(r.child_id);
      g.ids.push(r.id);
      for (const it of (r.items || [])) g.items.push(it);
    }
    for (const g of map.values()) g.items = dedupe(g.items);
    return [...map.values()];
  }

  async function load() {
    clear(listWrap);
    listWrap.append(el("div", { class: "loading" }, "טוען..."));
    let rows;
    try { rows = await listByDate(dateInput.value); }
    catch (e) { clear(listWrap); listWrap.append(el("div", { class: "error" }, "שגיאה בטעינה")); return; }
    clear(listWrap);
    if (rows.length === 0) { listWrap.append(el("div", { class: "empty" }, "אין פריטים ליום זה.")); return; }
    for (const g of groupByChild(rows)) listWrap.append(makeCard(g));
  }

  function makeCard(g) {
    const card = el("div", { class: "card-row" });
    showView(card, g);
    return card;
  }

  function showView(card, g) {
    clear(card);
    card.append(
      el("div", { class: "card-head" },
        avatar(g.name, g.child_id),
        el("div", { class: "child-name" }, g.name),
        el("div", { class: "card-actions" },
          el("button", { class: "icon-btn", "aria-label": "עריכה", title: "עריכה", onClick: () => showEdit(card, g) }, icon("edit")),
          el("button", { class: "icon-btn danger", "aria-label": "מחיקה", title: "מחיקה", onClick: () => del(g) }, icon("trash")),
        ),
      ),
      el("ul", { class: "items" }, ...g.items.map((it) => el("li", {}, it))),
    );
  }

  function showEdit(card, g) {
    clear(card);
    const editor = chipEditor(g.items);
    async function save() {
      const items = editor.getItems();
      try {
        if (!items.length) {
          await deleteReminders(g.ids);
        } else {
          await updateReminder(g.ids[0], { items });
          if (g.ids.length > 1) await deleteReminders(g.ids.slice(1));
        }
        toast("נשמר");
        load();
      } catch (e) {
        toast("שגיאה: " + (e.message || e), "error");
      }
    }
    card.append(
      el("div", { class: "card-head" }, avatar(g.name, g.child_id), el("div", { class: "child-name" }, g.name)),
      editor.element,
      el("div", { class: "row gap", style: "margin-top:6px" },
        el("button", { class: "btn primary", onClick: save }, "שמירה"),
        el("button", { class: "btn", onClick: () => showView(card, g) }, "ביטול"),
      ),
    );
  }

  async function del(g) {
    if (!confirm(`למחוק את התזכורת של ${g.name} ליום זה?`)) return;
    try { await deleteReminders(g.ids); load(); }
    catch (e) { toast("שגיאה: " + (e.message || e), "error"); }
  }

  dateInput.addEventListener("change", load);
  container.append(
    el("h2", {}, "מה צריך להביא"),
    el("div", { class: "row gap", style: "margin-bottom:14px" },
      el("label", { class: "lbl", style: "margin:0" }, "תאריך"),
      dateInput),
    listWrap,
  );
  load();
}
