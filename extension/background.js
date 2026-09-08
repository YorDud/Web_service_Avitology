importScripts("ext-api.js");

const SITE_URL = "https://helpsell.ru";
const DEV_SITE_URL = "http://localhost:3000";

const CHECK_INTERVAL_MINUTES = 5;

const WEBSTORE_URL =
  "https://chromewebstore.google.com/detail/avitology/oigdilhkhidoinkpkfchkdpbkaobfhng";

const rawApi = globalThis.extApi?.raw;

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
    console.error("Failed to read custom site URL:", error);
  }

  return SITE_URL;
}

async function getExtensionToken() {
  try {
    const result = await globalThis.extApi?.storage?.local.get([
      "helpsellExtensionApiToken",
    ]);

    return result?.helpsellExtensionApiToken || null;
  } catch (error) {
    console.error("Failed to read extension token:", error);
    return null;
  }
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

async function saveAccessState(data) {
  if (!globalThis.extApi?.storage?.local) return;

  await globalThis.extApi.storage.local.set({
    helpsellAccessState: {
      authenticated: !!data.authenticated,
      access: !!data.access,
      subscriptionLevel: data.subscriptionLevel || null,
      updatedAt: Date.now(),
    },
  });
}

async function saveVersionState(data) {
  if (!globalThis.extApi?.storage?.local) return;

  await globalThis.extApi.storage.local.set({
    helpsellVersionState: {
      currentVersion: data.currentVersion || null,
      latestVersion: data.latestVersion || null,
      isOutdated: !!data.isOutdated,
      updateUrl: data.updateUrl || WEBSTORE_URL,
      checkedAt: Date.now(),
    },
  });
}

async function fetchJsonWithFallback(primaryUrl, fallbackUrl, options = {}) {
  try {
    const response = await fetch(primaryUrl, options);
    const data = await response.json().catch(() => null);

    return {
      response,
      data,
      usedUrl: primaryUrl,
    };
  } catch (error) {
    console.warn("Primary request failed:", primaryUrl, error);

    const response = await fetch(fallbackUrl, options);
    const data = await response.json().catch(() => null);

    return {
      response,
      data,
      usedUrl: fallbackUrl,
    };
  }
}

async function checkAccessInBackground() {
  try {
    const siteUrl = await getSiteUrl();

    const primaryUrl = `${siteUrl}/api/extension/access`;
    const fallbackUrl = `${DEV_SITE_URL}/api/extension/access`;

    const { response, data } = await fetchJsonWithFallback(
      primaryUrl,
      fallbackUrl,
      {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response?.ok || !data) {
      await saveAccessState({
        authenticated: false,
        access: false,
        subscriptionLevel: null,
      });
      return;
    }

    await saveAccessState(data);
  } catch (error) {
    console.error("HelpSell background access check failed:", error);

    await saveAccessState({
      authenticated: false,
      access: false,
      subscriptionLevel: null,
    });
  }
}

async function checkExtensionVersion() {
  try {
    const currentVersion = rawApi?.runtime?.getManifest?.()?.version || null;

    if (!currentVersion) return;

    const siteUrl = await getSiteUrl();

    const primaryUrl = `${siteUrl}/api/extension/version`;
    const fallbackUrl = `${DEV_SITE_URL}/api/extension/version`;

    const { response, data } = await fetchJsonWithFallback(
      primaryUrl,
      fallbackUrl,
      {
        method: "GET",
        credentials: "omit",
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response?.ok || !data?.version) return;

    await saveVersionState({
      currentVersion,
      latestVersion: data.version,
      isOutdated: compareVersions(currentVersion, data.version) < 0,
      updateUrl: data.updateUrl || WEBSTORE_URL,
    });
  } catch (error) {
    console.error("Failed to check extension version:", error);
  }
}

async function saveAnalysisInBackground(payload) {
  const siteUrl = await getSiteUrl();
  const token = await getExtensionToken();

  if (!token) {
    return {
      ok: false,
      error:
        "Не найден токен расширения. Откройте popup расширения и нажмите «Обновить статус».",
    };
  }

  const primaryUrl = `${siteUrl}/api/extension/avito-search-analyses`;
  const fallbackUrl = `${DEV_SITE_URL}/api/extension/avito-search-analyses`;

  try {
    const { response, data, usedUrl } = await fetchJsonWithFallback(
      primaryUrl,
      fallbackUrl,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response?.ok) {
      return {
        ok: false,
        error: data?.error || `Ошибка сохранения (${response?.status || "unknown"})`,
        status: response?.status || null,
        usedUrl,
      };
    }

    return {
      ok: true,
      data,
      usedUrl,
    };
  } catch (error) {
    console.error("HelpSell background save failed:", error);

    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Не удалось выполнить запрос на сохранение",
    };
  }
}

function setupMessageListener() {
  if (!rawApi?.runtime?.onMessage) return;

  rawApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message !== "object") return;

    if (message.type === "helpsell_save_analysis") {
      saveAnalysisInBackground(message.payload)
        .then((result) => {
          sendResponse(result);
        })
        .catch((error) => {
          console.error("Message save handler failed:", error);
          sendResponse({
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : "Неизвестная ошибка сохранения",
          });
        });

      return true;
    }
  });
}

async function runBackgroundChecks() {
  await Promise.allSettled([checkAccessInBackground(), checkExtensionVersion()]);
}

setupMessageListener();

if (rawApi?.runtime?.onInstalled) {
  rawApi.runtime.onInstalled.addListener(() => {
    runBackgroundChecks();
  });
}

if (rawApi?.runtime?.onStartup) {
  rawApi.runtime.onStartup.addListener(() => {
    runBackgroundChecks();
  });
}

if (rawApi?.alarms) {
  rawApi.alarms.create("helpsell_access_check", {
    periodInMinutes: CHECK_INTERVAL_MINUTES,
  });

  rawApi.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "helpsell_access_check") {
      runBackgroundChecks();
    }
  });
}

runBackgroundChecks();