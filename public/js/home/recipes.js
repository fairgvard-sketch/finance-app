/* ============================================================
   HOME · РЕЦЕПТЫ (Этап 4)
   Журнальные карточки с фото, категории + избранное + поиск,
   детальный вид; связь с Запасами: «можно приготовить» (по
   наличию ингредиентов) + «добавить недостающее в покупки».

   Данные household/{id}/recipes:
     {id:{title,cat,photo,time,servings,fav,
          ingredients:[{name,qty}], steps:[str], ts}}
   Использует household/{id}/stock и /shopping (из stock.js).
   ============================================================ */

(function () {
  "use strict";

  const CATS = [
    { id: "breakfast", name: "Завтрак" },
    { id: "lunch",     name: "Обед" },
    { id: "dinner",    name: "Ужин" },
    { id: "dessert",   name: "Десерт" },
    { id: "drinks",    name: "Напитки" }
  ];
  const CAT = Object.fromEntries(CATS.map(c => [c.id, c]));

  let catFilter = "all";   // all | fav | <catId>
  let search = "";
  let openId = null;       // открытый детальный рецепт
  let editId = null;
  const form = {};
  const ui = (k, s, c) => (window.uiIcon ? window.uiIcon(k, s, c) : "");

  /* ── Данные ── */
  function H() { return (window.Household && window.Household.data) || {}; }
  function recipesObj() { return H().recipes || {}; }
  function stockObj()   { return H().stock || {}; }
  function shoppingObj(){ return H().shopping || {}; }
  function arr(o) { return Object.entries(o || {}).map(([id, v]) => ({ id, ...v })); }
  function save(section, obj) { if (window.saveHousehold) window.saveHousehold(section, obj); }

  /* ── Наличие ингредиента в Запасах ──
     Сопоставляем по имени (без регистра, по вхождению). Доступно,
     если в запасах есть позиция с этим именем и статус не "out". */
  function stockStatusOf(it) {
    if (it.track === "qty") { const q = +it.qty || 0, m = +it.min || 0; return q <= 0 ? "out" : (q <= m ? "low" : "ok"); }
    return it.status || "ok";
  }
  function haveIngredient(name) {
    const n = (name || "").trim().toLowerCase();
    if (!n) return true;
    const items = arr(stockObj());
    const hit = items.find(it => {
      const sn = (it.name || "").toLowerCase();
      return sn === n || sn.includes(n) || n.includes(sn);
    });
    if (!hit) return false;
    return stockStatusOf(hit) !== "out";
  }
  function missingOf(r) {
    return (r.ingredients || []).filter(ing => !haveIngredient(ing.name));
  }

  /* ============================================================
     РЕНДЕР
     ============================================================ */
  function render(main) {
    if (openId) { renderDetail(main, openId); return; }
    renderList(main);
  }

  function renderList(main) {
    let list = arr(recipesObj());
    // фильтр
    if (catFilter === "fav") list = list.filter(r => r.fav);
    else if (catFilter !== "all") list = list.filter(r => r.cat === catFilter);
    // поиск (по названию + ингредиентам)
    if (search) {
      const q = search;
      list = list.filter(r =>
        (r.title || "").toLowerCase().includes(q) ||
        (r.ingredients || []).some(i => (i.name || "").toLowerCase().includes(q)));
    }
    // сортировка: «можно приготовить» вперёд, потом избранное, потом новые
    list.sort((a, b) => {
      const am = missingOf(a).length === 0 ? 0 : 1;
      const bm = missingOf(b).length === 0 ? 0 : 1;
      return (am - bm) || ((b.fav ? 1 : 0) - (a.fav ? 1 : 0)) || (b.ts || 0) - (a.ts || 0);
    });

    const cats = `
      <div class="rc-cats anim">
        ${catChip("all", "Все", "recipe")}
        ${catChip("fav", "Избранное", "heart-cat")}
        ${CATS.map(c => catChip(c.id, c.name, c.id)).join("")}
      </div>`;

    const search_ = `
      <div class="rc-search anim">
        <span class="rc-search__ico">${ui("search", 18)}</span>
        <input id="rc-search-input" placeholder="Поиск по названию или ингредиенту…"
          value="${escapeHtml(search)}" oninput="RecipesUI.search(this.value)">
      </div>`;

    const body = list.length
      ? `<div class="anim">${list.map(recipeCard).join("")}</div>`
      : `<div class="rc-empty anim">
           <div class="rc-empty__ico">${window.duoIcon ? window.duoIcon("recipe", 40) : "🍳"}</div>
           <h3>${arr(recipesObj()).length ? "Ничего не найдено" : "Пока нет рецептов"}</h3>
           <p>${arr(recipesObj()).length ? "Измените фильтр или запрос." : "Добавьте первый рецепт — кнопкой + внизу. Укажите ингредиенты, и мы подскажем, что можно приготовить из запасов."}</p>
         </div>`;

    main.innerHTML = search_ + cats + body;
    initCatsFade(main);
  }

  /* fade-края ленты категорий показываем только когда есть куда листать */
  function initCatsFade(main) {
    const el = main.querySelector(".rc-cats");
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      el.classList.toggle("can-left", el.scrollLeft > 4);
      el.classList.toggle("can-right", el.scrollLeft < max - 4);
    };
    el.addEventListener("scroll", update, { passive: true });
    requestAnimationFrame(update);
  }

  function catChip(id, name, icoKey) {
    const on = catFilter === id;
    const color = id === "all" ? "var(--home)"
      : id === "fav" ? "#c0563a"
      : (window.HOME_ICON_COLOR[icoKey] || "var(--home)");
    return `<div class="rc-cat ${on ? "on" : ""}" style="${on ? `background:${color};` : ""}" onclick="RecipesUI.filter('${id}')">${name}</div>`;
  }

  function recipeCard(r) {
    const c = CAT[r.cat] || { id: "recipe" };
    const colors = catColors(r.cat);
    const missing = missingOf(r);
    const canCook = (r.ingredients || []).length > 0 && missing.length === 0;
    const photo = (r.photo || "").trim();

    return `
      <div class="rc-card" onclick="RecipesUI.open('${r.id}')">
        <div class="rc-card__photo" style="--c1:${colors[0]};--c2:${colors[1]};">
          ${photo
            ? `<img src="${escapeAttr(photo)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
               <div class="rc-card__ph" style="display:none;">${catIconBig(r.cat)}</div>`
            : `<div class="rc-card__ph">${catIconBig(r.cat)}</div>`}
          <div class="rc-card__grad"></div>
          <button class="rc-card__fav ${r.fav ? "on" : ""}" aria-label="${r.fav ? "Убрать из избранного" : "В избранное"}" onclick="event.stopPropagation();RecipesUI.toggleFav('${r.id}')">${ui(r.fav ? "heart-fill" : "heart", 19, "#fff")}</button>
          ${(r.ingredients || []).length ? `<div class="rc-card__cook ${canCook ? "ok" : "miss"}">${canCook ? `${ui("check", 13, "#fff")}можно приготовить` : `${ui("warn", 13, "#fff")}нет ${missing.length}`}</div>` : ""}
          <div class="rc-card__title">
            <div class="rc-card__name">${escapeHtml(r.title)}</div>
            <div class="rc-card__meta">
              ${c.name ? `<span>${escapeHtml(c.name)}</span>` : ""}
              ${r.time ? `<span>${ui("clock", 13, "rgba(255,255,255,.9)")}${escapeHtml(String(r.time))} мин</span>` : ""}
              ${r.servings ? `<span>${ui("serving", 13, "rgba(255,255,255,.9)")}${escapeHtml(String(r.servings))} порц.</span>` : ""}
            </div>
          </div>
        </div>
      </div>`;
  }

  function catColors(catId) {
    const map = {
      breakfast: ["#e0aa3a", "#c47a3e"],
      lunch:     ["#cf8a4a", "#b5613e"],
      dinner:    ["#c47a4e", "#9a4a2c"],
      dessert:   ["#d49bbd", "#b56a92"],
      drinks:    ["#5aa0d8", "#3f7fb0"]
    };
    return map[catId] || ["#d99a2b", "#b5613e"];
  }
  function catIconBig(catId) {
    const key = CAT[catId] ? catId : "recipe";
    return window.duoIcon ? window.duoIcon(key, 64, "#fff") : "🍳";
  }

  /* ── ДЕТАЛЬНЫЙ ВИД ── */
  function renderDetail(main, id) {
    const r = recipesObj()[id];
    if (!r) { openId = null; renderList(main); return; }
    const colors = catColors(r.cat);
    const photo = (r.photo || "").trim();
    const ings = r.ingredients || [];
    const missing = missingOf(r);
    const canCook = ings.length > 0 && missing.length === 0;
    const c = CAT[r.cat];

    main.innerHTML = `
      <div class="rc-detail">
        <div class="rc-detail__hero" style="--c1:${colors[0]};--c2:${colors[1]};">
          <button class="rc-detail__back" aria-label="Назад" onclick="RecipesUI.close()">${ui("arrow-left", 20, "#fff")}</button>
          ${photo
            ? `<img src="${escapeAttr(photo)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
               <div class="rc-card__ph" style="display:none;">${catIconBig(r.cat)}</div>`
            : `<div class="rc-card__ph">${catIconBig(r.cat)}</div>`}
        </div>

        <div class="rc-detail__name">${escapeHtml(r.title)}</div>
        <div class="rc-detail__meta">
          ${c ? `<span>${escapeHtml(c.name)}</span>` : ""}
          ${r.time ? `<span><b>${escapeHtml(String(r.time))}</b> мин</span>` : ""}
          ${r.servings ? `<span><b>${escapeHtml(String(r.servings))}</b> порц.</span>` : ""}
        </div>

        ${ings.length ? `
        <div class="rc-cook-bar ${canCook ? "ok" : "miss"}">
          ${canCook ? `<span class="rc-cook-bar__ico">${ui("check", 18)}</span>` : ""}
          <div class="rc-cook-bar__txt">
            ${canCook ? "Всё есть — можно готовить!" : `Не хватает: ${missing.map(m => escapeHtml(m.name)).join(", ")}`}
          </div>
          ${!canCook ? `<button class="rc-cook-bar__btn" onclick="RecipesUI.addMissing('${r.id}')">${ui("plus", 15, "#fff")} В покупки</button>` : ""}
        </div>` : ""}

        ${ings.length ? `
        <div class="rc-sec-title">Ингредиенты</div>
        ${ings.map(ing => {
          const have = haveIngredient(ing.name);
          return `<div class="rc-ing ${have ? "" : "is-miss"}">
            <span class="rc-ing__dot ${have ? "have" : "miss"}"></span>
            <span class="rc-ing__name">${escapeHtml(ing.name)}</span>
            ${ing.qty ? `<span class="rc-ing__qty">${escapeHtml(ing.qty)}</span>` : ""}
          </div>`;
        }).join("")}` : ""}

        ${(r.steps || []).length ? `
        <div class="rc-sec-title">Приготовление</div>
        ${(r.steps || []).map((s, i) => `
          <div class="rc-step"><div class="rc-step__n">${i + 1}</div><div class="rc-step__txt">${escapeHtml(s)}</div></div>`).join("")}` : ""}

        <button class="hub-btn-primary" style="margin-top:22px;" onclick="RecipesUI.edit('${r.id}')">Редактировать</button>
        <button class="hub-btn-danger" onclick="RecipesUI.remove('${r.id}')">Удалить рецепт</button>
      </div>`;
  }

  /* ============================================================
     ДЕЙСТВИЯ
     ============================================================ */
  function rerender() {
    const main = document.getElementById("main");
    if (main && window.Shell && window.Shell.world === "home" && window.Shell.homeTab === "recipes") render(main);
  }

  function filter(id) { catFilter = id; rerender(); }
  function searchFn(v) {
    search = (v || "").toLowerCase();
    // не перерисовываем всё, чтобы не терять фокус — обновляем только список
    const main = document.getElementById("main");
    if (!main) return;
    rerender();
    const inp = document.getElementById("rc-search-input");
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  }
  function open(id) { openId = id; rerender(); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function close() { openId = null; rerender(); }

  function toggleFav(id) {
    const obj = recipesObj(); const r = obj[id]; if (!r) return;
    obj[id] = { ...r, fav: !r.fav };
    save("recipes", obj);
  }

  // Добавить недостающие ингредиенты в список покупок
  function addMissing(id) {
    const r = recipesObj()[id]; if (!r) return;
    const missing = missingOf(r);
    if (!missing.length) { if (window.toast) window.toast("Всё уже есть"); return; }
    const shop = shoppingObj();
    let added = 0;
    missing.forEach(m => {
      const name = (m.name || "").trim(); if (!name) return;
      // не дублируем, если уже в списке
      const exists = Object.values(shop).some(s => (s.name || "").toLowerCase() === name.toLowerCase() && !s.done);
      if (exists) return;
      const sid = "sh_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3) + added;
      shop[sid] = { name, fromStock: false, fromRecipe: r.title, done: false, ts: Date.now() };
      added++;
    });
    save("shopping", shop);
    if (window.toast) window.toast(added ? `Добавлено в покупки: ${added}` : "Уже в списке покупок");
  }

  /* ============================================================
     SHEET добавления / редактирования
     ============================================================ */
  function add() { openSheet(null); }

  function openSheet(id) {
    editId = id;
    const r = id ? recipesObj()[id] : null;
    Object.assign(form, {
      title: r ? r.title : "",
      cat: r ? (r.cat || "lunch") : "lunch",
      photo: r ? (r.photo || "") : "",
      time: r ? (r.time || "") : "",
      servings: r ? (r.servings || "") : "",
      ingredients: r && r.ingredients ? r.ingredients.map(x => ({ ...x })) : [{ name: "", qty: "" }],
      steps: r && r.steps ? r.steps.slice() : [""]
    });
    mountSheet();
  }

  function mountSheet() {
    let ov = document.getElementById("rc-sheet-ov");
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "rc-sheet-ov"; ov.className = "hub-sheet-ov hidden";
      ov.addEventListener("click", e => { if (e.target === ov) closeSheet(); });
      document.body.appendChild(ov);
    }
    ov.innerHTML = `<div class="hub-sheet">
      <div class="hub-sheet__handle"></div>
      <div class="hub-sheet__title">${editId ? "Изменить рецепт" : "Новый рецепт"}</div>

      <div class="hub-field"><label>Название</label>
        <input class="hub-input" id="rf-title" placeholder="напр. Паста карбонара" value="${escapeAttr(form.title)}"></div>

      <div class="hub-field"><label>Категория</label>
        <div class="hub-chiprow" id="rf-cat">${catFormChips()}</div></div>

      <div class="hub-field"><label>Фото (ссылка, необязательно)</label>
        <input class="hub-input" id="rf-photo" placeholder="https://…" value="${escapeAttr(form.photo)}"></div>

      <div style="display:flex;gap:12px;">
        <div class="hub-field" style="flex:1;"><label>Время, мин</label>
          <input class="hub-input" id="rf-time" type="number" inputmode="numeric" value="${escapeAttr(String(form.time))}"></div>
        <div class="hub-field" style="flex:1;"><label>Порции</label>
          <input class="hub-input" id="rf-serv" type="number" inputmode="numeric" value="${escapeAttr(String(form.servings))}"></div>
      </div>

      <div class="hub-field"><label>Ингредиенты</label>
        <div id="rf-ings">${ingRows()}</div>
        <button class="rc-add-line" onclick="RecipesUI.addIng()">${ui("plus", 16)} ингредиент</button>
      </div>

      <div class="hub-field"><label>Шаги приготовления</label>
        <div id="rf-steps">${stepRows()}</div>
        <button class="rc-add-line" onclick="RecipesUI.addStep()">${ui("plus", 16)} шаг</button>
      </div>

      <button class="hub-btn-primary" onclick="RecipesUI.save()">${editId ? "Сохранить" : "Добавить рецепт"}</button>
      ${editId ? `<button class="hub-btn-danger" onclick="RecipesUI.remove('${editId}')">Удалить рецепт</button>` : ""}
    </div>`;

    ov.classList.remove("hidden");
    requestAnimationFrame(() => ov.classList.add("show"));
    document.body.style.overflow = "hidden";
    setTimeout(() => { const n = document.getElementById("rf-title"); if (n && !form.title) n.focus(); }, 380);
  }

  function catFormChips() {
    return CATS.map(c => {
      const on = form.cat === c.id;
      const color = window.HOME_ICON_COLOR[c.id] || "var(--home)";
      return `<div class="hub-chip ${on ? "on" : ""}" style="${on ? `background:${color};` : ""}" onclick="RecipesUI.formCat('${c.id}')">
        <span class="dot" style="background:${on ? "rgba(255,255,255,.25)" : color + "1a"};">${window.duoIcon ? window.duoIcon(c.id, 15, on ? "#fff" : null) : ""}</span>${c.name}</div>`;
    }).join("");
  }

  function ingRows() {
    return form.ingredients.map((ing, i) => `
      <div class="rc-ing-edit">
        <input class="hub-input name" placeholder="Ингредиент" value="${escapeAttr(ing.name)}" oninput="RecipesUI.setIng(${i},'name',this.value)">
        <input class="hub-input qty" placeholder="100 г" value="${escapeAttr(ing.qty)}" oninput="RecipesUI.setIng(${i},'qty',this.value)">
        <button aria-label="Удалить" onclick="RecipesUI.delIng(${i})">${ui("close", 16)}</button>
      </div>`).join("");
  }
  function stepRows() {
    return form.steps.map((s, i) => `
      <div class="rc-ing-edit">
        <input class="hub-input name" placeholder="Шаг ${i + 1}" value="${escapeAttr(s)}" oninput="RecipesUI.setStep(${i},this.value)">
        <button aria-label="Удалить" onclick="RecipesUI.delStep(${i})">${ui("close", 16)}</button>
      </div>`).join("");
  }

  function closeSheet() {
    const ov = document.getElementById("rc-sheet-ov");
    if (!ov) return;
    ov.classList.remove("show");
    document.body.style.overflow = "";
    setTimeout(() => ov.classList.add("hidden"), 380);
  }

  /* form helpers */
  function formCat(id) {
    form.cat = id;
    document.getElementById("rf-cat").innerHTML = catFormChips();
  }
  function setIng(i, key, val) { if (form.ingredients[i]) form.ingredients[i][key] = val; }
  function addIng() { form.ingredients.push({ name: "", qty: "" }); document.getElementById("rf-ings").innerHTML = ingRows(); }
  function delIng(i) { form.ingredients.splice(i, 1); if (!form.ingredients.length) form.ingredients.push({ name: "", qty: "" }); document.getElementById("rf-ings").innerHTML = ingRows(); }
  function setStep(i, val) { form.steps[i] = val; }
  function addStep() { form.steps.push(""); document.getElementById("rf-steps").innerHTML = stepRows(); }
  function delStep(i) { form.steps.splice(i, 1); if (!form.steps.length) form.steps.push(""); document.getElementById("rf-steps").innerHTML = stepRows(); }

  function syncInputs() {
    const g = id => document.getElementById(id);
    if (g("rf-title")) form.title = g("rf-title").value;
    if (g("rf-photo")) form.photo = g("rf-photo").value.trim();
    if (g("rf-time")) form.time = g("rf-time").value;
    if (g("rf-serv")) form.servings = g("rf-serv").value;
  }

  function saveForm() {
    syncInputs();
    if (!form.title.trim()) { if (window.toast) window.toast("Укажите название"); return; }
    const obj = recipesObj();
    const id = editId || ("r_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3));
    const ingredients = form.ingredients.map(x => ({ name: (x.name || "").trim(), qty: (x.qty || "").trim() })).filter(x => x.name);
    const steps = form.steps.map(s => (s || "").trim()).filter(Boolean);
    obj[id] = {
      title: form.title.trim(), cat: form.cat, photo: form.photo || "",
      time: form.time || "", servings: form.servings || "",
      fav: (obj[id] && obj[id].fav) || false,
      ingredients, steps, ts: (obj[id] && obj[id].ts) || Date.now()
    };
    save("recipes", obj);
    closeSheet();
    if (editId) openId = editId;   // вернёмся в деталь после правки
    if (window.toast) window.toast(editId ? "Сохранено" : "Рецепт добавлен");
  }

  function remove(id) {
    const useId = id || editId; if (!useId) return;
    const obj = recipesObj(); delete obj[useId]; save("recipes", obj);
    closeSheet(); openId = null;
    if (window.toast) window.toast("Удалено");
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/`/g, "&#96;"); }

  /* ── Публичный API ── */
  window.RecipesUI = {
    filter, search: searchFn, open, close, toggleFav, addMissing,
    add, edit: openSheet, save: saveForm, remove,
    formCat, setIng, addIng, delIng, setStep, addStep, delStep, closeSheet
  };

  /* ── Контракт модуля ── */
  window.HomeModules.register("recipes", {
    render,
    onAdd() { openSheet(null); }
  });
})();
