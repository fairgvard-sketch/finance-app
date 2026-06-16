/* ============================================================
   SHEET-SWIPE — единое закрытие нижних окон свайпом вниз.
   Работает для ОБОИХ систем листов:
     • «Дом»   — .hub-sheet внутри .hub-sheet-ov   (класс show)
     • «Деньги»— .sheet     внутри .overlay        (класс visible)
   Делегирование на document — ловит и динамически созданные листы.

   Логика:
   - тянуть можно за «ручку» (.hub-sheet__handle / .handle-area)
     ИЛИ за любую часть листа, когда он прокручен в самый верх;
   - лист едет за пальцем, фон-затемнение слабеет;
   - отпустил дальше порога (или быстрый флик) → лист закрывается.

   Закрытие легаси-листа делегируем в window.closeSheet(id),
   чтобы переиспользовать его штатный teardown (сброс body-локов).
   ============================================================ */

(function () {
  "use strict";

  const CLOSE_PX = 110;     // порог протяжки для закрытия
  const FLICK_V  = 0.6;     // скорость флика (px/ms)
  const RESIST   = 0.55;    // сопротивление при попытке тянуть вверх

  // дескриптор текущего перетаскиваемого листа
  let D = null;
  let startY = 0, startT = 0, dy = 0, dragging = false, fromHandle = false;

  // Определяем систему листа по DOM
  function describe(sheetEl) {
    if (sheetEl.classList.contains("hub-sheet")) {
      const ov = sheetEl.closest(".hub-sheet-ov");
      if (!ov || !ov.classList.contains("show")) return null;
      return { kind: "hub", sheet: sheetEl, ov,
               handleSel: ".hub-sheet__handle", shownClass: "show" };
    }
    if (sheetEl.classList.contains("sheet")) {
      const ov = sheetEl.closest(".overlay");
      if (!ov || !ov.classList.contains("visible")) return null;
      return { kind: "legacy", sheet: sheetEl, ov,
               handleSel: ".handle-area,.handle", shownClass: "visible" };
    }
    return null;
  }

  function onStart(e) {
    const sheetEl = e.target.closest(".hub-sheet, .sheet");
    if (!sheetEl) return;
    const d = describe(sheetEl);
    if (!d) return;

    const onHandle = !!e.target.closest(d.handleSel);
    if (!onHandle && d.sheet.scrollTop > 2) return;   // отдаём скролл контенту

    D = d;
    startY = e.touches[0].clientY;
    startT = e.timeStamp;
    dy = 0; dragging = true; fromHandle = onHandle;
    D.sheet.style.transition = "none";
  }

  function onMove(e) {
    if (!dragging || !D) return;
    let delta = e.touches[0].clientY - startY;
    if (!fromHandle && D.sheet.scrollTop > 2 && delta > 0) { reset(); return; }
    if (delta < 0) delta *= RESIST;                  // вверх — с сопротивлением
    dy = delta;
    D.sheet.style.transform = `translateY(${Math.max(delta, -40)}px)`;
    fadeOverlay(Math.max(0, delta));
    if (delta > 0 && e.cancelable) e.preventDefault();
  }

  function fadeOverlay(down) {
    const k = Math.max(0, 1 - down / 260);
    if (D.kind === "hub") {
      D.ov.style.background = `rgba(34,31,26,${0.34 * k})`;
      D.ov.style.backdropFilter = `blur(${4 * k}px)`;
    } else {
      D.ov.style.background = `rgba(0,0,0,${0.25 * k})`;
    }
  }

  function onEnd(e) {
    if (!dragging || !D) return;
    const dt = Math.max(1, e.timeStamp - startT);
    const v = dy / dt;
    const shouldClose = dy > CLOSE_PX || (dy > 28 && v > FLICK_V);
    dragging = false;
    if (shouldClose) closeSheet(); else snapBack();
  }

  function snapBack() {
    if (!D) return;
    D.sheet.style.transition = "transform .26s cubic-bezier(.34,1.4,.64,1)";
    D.sheet.style.transform = "translateY(0)";
    D.ov.style.background = "";
    if (D.kind === "hub") D.ov.style.backdropFilter = "";
    clearVars();
  }

  function closeSheet() {
    const d = D;
    if (d.kind === "legacy") {
      // переиспользуем штатный teardown легаси-окна
      const id = d.ov.id.replace(/^ov-/, "");
      d.sheet.style.transition = "transform .3s cubic-bezier(.4,0,.2,1)";
      d.sheet.style.transform = "translateY(100%)";
      if (typeof window.closeSheet === "function") window.closeSheet(id);
      // снимем инлайны после анимации закрытия
      setTimeout(() => { d.sheet.style.transition = ""; d.sheet.style.transform = ""; d.ov.style.background = ""; }, 320);
    } else {
      d.sheet.style.transition = "transform .3s cubic-bezier(.4,0,.2,1)";
      d.sheet.style.transform = "translateY(100%)";
      d.ov.style.transition = "background .3s, backdrop-filter .3s";
      d.ov.style.background = "rgba(34,31,26,0)";
      d.ov.style.backdropFilter = "blur(0)";
      setTimeout(() => {
        d.ov.classList.remove("show");
        d.ov.classList.add("hidden");
        d.ov.style.background = ""; d.ov.style.backdropFilter = ""; d.ov.style.transition = "";
        d.sheet.style.transition = ""; d.sheet.style.transform = "";
        document.body.style.overflow = "";
      }, 300);
    }
    clearVars();
  }

  function reset() { dragging = false; snapBack(); }
  function clearVars() { D = null; dy = 0; }

  document.addEventListener("touchstart", onStart, { passive: true });
  document.addEventListener("touchmove",  onMove,  { passive: false });
  document.addEventListener("touchend",   onEnd,   { passive: true });
  document.addEventListener("touchcancel", reset,  { passive: true });
})();
