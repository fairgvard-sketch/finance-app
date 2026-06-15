# Домашний хаб — CLAUDE.md

## Обзор проекта

Мобильное веб-приложение — **домашний хаб для пары** (мобайл-фёрст). Развилось из финансового трекера. SPA на чистом HTML/CSS/JS без фреймворков, деплоится на Firebase Hosting, данные в Firebase Realtime Database.

Два «мира», переключаемых сверху:
- 💰 **Деньги** — доходы, расходы, копилка, бюджеты, автоплатежи (личные, `users/{uid}`)
- 🏠 **Дом** — запасы/холодильник, дела/обязанности, рецепты (общие для пары, `household/{id}`)

**Рабочий файл — `public/index.html`** (НЕ корневой `index.html`, тот устарел). Firebase деплоит папку `public/`.

**Firebase проект:** `financial-app-9c4fa`
**Деплой:** `firebase deploy --only hosting`
**Локально:** открыть `public/index.html` через веб-сервер (не `file://` — Firebase SDK требует http)

## Архитектура

**Стратегия — «обернуть, не переписывать»**: рабочий финансовый монолит (весь `<style>`+`<script>` в `public/index.html`, ядро — функция `render()` по табам) сохранён как **мир «Деньги»** и почти не тронут. Вокруг построена модульная оболочка домашнего хаба.

```
public/
  index.html          — разметка-каркас + легаси-финансы + подключение модулей
  index.legacy.html   — бэкап до рефакторинга (НЕ деплоится, см. firebase.json ignore)
  css/
    theme.css         — дизайн-токены: два мира (зелёный=деньги, терракот=дом)
    shell.css         — шапка хаба, переключатель миров, контекстная нав, виджеты
  js/
    shell.js          — window.Shell (world/moneyTab/homeTab), navigation, [+]
    household.js      — window.Household, bootstrap общего пространства пары
    home/
      overview.js     — дашборд мира «Дом» (живой)
      stock.js        — Запасы (заглушка, Этап 2)
      tasks.js        — Дела/обязанности (заглушка, Этап 3)
      recipes.js      — Рецепты (заглушка, Этап 4)
```

### Контракт home-модулей (для Этапов 2-4)
Каждый раздел мира «Дом» регистрируется так:
```js
window.HomeModules.register("stock", {
  render(mainEl) { mainEl.innerHTML = "..."; },  // рисует раздел в #main
  onAdd() { /* реакция на контекстную кнопку [+] */ }
});
```
- Оболочка вызывает `render()` при входе в раздел и `onAdd()` при тапе `[+]`.
- Общие данные читать из `window.Household.data.{stock|tasks|recipes}`, сохранять через `window.saveHousehold(section, value)`.
- `window.toast(msg)` — лёгкое уведомление.
- Иконки нав-панели: `<symbol id="ico-…">` в `index.html` (grid/box/check/chef уже добавлены).

### ⚠️ ПРАВИЛО ИКОНОК: всегда duotone SVG, НЕ плоские эмодзи

Визуальный язык всего приложения — **Phosphor duotone**: фигура рисуется дважды (бледная заливка `opacity .2` + контур `stroke` поверх), один цвет на иконку, в плашке с фоном `color + '1a'` (~10%). Так сделаны категории финансов (`CATEGORY_META`, `catIcon`/`catTile` в `index.html`) и места хранения / разделы «Дома».

**В любом новом UI содержательные иконки рисуй через хелперы из `js/home/icons.js`:**
- `window.duoIcon(key, size)` → `<svg>` duotone-иконка
- `window.duoTile(key, size, tileSize)` → иконка в цветной плашке
- `window.HOME_ICONS` / `window.HOME_ICON_COLOR` — реестр; новые иконки добавляй сюда (svg с плейсхолдерами `stroke="C"`/`fill="C"`, плюс цвет).

**Нельзя** ставить голые эмодзи (🍽️, 🗑️ и т.п.) как основные иконки сущностей — это «удешевляет» вид и ломает консистентность. Эмодзи допустимы только как мелкий декор в тексте/бейджах. Если нужной иконки нет в `HOME_ICONS` — добавь её туда в duotone-стиле, а не подставляй эмодзи.

### Интеграция со старым кодом
Легаси `go()`, `render()`, `_fbInit()` сделаны shell-aware: переключают/уважают активный мир. Когда `Shell.world==="home"`, финансовый `render()` делегирует в `renderHome()`. CSS оболочки переопределяет легаси через `body[data-world]` для нужной специфичности (легаси `<style>` грузится позже).

**Разделы файла:**
- `<style>` — все стили, CSS-переменные не используются, цвет бренда `#1a4a35`
- Firebase SDK — подключается через CDN (compat версия 9.23.0)
- Блок аутентификации — Google Sign-In через popup
- Константы и данные (`ECATS`, `ICATS`, `SVCS`, `COLORS`, `ICONS`)
- Логика — функции `render()`, `go()`, `openSheet()` / `closeSheet()` и т.д.
- HTML оверлеи (bottom sheets) для каждой формы

## Структура данных Firebase

**Личные финансы** — `users/{uid}/`:
```
txs        — массив транзакций [{id, type, amount, cat, note, date}]
subs       — массив подписок [{id, n, amt, day, autoCharge}]
goals      — массив целей копилки [{id, name, target, saved, icon, color, deadline}]
budgets    — объект бюджетов {cat: amount}
recurrings — автоплатежи [{id, type, amount, cat, note, freq, day, subId}]
householdId — ссылка на общее пространство пары
```
Сохранение: `saveAll()` → `window.saveToFirebase()`.

**Общий быт пары** — `household/{householdId}/`:
```
members  — {uid: {name, photo, email}}
stock    — Этап 2 (запасы)
tasks    — Этап 3 (дела/обязанности/очередь)
recipes  — Этап 4 (рецепты)
```
Bootstrap в `household.js` (`initHousehold`): при первом входе создаётся household, id пишется в `users/{uid}/householdId`. Подписка `.on("value")` держит `window.Household.data` живым. Сохранение: `window.saveHousehold(section, value)`.

## Навигация (вкладки)

- `home` — главная (баланс, транзакции, подписки)
- `piggy` — копилка (цели, пополнение/снятие)
- `budget` — бюджеты по категориям
- `history` — история операций с фильтрами

Переключение: `go(tab)` обновляет `tab` и вызывает `render()`.

## UI-паттерны

**Bottom sheets (оверлеи):**
- `openSheet(id)` / `closeSheet(id)` — анимированные снизу вверх
- ID оверлеев: `ov-tx`, `ov-sub`, `ov-goal`, `ov-saving`, `ov-withdraw`, `ov-edit-goal`, `ov-autorule`, `ov-overview`

**Классы-утилиты:**
- `.card` — белая карточка с тенью
- `.btn-g` — зелёная кнопка (цвет бренда)
- `.btn-ol` — outline кнопка
- `.chip` / `.chip.on` — теги выбора категории
- `.lbl` — подпись секции (капслок, серый)
- `.tx-row` — строка транзакции

**Валюта:** израильский шекель `₪`, форматирование через `fmt(n)` → `Math.round(n).toLocaleString("he-IL")`

## Важные функции

| Функция | Описание |
|---------|----------|
| `render()` | Перерисовывает текущую вкладку |
| `saveAll()` | Сохраняет в localStorage + Firebase |
| `go(tab)` | Переключает вкладку |
| `openTx()` | Открывает форму добавления транзакции |
| `checkAutoRules()` | Запускает авто-списания при старте |
| `fmtDate(dateStr)` | Форматирует дату на русском |
| `fmt(n)` | Форматирует число в шекели |

## Категории расходов (ECATS)

Рестораны, Продукты, Транспорт, Такси, Гаджеты, Одежда, Здоровье, Развлечения, Игры, Бьюти, Коммунальные, Путешествия, Подарки, Образование, Разное

## Подписки (SVCS)

Netflix, YouTube, Spotify, CyberGhost, Claude, Своя — каждая с цветом фона и SVG-иконкой.

## Правила при изменениях

- Все правки вносятся в `index.html` (или `public/index.html` — это тот же файл при деплое)
- Не добавлять отдельные JS/CSS файлы без явной необходимости
- Язык интерфейса — **русский**
- Цвет бренда — `#1a4a35` (тёмно-зелёный)
- Анимации через CSS transitions/keyframes, не JS-библиотеки
- После изменений деплоить: `firebase deploy --only hosting`
