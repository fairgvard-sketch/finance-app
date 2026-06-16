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

  let openPlace = null;      // null = обзор bento, иначе развёрнутое место
  let editId = null;         // редактируемая позиция в sheet
  const form = {};           // черновик формы
  const ui = (k, s, c) => (window.uiIcon ? window.uiIcon(k, s, c) : "");

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
    if (openPlace) { renderDrawer(main, openPlace); return; }
    renderOverview(main);
  }

  /* ── ОБЗОР: герой + bento-плитки мест + покупки ── */
  function renderOverview(main) {
    const all = items();
    const low = all.filter(i => statusOf(i) === "low").length;
    const out = all.filter(i => statusOf(i) === "out").length;
    const expSoon = all.filter(i => { const e = expiryInfo(i); return e && e.days >= 0 && e.days <= 3; }).length;
    const needBuy = [...all.filter(i => statusOf(i) === "out"), ...all.filter(i => statusOf(i) === "low")];
    const alert = out + low > 0 || expSoon > 0;

    // имена того, что надо купить (до 4)
    const buyNames = needBuy.slice(0, 4).map(i => i.name);
    const extra = needBuy.length - buyNames.length;

    const hero = `
      <div class="stk-hero ${alert ? "alert" : "calm"} anim">
        <div class="stk-hero__blob" style="width:150px;height:150px;right:-46px;top:-50px;"></div>
        <div class="stk-hero__blob" style="width:80px;height:80px;right:70px;bottom:-30px;"></div>
        <div class="stk-hero__eyebrow">${alert ? "Стоит пополнить" : "Запасы в порядке"}</div>
        <div class="stk-hero__big">${alert
          ? `${out + low} ${plural(out + low, "позиция", "позиции", "позиций")} на исходе`
          : "Всё на месте"}</div>
        ${buyNames.length ? `<div class="stk-hero__names">
            ${buyNames.map(n => `<span class="stk-hero__pill">${escapeHtml(n)}</span>`).join("")}
            ${extra > 0 ? `<span class="stk-hero__pill">+${extra}</span>` : ""}
          </div>` : ""}
        <div class="stk-hero__chips">
          <div class="stk-hero__chip"><b>${all.length}</b><span>всего</span></div>
          ${out ? `<div class="stk-hero__chip"><b>${out}</b><span>закончилось</span></div>` : ""}
          ${expSoon ? `<div class="stk-hero__chip"><b>${expSoon}</b><span>скоро срок</span></div>` : ""}
        </div>
      </div>`;

    // bento-плитки мест (только непустые + всегда плитка-добавление)
    const tiles = PLACES.map(p => {
      const arr = all.filter(i => i.place === p.id);
      return bentoTile(p, arr);
    }).filter(Boolean);

    main.innerHTML = `
      ${hero}
      <div class="bento anim">
        ${tiles.join("")}
        <div class="bento-add" onclick="StockUI.add()">
          <div class="plus">${ui("plus", 20)}</div><span>Добавить запас</span>
        </div>
      </div>
      <div class="anim">${renderShopping()}</div>
    `;
  }

  function bentoTile(p, arr) {
    const c1 = `var(--pl-${p.id})`, c2 = `var(--pl-${p.id}-2)`;
    const need = arr.filter(i => statusOf(i) === "low" || statusOf(i) === "out").length;
    // до 6 точек-индикаторов по статусу
    const order = { out: 0, low: 1, ok: 2 };
    const dots = arr.slice().sort((a, b) => order[statusOf(a)] - order[statusOf(b)])
      .slice(0, 6).map(i => `<i class="${statusOf(i)}"></i>`).join("");
    const ico = window.duoIcon ? window.duoIcon(p.id, 22) : "";
    const metaTxt = arr.length
      ? `${arr.length} ${plural(arr.length, "позиция", "позиции", "позиций")}`
      : "пусто — добавить";
    return `
      <div class="bento-tile" style="--c1:${c1};--c2:${c2};" onclick="StockUI.openPlace('${p.id}')">
        <div class="bento-tile__deco"></div><div class="bento-tile__deco2"></div>
        ${need ? `<div class="bento-tile__alert">${ui("warn", 12, "#fff")}${need}</div>` : ""}
        <div class="bento-tile__ico">${ico}</div>
        <div class="bento-tile__name">${p.name}<span class="bento-tile__chev">${ui("chevron", 16)}</span></div>
        <div class="bento-tile__meta">
          <span>${metaTxt}</span>
          ${dots ? `<span class="bento-dots">${dots}</span>` : ""}
        </div>
      </div>`;
  }

  /* ── DRAWER: развёрнутое место со списком позиций ── */
  function renderDrawer(main, placeId) {
    const p = PLACE[placeId];
    const arr = items().filter(i => i.place === placeId);
    const order = { out: 0, low: 1, ok: 2 };
    arr.sort((a, b) => (order[statusOf(a)] - order[statusOf(b)]) || a.name.localeCompare(b.name, "ru"));
    const color = `var(--pl-${placeId})`;

    main.innerHTML = `
      <div class="stk-drawer">
        <div class="stk-drawer__head">
          <button class="stk-drawer__back" aria-label="Назад" onclick="StockUI.closePlace()">${ui("arrow-left", 20)}</button>
          <div class="stk-drawer__title">${p.name}</div>
          <button class="stk-drawer__add" style="background:${color};" onclick="StockUI.add()">
            ${ui("plus", 16, "#fff")} Добавить
          </button>
        </div>
        ${arr.length
          ? arr.map(it => itemRow(it)).join("")
          : `<div class="stk-empty">В этом месте пока пусто.<br>Нажми «Добавить».</div>`}
      </div>
      <div class="anim" style="margin-top:8px;">${renderShopping()}</div>
    `;
  }

  const STATUS_WORD = { ok: "в наличии", low: "заканчивается", out: "закончилось" };
  const SEG_LABEL   = { ok: "Есть", low: "Мало", out: "Нет" };

  function itemRow(it) {
    const st = statusOf(it);
    const exp = expiryInfo(it);
    const isQty = it.track === "qty";
    const placeColor = window.HOME_ICON_COLOR && window.HOME_ICON_COLOR[it.place]
      ? window.HOME_ICON_COLOR[it.place] : "var(--home)";

    const right = isQty
      ? `<div class="stk-qty" onclick="event.stopPropagation()">
           <button aria-label="Меньше" onclick="StockUI.qty('${it.id}',-1)">${ui("minus", 16)}</button>
           <span class="stk-qty__val">${(+it.qty || 0)}</span>
           <button aria-label="Больше" onclick="StockUI.qty('${it.id}',1)">${ui("plus", 16)}</button>
         </div>`
      : `<div class="stk-seg" onclick="event.stopPropagation()">
           ${["ok","low","out"].map(s =>
             `<button class="${s} ${st === s ? "on" : ""}" aria-label="${SEG_LABEL[s]}" onclick="StockUI.setStatus('${it.id}','${s}')"><i></i><span>${SEG_LABEL[s]}</span></button>`).join("")}
         </div>`;

    // мета-строка: статус словом (для qty — кол-во) + срок годности
    const meta = [];
    if (isQty) meta.push(`<span>${(+it.qty || 0)} ${it.unit || "шт"}${it.min ? ` · мин ${it.min}` : ""}</span>`);
    else       meta.push(`<span class="stk-item__st ${st}">${STATUS_WORD[st]}</span>`);
    if (exp) meta.push(`<span class="stk-badge ${exp.cls}">${ui("clock", 12)}${exp.txt}</span>`);

    // иконка места хранения в цветной плашке — даёт акцент и контекст
    const tile = window.duoTile ? window.duoTile(it.place || "pantry", 22, 44) : "";

    return `
      <div class="stk-item st-${st} ${st === "out" ? "is-out" : ""}" style="--pc:${placeColor};" onclick="StockUI.edit('${it.id}')">
        <div class="stk-item__tile">${tile}</div>
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
          <button class="shop-del" aria-label="Удалить" onclick="StockUI.delShop('${s.id}')">${ui("close", 16)}</button>
        </div>`).join("")
      : `<div style="text-align:center;color:var(--ink-3);font-size:13px;padding:14px 0;">Список пуст. Что заканчивается — добавится сюда автоматически.</div>`;

    const openCount = list.filter(s => !s.done).length;
    return `
      <div class="shop-card">
        <div class="shop-card__head">
          <span class="shop-card__ico" style="color:#457b9d;">${window.duoIcon ? window.duoIcon("cart", 20) : ""}</span>
          <h2>Список покупок</h2>
          ${openCount ? `<span class="shop-card__count">${openCount}</span>` : ""}
        </div>
        ${rows}
        <div class="shop-add">
          <input id="shop-input" type="text" placeholder="Добавить вручную…"
            onkeydown="if(event.key==='Enter')StockUI.addShopFromInput()">
          <button aria-label="Добавить" onclick="StockUI.addShopFromInput()">${ui("plus", 18, "#fff")}</button>
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

  function openPlaceFn(id) { openPlace = id; rerender(); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function closePlace() { openPlace = null; rerender(); }

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
      place:  it ? it.place : (openPlace || "fridge"),
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
    openPlace: openPlaceFn, closePlace, add: () => openSheet(null),
    setStatus, qty, edit: openSheet,
    toggleShop, delShop, addShopFromInput,
    formPlace, formTrack, formStatus, save, remove, close: closeSheet
  };

  /* ── Контракт модуля ── */
  window.HomeModules.register("stock", {
    render,
    onAdd() { openSheet(null); }
  });
})();
