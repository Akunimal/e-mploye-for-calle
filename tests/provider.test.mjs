import { describe, expect, it, vi } from "vitest";
import { CalleApiProvider } from "../server/calle-api-provider.mjs";

describe("CALL-E API provider", () => {
  it("constructs an authenticated idempotent create request", async () => {
    const fetchImpl = vi.fn(async (_url, init) => ({ ok: true, status: 201, json: async () => ({ id: "call_123", status: "queued" }), init }));
    const provider = new CalleApiProvider({ apiKey: "test-key", baseUrl: "https://api.example.test", liveEnabled: true, fetchImpl });
    await provider.createCall({ idempotencyKey: "employe_job_1", body: { task: "Call <E164_PHONE>" } });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.example.test/v1/calls");
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Bearer test-key");
    expect(init.headers["idempotency-key"]).toBe("employe_job_1");
    expect(JSON.parse(init.body)).toEqual({ task: "Call <E164_PHONE>" });
  });

  it("refuses live calls when live mode is disabled", async () => {
    const provider = new CalleApiProvider({ apiKey: "test-key", baseUrl: "https://api.example.test", liveEnabled: false, fetchImpl: vi.fn() });
    await expect(provider.createCall({ idempotencyKey: "job-1", body: {} })).rejects.toThrow("disabled");
  });
});
