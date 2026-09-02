(function () {
  const rawApi =
    (typeof globalThis !== "undefined" && (globalThis.browser || globalThis.chrome)) ||
    null;

  if (!rawApi) {
    console.error("HelpSell: browser extension API not found");
    globalThis.extApi = null;
    return;
  }

  function promisifyChromeStorageArea(storageArea) {
    return {
      get(keys) {
        return new Promise((resolve, reject) => {
          try {
            storageArea.get(keys, (result) => {
              const err = rawApi.runtime && rawApi.runtime.lastError;
              if (err) reject(err);
              else resolve(result);
            });
          } catch (error) {
            reject(error);
          }
        });
      },
      set(items) {
        return new Promise((resolve, reject) => {
          try {
            storageArea.set(items, () => {
              const err = rawApi.runtime && rawApi.runtime.lastError;
              if (err) reject(err);
              else resolve();
            });
          } catch (error) {
            reject(error);
          }
        });
      },
      remove(keys) {
        return new Promise((resolve, reject) => {
          try {
            storageArea.remove(keys, () => {
              const err = rawApi.runtime && rawApi.runtime.lastError;
              if (err) reject(err);
              else resolve();
            });
          } catch (error) {
            reject(error);
          }
        });
      }
    };
  }

  function promisifyChromeTabs(tabsApi) {
    return {
      create(createProperties) {
        return new Promise((resolve, reject) => {
          try {
            tabsApi.create(createProperties, (tab) => {
              const err = rawApi.runtime && rawApi.runtime.lastError;
              if (err) reject(err);
              else resolve(tab);
            });
          } catch (error) {
            reject(error);
          }
        });
      }
    };
  }

  const isPromiseStyleStorage =
    rawApi.storage &&
    rawApi.storage.local &&
    typeof rawApi.storage.local.get === "function" &&
    rawApi.storage.local.get.length <= 1;

  const storageLocal = isPromiseStyleStorage
    ? rawApi.storage.local
    : promisifyChromeStorageArea(rawApi.storage.local);

  const tabs =
    rawApi.tabs && typeof rawApi.tabs.create === "function"
      ? rawApi.tabs.create.length <= 1
        ? rawApi.tabs
        : promisifyChromeTabs(rawApi.tabs)
      : null;

  globalThis.extApi = {
    raw: rawApi,
    storage: {
      local: storageLocal
    },
    tabs
  };
})();