importScripts("ext-api.js");

const ACCESS_URL = "http://localhost:3000/api/extension/access";
const CHECK_INTERVAL_MINUTES = 5;

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

async function checkAccessInBackground() {
  try {
    const response = await fetch(ACCESS_URL, {
      credentials: "include"
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
        subscriptionLevel: null
      });
      return;
    }

    await saveAccessState(data);
  } catch (error) {
    console.error("Avitology background access check failed:", error);
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
    periodInMinutes: CHECK_INTERVAL_MINUTES
  });

  rawApi.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "avitology_access_check") {
      checkAccessInBackground();
    }
  });
}