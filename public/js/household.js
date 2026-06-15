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
  async function initHousehold(user, db) {
    if (!user || !db) return;
    window._authUid = user.uid;   // кто я (для очереди дел и пр.)
    const me = {
      name: (user.displayName || "").split(" ")[0] || "Я",
      photo: user.photoURL || "",
      email: user.email || "",
      color: MEMBER_COLORS[0]     // первый участник — зелёный
    };

    const tryShared = localStorage.getItem("hub.sharedHousehold") === "1";
    let ref = null;

    if (tryShared) {
      // Общий household/{hid} — только если правила уже открыты
      try {
        const uref = db.ref("users/" + user.uid + "/householdId");
        const snap = await uref.get();
        let hid = snap.exists() ? snap.val() : null;
        if (!hid) {
          hid = genId();
          await db.ref("household/" + hid).set({
            createdBy: user.uid, createdAt: Date.now(),
            members: { [user.uid]: me }
          });
          await uref.set(hid);
        }
        Household.id = hid;
        Household.mode = "shared";
        ref = db.ref("household/" + hid);
      } catch (e) {
        console.warn("[household] shared недоступен, личный путь:", e && e.code || e);
      }
    }

    // Личный путь (по умолчанию и как fallback)
    if (!ref) {
      ref = db.ref("users/" + user.uid + "/household");
      Household.id = "self:" + user.uid;
      Household.mode = "personal";
      // гарантируем запись об участнике (для аватаров)
      ref.child("members/" + user.uid).set(me).catch(e =>
        console.warn("[household] member write:", e && e.code || e));
    }

    Household.ref = ref;

    // Живая подписка на общие данные
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
  window.initHousehold = initHousehold;

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

  // Рисуем аватары участников в шапке
  function renderHouseholdHeader() {
    const box = document.getElementById("hub-avatars");
    if (!box) return;
    const members = (Household.data && Household.data.members) || {};
    const arr = Object.values(members).slice(0, 2);
    if (arr.length === 0) { box.innerHTML = ""; return; }
    box.innerHTML = arr.map(m =>
      m.photo
        ? `<img src="${m.photo}" alt="${m.name || ""}">`
        : `<div class="av-fallback">${(m.name || "?").slice(0, 1).toUpperCase()}</div>`
    ).join("");
  }
  window.renderHouseholdHeader = renderHouseholdHeader;

})();
