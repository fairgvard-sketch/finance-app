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
    // duotone-иконка в плашке — единый стиль с финансами (catTile)
    const tile = window.duoTile ? window.duoTile(opts.icon, 26, 46) : "";
    const color = (window.HOME_ICON_COLOR && window.HOME_ICON_COLOR[opts.icon]) || "var(--home)";
    return `
      <div class="widget anim" onclick="goTab('${opts.tab}')">
        <div class="widget__tile">${tile}</div>
        <div class="widget__glow" style="background:${color};"></div>
        <div class="widget__title">${opts.title}</div>
        <div class="widget__meta">${opts.meta}</div>
      </div>`;
  }

  function render(main) {
    const s = summary();

    main.innerHTML = `
      <div class="widget-grid">
        ${widget({
          tab: "stock", icon: "stock", title: "Запасы",
          meta: s.stockCount ? `${s.stockCount} позиций${s.low ? ` · ${s.low} кончается` : ""}` : "Холодильник, химия, нужное"
        })}
        ${widget({
          tab: "tasks", icon: "tasks", title: "Дела",
          meta: s.openTasks ? `${s.openTasks} активных` : "Обязанности и очередь"
        })}
        ${widget({
          tab: "recipes", icon: "recipes", title: "Рецепты",
          meta: s.recipeCount ? `${s.recipeCount} сохранено` : "Что приготовить"
        })}
        ${widget({
          tab: "stock", icon: "cart", title: "Купить",
          meta: s.low ? `${s.low} в списке` : "Список покупок"
        })}
      </div>

      <div class="card anim">
        <div class="section-head"><h2>Очередь дел</h2></div>
        <button type="button" class="ov-rowlink" onclick="goTab('tasks')" aria-label="Открыть раздел «Дела»">
          ${window.duoTile ? window.duoTile("queue", 22, 42) : ""}
          <div style="flex:1;min-width:0;text-align:left;">
            <div class="font-semibold" style="font-size:14px;">Чья сейчас очередь</div>
            <div style="font-size:12.5px;color:var(--ink-2);margin-top:2px;">Мытьё посуды, уборка — настроится в разделе «Дела»</div>
          </div>
          <svg width="18" height="18" style="color:var(--ink-3);flex-shrink:0;"><use href="#ico-chevron-right"/></svg>
        </button>
      </div>
    `;
  }

  function onAdd() {
    // На обзоре [+] предлагает быстрый выбор куда добавить
    if (typeof window.openHomeAddMenu === "function") window.openHomeAddMenu();
    else goTab("stock");
  }

  window.HomeModules.register("overview", { render, onAdd });
})();
