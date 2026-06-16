/* ============================================================
   MOTION JS — ненавязчивые триггеры анимаций.
   Оборачивает существующие функции (renderHome/render/toast),
   НЕ меняя их логику: только добавляет/снимает CSS-классы.
   Всё уважает prefers-reduced-motion (классы просто не дают
   эффекта, т.к. CSS глушит анимации в этом режиме).
   ============================================================ */

(function () {
  "use strict";

  function pulseMain() {
    const main = document.getElementById("main");
    if (!main) return;
    main.classList.remove("m-swap");
    // рефлоу, чтобы перезапустить анимацию
    void main.offsetWidth;
    main.classList.add("m-swap");
  }

  // Обернуть функцию так, чтобы после её вызова пульсировал #main
  function wrapWithPulse(name) {
    const orig = window[name];
    if (typeof orig !== "function" || orig.__motionWrapped) return;
    const wrapped = function () {
      const r = orig.apply(this, arguments);
      pulseMain();
      return r;
    };
    wrapped.__motionWrapped = true;
    window[name] = wrapped;
  }

  // toast с приятным въездом
  function wrapToast() {
    const orig = window.toast;
    if (typeof orig !== "function" || orig.__motionWrapped) return;
    const wrapped = function (msg) {
      const r = orig.apply(this, arguments);
      const t = document.getElementById("hub-toast");
      if (t) {
        t.classList.remove("m-show"); void t.offsetWidth; t.classList.add("m-show");
        // снять класс после въезда, чтобы он не мешал базовому скрытию
        clearTimeout(t.__mShowTimer);
        t.__mShowTimer = setTimeout(() => t.classList.remove("m-show"), 320);
      }
      return r;
    };
    wrapped.__motionWrapped = true;
    window.toast = wrapped;
  }

  // Публичные хелперы для модулей: подсветить «момент действия»
  window.Motion = {
    // кратко проиграть анимацию на элементе по классу
    flash(el, cls, ms) {
      if (!el) return;
      el.classList.add(cls);
      setTimeout(() => el.classList.remove(cls), ms || 600);
    },
    // отметить элемент как «только что добавленный» по data-атрибуту
    markNewById(containerSelector, attr, val) {
      requestAnimationFrame(() => {
        const el = document.querySelector(`${containerSelector}[${attr}="${val}"]`);
        if (el) { el.classList.add("m-new"); setTimeout(() => el.classList.remove("m-new"), 600); }
      });
    },
    pulseMain
  };

  // Инициализация после загрузки модулей
  function init() {
    wrapWithPulse("renderHome");
    wrapWithPulse("render");
    wrapToast();
  }

  // оборачиваем, когда основные функции уже определены
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(init, 0);
  } else {
    window.addEventListener("DOMContentLoaded", () => setTimeout(init, 0));
  }
  // повторная попытка обернуть toast/renderHome, если их определили позже
  setTimeout(init, 1200);
})();
