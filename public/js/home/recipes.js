/* ============================================================
   HOME · РЕЦЕПТЫ (заглушка Этапа 1)
   Этап 4 наполнит: хранение рецептов, ингредиенты, возможно
   связь с «Запасами» (что можно приготовить из имеющегося).
   Данные: household/{id}/recipes
   ============================================================ */

(function () {
  "use strict";

  function render(main) {
    main.innerHTML = `
      <div class="card anim"><div class="stub">
        <div class="stub__badge">Этап 4</div>
        <div class="stub__ico">🍳</div>
        <h3>Рецепты</h3>
        <p>Сохранённые рецепты с ингредиентами. Подскажем, что можно приготовить из того, что уже есть в запасах.</p>
      </div></div>`;
  }

  function onAdd() {
    if (typeof window.toast === "function") window.toast("Добавление появится на Этапе 4");
  }

  window.HomeModules.register("recipes", { render, onAdd });
})();
