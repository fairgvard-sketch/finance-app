/* ============================================================
   HOME · ЗАПАСЫ (заглушка Этапа 1)
   Этап 2 наполнит: продукты в холодильнике/вне, средства первой
   необходимости, бытовая химия. Учёт qty/min, список покупок.
   Данные: household/{id}/stock
   ============================================================ */

(function () {
  "use strict";

  function render(main) {
    main.innerHTML = `
      <div class="card anim"><div class="stub">
        <div class="stub__badge">Этап 2</div>
        <div class="stub__ico">🧺</div>
        <h3>Запасы</h3>
        <p>Здесь будут продукты в холодильнике и вне, бытовая химия и средства первой необходимости — с отметкой, что заканчивается, и списком покупок.</p>
      </div></div>`;
  }

  function onAdd() {
    if (typeof window.toast === "function") window.toast("Добавление появится на Этапе 2");
  }

  window.HomeModules.register("stock", { render, onAdd });
})();
