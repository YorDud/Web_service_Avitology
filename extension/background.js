importScripts("ext-api.js");

const SITE_URL =
  "https://helpsell.ru";

const DEV_SITE_URL =
  "http://localhost:3000";

const EXTENSION_VERSION_URL = `${SITE_URL}/api/extension/version`;
const DEV_EXTENSION_VERSION_URL = `${DEV_SITE_URL}/api/extension/version`;

const ACCESS_URL =
  `${SITE_URL}/api/extension/access`;

const DEV_ACCESS_URL =
  `${DEV_SITE_URL}/api/extension/access`;

const CHECK_INTERVAL_MINUTES = 5;

async function getAccessUrl() {
  try {
    const result = await globalThis.extApi?.storage?.local.get([
      "helpsellSiteUrl",
    ]);

    const customUrl = result?.helpsellSiteUrl;

    if (customUrl && typeof customUrl === "string") {
      return `${customUrl.replace(/\/$/, "")}/api/extension/access`;
    }
  } catch (error) {
    console.error("Failed to read custom site url:", error);
  }

  return ACCESS_URL;
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

async function checkExtensionVersion() {
  try {
    const currentVersion =
      rawApi?.runtime?.getManifest?.()?.version || null;

    if (!currentVersion) return;

    let response;
    let data = null;

    try {
      response = await fetch(EXTENSION_VERSION_URL, { credentials: "omit" });
      data = await response.json();
    } catch {
      response = await fetch(DEV_EXTENSION_VERSION_URL, { credentials: "omit" });
      data = await response.json();
    }

    if (!response?.ok || !data?.version) return;

    const isOutdated = compareVersions(currentVersion, data.version) < 0;

    await globalThis.extApi.storage.local.set({
      helpsellVersionState: {
        currentVersion,
        latestVersion: data.version,
        isOutdated,
        updateUrl:
          data.updateUrl ||
          "https://chromewebstore.google.com/detail/avitology/oigdilhkhidoinkpkfchkdpbkaobfhng",
        checkedAt: Date.now(),
      },
    });
  } catch (error) {
    console.error("Failed to check extension version:", error);
  }
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

async function checkAccessInBackground() {
  try {
    const url = await getAccessUrl();

    const response = await fetch(url, {
      credentials: "include",
    });

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok || !data) {
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

    try {
      const response = await fetch(DEV_ACCESS_URL, {
        credentials: "include",
      });

      let data = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok || !data) {
        await saveAccessState({
          authenticated: false,
          access: false,
          subscriptionLevel: null,
        });
        return;
      }

      await saveAccessState(data);
    } catch (devError) {
      console.error("HelpSell dev fallback access check failed:", devError);
    }
  }
}

const rawApi = globalThis.extApi?.raw;

if (rawApi?.runtime?.onInstalled) {
  rawApi.runtime.onInstalled.addListener(() => {
    checkAccessInBackground();
    checkExtensionVersion();
  });
}

if (rawApi?.runtime?.onStartup) {
  rawApi.runtime.onStartup.addListener(() => {
    checkAccessInBackground();
    checkExtensionVersion();
  });
}

if (rawApi?.alarms) {
  rawApi.alarms.create("helpsell_access_check", {
    periodInMinutes: CHECK_INTERVAL_MINUTES,
  });

  rawApi.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "helpsell_access_check") {
      checkAccessInBackground();
      checkExtensionVersion();
    }
  });
}