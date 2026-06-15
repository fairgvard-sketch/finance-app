/* ============================================================
   HOME · ИКОНКИ — duotone в стиле финансового CATEGORY_META.
   Приём Phosphor duotone: фигура рисуется дважды —
   бледная заливка (opacity .2) + контур stroke поверх,
   один цвет на иконку, в плашке с фоном color+'1a'.

   Использование:
     duoIcon('stock', 24)            -> <svg>…</svg>
     duoTile('stock', 24, 46)        -> <div bg>…icon…</div>
     HOME_ICON_COLOR.stock           -> цвет раздела
   ============================================================ */

(function () {
  "use strict";

  // svg-фрагменты: stroke="C"/fill="C" — плейсхолдер цвета (как в CATEGORY_META)
  const HOME_ICONS = {
    overview: { color: "#1a4a35", svg:
      `<g opacity=".2"><rect x="3" y="3" width="7" height="7" rx="2" fill="C"/><rect x="14" y="3" width="7" height="7" rx="2" fill="C"/><rect x="3" y="14" width="7" height="7" rx="2" fill="C"/><rect x="14" y="14" width="7" height="7" rx="2" fill="C"/></g>`+
      `<rect x="3" y="3" width="7" height="7" rx="2" stroke="C" stroke-width="1.6" fill="none"/><rect x="14" y="3" width="7" height="7" rx="2" stroke="C" stroke-width="1.6" fill="none"/><rect x="3" y="14" width="7" height="7" rx="2" stroke="C" stroke-width="1.6" fill="none"/><rect x="14" y="14" width="7" height="7" rx="2" stroke="C" stroke-width="1.6" fill="none"/>` },

    stock: { color: "#b5613e", svg:  // корзина / запасы
      `<g opacity=".2"><path d="M4 8h16l-1.2 11.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8L4 8z" fill="C"/></g>`+
      `<path d="M4 8h16l-1.2 11.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8L4 8z" stroke="C" stroke-width="1.6" stroke-linejoin="round" fill="none"/>`+
      `<path d="M8.5 8 12 3l3.5 5M9 12v5M15 12v5M12 12v5" stroke="C" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>` },

    tasks: { color: "#2f6a4c", svg:  // чек / дела
      `<g opacity=".2"><rect x="3" y="4" width="18" height="17" rx="3" fill="C"/></g>`+
      `<rect x="3" y="4" width="18" height="17" rx="3" stroke="C" stroke-width="1.6" fill="none"/>`+
      `<path d="M8 12.5l2.5 2.5L16 9" stroke="C" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>` },

    recipes: { color: "#d99a2b", svg:  // колпак / рецепты
      `<g opacity=".2"><path d="M6 14a4 4 0 0 1-1.3-7.8 5 5 0 0 1 9.6-1 5 5 0 0 1 4.7 1 4 4 0 0 1-1 7.8z" fill="C"/></g>`+
      `<path d="M6 14a4 4 0 0 1-1.3-7.8 5 5 0 0 1 9.6-1 5 5 0 0 1 4.7 1 4 4 0 0 1-1 7.8z" stroke="C" stroke-width="1.6" stroke-linejoin="round" fill="none"/>`+
      `<path d="M6 14v5a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-5M9.5 17v2M14.5 17v2" stroke="C" stroke-width="1.6" stroke-linecap="round" fill="none"/>` },

    cart: { color: "#457b9d", svg:  // тележка / купить
      `<g opacity=".2"><path d="M6 6h15l-1.8 8.4a2 2 0 0 1-2 1.6H9.2a2 2 0 0 1-2-1.6L5.2 4H2" fill="C"/></g>`+
      `<path d="M5.2 4H2M6 6h15l-1.8 8.4a2 2 0 0 1-2 1.6H9.2a2 2 0 0 1-2-1.6L5.5 6" stroke="C" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`+
      `<circle cx="9.5" cy="20" r="1.6" fill="C"/><circle cx="17" cy="20" r="1.6" fill="C"/>` },

    queue: { color: "#9b72cf", svg:  // очередь / чередование
      `<g opacity=".2"><circle cx="12" cy="12" r="9" fill="C"/></g>`+
      `<path d="M20 9a8 8 0 0 0-14-3L3 9M4 15a8 8 0 0 0 14 3l3-3" stroke="C" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`+
      `<path d="M3 5v4h4M21 19v-4h-4" stroke="C" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>` }
  };

  function duoIcon(key, size) {
    size = size || 24;
    const m = HOME_ICONS[key];
    if (!m) return `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#e8e1d4"/></svg>`;
    const paths = m.svg.replace(/stroke="C"/g, `stroke="${m.color}"`).replace(/fill="C"/g, `fill="${m.color}"`);
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${paths}</svg>`;
  }

  function duoTile(key, size, tileSize) {
    size = size || 24; tileSize = tileSize || 46;
    const m = HOME_ICONS[key];
    const bg = m ? m.color + "1a" : "#f0ebe0";       // ~10% того же цвета
    const r = Math.round(tileSize * 0.30);
    return `<div style="width:${tileSize}px;height:${tileSize}px;border-radius:${r}px;background:${bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;">${duoIcon(key, size)}</div>`;
  }

  window.HOME_ICONS = HOME_ICONS;
  window.HOME_ICON_COLOR = Object.fromEntries(Object.entries(HOME_ICONS).map(([k, v]) => [k, v.color]));
  window.duoIcon = duoIcon;
  window.duoTile = duoTile;
})();
