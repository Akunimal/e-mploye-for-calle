const metadataFor = (request) => request.metadata || request.body?.metadata || {};

const outcomeResult = (outcome, request) => {
  const metadata = metadataFor(request);
  const date = metadata.requested_date || "";
  const time = metadata.requested_time || "";
  const alternateDate = metadata.alternate_date || "2026-09-08";
  const alternateTime = metadata.alternate_time || "10:00";
  const results = {
    confirmed: {
      outcome: "confirmed",
      requested_date: "",
      requested_time: "",
      employee_message: "The employee confirmed the proposed shift.",
      confidence: 0.96,
      needs_manager_review: false,
    },
    reschedule_requested: {
      outcome: "reschedule_requested",
      requested_date: alternateDate,
      requested_time: alternateTime,
      employee_message: "The employee requested an alternate date and time.",
      confidence: 0.91,
      needs_manager_review: true,
    },
    declined: {
      outcome: "declined",
      requested_date: "",
      requested_time: "",
      employee_message: "The employee declined the proposed shift.",
      confidence: 0.94,
      needs_manager_review: true,
    },
    unknown: {
      outcome: "unknown",
      requested_date: "",
      requested_time: "",
      employee_message: "The call did not establish a reliable scheduling answer.",
      confidence: 0.31,
      needs_manager_review: true,
    },
  };
  return { ...results[outcome] || results.unknown, proposed_date: date, proposed_time: time };
};

export class FakeCallProvider {
  constructor({ clock = () => Date.now(), queuedMs = 250, inProgressMs = 700 } = {}) {
    this.name = "fake";
    this.clock = clock;
    this.queuedMs = queuedMs;
    this.inProgressMs = inProgressMs;
    this.calls = new Map();
    this.idempotency = new Map();
  }

  createCall(request) {
    const existingId = this.idempotency.get(request.idempotencyKey);
    if (existingId) return this.getCall(existingId);
    const id = `call_fake_${Date.now()}_${this.calls.size + 1}`;
    this.idempotency.set(request.idempotencyKey, id);
    this.calls.set(id, { id, request, createdAt: this.clock(), canceled: false });
    return this.getCall(id);
  }

  getCall(id) {
    const call = this.calls.get(id);
    if (!call) throw new Error("Fake call not found");
    if (call.canceled) return this.response(call, "canceled");
    const elapsed = this.clock() - call.createdAt;
    const outcome = metadataFor(call.request).fake_outcome || "confirmed";
    if (outcome === "failed" && elapsed >= this.inProgressMs) return this.response(call, "failed");
    if (elapsed < this.queuedMs) return this.response(call, "queued");
    if (elapsed < this.inProgressMs) return this.response(call, "in_progress");
    return this.response(call, "completed");
  }

  cancel(id) {
    const call = this.calls.get(id);
    if (!call) throw new Error("Fake call not found");
    call.canceled = true;
    return this.getCall(id);
  }

  response(call, status) {
    const outcome = metadataFor(call.request).fake_outcome || "confirmed";
    const result = status === "completed" ? outcomeResult(outcome, call.request) : null;
    const transcript = status === "completed" ? [
      { speaker: "bot", text: `Hello. I am calling about your shift on ${metadataFor(call.request).requested_date} at ${metadataFor(call.request).requested_time}.` },
      { speaker: "user", text: result?.employee_message || "The call did not complete." },
    ] : [];
    return {
      id: call.id,
      status,
      structured_result: result,
      summary: result?.employee_message || (status === "failed" ? "The simulated provider failed." : null),
      evidence: result ? [result.employee_message] : [],
      transcript_turns: transcript,
      failure_code: status === "failed" ? "fake_provider_failure" : null,
      failure_message: status === "failed" ? "The selected fake scenario simulates a provider failure." : null,
      metadata: call.request.metadata,
    };
  }
}
