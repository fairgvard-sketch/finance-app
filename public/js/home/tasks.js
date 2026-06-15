/* ============================================================
   HOME · ДЕЛА (Этап 3)
   Очередь сверху (кто дежурный, авто-чередование) + секции:
   Сегодня (разовые задачи с дедлайнами), Обязанности (зоны).
   Цветовая метка партнёра у каждого дела.

   Данные household/{id}:
     chores: {id:{title,emoji,rotation:[uid…],turnIdx,freq,lastDone,ts}}
     tasks:  {id:{title,assignee,done,due,ts}}
     duties: {id:{title,emoji,owner}}
   ============================================================ */

(function () {
  "use strict";

  // ключи duotone-иконок из icons.js (HOME_ICONS) — НЕ эмодзи
  const CHORE_ICONS = ["dishes","trash","broom","laundry","cook","cart","plant","pet","bath","iron"];
  const DUTY_ICONS  = ["dishes","bath","bed","broom","plant","pet","laundry","cook"];

  let editType = null;   // 'task' | 'chore' | 'duty'
  let editId = null;
  const form = {};

  /* ── Данные ── */
  function H() { return (window.Household && window.Household.data) || {}; }
  function choresObj() { return H().chores || {}; }
  function tasksObj()  { return H().tasks  || {}; }
  function dutiesObj() { return H().duties || {}; }
  function arr(o) { return Object.entries(o || {}).map(([id, v]) => ({ id, ...v })); }

  function save(section, obj) { if (window.saveHousehold) window.saveHousehold(section, obj); }

  /* ── Участники (с виртуальным партнёром, пока нет pairing) ── */
  function members() {
    const real = (window.Household && window.Household.members && window.Household.members()) || [];
    if (real.length >= 2) return real.slice(0, 2);
    // соло-режим: добавляем виртуального «Партнёра» для демонстрации очереди
    const me = real[0] || { uid: "me", name: "Я", photo: "", color: "#2f6a4c" };
    const partner = { uid: "partner", name: "Партнёр", photo: "", color: "#b5613e" };
    return [me, partner];
  }
  function colorOf(uid) {
    const m = members().find(x => x.uid === uid);
    return m ? m.color : "var(--ink-3)";
  }
  function nameOf(uid) {
    const m = members().find(x => x.uid === uid);
    return m ? m.name : "?";
  }
  function avatarHtml(uid, cls) {
    const m = members().find(x => x.uid === uid);
    if (m && m.photo) return `<img class="${cls}" src="${m.photo}" alt="${escapeHtml(m.name)}">`;
    const c = m ? m.color : "var(--ink-3)";
    return `<div class="${cls}" style="background:${c};">${(m ? m.name : "?").slice(0, 1).toUpperCase()}</div>`;
  }

  /* ── Дедлайн ── */
  function dueInfo(due) {
    if (!due) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(due + "T00:00:00");
    const days = Math.round((d - today) / 86400000);
    if (days < 0) return { cls: "due-bad", txt: "просрочено" };
    if (days === 0) return { cls: "due-bad", txt: "сегодня" };
    if (days === 1) return { cls: "due-soon", txt: "завтра" };
    if (days <= 3) return { cls: "due-soon", txt: days + " дн." };
    const MON = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
    return { cls: "due-ok", txt: `${d.getDate()} ${MON[d.getMonth()]}` };
  }

  /* ============================================================
     РЕНДЕР
     ============================================================ */
  function render(main) {
    const chores = arr(choresObj());
    const tasks = arr(tasksObj()).sort((a, b) => (a.done - b.done) || (a.ts || 0) - (b.ts || 0));
    const duties = arr(dutiesObj());

    main.innerHTML = `
      ${renderChores(chores)}
      ${renderTasks(tasks)}
      ${renderDuties(duties)}
    `;
  }

  /* ── СЕКЦИЯ «ДЕЖУРСТВА»: равноправные карточки, своя очередь у каждой ── */
  function renderChores(chores) {
    const myUid = (window.Household && window.Household.me && window.Household.me()) || members()[0].uid;
    // сортировка: сначала «сейчас моя очередь», потом остальные
    const sorted = chores.slice().sort((a, b) => {
      const am = isMyTurn(a, myUid) ? 0 : 1;
      const bm = isMyTurn(b, myUid) ? 0 : 1;
      return (am - bm) || (a.ts || 0) - (b.ts || 0);
    });
    const body = sorted.length
      ? sorted.map(c => choreCard(c, myUid)).join("")
      : `<div class="tsk-empty">Дежурств нет. Добавьте «мытьё посуды», «вынос мусора» — с честным чередованием по кругу.</div>`;
    return `
      <div class="tsk-section anim">
        <div class="tsk-section__head">
          <h2>🔁 Дежурства</h2>
          <button class="tsk-section__add" onclick="TasksUI.add('chore')">+</button>
        </div>
        ${body}
      </div>`;
  }

  function rotationOf(c) {
    return (c.rotation && c.rotation.length) ? c.rotation : members().map(m => m.uid);
  }
  function curUidOf(c) {
    const rot = rotationOf(c);
    return rot[(c.turnIdx || 0) % rot.length];
  }
  function isMyTurn(c, myUid) { return curUidOf(c) === myUid; }

  function choreCard(c, myUid) {
    const rot = rotationOf(c);
    const curUid = curUidOf(c);
    const nextUid = rot[((c.turnIdx || 0) + 1) % rot.length];
    const col = colorOf(curUid);
    const mine = curUid === myUid;
    const icoKey = c.icon || "broom";
    return `
      <div class="tsk-chore ${mine ? "mine" : ""}" style="--c:${col};" onclick="TasksUI.edit('chore','${c.id}')">
        <div class="tsk-chore__emoji">${window.duoIcon ? window.duoIcon(icoKey, 24, col) : ""}</div>
        <div class="tsk-chore__body">
          <div class="tsk-chore__title">${escapeHtml(c.title)}</div>
          <div class="tsk-chore__turn">
            <span class="tsk-chore__dot" style="background:${col};">${nameOf(curUid).slice(0,1).toUpperCase()}</span>
            ${mine ? "<b>твоя очередь</b>" : `очередь ${escapeHtml(nameOf(curUid))}`}
          </div>
          <div class="tsk-chore__when">${c.lastDone ? `делали ${fmtAgo(c.lastDone)} · далее ${escapeHtml(nameOf(nextUid))}` : `далее ${escapeHtml(nameOf(nextUid))}`}</div>
        </div>
        <button class="tsk-chore__done" onclick="event.stopPropagation();TasksUI.doneChore('${c.id}')">✓ Сделал</button>
      </div>`;
  }

  /* ── Секция «Сегодня» (разовые задачи) ── */
  function renderTasks(tasks) {
    const rows = tasks.length
      ? `<div class="tsk-card">${tasks.map(taskRow).join("")}</div>`
      : `<div class="tsk-empty">Задач нет. Добавь первую — «купить лампочку», «позвонить мастеру».</div>`;
    return `
      <div class="tsk-section anim">
        <div class="tsk-section__head">
          <h2>📋 Задачи</h2>
          <button class="tsk-section__add" onclick="TasksUI.add('task')">+</button>
        </div>
        ${rows}
      </div>`;
  }

  function taskRow(t) {
    const col = colorOf(t.assignee);
    const due = dueInfo(t.due);
    return `
      <div class="tsk-row ${t.done ? "done" : ""}" onclick="TasksUI.edit('task','${t.id}')">
        <div class="tsk-check ${t.done ? "done" : ""}" style="--c:${col};"
             onclick="event.stopPropagation();TasksUI.toggleTask('${t.id}')">
          <svg viewBox="0 0 24 24"><polyline points="5 12 10 17 19 7"/></svg>
        </div>
        <div class="tsk-row__body">
          <div class="tsk-row__title">${escapeHtml(t.title)}</div>
          <div class="tsk-row__meta">
            ${t.assignee ? `<span class="tsk-who"><span class="tsk-who__dot" style="background:${col};"></span>${escapeHtml(nameOf(t.assignee))}</span>` : ""}
            ${due ? `<span class="tsk-badge ${due.cls}">⏱ ${due.txt}</span>` : ""}
          </div>
        </div>
      </div>`;
  }

  /* ── Секция «Обязанности» (зоны) ── */
  function renderDuties(duties) {
    const body = duties.length
      ? `<div class="duty-grid">${duties.map(dutyCard).join("")}</div>`
      : `<div class="tsk-empty">Закрепите зоны: «ты — кухня, я — ванная».</div>`;
    return `
      <div class="tsk-section anim">
        <div class="tsk-section__head">
          <h2>🧭 Обязанности</h2>
          <button class="tsk-section__add" onclick="TasksUI.add('duty')">+</button>
        </div>
        ${body}
      </div>`;
  }

  function dutyCard(d) {
    const col = colorOf(d.owner);
    const icoKey = d.icon || "broom";
    return `
      <div class="duty" style="--c:${col};" onclick="TasksUI.edit('duty','${d.id}')">
        <div class="duty__emoji">${window.duoTile ? window.duoTile(icoKey, 22, 42, col) : ""}</div>
        <div class="duty__title">${escapeHtml(d.title)}</div>
        <div class="duty__owner">
          <span class="duty__ownerdot" style="background:${col};">${nameOf(d.owner).slice(0,1).toUpperCase()}</span>
          ${escapeHtml(nameOf(d.owner))}
        </div>
      </div>`;
  }

  function fmtAgo(ts) {
    const days = Math.floor((Date.now() - ts) / 86400000);
    if (days <= 0) return "сегодня";
    if (days === 1) return "вчера";
    return `${days} дн. назад`;
  }

  /* ============================================================
     ДЕЙСТВИЯ
     ============================================================ */
  function rerender() {
    const main = document.getElementById("main");
    if (main && window.Shell && window.Shell.world === "home" && window.Shell.homeTab === "tasks") render(main);
  }

  // Сделано дежурное дело → очередь переходит к следующему
  function doneChore(id) {
    const obj = choresObj(); const c = obj[id]; if (!c) return;
    const rot = (c.rotation && c.rotation.length) ? c.rotation : members().map(m => m.uid);
    const curUid = rot[(c.turnIdx || 0) % rot.length];
    const next = nameOf(rot[((c.turnIdx || 0) + 1) % rot.length]);

    // момент действия: карточка пульсирует, иконка проворачивается
    const card = document.querySelector(`.tsk-chore[onclick*="'${id}'"]`);
    if (card && window.Motion) window.Motion.flash(card, "m-done", 500);

    const apply = () => {
      obj[id] = { ...c, turnIdx: ((c.turnIdx || 0) + 1) % rot.length, lastDone: Date.now(), lastDoneBy: curUid };
      save("chores", obj);
      if (window.toast) window.toast(`Готово! Теперь очередь: ${next}`);
    };
    // даём анимации проиграться (если reduced-motion — почти мгновенно)
    if (card && window.Motion) setTimeout(apply, 280); else apply();
  }

  function toggleTask(id) {
    const obj = tasksObj(); const t = obj[id]; if (!t) return;
    obj[id] = { ...t, done: !t.done };
    save("tasks", obj);
  }

  /* ============================================================
     SHEET добавления / редактирования (task | chore | duty)
     ============================================================ */
  function add(type) { openSheet(type, null); }

  function openSheet(type, id) {
    editType = type; editId = id;
    const m = members();
    let src = null;
    if (id) src = (type === "task" ? tasksObj() : type === "chore" ? choresObj() : dutiesObj())[id];

    const defIcon = type === "duty" ? DUTY_ICONS[0] : CHORE_ICONS[0];
    Object.assign(form, {
      title: src ? src.title : "",
      assignee: src ? (src.assignee || m[0].uid) : m[0].uid,
      due: src ? (src.due || "") : "",
      icon: src ? (src.icon || defIcon) : defIcon,
      owner: src ? (src.owner || m[0].uid) : m[0].uid,
      rotation: src && src.rotation ? src.rotation.slice() : m.map(x => x.uid)
    });
    mountSheet();
  }

  function mountSheet() {
    let ov = document.getElementById("tsk-sheet-ov");
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "tsk-sheet-ov"; ov.className = "hub-sheet-ov hidden";
      ov.addEventListener("click", e => { if (e.target === ov) closeSheet(); });
      document.body.appendChild(ov);
    }
    const titles = {
      task:  { neu: "Новая",  name: "задача",      edit: "Изменить задачу" },
      chore: { neu: "Новое",  name: "дежурство",   edit: "Изменить дежурство" },
      duty:  { neu: "Новая",  name: "обязанность", edit: "Изменить обязанность" }
    };
    const tt = titles[editType];
    ov.innerHTML = `<div class="hub-sheet">
      <div class="hub-sheet__handle"></div>
      <div class="hub-sheet__title">${editId ? tt.edit : tt.neu + " " + tt.name}</div>

      <div class="hub-field">
        <label>Название</label>
        <input class="hub-input" id="tf-title" placeholder="${placeholderFor(editType)}" value="${escapeHtml(form.title)}">
      </div>

      ${editType !== "task" ? `
      <div class="hub-field">
        <label>Иконка</label>
        <div class="hub-chiprow" id="tf-emoji">${iconChips()}</div>
      </div>` : ""}

      ${editType === "chore" ? renderRotationField() : renderAssigneeField()}

      ${editType === "task" ? `
      <div class="hub-field">
        <label>Срок (необязательно)</label>
        <input class="hub-input" id="tf-due" type="date" value="${form.due}">
      </div>` : ""}

      <button class="hub-btn-primary" onclick="TasksUI.save()">${editId ? "Сохранить" : "Добавить"}</button>
      ${editId ? `<button class="hub-btn-danger" onclick="TasksUI.remove()">Удалить</button>` : ""}
    </div>`;

    ov.classList.remove("hidden");
    requestAnimationFrame(() => ov.classList.add("show"));
    document.body.style.overflow = "hidden";
    setTimeout(() => { const n = document.getElementById("tf-title"); if (n && !form.title) n.focus(); }, 380);
  }

  function placeholderFor(t) {
    return t === "task" ? "напр. Купить лампочку"
      : t === "chore" ? "напр. Мытьё посуды"
      : "напр. Кухня";
  }

  function iconChips() {
    const set = editType === "duty" ? DUTY_ICONS : CHORE_ICONS;
    return set.map(k => {
      const on = form.icon === k;
      return `<div class="hub-chip ${on ? "on" : ""}" style="${on ? "background:var(--home);" : ""}padding:8px;"
        onclick="TasksUI.formIcon('${k}')">${window.duoIcon ? window.duoIcon(k, 22, on ? "#fff" : null) : ""}</div>`;
    }).join("");
  }

  function renderAssigneeField() {
    const m = members();
    const key = editType === "duty" ? "owner" : "assignee";
    const cur = form[key];
    return `
      <div class="hub-field">
        <label>${editType === "duty" ? "Ответственный" : "Кому"}</label>
        <div class="hub-chiprow" id="tf-assignee">
          ${m.map(x => `<div class="hub-chip ${cur === x.uid ? "on" : ""}" style="${cur === x.uid ? `background:${x.color};` : ""}"
            onclick="TasksUI.formAssignee('${x.uid}')">
            <span class="dot" style="background:${cur === x.uid ? "rgba(255,255,255,.25)" : x.color};"></span>${escapeHtml(x.name)}</div>`).join("")}
        </div>
      </div>`;
  }

  function renderRotationField() {
    const m = members();
    return `
      <div class="hub-field">
        <label>Чередуется между</label>
        <div class="hub-chiprow">
          ${m.map(x => `<div class="hub-chip on" style="background:${x.color};">
            <span class="dot" style="background:rgba(255,255,255,.25);"></span>${escapeHtml(x.name)}</div>`).join("")}
        </div>
        <div style="font-size:12px;color:var(--ink-3);margin-top:8px;">После «Сделано» очередь переходит к следующему по кругу.</div>
      </div>`;
  }

  function closeSheet() {
    const ov = document.getElementById("tsk-sheet-ov");
    if (!ov) return;
    ov.classList.remove("show");
    document.body.style.overflow = "";
    setTimeout(() => ov.classList.add("hidden"), 380);
  }

  function syncTitle() {
    const t = document.getElementById("tf-title"); if (t) form.title = t.value;
    const d = document.getElementById("tf-due"); if (d) form.due = d.value;
  }
  function formIcon(k) {
    form.icon = k;
    document.getElementById("tf-emoji").innerHTML = iconChips();
  }
  function formAssignee(uid) {
    if (editType === "duty") form.owner = uid; else form.assignee = uid;
    const wrap = document.getElementById("tf-assignee");
    if (wrap) {
      const m = members();
      wrap.innerHTML = m.map(x => `<div class="hub-chip ${uid === x.uid ? "on" : ""}" style="${uid === x.uid ? `background:${x.color};` : ""}"
        onclick="TasksUI.formAssignee('${x.uid}')">
        <span class="dot" style="background:${uid === x.uid ? "rgba(255,255,255,.25)" : x.color};"></span>${escapeHtml(x.name)}</div>`).join("");
    }
  }

  function saveForm() {
    syncTitle();
    if (!form.title.trim()) { if (window.toast) window.toast("Укажите название"); return; }
    const section = editType === "task" ? "tasks" : editType === "chore" ? "chores" : "duties";
    const obj = editType === "task" ? tasksObj() : editType === "chore" ? choresObj() : dutiesObj();
    const id = editId || (editType[0] + "_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3));

    let rec;
    if (editType === "task") {
      rec = { title: form.title.trim(), assignee: form.assignee, due: form.due || "",
              done: (obj[id] && obj[id].done) || false, ts: (obj[id] && obj[id].ts) || Date.now() };
    } else if (editType === "chore") {
      rec = { title: form.title.trim(), icon: form.icon, rotation: form.rotation,
              turnIdx: (obj[id] && obj[id].turnIdx) || 0, lastDone: (obj[id] && obj[id].lastDone) || 0,
              lastDoneBy: (obj[id] && obj[id].lastDoneBy) || "", ts: (obj[id] && obj[id].ts) || Date.now() };
    } else {
      rec = { title: form.title.trim(), icon: form.icon, owner: form.owner, ts: (obj[id] && obj[id].ts) || Date.now() };
    }
    obj[id] = rec;
    save(section, obj);
    closeSheet();
    if (window.toast) window.toast(editId ? "Сохранено" : "Добавлено");
  }

  function remove() {
    if (!editId) return;
    const section = editType === "task" ? "tasks" : editType === "chore" ? "chores" : "duties";
    const obj = editType === "task" ? tasksObj() : editType === "chore" ? choresObj() : dutiesObj();
    delete obj[editId];
    save(section, obj);
    closeSheet();
    if (window.toast) window.toast("Удалено");
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* ── Публичный API ── */
  window.TasksUI = {
    add, edit: openSheet, doneChore, toggleTask,
    formIcon, formAssignee, save: saveForm, remove, close: closeSheet
  };

  /* ── Контракт модуля ── */
  window.HomeModules.register("tasks", {
    render,
    onAdd() { openSheet("task", null); }   // [+] по умолчанию — новая задача
  });
})();
