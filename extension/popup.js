const statusCard = document.getElementById("statusCard");
const refreshBtn = document.getElementById("refreshBtn");
const openSiteBtn = document.getElementById("openSiteBtn");
const versionCard = document.getElementById("versionCard");

const SITE_URL = "https://helpsell.ru";
const DEV_SITE_URL = "http://localhost:3000";
const WEBSTORE_URL =
  "https://chromewebstore.google.com/detail/avitology/oigdilhkhidoinkpkfchkdpbkaobfhng";

async function getSiteUrl() {
  try {
    const result = await globalThis.extApi?.storage?.local.get([
      "helpsellSiteUrl",
    ]);

    const customUrl = result?.helpsellSiteUrl;

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

async function getVersionUrl() {
  const siteUrl = await getSiteUrl();
  return `${siteUrl}/api/extension/version`;
}

async function saveAccessState(data) {
  if (!globalThis.extApi) return;

  await globalThis.extApi.storage.local.set({
    helpsellAccessState: {
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
        Войдите в аккаунт HelpSell на сайте, чтобы использовать расширение.
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

function compareVersions(a, b) {
  const pa = String(a || "").split(".").map(Number);
  const pb = String(b || "").split(".").map(Number);
  const len = Math.max(pa.length, pb.length);

  for (let i = 0; i < len; i++) {
    const av = pa[i] || 0;
    const bv = pb[i] || 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }

  return 0;
}

async function loadSavedState() {
  try {
    const result = await globalThis.extApi?.storage?.local.get([
      "helpsellAccessState",
    ]);

    return result?.helpsellAccessState || null;
  } catch (error) {
    console.error("Failed to load saved state:", error);
    return null;
  }
}

async function loadSavedVersionState() {
  try {
    const result = await globalThis.extApi?.storage?.local.get([
      "helpsellVersionState",
    ]);

    return result?.helpsellVersionState || null;
  } catch (error) {
    console.error("Failed to load saved version state:", error);
    return null;
  }
}

function renderVersionState(versionState) {
  if (!versionCard) return;

  if (!versionState?.isOutdated) {
    versionCard.style.display = "none";
    versionCard.innerHTML = "";
    return;
  }

  versionCard.style.display = "block";
  versionCard.innerHTML = `
    <div class="version-title">Доступно обновление</div>
    <div class="version-text">
      У вас установлена версия <strong>${versionState.currentVersion || "—"}</strong>,
      доступна <strong>${versionState.latestVersion || "—"}</strong>.
    </div>
    <a
      href="${versionState.updateUrl || WEBSTORE_URL}"
      target="_blank"
      rel="noreferrer"
      class="version-update-link"
    >
      Установить обновление
    </a>
  `;
}

async function checkVersion() {
  try {
    const currentVersion =
      globalThis.extApi?.raw?.runtime?.getManifest?.()?.version || null;

    if (!currentVersion) {
      const saved = await loadSavedVersionState();
      renderVersionState(saved);
      return;
    }

    let response;
    let data = null;

    try {
      const versionUrl = await getVersionUrl();
      response = await fetch(versionUrl, { credentials: "omit" });
      data = await response.json();
    } catch {
      response = await fetch(`${DEV_SITE_URL}/api/extension/version`, {
        credentials: "omit",
      });
      data = await response.json();
    }

    if (!response?.ok || !data?.version) {
      const saved = await loadSavedVersionState();
      renderVersionState(saved);
      return;
    }

    const versionState = {
      currentVersion,
      latestVersion: data.version,
      isOutdated: compareVersions(currentVersion, data.version) < 0,
      updateUrl: data.updateUrl || WEBSTORE_URL,
      checkedAt: Date.now(),
    };

    if (globalThis.extApi?.storage?.local) {
      await globalThis.extApi.storage.local.set({
        helpsellVersionState: versionState,
      });
    }

    renderVersionState(versionState);
  } catch (error) {
    console.error("Popup version check failed:", error);
    const saved = await loadSavedVersionState();
    renderVersionState(saved);
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
  refreshBtn.addEventListener("click", async () => {
    await checkAccess();
    await checkVersion();
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

(async () => {
  await checkAccess();
  await checkVersion();
})();