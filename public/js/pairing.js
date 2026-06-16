/* ============================================================
   PAIRING UI — sheet подключения партнёра (открывается из шапки).
   Создать код приглашения / войти по коду / список участников.
   ============================================================ */

(function () {
  "use strict";

  function members() {
    return (window.Household && window.Household.members && window.Household.members()) || [];
  }
  function meUid() { return window._authUid || null; }

  function avatar(m, cls) {
    if (m.photo) return `<img class="${cls}" src="${esc(m.photo)}" alt="">`;
    return `<div class="${cls}" style="background:${m.color || "#8a6fb0"};">${(m.name || "?").slice(0, 1).toUpperCase()}</div>`;
  }

  function open() {
    let ov = document.getElementById("pr-sheet-ov");
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "pr-sheet-ov"; ov.className = "hub-sheet-ov hidden";
      ov.addEventListener("click", e => { if (e.target === ov) close(); });
      document.body.appendChild(ov);
    }
    render(ov);
    ov.classList.remove("hidden");
    requestAnimationFrame(() => ov.classList.add("show"));
    document.body.style.overflow = "hidden";
  }

  function close() {
    const ov = document.getElementById("pr-sheet-ov");
    if (!ov) return;
    ov.classList.remove("show");
    document.body.style.overflow = "";
    setTimeout(() => ov.classList.add("hidden"), 380);
  }

  function render(ov) {
    const ms = members();
    const paired = ms.length >= 2;
    const me = ms.find(m => m.uid === meUid()) || ms[0];

    ov.innerHTML = `<div class="hub-sheet">
      <div class="hub-sheet__handle"></div>
      <div class="hub-sheet__title">Наш дом</div>

      <div class="pr-hero">
        <div class="pr-hero__avs">
          ${me ? avatar(me, "pr-hero__av") : ""}
          ${paired ? avatar(ms.find(m => m.uid !== meUid()) || ms[1], "pr-hero__av")
                   : `<div class="pr-hero__av" style="background:var(--surface-2);color:var(--ink-3);border-style:dashed;">+</div>`}
        </div>
        <div class="pr-hero__title">${paired ? "Вы вместе 💛" : "Подключите партнёра"}</div>
        <div class="pr-hero__sub">${paired
          ? "Запасы, дела и рецепты — общие. Изменения видны обоим сразу."
          : "Поделитесь кодом, чтобы вести дом вдвоём. Все данные станут общими."}</div>
      </div>

      ${paired ? renderMembers(ms) : ""}

      <div id="pr-body">
        ${paired ? "" : renderActions()}
      </div>

      ${paired ? `<button class="hub-btn-danger" onclick="Pairing.leave()">Отключиться от общего дома</button>` : ""}
      <div class="pr-error" id="pr-error"></div>
    </div>`;
  }

  function renderMembers(ms) {
    return `<div class="pr-members">
      ${ms.map(m => `
        <div class="pr-member">
          ${avatar(m, "pr-member__av")}
          <div class="pr-member__name">${esc(m.name)}</div>
          ${m.uid === meUid() ? `<span class="pr-member__you">это вы</span>` : ""}
        </div>`).join("")}
    </div>`;
  }

  function renderActions() {
    return `
      <button class="hub-btn-primary" onclick="Pairing.invite()">Создать код приглашения</button>
      <div class="pr-divider">или</div>
      <div class="hub-field">
        <label>У меня есть код</label>
        <input class="hub-input" id="pr-code-input" placeholder="Например, K7F2QX" maxlength="6"
          style="text-transform:uppercase;letter-spacing:.1em;font-weight:700;text-align:center;font-size:18px;">
      </div>
      <button class="hub-btn-primary" style="background:var(--surface);color:var(--home);box-shadow:none;border:1.5px solid var(--home);"
        onclick="Pairing.join()">Присоединиться</button>`;
  }

  /* ── Действия ── */
  async function invite() {
    setError("");
    const body = document.getElementById("pr-body");
    if (body) body.innerHTML = `<div class="pr-hint">Создаём код…</div>`;
    try {
      const code = await window.createInvite();
      if (body) body.innerHTML = `
        <div class="pr-code"><span class="pr-code__val">${code}</span></div>
        <div class="pr-hint">Продиктуйте этот код партнёру. Он введёт его у себя в «Наш дом» → «У меня есть код». Код одноразовый.</div>
        <button class="hub-btn-primary" onclick="Pairing.copy('${code}')">Скопировать код</button>`;
    } catch (e) {
      setError(errText(e));
      if (body) body.innerHTML = renderActions();
    }
  }

  async function join() {
    setError("");
    const inp = document.getElementById("pr-code-input");
    const code = inp ? inp.value.trim() : "";
    if (!code) { setError("Введите код"); return; }
    try {
      await window.joinByCode(code);
      if (window.toast) window.toast("Готово! Теперь дом общий 💛");
      // перерисуем sheet (уже paired)
      const ov = document.getElementById("pr-sheet-ov");
      if (ov) render(ov);
    } catch (e) {
      setError(errText(e));
    }
  }

  async function leave() {
    setError("");
    try {
      await window.leaveHousehold();
      if (window.toast) window.toast("Вы вышли из общего дома");
      const ov = document.getElementById("pr-sheet-ov");
      if (ov) render(ov);
    } catch (e) { setError(errText(e)); }
  }

  function copy(code) {
    try {
      navigator.clipboard.writeText(code);
      if (window.toast) window.toast("Код скопирован: " + code);
    } catch (e) { if (window.toast) window.toast("Код: " + code); }
  }

  function setError(msg) { const e = document.getElementById("pr-error"); if (e) e.textContent = msg || ""; }
  function errText(e) { return (e && e.message) || "Что-то пошло не так"; }
  function esc(s) { return String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  window.Pairing = { open, close, invite, join, leave, copy };
})();
