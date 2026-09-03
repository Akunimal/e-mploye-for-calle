import { sanitizeError } from "./safety-policy.mjs";

export class CalleApiProvider {
  constructor({ apiKey, baseUrl, liveEnabled, fetchImpl = fetch, timeoutMs = 30000 }) {
    this.name = "live";
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.liveEnabled = liveEnabled;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async request(path, { method = "GET", body, idempotencyKey } = {}) {
    if (!this.liveEnabled) throw new Error("Live CALL-E mode is disabled");
    if (!this.apiKey) throw new Error("CALLE_API_KEY is required for live mode");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
          ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || payload?.error || `CALL-E returned HTTP ${response.status}`);
      return payload;
    } catch (error) {
      throw new Error(sanitizeError(error));
    } finally {
      clearTimeout(timer);
    }
  }

  createCall(request) {
    return this.request("/v1/calls", { method: "POST", body: request.body, idempotencyKey: request.idempotencyKey });
  }

  getCall(id) {
    return this.request(`/v1/calls/${encodeURIComponent(id)}`);
  }

  getEvents(id) {
    return this.request(`/v1/calls/${encodeURIComponent(id)}/events`);
  }

  async cancel() {
    throw new Error("CALL-E cancellation is not available in the current API contract");
  }
}
