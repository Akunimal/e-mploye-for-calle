import assert from "node:assert/strict";

const base = (process.env.PUBLIC_DEMO_URL || "https://e-mploye-for-calle.vercel.app").replace(/\/+$/, "");
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const request = async (path, init = {}) => {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
};

const post = async (path, body = {}) => {
  const result = await request(path, { method: "POST", body: JSON.stringify(body) });
  assert.equal(result.response.ok, true, `${path} failed: ${JSON.stringify(result.body)}`);
  return result.body;
};

const jobFor = (state, id) => state.jobs.find((job) => job.id === id);
const create = (employeeId, shiftId, fakeOutcome, workflowType = "shift_coordination") => post("/api/jobs", { employeeId, shiftId, fakeOutcome, workflowType });

const run = async () => {
  const page = await fetch(base);
  assert.equal(page.ok, true);
  assert.match(await page.text(), /E-mploye/);

  const health = (await request("/api/health")).body;
  assert.equal(health.ok, true);
  assert.equal(health.runtime.provider, "fake");
  assert.equal(health.runtime.workflows.length, 3);
  await post("/api/reset");

  const preview = await post("/api/jobs/preview", { employeeId: "emp-ana", shiftId: "shift-ana-1", fakeOutcome: "reschedule_requested" });
  assert.equal(preview.safety.ok, true);
  assert.equal(preview.workflowType, "shift_coordination");

  const reschedule = await create("emp-ana", "shift-ana-1", "reschedule_requested", "appointment_management");
  const rescheduleId = reschedule.jobs[0].id;
  await post(`/api/jobs/${rescheduleId}/approve`);
  await wait(900);
  const rescheduleReview = await post(`/api/jobs/${rescheduleId}/refresh`);
  assert.equal(jobFor(rescheduleReview, rescheduleId).result.outcome, "reschedule_requested");
  const rescheduleApplied = await post(`/api/jobs/${rescheduleId}/apply`);
  assert.equal(jobFor(rescheduleApplied, rescheduleId).status, "applied");
  assert.equal(rescheduleApplied.shifts.find((shift) => shift.id === "shift-ana-1").status, "rescheduled");

  const confirmed = await create("emp-diego", "shift-diego-1", "confirmed", "lead_follow_up");
  const confirmedId = confirmed.jobs[0].id;
  await post(`/api/jobs/${confirmedId}/approve`);
  await wait(900);
  await post(`/api/jobs/${confirmedId}/refresh`);
  const confirmedApplied = await post(`/api/jobs/${confirmedId}/apply`);
  assert.equal(jobFor(confirmedApplied, confirmedId).status, "applied");
  assert.equal(confirmedApplied.shifts.find((shift) => shift.id === "shift-diego-1").status, "confirmed");

  const declined = await create("emp-lucia", "shift-lucia-1", "declined");
  const declinedId = declined.jobs[0].id;
  await post(`/api/jobs/${declinedId}/approve`);
  await wait(900);
  await post(`/api/jobs/${declinedId}/refresh`);
  const declinedRejected = await post(`/api/jobs/${declinedId}/reject`);
  assert.equal(jobFor(declinedRejected, declinedId).status, "rejected");
  assert.equal(declinedRejected.shifts.find((shift) => shift.id === "shift-lucia-1").status, "scheduled");

  const unknown = await create("emp-ana", "shift-ana-1", "unknown");
  const unknownId = unknown.jobs[0].id;
  await post(`/api/jobs/${unknownId}/approve`);
  await wait(900);
  const unknownReview = await post(`/api/jobs/${unknownId}/refresh`);
  assert.equal(jobFor(unknownReview, unknownId).result.outcome, "unknown");
  const blockedApply = await request(`/api/jobs/${unknownId}/apply`, { method: "POST", body: "{}" });
  assert.equal(blockedApply.response.status, 400);
  await post(`/api/jobs/${unknownId}/reject`);

  const failed = await create("emp-diego", "shift-diego-1", "failed");
  const failedId = failed.jobs[0].id;
  await post(`/api/jobs/${failedId}/approve`);
  await wait(900);
  const failedReview = await post(`/api/jobs/${failedId}/refresh`);
  const failedJob = jobFor(failedReview, failedId);
  assert.equal(failedJob.status, "failed");
  assert.equal(failedJob.failureCode, "fake_provider_failure");
  const retry = await post(`/api/jobs/${failedId}/retry`);
  assert.equal(jobFor(retry, failedId).providerCallId, failedJob.providerCallId);

  const cancel = await create("emp-lucia", "shift-lucia-1", "confirmed");
  const cancelId = cancel.jobs[0].id;
  const queued = await post(`/api/jobs/${cancelId}/approve`);
  assert.ok(["queued", "in_progress"].includes(jobFor(queued, cancelId).status));
  const canceled = await post(`/api/jobs/${cancelId}/cancel`);
  assert.equal(jobFor(canceled, cancelId).status, "canceled");
  assert.equal(canceled.shifts.find((shift) => shift.id === "shift-lucia-1").status, "scheduled");

  await post("/api/reset");
  console.log(JSON.stringify({ ok: true, base, scenarios: 6, finalJobs: 0 }));
};

run().catch(async (error) => {
  try { await post("/api/reset"); } catch { /* preserve the original failure */ }
  console.error(error);
  process.exitCode = 1;
});
