// Children: data access and the "my kids" view.

import { getSupabase } from "./supabaseClient.js";
import { el, clear, toast, avatar, icon } from "./ui.js";

export async function listChildren() {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("children")
    .select("*")
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function addChild(name) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("children")
    .insert({ name, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteChild(id) {
  const supabase = await getSupabase();
  const { error } = await supabase.from("children").delete().eq("id", id);
  if (error) throw error;
}

export async function renderChildren(container) {
  clear(container);
  container.append(el("div", { class: "loading" }, "טוען..."));

  let kids;
  try {
    kids = await listChildren();
  } catch (e) {
    clear(container);
    container.append(el("div", { class: "error" }, "שגיאה בטעינת הילדים"));
    return;
  }

  clear(container);
  const nameInput = el("input", { class: "field", placeholder: "שם הילד/ה" });

  async function add() {
    const name = nameInput.value.trim();
    if (!name) return;
    try {
      await addChild(name);
      toast("נוסף");
      renderChildren(container);
    } catch (e) {
      toast("שגיאה: " + e.message, "error");
    }
  }
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); add(); }
  });

  const list = el("div", { class: "stack" });
  if (kids.length === 0) {
    list.append(el("p", { class: "empty" }, "אין ילדים עדיין. הוסף/י את הראשון/ה."));
  }
  for (const kid of kids) {
    list.append(
      el("div", { class: "list-row" },
        el("div", { class: "row-main" },
          avatar(kid.name, kid.id),
          el("span", { class: "child-name" }, kid.name),
        ),
        el("button", {
          class: "icon-btn danger", "aria-label": "מחיקה", title: "מחיקה",
          onClick: async () => {
            if (!confirm(`למחוק את ${kid.name}? כל התזכורות של הילד/ה יימחקו.`)) return;
            try {
              await deleteChild(kid.id);
              renderChildren(container);
            } catch (e) {
              toast("שגיאה: " + e.message, "error");
            }
          },
        }, icon("trash")),
      ),
    );
  }

  container.append(
    el("h2", {}, "הילדים שלי"),
    el("div", { class: "row gap" },
      nameInput,
      el("button", { class: "btn primary", onClick: add }, "הוספה"),
    ),
    el("div", { style: "height:14px" }),
    list,
  );
}
