const statusCard = document.getElementById("statusCard");
const refreshBtn = document.getElementById("refreshBtn");
const openSiteBtn = document.getElementById("openSiteBtn");

const SITE_URL = "https://avitology.site";
const DEV_SITE_URL = "http://localhost:3000";

async function getSiteUrl() {
  try {
    const result = await globalThis.extApi?.storage?.local.get([
      "avitologySiteUrl",
    ]);

    const customUrl = result?.avitologySiteUrl;

    if (customUrl && typeof customUrl === "string") {
      return customUrl.replace(/\/$/, "");
    }
  } catch (error) {
    console.error("Failed to read custom site url:", error);
  }

  return SITE_URL;
}

async function getAccessUrl() {
  const siteUrl = await getSiteUrl();
  return `${siteUrl}/api/extension/access`;
}

async function saveAccessState(data) {
  if (!globalThis.extApi) return;

  await globalThis.extApi.storage.local.set({
    avitologyAccessState: {
      authenticated: !!data.authenticated,
      access: !!data.access,
      subscriptionLevel: data.subscriptionLevel || null,
      updatedAt: Date.now(),
    },
  });
}

function renderStatus(data) {
  if (!statusCard) return;

  if (!data || !data.authenticated) {
    statusCard.innerHTML = `
      <div class="status-title">Требуется вход</div>
      <div class="status-text">
        Войдите в аккаунт Avitology на сайте, чтобы использовать расширение.
      </div>
    `;
    return;
  }

  if (data.access) {
    statusCard.innerHTML = `
      <div class="status-title">Доступ открыт</div>
      <div class="status-text">
        Ваш уровень доступа: <strong>${data.subscriptionLevel || "basic"}</strong>.
        Расширение готово к работе.
      </div>
    `;
    return;
  }

  statusCard.innerHTML = `
    <div class="status-title">Доступ ограничен</div>
    <div class="status-text">
      Для использования расширения требуется активный доступ к сервису.
    </div>
  `;
}

async function loadSavedState() {
  try {
    const result = await globalThis.extApi?.storage?.local.get([
      "avitologyAccessState",
    ]);

    return result?.avitologyAccessState || null;
  } catch (error) {
    console.error("Failed to load saved state:", error);
    return null;
  }
}

async function checkAccess() {
  try {
    const accessUrl = await getAccessUrl();

    const response = await fetch(accessUrl, {
      credentials: "include",
    });

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok || !data) {
      renderStatus({
        authenticated: false,
        access: false,
        subscriptionLevel: null,
      });

      await saveAccessState({
        authenticated: false,
        access: false,
        subscriptionLevel: null,
      });

      return;
    }

    renderStatus(data);
    await saveAccessState(data);
  } catch (error) {
    console.error("Popup access check failed:", error);

    try {
      const response = await fetch(`${DEV_SITE_URL}/api/extension/access`, {
        credentials: "include",
      });

      let data = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok || !data) {
        const savedState = await loadSavedState();
        renderStatus(savedState);
        return;
      }

      renderStatus(data);
      await saveAccessState(data);
    } catch (devError) {
      console.error("Popup dev fallback failed:", devError);
      const savedState = await loadSavedState();
      renderStatus(savedState);
    }
  }
}

if (refreshBtn) {
  refreshBtn.addEventListener("click", () => {
    checkAccess();
  });
}

if (openSiteBtn) {
  openSiteBtn.addEventListener("click", async () => {
    const siteUrl = await getSiteUrl();

    if (globalThis.extApi?.raw?.tabs?.create) {
      globalThis.extApi.raw.tabs.create({
        url: `${siteUrl}/extension`,
      });
      return;
    }

    window.open(`${siteUrl}/extension`, "_blank");
  });
}

checkAccess();