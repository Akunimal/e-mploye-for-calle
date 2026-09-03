import { isE164 } from "./safety-policy.mjs";

const asBoolean = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return value === "true" || value === "1" || value === "yes";
};

export const getConfig = (env = process.env) => ({
  port: Number(env.EMPLOYE_PORT || 8787),
  host: env.EMPLOYE_HOST || (env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1"),
  stateFile: env.EMPLOYE_STATE_FILE || "./data/state.json",
  calleApiKey: String(env.CALLE_API_KEY || "").trim(),
  calleBaseUrl: (env.CALLE_BASE_URL || "https://api.heycall-e.com").replace(/\/+$/, ""),
  calleLiveEnabled: asBoolean(env.CALLE_LIVE_ENABLED),
  calleTestPhone: String(env.CALLE_TEST_PHONE || "").trim(),
  calleTestEmployeeId: env.CALLE_TEST_EMPLOYEE_ID || "emp-ana",
  calleTestRegion: env.CALLE_TEST_REGION || "",
  calleTestLocale: env.CALLE_TEST_LOCALE || "",
  defaultLanguage: env.CALLE_DEFAULT_LANGUAGE || "en-US",
  defaultRegion: env.CALLE_DEFAULT_REGION || "MX",
});

export const liveReadiness = (config) => ({
  requested: Boolean(config.calleLiveEnabled),
  apiKeyConfigured: Boolean(String(config.calleApiKey || "").trim()),
  testPhoneConfigured: isE164(config.calleTestPhone),
});

export const isLiveReady = (config) => {
  const readiness = liveReadiness(config);
  return readiness.requested && readiness.apiKeyConfigured && readiness.testPhoneConfigured;
};

export const publicRuntimeConfig = (config) => {
  const readiness = liveReadiness(config);
  const liveReady = isLiveReady(config);
  return {
    provider: liveReady ? "live" : "fake",
    liveEnabled: liveReady,
    liveRequested: readiness.requested,
    liveReady,
    apiKeyConfigured: readiness.apiKeyConfigured,
    testPhoneConfigured: readiness.testPhoneConfigured,
    baseUrl: config.calleBaseUrl,
    testEmployeeId: config.calleTestEmployeeId || "",
    language: config.calleTestLocale || config.defaultLanguage,
    region: config.calleTestRegion || config.defaultRegion,
  };
};
