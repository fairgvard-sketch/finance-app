/* ============================================================
   HOUSEHOLD — общее пространство пары («раздельно + общее»).

   Финансы остаются личными (users/{uid}).
   Быт — общий: household/{householdId}/{stock,tasks,recipes,members}.

   Этап 1: bootstrap. При первом входе создаём household для
   пользователя и сохраняем householdId в users/{uid}/householdId.
   Подключение партнёра по коду — на следующих этапах.
   ============================================================ */

(function () {
  "use strict";

  // Палитра цветов партнёров (контрастные, тёплые)
  const MEMBER_COLORS = ["#2f6a4c", "#b5613e", "#4f86c4", "#9b72cf"];

  const Household = {
    id: null,
    data: { members: {}, stock: {}, tasks: {}, recipes: {} },
    ref: null,
    // массив участников [{uid, name, photo, color}]
    members() {
      const m = (this.data && this.data.members) || {};
      return Object.entries(m).map(([uid, v], i) => ({
        uid, name: v.name || "?", photo: v.photo || "",
        color: v.color || MEMBER_COLORS[i % MEMBER_COLORS.length]
      }));
    },
    memberColor(uid) {
      const found = this.members().find(x => x.uid === uid);
      return found ? found.color : "var(--ink-3)";
    },
    memberName(uid) {
      const found = this.members().find(x => x.uid === uid);
      return found ? found.name : "?";
    },
    me() { return (window._authUid) || (this.members()[0] && this.members()[0].uid) || null; }
  };
  window.Household = Household;

  function genId() {
    return "hh_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  }

  // Вызывается после авторизации (передаём firebase user и db).
  //
  // ВАЖНО: текущие security-rules Firebase разрешают только
  // users/{uid}, а household/ блокируют (PERMISSION_DENIED). Поэтому
  // по умолчанию работаем по личному пути users/{uid}/household —
  // он гарантированно пишется и переживает перезагрузку.
  //
  // Когда правила household/ будут задеплоены (database.rules.json),
  // включится общий режим: достаточно поставить флаг
  //   localStorage.setItem("hub.sharedHousehold","1")
  // — тогда данные станут общими для пары.
  // храним ссылки для pairing-операций
  let _db = null, _user = null, _me = null;

  function meObj(user, colorIdx) {
    return {
      name: (user.displayName || "").split(" ")[0] || "Я",
      photo: user.photoURL || "",
      email: user.email || "",
      color: MEMBER_COLORS[(colorIdx || 0) % MEMBER_COLORS.length]
    };
  }

  async function initHousehold(user, db) {
    if (!user || !db) return;
    window._authUid = user.uid;   // кто я (для очереди дел и пр.)
    _db = db; _user = user;
    _me = meObj(user, 0);

    let hid = null;
    try {
      const snap = await db.ref("users/" + user.uid + "/householdId").get();
      hid = snap.exists() ? snap.val() : null;
    } catch (e) { console.warn("[household] read householdId:", e && e.code || e); }

    if (hid) {
      // Общий режим: есть household — работаем с ним
      attachShared(hid);
      // подстрахуемся, что мы есть в members (и цвет назначен)
      ensureMembership(hid);
    } else {
      // Личный режим по умолчанию (users/{uid}/household)
      attachPersonal();
    }
  }
  window.initHousehold = initHousehold;

  function attachShared(hid) {
    detach();
    Household.id = hid;
    Household.mode = "shared";
    Household.ref = _db.ref("household/" + hid);
    subscribe(Household.ref);
  }

  function attachPersonal() {
    detach();
    Household.id = "self:" + _user.uid;
    Household.mode = "personal";
    Household.ref = _db.ref("users/" + _user.uid + "/household");
    Household.ref.child("members/" + _user.uid).set(_me).catch(e =>
      console.warn("[household] member write:", e && e.code || e));
    subscribe(Household.ref);
  }

  function detach() {
    if (Household.ref) { try { Household.ref.off(); } catch (e) {} }
  }

  function subscribe(ref) {
    ref.on("value", (s) => {
      Household.data = s.val() || { members: {} };
      renderHouseholdHeader();
      if (window.Shell && window.Shell.world === "home" && typeof window.renderHome === "function") {
        window.renderHome();
      }
    }, (err) => {
      console.error("[household] subscription error:", err && err.code || err);
    });
  }

  // Убедиться, что текущий пользователь — участник household (с цветом)
  async function ensureMembership(hid) {
    try {
      const mref = _db.ref("household/" + hid + "/members");
      const snap = await mref.get();
      const members = snap.val() || {};
      if (!members[_user.uid]) {
        const idx = Object.keys(members).length;   // назначаем следующий цвет
        await mref.child(_user.uid).set(meObj(_user, idx));
      }
    } catch (e) { console.warn("[household] ensureMembership:", e && e.code || e); }
  }

  /* ============================================================
     PAIRING — приглашение партнёра по короткому коду
     ============================================================ */

  // Сгенерировать invite-код. Если мы ещё в личном режиме — сначала
  // создаём общий household и мигрируем туда личные данные.
  async function createInvite() {
    if (!_db || !_user) throw new Error("not ready");
    let hid = Household.id && Household.mode === "shared" ? Household.id : null;

    if (!hid) {
      // создаём общий household из текущих личных данных
      hid = genId();
      const personalSnap = await _db.ref("users/" + _user.uid + "/household").get().catch(() => null);
      const personal = (personalSnap && personalSnap.val()) || {};
      const payload = {
        createdBy: _user.uid, createdAt: Date.now(),
        members: { [_user.uid]: meObj(_user, 0) },
        stock: personal.stock || {}, shopping: personal.shopping || {},
        chores: personal.chores || {}, tasks: personal.tasks || {},
        duties: personal.duties || {}, recipes: personal.recipes || {}
      };
      await _db.ref("household/" + hid).set(payload);
      await _db.ref("users/" + _user.uid + "/householdId").set(hid);
      attachShared(hid);
    }

    const code = genCode();
    await _db.ref("invites/" + code).set({ hid, by: _user.uid, ts: Date.now() });
    return code;
  }
  window.createInvite = createInvite;

  // Присоединиться к household по коду
  async function joinByCode(rawCode) {
    if (!_db || !_user) throw new Error("not ready");
    const code = (rawCode || "").trim().toUpperCase();
    if (!code) throw new Error("Введите код");

    const invSnap = await _db.ref("invites/" + code).get();
    if (!invSnap.exists()) throw new Error("Код не найден");
    const inv = invSnap.val();
    const hid = inv.hid;
    if (!hid) throw new Error("Неверный код");
    if (inv.by === _user.uid) throw new Error("Это ваш собственный код");

    // добавляем себя в members (цвет — следующий свободный)
    const mref = _db.ref("household/" + hid + "/members");
    const msnap = await mref.get();
    const members = msnap.val() || {};
    const idx = Object.keys(members).length;
    await mref.child(_user.uid).set(meObj(_user, idx));
    await _db.ref("users/" + _user.uid + "/householdId").set(hid);

    attachShared(hid);
    // код одноразовый — гасим
    _db.ref("invites/" + code).remove().catch(() => {});
    return true;
  }
  window.joinByCode = joinByCode;

  // Выйти из общего household, вернуться в личный режим
  async function leaveHousehold() {
    if (!_db || !_user) return;
    const hid = Household.id;
    if (Household.mode === "shared" && hid) {
      await _db.ref("household/" + hid + "/members/" + _user.uid).remove().catch(() => {});
      await _db.ref("users/" + _user.uid + "/householdId").remove().catch(() => {});
    }
    attachPersonal();
  }
  window.leaveHousehold = leaveHousehold;

  function genCode() {
    const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // без похожих 0/O/1/I
    let s = ""; for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)];
    return s;
  }

  // Сохранить участок общих данных (stock/tasks/recipes/shopping).
  function saveHousehold(section, value) {
    if (!Household.ref) {
      console.error("[household] saveHousehold called before init (ref is null)");
      if (window.toast) window.toast("Нет связи с базой — данные не сохранены");
      return;
    }
    Household.ref.child(section).set(value).catch(e => {
      console.error("[household] save error:", e && e.code || e);
      if (window.toast) window.toast("Ошибка сохранения: " + (e && e.code || ""));
    });
  }
  window.saveHousehold = saveHousehold;

  // Рисуем аватары участников в шапке (+ кнопка-добавление если соло)
  function renderHouseholdHeader() {
    const box = document.getElementById("hub-avatars");
    if (!box) return;
    const members = (Household.data && Household.data.members) || {};
    const arr = Object.values(members).slice(0, 2);
    let html = arr.map(m =>
      m.photo
        ? `<img src="${m.photo}" alt="${m.name || ""}">`
        : `<div class="av-fallback">${(m.name || "?").slice(0, 1).toUpperCase()}</div>`
    ).join("");
    // если партнёра ещё нет — пунктирный «+» как приглашение подключить
    if (arr.length < 2) html += `<div class="av-add">+</div>`;
    box.innerHTML = html;
  }
  window.renderHouseholdHeader = renderHouseholdHeader;

})();
