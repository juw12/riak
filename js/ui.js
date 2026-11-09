// Small UI kit: line icons, sheets (dialogs), toasts, buttons.
import { el } from "./util.js";
import { t } from "./i18n.js";

const ICONS = {
  tank: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 9c3 1.2 6 1.2 9 0s6-1.2 9 0"/><path d="M7 15c1-1.2 2.5-1.2 3.5 0-1 1.2-2.5 1.2-3.5 0z"/>',
  hook: '<path d="M14 3v9a4 4 0 1 1-8 0v-1"/><path d="M6 11l-2 2"/><circle cx="14" cy="3" r="1"/>',
  leaf: '<path d="M5 19c0-8 6-14 14-14 0 8-6 14-14 14z"/><path d="M5 19l8-8"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/><path d="M9 7h6"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5"/><path d="M9 2h6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  feed: '<path d="M6 4h12l-2 5H8z"/><circle cx="9" cy="14" r="1"/><circle cx="13" cy="17" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="10" cy="20" r="1"/>',
  drop: '<path d="M12 3c3.5 4.5 6 7.6 6 10.5a6 6 0 0 1-12 0C6 10.6 8.5 7.5 12 3z"/>',
  brush: '<path d="M14 4l6 6-8 8H6v-6z"/><path d="M11 7l6 6"/>',
  fish: '<path d="M3 12c3-4 8-5 12-3l4-3v12l-4-3c-4 2-9 1-12-3z"/><circle cx="8" cy="11" r="0.8"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  camera: '<rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8 7l1.5-3h5L16 7"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.9l7.6-3.8M8.2 13.1l7.6 3.8"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  shell: '<path d="M12 20c-5 0-8-4-8-8 0-3 2-6 8-8 6 2 8 5 8 8 0 4-3 8-8 8z"/><path d="M12 4v16M8 6.5l2 13M16 6.5l-2 13"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  scissors: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 7.5L20 18M8 16.5L20 6"/>',
  thermo: '<path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z"/>',
  test: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M7 15h10"/>',
  wave: '<path d="M2 12c2.5-3 5-3 7.5 0s5 3 7.5 0 3.5-2 5-1"/>',
  coral: '<path d="M12 21v-7M12 14l-4-4V6M12 14l4-4V5M8 10L5 8M16 10l3-2"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 8a5 5 0 0 1 0 8"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  breath: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
  flip: '<path d="M12 3v18"/><path d="M8 7L3 12l5 5zM16 7l5 5-5 5z"/>',
  arrow: '<path d="M5 12h13M13 7l5 5-5 5"/>',
  grid: '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>',
};

export function icon(name, size = 20) {
  const span = document.createElement("span");
  span.className = "ic";
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ""}</svg>`;
  return span;
}

export function button(label, opts = {}) {
  const b = el("button", { type: "button", class: "btn " + (opts.kind || ""), disabled: opts.disabled || undefined, "aria-pressed": opts.pressed === undefined ? undefined : String(!!opts.pressed), title: opts.title });
  if (opts.icon) b.append(icon(opts.icon, opts.iconSize || 18));
  if (label) b.append(el("span", { text: label }));
  if (opts.onclick) b.addEventListener("click", opts.onclick);
  return b;
}

// ---------- Sheets ----------
let sheetStack = [];
export function openSheet({ title, body, wide = false, onClose, actions = [], className = "" }) {
  const backdrop = el("div", { class: "sheet-backdrop" });
  const dialog = el("div", { class: `sheet ${wide ? "wide" : ""} ${className}`, role: "dialog", "aria-modal": "true", "aria-label": title });
  const head = el("div", { class: "sheet-head" }, [
    el("h2", { class: "sheet-title", text: title }),
    (() => {
      const c = button("", { icon: "close", kind: "icon ghost", title: t("common.close") });
      c.setAttribute("aria-label", t("a11y.closeSheet"));
      c.addEventListener("click", () => close());
      return c;
    })(),
  ]);
  const content = el("div", { class: "sheet-body" });
  // Function bodies run after openSheet returns, so callers can reference the sheet they are building.
  if (typeof body === "function") queueMicrotask(() => body(content));
  else if (body) content.append(body);
  dialog.append(head, content);
  if (actions.length) {
    const foot = el("div", { class: "sheet-foot" });
    for (const a of actions) foot.append(a);
    dialog.append(foot);
  }
  backdrop.append(dialog);
  document.body.append(backdrop);
  const prevFocus = document.activeElement;
  requestAnimationFrame(() => {
    backdrop.classList.add("open");
    const focusable = content.querySelector("input, select, textarea, button:not([disabled]), [tabindex]") || dialog.querySelector("button:not([disabled])");
    (focusable || dialog).focus?.();
  });
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  const onKey = (e) => {
    if (e.key === "Escape" && sheetStack[sheetStack.length - 1] === api) close();
  };
  document.addEventListener("keydown", onKey);
  function close() {
    document.removeEventListener("keydown", onKey);
    backdrop.classList.remove("open");
    sheetStack = sheetStack.filter((s) => s !== api);
    setTimeout(() => backdrop.remove(), 180);
    prevFocus?.focus?.();
    onClose?.();
  }
  const api = { close, content, dialog, setBody(fn) { content.innerHTML = ""; fn(content); } };
  sheetStack.push(api);
  return api;
}
export function closeAllSheets() {
  for (const s of [...sheetStack]) s.close();
}

// ---------- Toasts ----------
let toastHost;
export function clearToasts() {
  if (toastHost) toastHost.replaceChildren();
}

export function toast(message, kind = "") {
  if (!toastHost) {
    toastHost = el("div", { class: "toasts", role: "status", "aria-live": "polite" });
    document.body.append(toastHost);
  }
  const node = el("div", { class: "toast " + kind, text: message });
  toastHost.append(node);
  while (toastHost.children.length > 2) toastHost.firstChild.remove();
  requestAnimationFrame(() => node.classList.add("show"));
  setTimeout(() => {
    node.classList.remove("show");
    setTimeout(() => node.remove(), 250);
  }, kind === "big" ? 3600 : 2600);
}

export function confirmSheet(message, onYes) {
  const s = openSheet({
    title: message,
    body: el("div"),
    actions: [
      button(t("common.cancel"), { kind: "ghost", onclick: () => s.close() }),
      button(t("common.yes"), { kind: "danger", onclick: () => { s.close(); onYes(); } }),
    ],
  });
}

export function meter(value, max = 100, label = "") {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return el("div", { class: "meter", role: "meter", "aria-valuemin": "0", "aria-valuemax": String(max), "aria-valuenow": String(Math.round(value)), "aria-label": label }, [
    el("i", { style: { width: pct + "%" } }),
  ]);
}

export function segmented(options, value, onChange, label) {
  const wrap = el("div", { class: "seg", role: "tablist", "aria-label": label });
  for (const o of options) {
    const b = el("button", { type: "button", role: "tab", class: "seg-btn", "aria-selected": String(o.id === value), text: o.label });
    b.addEventListener("click", () => {
      for (const c of wrap.children) c.setAttribute("aria-selected", "false");
      b.setAttribute("aria-selected", "true");
      onChange(o.id);
    });
    wrap.append(b);
  }
  return wrap;
}
