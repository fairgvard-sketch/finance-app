/* ============================================================
   HOME · ЗАПАСЫ (Этап 2)
   Кладовка-инвентарь: позиции по местам хранения, статус
   (есть/мало/нет) ИЛИ число+порог, срок годности с подсветкой,
   связанный список покупок (авто из «заканчивается» + ручное).

   Данные:
     household/{id}/stock    — {id:{name,place,track,status,qty,min,unit,expiry,ts}}
     household/{id}/shopping — {id:{name,fromStock,stockId,done,ts}}
   ============================================================ */

(function () {
  "use strict";

  /* ── Места хранения (id, имя, иконка/цвет из icons.js) ── */
  const PLACES = [
    { id: "fridge",     name: "Холодильник" },
    { id: "freezer",    name: "Морозилка" },
    { id: "pantry",     name: "Кухня / шкаф" },
    { id: "cleaning",   name: "Бытовая химия" },
    { id: "essentials", name: "Первая необходимость" }
  ];
  const PLACE = Object.fromEntries(PLACES.map(p => [p.id, p]));
  const UNITS = ["шт", "уп", "кг", "г", "л", "мл", "рул"];

  let placeFilter = "all";   // "all" | <placeId>
  let editId = null;         // редактируемая позиция в sheet
  const form = {};           // черновик формы

  /* ── Доступ к данным ── */
  function stockObj()    { return (window.Household && window.Household.data && window.Household.data.stock)    || {}; }
  function shoppingObj() { return (window.Household && window.Household.data && window.Household.data.shopping) || {}; }
  function items()    { return Object.entries(stockObj()).map(([id, v]) => ({ id, ...v })); }
  function shopping() { return Object.entries(shoppingObj()).map(([id, v]) => ({ id, ...v })); }

  function saveStock(obj)    { if (window.saveHousehold) window.saveHousehold("stock", obj); }
  function saveShopping(obj) { if (window.saveHousehold) window.saveHousehold("shopping", obj); }

  /* ── Статус позиции (нормализованный) ── */
  function statusOf(it) {
    if (it.track === "qty") {
      const q = +it.qty || 0, m = +it.min || 0;
      if (q <= 0) return "out";
      if (q <= m) return "low";
      return "ok";
    }
    return it.status || "ok";
  }

  /* ── Срок годности ── */
  function expiryInfo(it) {
    if (!it.expiry) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(it.expiry + "T00:00:00");
    const days = Math.round((d - today) / 86400000);
    if (days < 0)  return { cls: "exp-bad",  txt: "просрочено", days };
    if (days === 0) return { cls: "exp-bad", txt: "сегодня", days };
    if (days <= 3) return { cls: "exp-soon", txt: `${days} ${plural(days, "день", "дня", "дней")}`, days };
    return { cls: "exp-ok", txt: fmtShort(d), days };
  }
  function plural(n, a, b, c) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return a;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return b;
    return c;
  }
  const MON = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
  function fmtShort(d) { return `до ${d.getDate()} ${MON[d.getMonth()]}`; }

  /* ============================================================
     РЕНДЕР
     ============================================================ */
  function render(main) {
    const all = items();
    const low = all.filter(i => statusOf(i) === "low").length;
    const out = all.filter(i => statusOf(i) === "out").length;
    const expSoon = all.filter(i => { const e = expiryInfo(i); return e && e.days >= 0 && e.days <= 3; }).length;
    const shopOpen = shopping().filter(s => !s.done).length;

    const visible = placeFilter === "all" ? all : all.filter(i => i.place === placeFilter);

    main.innerHTML = `
      <!-- Сводка -->
      <div class="stk-summary anim">
        <div class="stk-stat"><div class="stk-stat__num">${all.length}</div><div class="stk-stat__lbl">всего позиций</div></div>
        <div class="stk-stat ${low ? "warn" : ""}"><div class="stk-stat__num">${low}</div><div class="stk-stat__lbl">заканчивается</div></div>
        <div class="stk-stat ${out ? "neg" : ""}"><div class="stk-stat__num">${out}</div><div class="stk-stat__lbl">закончилось</div></div>
        <div class="stk-stat ${expSoon ? "warn" : ""}"><div class="stk-stat__num">${expSoon}</div><div class="stk-stat__lbl">скоро срок</div></div>
        <div class="stk-stat"><div class="stk-stat__num">${shopOpen}</div><div class="stk-stat__lbl">в покупках</div></div>
      </div>

      <!-- Рейка мест -->
      <div class="stk-places anim">
        ${placeChip("all", "Всё", all.length)}
        ${PLACES.map(p => placeChip(p.id, p.name, all.filter(i => i.place === p.id).length)).join("")}
      </div>

      <!-- Полки -->
      <div class="anim">${renderShelves(visible)}</div>

      <!-- Список покупок -->
      <div class="anim">${renderShopping()}</div>
    `;
  }

  function placeChip(id, name, n) {
    const on = placeFilter === id;
    const color = id === "all" ? "var(--home)" : (window.HOME_ICON_COLOR[id] || "var(--home)");
    const icon = id === "all"
      ? `<span style="font-size:14px;">🗂️</span>`
      : (window.duoIcon ? window.duoIcon(id, 18) : "");
    const dotBg = on ? "" : (id === "all" ? "var(--home-soft)" : (window.HOME_ICON_COLOR[id] || "var(--home)") + "1a");
    return `<div class="stk-place-chip ${on ? "on" : ""}" style="${on ? `background:${color};` : ""}" onclick="StockUI.filter('${id}')">
      <span class="dot" style="background:${dotBg};">${icon}</span>${name}${n ? ` <span style="opacity:.7;font-weight:700;">${n}</span>` : ""}</div>`;
  }

  function renderShelves(list) {
    if (list.length === 0) {
      return `<div class="stk-empty">Пусто. Нажми <b>+</b> внизу, чтобы добавить запас.</div>`;
    }
    // группируем по местам, в фиксированном порядке
    const groups = PLACES.map(p => ({ p, arr: list.filter(i => i.place === p.id) })).filter(g => g.arr.length);
    return groups.map(({ p, arr }) => {
      // сортировка: out → low → ok, внутри по имени
      const order = { out: 0, low: 1, ok: 2 };
      arr.sort((a, b) => (order[statusOf(a)] - order[statusOf(b)]) || a.name.localeCompare(b.name, "ru"));
      const color = window.HOME_ICON_COLOR[p.id] || "var(--home)";
      return `
        <div class="stk-shelf">
          <div class="stk-shelf__head">
            ${window.duoTile ? window.duoTile(p.id, 22, 38) : ""}
            <div class="stk-shelf__title">${p.name}</div>
            <div class="stk-shelf__count">${arr.length}</div>
          </div>
          ${arr.map(it => itemRow(it, color)).join("")}
        </div>`;
    }).join("");
  }

  function itemRow(it, placeColor) {
    const st = statusOf(it);
    const exp = expiryInfo(it);
    const isQty = it.track === "qty";

    const right = isQty
      ? `<div class="stk-qty" onclick="event.stopPropagation()">
           <button onclick="StockUI.qty('${it.id}',-1)">−</button>
           <div><span class="stk-qty__val">${(+it.qty || 0)}</span></div>
           <button onclick="StockUI.qty('${it.id}',1)">+</button>
         </div>`
      : `<div class="stk-status" onclick="event.stopPropagation()">
           ${["ok","low","out"].map(s =>
             `<div class="stk-dot ${s} ${st === s ? "on" : ""}" title="${s}" onclick="StockUI.setStatus('${it.id}','${s}')"><i></i></div>`).join("")}
         </div>`;

    const meta = [];
    if (isQty) {
      meta.push(`<span>${(+it.qty || 0)} ${it.unit || "шт"}${it.min ? ` · мин. ${it.min}` : ""}</span>`);
      if (st === "low") meta.push(`<span class="stk-badge low">заканчивается</span>`);
      if (st === "out") meta.push(`<span class="stk-badge out">нет</span>`);
    } else {
      if (st === "low") meta.push(`<span class="stk-badge low">мало</span>`);
      if (st === "out") meta.push(`<span class="stk-badge out">закончилось</span>`);
    }
    if (exp) meta.push(`<span class="stk-badge ${exp.cls}">⏱ ${exp.txt}</span>`);

    return `
      <div class="stk-item ${st === "out" ? "is-out" : ""}" style="--place-c:${placeColor};" onclick="StockUI.edit('${it.id}')">
        <div class="stk-item__body">
          <div class="stk-item__name">${escapeHtml(it.name)}</div>
          ${meta.length ? `<div class="stk-item__meta">${meta.join("")}</div>` : ""}
        </div>
        ${right}
      </div>`;
  }

  /* ── Список покупок ── */
  function renderShopping() {
    const list = shopping().sort((a, b) => (a.done - b.done) || (a.ts || 0) - (b.ts || 0));
    const rows = list.length
      ? list.map(s => `
        <div class="shop-row ${s.done ? "done" : ""}">
          <div class="shop-check ${s.done ? "done" : ""}" onclick="StockUI.toggleShop('${s.id}')">
            <svg viewBox="0 0 24 24"><polyline points="5 12 10 17 19 7"/></svg>
          </div>
          <div class="shop-name">${escapeHtml(s.name)}</div>
          ${s.fromStock ? `<span class="shop-src">кончается</span>` : ""}
          <button class="shop-del" onclick="StockUI.delShop('${s.id}')">×</button>
        </div>`).join("")
      : `<div style="text-align:center;color:var(--ink-3);font-size:13px;padding:14px 0;">Список пуст. Что заканчивается — добавится сюда автоматически.</div>`;

    return `
      <div class="shop-card">
        <div class="section-head"><h2>🛒 Купить</h2></div>
        ${rows}
        <div class="shop-add">
          <input id="shop-input" type="text" placeholder="Добавить вручную…"
            onkeydown="if(event.key==='Enter')StockUI.addShopFromInput()">
          <button onclick="StockUI.addShopFromInput()">+</button>
        </div>
      </div>`;
  }

  /* ============================================================
     ДЕЙСТВИЯ
     ============================================================ */
  function rerender() {
    const main = document.getElementById("main");
    if (main && window.Shell && window.Shell.world === "home" && window.Shell.homeTab === "stock") render(main);
  }

  function filter(id) { placeFilter = id; rerender(); }

  function setStatus(id, s) {
    const obj = stockObj(); if (!obj[id]) return;
    obj[id] = { ...obj[id], status: s };
    saveStock(obj);
    syncShoppingFor(id, obj[id]);
  }

  function qty(id, delta) {
    const obj = stockObj(); if (!obj[id]) return;
    const q = Math.max(0, (+obj[id].qty || 0) + delta);
    obj[id] = { ...obj[id], qty: q };
    saveStock(obj);
    syncShoppingFor(id, obj[id]);
  }

  /* Авто-синк списка покупок: если позиция low/out — добавить;
     если снова ok — снять авто-пункт (если он не отмечен куплено). */
  function syncShoppingFor(stockId, it) {
    const st = statusOf(it);
    const shop = shoppingObj();
    const existing = Object.entries(shop).find(([, v]) => v.stockId === stockId && v.fromStock);
    if (st === "low" || st === "out") {
      if (!existing) {
        const sid = "sh_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
        shop[sid] = { name: it.name, fromStock: true, stockId, done: false, ts: Date.now() };
        saveShopping(shop);
      }
    } else if (existing && !existing[1].done) {
      delete shop[existing[0]];
      saveShopping(shop);
    }
  }

  function toggleShop(id) {
    const shop = shoppingObj(); if (!shop[id]) return;
    const wasDone = shop[id].done;
    shop[id] = { ...shop[id], done: !wasDone };
    // Куплено + связано с запасом → пополняем запас (ok)
    if (!wasDone && shop[id].fromStock && shop[id].stockId) {
      const obj = stockObj();
      const sid = shop[id].stockId;
      const it = obj[sid];
      if (it) {
        if (it.track === "qty") obj[sid] = { ...it, qty: Math.max((+it.min || 0) + 1, (+it.qty || 0) + 1) };
        else obj[sid] = { ...it, status: "ok" };
        saveStock(obj);
      }
      // купленный авто-пункт убираем из списка
      delete shop[id];
    }
    saveShopping(shop);
  }

  function delShop(id) {
    const shop = shoppingObj(); delete shop[id]; saveShopping(shop);
  }

  function addShopFromInput() {
    const inp = document.getElementById("shop-input");
    if (!inp) return;
    const name = inp.value.trim(); if (!name) return;
    const shop = shoppingObj();
    const sid = "sh_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
    shop[sid] = { name, fromStock: false, done: false, ts: Date.now() };
    saveShopping(shop);
    inp.value = "";
  }

  /* ============================================================
     SHEET добавления / редактирования
     ============================================================ */
  function openSheet(id) {
    editId = id;
    const it = id ? stockObj()[id] : null;
    Object.assign(form, {
      name:   it ? it.name : "",
      place:  it ? it.place : (placeFilter !== "all" ? placeFilter : "fridge"),
      track:  it ? (it.track || "status") : "status",
      status: it ? (it.status || "ok") : "ok",
      qty:    it && it.qty != null ? it.qty : 1,
      min:    it && it.min != null ? it.min : 1,
      unit:   it ? (it.unit || "шт") : "шт",
      expiry: it ? (it.expiry || "") : ""
    });
    mountSheet();
  }

  function mountSheet() {
    let ov = document.getElementById("stk-sheet-ov");
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "stk-sheet-ov";
      ov.className = "hub-sheet-ov hidden";
      ov.addEventListener("click", e => { if (e.target === ov) closeSheet(); });
      document.body.appendChild(ov);
    }
    ov.innerHTML = `<div class="hub-sheet">
      <div class="hub-sheet__handle"></div>
      <div class="hub-sheet__title">${editId ? "Изменить запас" : "Новый запас"}</div>

      <div class="hub-field">
        <label>Название</label>
        <input class="hub-input" id="f-name" placeholder="напр. Молоко" value="${escapeHtml(form.name)}">
      </div>

      <div class="hub-field">
        <label>Где лежит</label>
        <div class="hub-chiprow" id="f-place">${PLACES.map(p => placeFormChip(p)).join("")}</div>
      </div>

      <div class="hub-field">
        <label>Как считать</label>
        <div class="hub-seg" id="f-track">
          <button class="${form.track === "status" ? "on" : ""}" onclick="StockUI.formTrack('status')">Статус</button>
          <button class="${form.track === "qty" ? "on" : ""}" onclick="StockUI.formTrack('qty')">Количество</button>
        </div>
      </div>

      <div id="f-track-body">${trackBody()}</div>

      <div class="hub-field">
        <label>Срок годности (необязательно)</label>
        <input class="hub-input" id="f-expiry" type="date" value="${form.expiry}">
      </div>

      <button class="hub-btn-primary" onclick="StockUI.save()">${editId ? "Сохранить" : "Добавить"}</button>
      ${editId ? `<button class="hub-btn-danger" onclick="StockUI.remove()">Удалить позицию</button>` : ""}
    </div>`;

    ov.classList.remove("hidden");
    requestAnimationFrame(() => ov.classList.add("show"));
    document.body.style.overflow = "hidden";
    setTimeout(() => { const n = document.getElementById("f-name"); if (n && !form.name) n.focus(); }, 380);
  }

  function placeFormChip(p) {
    const on = form.place === p.id;
    const color = window.HOME_ICON_COLOR[p.id] || "var(--home)";
    return `<div class="hub-chip ${on ? "on" : ""}" style="${on ? `background:${color};` : ""}" onclick="StockUI.formPlace('${p.id}')">
      <span class="dot" style="background:${on ? "" : color + "1a"};">${window.duoIcon ? window.duoIcon(p.id, 16) : ""}</span>${p.name}</div>`;
  }

  function trackBody() {
    if (form.track === "qty") {
      return `
        <div style="display:flex;gap:12px;">
          <div class="hub-field" style="flex:1;"><label>Сейчас</label>
            <input class="hub-input" id="f-qty" type="number" inputmode="numeric" value="${form.qty}"></div>
          <div class="hub-field" style="flex:1;"><label>Минимум</label>
            <input class="hub-input" id="f-min" type="number" inputmode="numeric" value="${form.min}"></div>
          <div class="hub-field" style="flex:0 0 92px;"><label>Ед.</label>
            <select class="hub-input" id="f-unit">${UNITS.map(u => `<option ${u === form.unit ? "selected" : ""}>${u}</option>`).join("")}</select></div>
        </div>`;
    }
    return `
      <div class="hub-field">
        <label>Сейчас в наличии</label>
        <div class="hub-seg" id="f-status">
          <button class="${form.status === "ok" ? "on" : ""}" onclick="StockUI.formStatus('ok')">Есть</button>
          <button class="${form.status === "low" ? "on" : ""}" onclick="StockUI.formStatus('low')">Мало</button>
          <button class="${form.status === "out" ? "on" : ""}" onclick="StockUI.formStatus('out')">Нет</button>
        </div>
      </div>`;
  }

  function closeSheet() {
    const ov = document.getElementById("stk-sheet-ov");
    if (!ov) return;
    ov.classList.remove("show");
    document.body.style.overflow = "";
    setTimeout(() => ov.classList.add("hidden"), 380);
  }

  /* form helpers */
  function syncFormInputs() {
    const n = document.getElementById("f-name"); if (n) form.name = n.value;
    const e = document.getElementById("f-expiry"); if (e) form.expiry = e.value;
    if (form.track === "qty") {
      const q = document.getElementById("f-qty"); if (q) form.qty = +q.value || 0;
      const m = document.getElementById("f-min"); if (m) form.min = +m.value || 0;
      const u = document.getElementById("f-unit"); if (u) form.unit = u.value;
    }
  }
  function formPlace(id) { syncFormInputs(); form.place = id; refreshChips("f-place", id, placeFormChip, PLACES); }
  function refreshChips(containerId, sel, fn, arr) {
    const c = document.getElementById(containerId); if (!c) return;
    c.innerHTML = arr.map(fn).join("");
  }
  function formTrack(t) {
    syncFormInputs(); form.track = t;
    document.querySelectorAll("#f-track button").forEach((b, i) => b.classList.toggle("on", (i === 0) === (t === "status")));
    document.getElementById("f-track-body").innerHTML = trackBody();
  }
  function formStatus(s) {
    form.status = s;
    document.querySelectorAll("#f-status button").forEach((b, i) =>
      b.classList.toggle("on", ["ok","low","out"][i] === s));
  }

  function save() {
    syncFormInputs();
    if (!form.name.trim()) { if (window.toast) window.toast("Укажите название"); return; }
    const obj = stockObj();
    const id = editId || ("st_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3));
    const rec = {
      name: form.name.trim(), place: form.place, track: form.track,
      expiry: form.expiry || "", ts: (obj[id] && obj[id].ts) || Date.now()
    };
    if (form.track === "qty") { rec.qty = +form.qty || 0; rec.min = +form.min || 0; rec.unit = form.unit; }
    else { rec.status = form.status; }
    obj[id] = rec;
    saveStock(obj);
    syncShoppingFor(id, rec);
    closeSheet();
    if (window.toast) window.toast(editId ? "Сохранено" : "Добавлено в запасы");
  }

  function remove() {
    if (!editId) return;
    const obj = stockObj(); delete obj[editId]; saveStock(obj);
    // снять связанные авто-пункты покупок
    const shop = shoppingObj();
    Object.entries(shop).forEach(([k, v]) => { if (v.stockId === editId) delete shop[k]; });
    saveShopping(shop);
    closeSheet();
    if (window.toast) window.toast("Удалено");
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* ── Публичный API ── */
  window.StockUI = {
    filter, setStatus, qty, edit: openSheet,
    toggleShop, delShop, addShopFromInput,
    formPlace, formTrack, formStatus, save, remove, close: closeSheet
  };

  /* ── Контракт модуля ── */
  window.HomeModules.register("stock", {
    render,
    onAdd() { openSheet(null); }
  });
})();
