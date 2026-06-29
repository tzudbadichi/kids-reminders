// App controller: boots the app, handles auth gating, and switches between views.

import { el, clear, icon } from "./ui.js";
import { getSupabase } from "./supabaseClient.js";
import { getSession, signOut, renderAuth } from "./auth.js";
import { renderToday, renderAdd, setSharedText } from "./reminders.js";
import { renderChildren } from "./children.js";
import { renderSettings } from "./settings.js";
import { renderHelp } from "./help.js";

const app = document.getElementById("app");

// Android "share to app": the share target opens the app with the shared message in
// the query string. Capture it once, strip the query, and open the Add screen on it.
const sharedOnLoad = (() => {
  const p = new URLSearchParams(location.search);
  const parts = [p.get("title"), p.get("text"), p.get("url")].filter(Boolean);
  if (!parts.length) return false;
  setSharedText(parts.join("\n").trim());
  history.replaceState(null, "", location.pathname);
  return true;
})();

const views = {
  today: { label: "היום", icon: "today", render: renderToday },
  add: { label: "הוספה", icon: "add", render: renderAdd },
  children: { label: "ילדים", icon: "kids", render: renderChildren },
  settings: { label: "הגדרות", icon: "settings", render: renderSettings },
  help: { label: "עזרה", icon: "help", render: (c) => Promise.resolve(renderHelp(c)) },
};

async function boot() {
  clear(app);
  let session;
  try {
    session = await getSession();
  } catch (e) {
    if (e.message === "CONFIG_MISSING") { renderSetupNotice(); return; }
    renderFatal(e);
    return;
  }
  if (!session) {
    renderAuth(app, boot);
    return;
  }
  renderShell();
}

function renderSetupNotice() {
  app.append(
    el("div", { class: "setup" },
      el("h1", {}, "הגדרה נדרשת"),
      el("p", { class: "subtitle" },
        'צור קובץ config.js בתיקיית src לפי config.example.js, עם כתובת ה-Supabase והמפתח האנונימי, ורענן.'),
    ),
  );
}

function renderFatal(e) {
  app.append(el("div", { class: "setup" },
    el("h1", {}, "שגיאה"),
    el("p", {}, e.message || String(e)),
  ));
}

function renderShell() {
  clear(app);
  const content = el("main", { id: "content" });
  const nav = el("nav", { class: "tabbar" });
  const logoutBtn = el("button", {
    class: "icon-btn", "aria-label": "התנתקות", title: "התנתקות",
    onClick: async () => { await signOut(); boot(); },
  }, icon("logout"));
  const header = el("header", { class: "topbar" },
    el("span", { class: "brand" }, "תזכורות לילדים"),
    logoutBtn,
  );

  const tabButtons = {};
  function go(key) {
    for (const k in tabButtons) tabButtons[k].classList.toggle("active", k === key);
    window.scrollTo(0, 0);
    views[key].render(content).catch((e) => {
      clear(content);
      content.append(el("div", { class: "error" }, "שגיאה: " + (e.message || e)));
    });
  }
  for (const [key, view] of Object.entries(views)) {
    const button = el("button", { class: "tab", onClick: () => go(key) },
      icon(view.icon),
      el("span", { class: "tab-label" }, view.label),
    );
    tabButtons[key] = button;
    nav.append(button);
  }

  app.append(header, content, nav);
  go(sharedOnLoad ? "add" : "today");
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

boot();
registerServiceWorker();
