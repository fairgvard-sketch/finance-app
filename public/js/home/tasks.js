/* ============================================================
   HOME · ДЕЛА (заглушка Этапа 1)
   Этап 3 наполнит: задачи по дому, распределение обязанностей
   между партнёрами, очередность (мытьё посуды, уборка).
   Данные: household/{id}/tasks
   ============================================================ */

(function () {
  "use strict";

  function render(main) {
    main.innerHTML = `
      <div class="card anim"><div class="stub">
        <div class="stub__badge">Этап 3</div>
        <div class="stub__ico">✅</div>
        <h3>Дела</h3>
        <p>Задачи по дому, распределение обязанностей между вами и очередь — кто моет посуду и убирает сегодня. С чередованием и напоминаниями.</p>
      </div></div>`;
  }

  function onAdd() {
    if (typeof window.toast === "function") window.toast("Добавление появится на Этапе 3");
  }

  window.HomeModules.register("tasks", { render, onAdd });
})();
