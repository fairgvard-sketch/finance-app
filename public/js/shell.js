/* ============================================================
   SHELL — оболочка домашнего хаба.
   Управляет «двумя мирами» (money / home), контекстной
   навигацией и контекстной кнопкой [+].

   Контракт с модулями:
   - Мир «money» рендерит существующий финансовый render()
     (тот лежит в монолите index.html, мы его НЕ трогаем).
   - Мир «home» рендерит HomeModules[<homeTab>].render() в #main.
   ============================================================ */

(function () {
  "use strict";

  /* ── Состояние оболочки ── */
  const Shell = {
    world: localStorage.getItem("hub.world") || "money", // 'money' | 'home'
    moneyTab: "home",   // home | piggy | budget | history  (как в легаси)
    homeTab: "overview" // overview | stock | tasks | recipes
  };
  window.Shell = Shell;

  /* ── Описание навигации каждого мира ──
     id      — внутренний таб
     label   — подпись
     ico     — id <symbol> из общего набора иконок
     add     — что делает [+] на этом мире (вызов сразу, либо меню)        */
  const NAV = {
    money: [
      { id: "home",    label: "Главная", ico: "ico-home" },
      { id: "piggy",   label: "Копилка", ico: "ico-piggy" },
      { id: "budget",  label: "Бюджеты", ico: "ico-budget" },
      { id: "history", label: "История", ico: "ico-history" }
    ],
    home: [
      { id: "overview", label: "Обзор",   ico: "ico-grid" },
      { id: "stock",    label: "Запасы",  ico: "ico-box" },
      { id: "tasks",    label: "Дела",    ico: "ico-check" },
      { id: "recipes",  label: "Рецепты", ico: "ico-chef" }
    ]
  };
  window.HUB_NAV = NAV;

  /* Реестр home-модулей. Каждый модуль регистрируется сам:
     HomeModules.register('stock', { render(){...}, onAdd(){...} })       */
  const HomeModules = {};
  window.HomeModules = {
    register(id, mod) { HomeModules[id] = mod; },
    get(id) { return HomeModules[id]; }
  };

  /* ── Переключение мира ── */
  function setWorld(world) {
    if (world === Shell.world) return;
    Shell.world = world;
    localStorage.setItem("hub.world", world);
    document.body.setAttribute("data-world", world);
    // Синхронизируем легаси-переменную tab под текущий мир «денег»
    if (world === "money") window.tab = Shell.moneyTab;
    renderShell();
  }
  window.setWorld = setWorld;

  /* ── Переключение таба внутри мира ── */
  function goTab(id) {
    if (Shell.world === "money") {
      Shell.moneyTab = id;
      window.tab = id;                 // легаси-рендер читает глобальную tab
      if (typeof window.render === "function") window.render();
    } else {
      Shell.homeTab = id;
      renderHome();
    }
    paintNav();
  }
  window.goTab = goTab;
  window.paintNav = paintNav;

  /* ── Контекстная кнопка [+] ── */
  function onAdd() {
    if (Shell.world === "money") {
      // Легаси: добавление транзакции
      if (typeof window.openTx === "function") window.openTx();
      return;
    }
    // Home: делегируем активному модулю, иначе — модулю «обзор»
    const mod = HomeModules[Shell.homeTab] || HomeModules.overview;
    if (mod && typeof mod.onAdd === "function") mod.onAdd();
  }
  window.onAdd = onAdd;

  /* ── Рендер нижней навигации ── */
  function paintNav() {
    const inner = document.getElementById("hub-nav-inner");
    if (!inner) return;
    const items = NAV[Shell.world];
    const activeTab = Shell.world === "money" ? Shell.moneyTab : Shell.homeTab;
    const left = items.slice(0, 2), right = items.slice(2);
    const btn = (it) => `
      <button class="nb ${it.id === activeTab ? "on" : ""}" onclick="goTab('${it.id}')">
        <svg><use href="#${it.ico}"/></svg>${it.label}
      </button>`;
    inner.innerHTML =
      left.map(btn).join("") +
      `<button class="nb-add" onclick="onAdd()" aria-label="Добавить"><svg><use href="#ico-plus"/></svg></button>` +
      right.map(btn).join("");

    // Подсветка переключателя миров
    const ws = document.getElementById("world-switch");
    if (ws) ws.querySelectorAll(".world-switch__btn").forEach(b =>
      b.classList.toggle("on", b.dataset.world === Shell.world));
  }

  /* ── Рендер «домашнего» мира ── */
  function renderHome() {
    const main = document.getElementById("main");
    if (!main) return;
    const mod = HomeModules[Shell.homeTab];
    if (mod && typeof mod.render === "function") {
      main.innerHTML = "";
      mod.render(main);
    } else {
      main.innerHTML = `<div class="card anim"><div class="stub">
        <div class="stub__ico">🏠</div>
        <h3>Скоро здесь будет раздел</h3>
        <p>Этот раздел появится на следующем этапе.</p>
      </div></div>`;
    }
  }
  window.renderHome = renderHome;

  /* ── Главный рендер оболочки ── */
  function renderShell() {
    document.body.setAttribute("data-world", Shell.world);
    updateHeader();
    if (Shell.world === "money") {
      window.tab = Shell.moneyTab;
      if (typeof window.render === "function") window.render();
    } else {
      renderHome();
    }
    paintNav();
  }
  window.renderShell = renderShell;

  /* ── Шапка: марка мира + аватары household ── */
  function updateHeader() {
    const mark = document.getElementById("hub-mark");
    const name = document.getElementById("hub-name");
    const sub  = document.getElementById("hub-sub");
    if (mark) mark.textContent = Shell.world === "money" ? "💰" : "🏠";
    if (name) name.textContent = Shell.world === "money" ? "Финансы" : "Наш дом";
    if (sub)  sub.textContent  = Shell.world === "money"
      ? "Доходы, расходы, копилка"
      : "Запасы · дела · рецепты";
  }

  /* ── Инициализация оболочки (вызывается после авторизации) ── */
  function initShell() {
    document.body.setAttribute("data-world", Shell.world);
    if (Shell.world === "money") window.tab = Shell.moneyTab;
    paintNav();
    updateHeader();
  }
  window.initShell = initShell;

})();
