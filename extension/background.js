importScripts("ext-api.js");

const SITE_URL =
  "https://avitology.site";

const DEV_SITE_URL =
  "http://localhost:3000";

const ACCESS_URL =
  `${SITE_URL}/api/extension/access`;

const DEV_ACCESS_URL =
  `${DEV_SITE_URL}/api/extension/access`;

const CHECK_INTERVAL_MINUTES = 5;

async function getAccessUrl() {
  try {
    const result = await globalThis.extApi?.storage?.local.get([
      "avitologySiteUrl",
    ]);

    const customUrl = result?.avitologySiteUrl;

    if (customUrl && typeof customUrl === "string") {
      return `${customUrl.replace(/\/$/, "")}/api/extension/access`;
    }
  } catch (error) {
    console.error("Failed to read custom site url:", error);
  }

  return ACCESS_URL;
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
    console.error("Avitology background access check failed:", error);

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
      console.error("Avitology dev fallback access check failed:", devError);
    }
  }
}

const rawApi = globalThis.extApi?.raw;

if (rawApi?.runtime?.onInstalled) {
  rawApi.runtime.onInstalled.addListener(() => {
    checkAccessInBackground();
  });
}

if (rawApi?.runtime?.onStartup) {
  rawApi.runtime.onStartup.addListener(() => {
    checkAccessInBackground();
  });
}

if (rawApi?.alarms) {
  rawApi.alarms.create("avitology_access_check", {
    periodInMinutes: CHECK_INTERVAL_MINUTES,
  });

  rawApi.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "avitology_access_check") {
      checkAccessInBackground();
    }
  });
}