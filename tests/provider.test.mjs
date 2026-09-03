import { describe, expect, it, vi } from "vitest";
import { CalleApiProvider } from "../server/calle-api-provider.mjs";
import { FakeCallProvider } from "../server/fake-call-provider.mjs";

describe("CALL-E API provider", () => {
  it("returns the same fake call for a repeated idempotency key", () => {
    let now = 1000;
    const provider = new FakeCallProvider({ clock: () => now, queuedMs: 0, inProgressMs: 5000 });
    const request = { idempotencyKey: "job-1", body: { metadata: { fake_outcome: "confirmed" } } };
    const first = provider.createCall(request);
    const second = provider.createCall(request);
    expect(second.id).toBe(first.id);
    now = 4500;
    expect(provider.getCall(first.id).status).toBe("in_progress");
  });

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

  it("preserves structured provider errors instead of rendering object text", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 422, json: async () => ({ error: { code: "unsupported_region", message: "Unsupported destination" } }) }));
    const provider = new CalleApiProvider({ apiKey: "test-key", baseUrl: "https://api.example.test", liveEnabled: true, fetchImpl });
    await expect(provider.createCall({ idempotencyKey: "job-1", body: {} })).rejects.toThrow("unsupported_region");
  });
});
