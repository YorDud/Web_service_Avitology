const statusCard = document.getElementById("statusCard");
const refreshBtn = document.getElementById("refreshBtn");
const openSiteBtn = document.getElementById("openSiteBtn");

async function saveAccessState(data) {
  if (!globalThis.extApi) return;

  await globalThis.extApi.storage.local.set({
    avitologyAccessState: {
      authenticated: !!data.authenticated,
      access: !!data.access,
      subscriptionLevel: data.subscriptionLevel || null,
      updatedAt: Date.now()
    }
  });
}

async function loadStatus() {
  statusCard.innerHTML = `
    <div class="status-title">Проверка доступа...</div>
    <div class="status-text">Подождите, идет запрос к сайту Avitology</div>
  `;

  try {
    const response = await fetch("http://localhost:3000/api/extension/access", {
      credentials: "include"
    });

    const data = await response.json();

    if (!response.ok) {
      await saveAccessState({
        authenticated: false,
        access: false,
        subscriptionLevel: null
      });

      statusCard.innerHTML = `
        <div class="status-title">Ошибка подключения</div>
        <div class="status-text">Не удалось получить ответ от сайта Avitology</div>
      `;
      return;
    }

    await saveAccessState(data);

    if (!data.authenticated) {
      statusCard.innerHTML = `
        <div class="status-title">Требуется вход</div>
        <div class="status-text">
          Вы не авторизованы на сайте Avitology. Войдите в аккаунт в браузере.
        </div>
      `;
      return;
    }

    if (!data.access) {
      statusCard.innerHTML = `
        <div class="status-title">Нет доступа</div>
        <div class="status-text">
          У вас нет активной подписки Basic. Текущий уровень: ${data.subscriptionLevel || "free"}.
        </div>
      `;
      return;
    }

    statusCard.innerHTML = `
      <div class="status-title">Доступ разрешен</div>
      <div class="status-text">
        Расширение может работать на страницах Авито. Уровень доступа: ${data.subscriptionLevel}.
      </div>
    `;
  } catch (error) {
    console.error(error);

    await saveAccessState({
      authenticated: false,
      access: false,
      subscriptionLevel: null
    });

    statusCard.innerHTML = `
      <div class="status-title">Ошибка сети</div>
      <div class="status-text">
        Проверьте, что сайт Avitology запущен на http://localhost:3000
      </div>
    `;
  }
}

refreshBtn.addEventListener("click", loadStatus);

openSiteBtn.addEventListener("click", () => {
  if (globalThis.extApi?.tabs) {
  globalThis.extApi.tabs.create({ url: "http://localhost:3000" });
}
});

loadStatus();