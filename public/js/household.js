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
  async function initHousehold(user, db) {
    if (!user || !db) return;
    try {
      const uref = db.ref("users/" + user.uid + "/householdId");
      const snap = await uref.get();
      let hid = snap.exists() ? snap.val() : null;

      if (!hid) {
        // Создаём новый household с этим пользователем как участником
        hid = genId();
        await db.ref("household/" + hid).set({
          createdBy: user.uid,
          createdAt: Date.now(),
          members: { [user.uid]: {
            name: (user.displayName || "").split(" ")[0] || "Я",
            photo: user.photoURL || "",
            email: user.email || ""
          } }
        });
        await uref.set(hid);
      }
      Household.id = hid;
      Household.ref = db.ref("household/" + hid);

      // Живая подписка на общие данные
      Household.ref.on("value", (s) => {
        Household.data = s.val() || { members: {} };
        renderHouseholdHeader();
        // Если мы в мире «Дом» — перерисовать активный раздел
        if (window.Shell && window.Shell.world === "home" && typeof window.renderHome === "function") {
          window.renderHome();
        }
      });
    } catch (e) {
      console.log("[household] init error", e);
    }
  }
  window.initHousehold = initHousehold;

  // Сохранить участка общих данных (stock/tasks/recipes) — для этапов 2-4
  function saveHousehold(section, value) {
    if (!Household.ref) return;
    Household.ref.child(section).set(value).catch(e => console.log("[household] save", e));
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
