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
    };
  } catch (error) {
    console.warn("Primary request failed:", primaryUrl, error);

    const response = await fetch(fallbackUrl, options);
    const data = await response.json().catch(() => null);

    return {
      response,
      data,
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
    const currentVersion =
      rawApi?.runtime?.getManifest?.()?.version || null;

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

async function runBackgroundChecks() {
  await Promise.allSettled([
    checkAccessInBackground(),
    checkExtensionVersion(),
  ]);
}

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