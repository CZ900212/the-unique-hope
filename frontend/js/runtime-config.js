(function initUniqueHopeRuntimeConfig() {
  const runtimeConfig = window.UNIQUE_HOPE_RUNTIME_CONFIG || {};
  const metaApiBase = document
    .querySelector('meta[name="unique-hope-api-base"]')
    ?.getAttribute("content")
    ?.trim();

  if (!runtimeConfig.apiBase && metaApiBase) {
    runtimeConfig.apiBase = metaApiBase;
  }

  window.UNIQUE_HOPE_RUNTIME_CONFIG = runtimeConfig;
})();
