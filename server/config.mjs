const asBoolean = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return value === "true" || value === "1" || value === "yes";
};

export const getConfig = (env = process.env) => ({
  port: Number(env.EMPLOYE_PORT || 8787),
  stateFile: env.EMPLOYE_STATE_FILE || "./data/state.json",
  calleApiKey: env.CALLE_API_KEY || "",
  calleBaseUrl: (env.CALLE_BASE_URL || "https://api.heycall-e.com").replace(/\/+$/, ""),
  calleLiveEnabled: asBoolean(env.CALLE_LIVE_ENABLED),
  calleTestPhone: env.CALLE_TEST_PHONE || "",
  calleTestEmployeeId: env.CALLE_TEST_EMPLOYEE_ID || "emp-ana",
  defaultLanguage: env.CALLE_DEFAULT_LANGUAGE || "en-US",
  defaultRegion: env.CALLE_DEFAULT_REGION || "MX",
});

export const publicRuntimeConfig = (config) => ({
  provider: config.calleLiveEnabled ? "live" : "fake",
  liveEnabled: config.calleLiveEnabled,
  language: config.defaultLanguage,
  region: config.defaultRegion,
});
