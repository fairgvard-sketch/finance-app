/* ============================================================
   HOME · ОБЗОР — дашборд домашнего мира.
   Карточки-виджеты ведут в разделы. Данные подтянутся на
   следующих этапах из household/{id}/...; пока — превью.
   ============================================================ */

(function () {
  "use strict";

  // Сводка по household (на этапах 2-4 будет считаться из реальных данных)
  function summary() {
    const h = (window.Household && window.Household.data) || {};
    const stock   = h.stock   ? Object.values(h.stock)   : [];
    const tasks   = h.tasks   ? Object.values(h.tasks)   : [];
    const recipes = h.recipes ? Object.values(h.recipes) : [];
    const low = stock.filter(s => s && s.qty != null && s.min != null && s.qty <= s.min).length;
    const openTasks = tasks.filter(t => t && !t.done).length;
    return {
      stockCount: stock.length, low,
      openTasks,
      recipeCount: recipes.length
    };
  }

  function widget(opts) {
    return `
      <div class="widget anim" onclick="goTab('${opts.tab}')">
        <div class="widget__glow" style="background:${opts.color};"></div>
        <div class="widget__icon" style="background:${opts.soft};">${opts.emoji}</div>
        <div class="widget__title">${opts.title}</div>
        <div class="widget__meta">${opts.meta}</div>
      </div>`;
  }

  function render(main) {
    const s = summary();

    main.innerHTML = `
      <div class="card anim" style="background:var(--home-grad);color:#fff;border:none;">
        <div class="font-tiny" style="color:rgba(255,255,255,.7);">Сегодня дома</div>
        <div class="font-display" style="font-size:24px;font-weight:700;margin-top:6px;line-height:1.25;">
          ${greeting()}
        </div>
        <div style="font-size:13.5px;color:rgba(255,255,255,.85);margin-top:8px;line-height:1.5;">
          ${s.openTasks > 0
            ? `Открытых дел: <b>${s.openTasks}</b>`
            : "Дел на сегодня нет — чисто 🌿"}${s.low > 0 ? ` · Заканчивается: <b>${s.low}</b>` : ""}
        </div>
      </div>

      <div class="widget-grid">
        ${widget({
          tab: "stock", emoji: "🧺", title: "Запасы",
          color: "#b5613e", soft: "var(--home-soft)",
          meta: s.stockCount ? `${s.stockCount} позиций${s.low ? ` · ${s.low} кончается` : ""}` : "Холодильник, химия, нужное"
        })}
        ${widget({
          tab: "tasks", emoji: "✅", title: "Дела",
          color: "#2f6a4c", soft: "var(--money-soft)",
          meta: s.openTasks ? `${s.openTasks} активных` : "Обязанности и очередь"
        })}
        ${widget({
          tab: "recipes", emoji: "🍳", title: "Рецепты",
          color: "#d99a2b", soft: "var(--warn-soft)",
          meta: s.recipeCount ? `${s.recipeCount} сохранено` : "Что приготовить"
        })}
        ${widget({
          tab: "stock", emoji: "🛒", title: "Купить",
          color: "#457b9d", soft: "#e6eef3",
          meta: s.low ? `${s.low} в списке` : "Список покупок"
        })}
      </div>

      <div class="card anim">
        <div class="section-head"><h2>Очередь дел</h2></div>
        <div style="display:flex;align-items:center;gap:12px;padding:6px 2px;">
          <div style="width:40px;height:40px;border-radius:12px;background:var(--accent-soft);display:flex;align-items:center;justify-content:center;font-size:20px;">🔁</div>
          <div style="flex:1;">
            <div class="font-semibold" style="font-size:14px;">Чья сейчас очередь</div>
            <div style="font-size:12.5px;color:var(--ink-2);margin-top:2px;">Мытьё посуды, уборка — настроится в разделе «Дела»</div>
          </div>
          <svg width="18" height="18" style="color:var(--ink-3);" onclick="goTab('tasks')"><use href="#ico-chevron-right"/></svg>
        </div>
      </div>
    `;
  }

  function greeting() {
    const h = new Date().getHours();
    if (h < 6)  return "Доброй ночи 🌙";
    if (h < 12) return "Доброе утро ☀️";
    if (h < 18) return "Добрый день 🌿";
    return "Добрый вечер 🌆";
  }

  function onAdd() {
    // На обзоре [+] предлагает быстрый выбор куда добавить
    if (typeof window.openHomeAddMenu === "function") window.openHomeAddMenu();
    else goTab("stock");
  }

  window.HomeModules.register("overview", { render, onAdd });
})();
