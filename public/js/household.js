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

  const Household = {
    id: null,
    data: { members: {}, stock: {}, tasks: {}, recipes: {} },
    ref: null
  };
  window.Household = Household;

  function genId() {
    return "hh_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  }

  // Вызывается после авторизации (передаём firebase user и db).
  // Устойчиво к security-rules: пробуем общий путь household/, при
  // отказе откатываемся на users/{uid}/household (его правила уже
  // разрешают). Так сохранение работает всегда, а на общий путь
  // легко перейти, когда правила откроют household/.
  async function initHousehold(user, db) {
    if (!user || !db) return;
    const me = {
      name: (user.displayName || "").split(" ")[0] || "Я",
      photo: user.photoURL || "",
      email: user.email || ""
    };

    let ref = null;

    // 1) Пытаемся работать через общий household/{hid}
    try {
      const uref = db.ref("users/" + user.uid + "/householdId");
      const snap = await uref.get();
      let hid = snap.exists() ? snap.val() : null;

      if (!hid) {
        hid = genId();
        // пробная запись — упадёт, если правила запрещают household/
        await db.ref("household/" + hid).set({
          createdBy: user.uid, createdAt: Date.now(),
          members: { [user.uid]: me }
        });
        await uref.set(hid);
      } else {
        // убеждаемся, что доступ к узлу есть (read проверит правила)
        await db.ref("household/" + hid).child("members").get();
      }
      Household.id = hid;
      ref = db.ref("household/" + hid);
      Household.mode = "shared";
    } catch (e) {
      // 2) Fallback: личный узел users/{uid}/household
      console.warn("[household] shared path unavailable, falling back to users/{uid}/household:", e && e.code || e);
      try {
        ref = db.ref("users/" + user.uid + "/household");
        // гарантируем, что есть запись об участнике
        await ref.child("members/" + user.uid).set(me).catch(()=>{});
        Household.id = "self:" + user.uid;
        Household.mode = "personal";
      } catch (e2) {
        console.error("[household] init failed completely:", e2);
        return;
      }
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
