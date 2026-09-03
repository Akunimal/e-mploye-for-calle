import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { createWorkflow } from "../server/call-workflow.mjs";
import { FakeCallProvider } from "../server/fake-call-provider.mjs";
import { JsonStateStore } from "../server/persistence.mjs";

const dirs = [];
const make = () => {
  const directory = mkdtempSync(path.join(tmpdir(), "employe-workflow-")); dirs.push(directory);
  let tick = 0; const clock = () => new Date(2026, 8, 3, 10, 0, tick++).toISOString();
  const provider = new FakeCallProvider({ clock: () => 1000 + tick * 1000, queuedMs: 0, inProgressMs: 0 });
  return { workflow: createWorkflow({ store: new JsonStateStore(path.join(directory, "state.json"), () => ({ version: 1, employees: [{ id: "emp-ana", name: "Ana", role: "Support", phone: "+15550101001", locale: "en-US", region: "MX" }], shifts: [{ id: "shift-1", employeeId: "emp-ana", date: "2026-09-07", startTime: "09:00", endTime: "17:00", role: "Support", status: "scheduled" }], jobs: [], approvals: [], events: [] })), provider, clock }) , provider };
};
afterEach(() => { while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true }); });

describe("E-mploye workflow engine", () => {
  it("uses one E-mploye identity across multiple business workflows", async () => {
    for (const [workflowType, outcome, keyword] of [
      ["appointment_management", "reschedule_requested", "appointment"],
      ["lead_follow_up", "confirmed", "follow-up"],
      ["shift_coordination", "declined", "shift"],
    ]) {
      const { workflow } = make();
      const preview = workflow.preview({ employeeId: "emp-ana", shiftId: "shift-1", workflowType });
      expect(preview.workflowType).toBe(workflowType);
      expect(preview.task.toLowerCase()).toContain(keyword);
      const created = workflow.createJob({ employeeId: "emp-ana", shiftId: "shift-1", workflowType, fakeOutcome: outcome });
      const jobId = created.jobs[0].id;
      expect(created.jobs[0].workflowType).toBe(workflowType);
      await workflow.approve(jobId);
      const reviewed = await workflow.refresh(jobId);
      expect(reviewed.jobs[0].result.contact_message).toBeTruthy();
    }
  });

  it("resolves every fake outcome for every task template", async () => {
    const workflows = ["appointment_management", "lead_follow_up", "shift_coordination"];
    const outcomes = ["confirmed", "reschedule_requested", "declined", "unknown"];
    for (const workflowType of workflows) {
      for (const fakeOutcome of outcomes) {
        const { workflow } = make();
        const created = workflow.createJob({ employeeId: "emp-ana", shiftId: "shift-1", workflowType, fakeOutcome });
        const jobId = created.jobs[0].id;
        await workflow.approve(jobId);
        const reviewed = await workflow.refresh(jobId);
        const job = reviewed.jobs[0];
        expect(job.workflowType).toBe(workflowType);
        expect(job.outcome).toBe(fakeOutcome);
        expect(job.result.contact_message).toBeTruthy();
        if (["confirmed", "reschedule_requested"].includes(fakeOutcome)) {
          const applied = workflow.apply(jobId);
          expect(applied.jobs[0].status).toBe("applied");
          expect(applied.approvals[0].status).toBe("approved");
        } else {
          expect(() => workflow.apply(jobId)).toThrow("cannot be applied");
          const rejected = workflow.reject(jobId);
          expect(rejected.jobs[0].status).toBe("rejected");
          expect(rejected.approvals[0].status).toBe("rejected");
        }
      }
    }
  });

  it("surfaces the provider failure state for every task template", async () => {
    for (const workflowType of ["appointment_management", "lead_follow_up", "shift_coordination"]) {
      const { workflow } = make();
      const created = workflow.createJob({ employeeId: "emp-ana", shiftId: "shift-1", workflowType, fakeOutcome: "failed" });
      const jobId = created.jobs[0].id;
      const approved = await workflow.approve(jobId);
      expect(approved.jobs[0]).toMatchObject({ workflowType, status: "failed", failureCode: "fake_provider_failure" });
      const refreshed = await workflow.refresh(jobId);
      expect(refreshed.jobs[0]).toMatchObject({ workflowType, status: "failed", failureCode: "fake_provider_failure" });
      expect(refreshed.approvals[0].status).toBe("approved");
      expect(refreshed.shifts[0].status).toBe("scheduled");
    }
  });

  it("requires approval, returns structured evidence, and applies a reschedule", async () => {
    const { workflow } = make();
    const created = workflow.createJob({ employeeId: "emp-ana", shiftId: "shift-1", proposedDate: "2026-09-07", proposedTime: "09:00", fakeOutcome: "reschedule_requested" });
    const jobId = created.jobs[0].id;
    expect(created.jobs[0].status).toBe("awaiting_approval");
    const approved = await workflow.approve(jobId);
    expect(approved.jobs[0].providerCallId).toMatch(/^call_fake_/);
    const reviewed = await workflow.refresh(jobId);
    expect(reviewed.jobs[0].status).toBe("needs_review");
    expect(reviewed.jobs[0].result.outcome).toBe("reschedule_requested");
    const applied = workflow.apply(jobId);
    expect(applied.jobs[0].status).toBe("applied");
    expect(applied.shifts[0]).toMatchObject({ status: "rescheduled", date: "2026-09-08", startTime: "10:00", endTime: "18:00" });
  });

  it("keeps a declined result from mutating the shift", async () => {
    const { workflow } = make();
    const created = workflow.createJob({ employeeId: "emp-ana", shiftId: "shift-1", fakeOutcome: "declined" });
    const jobId = created.jobs[0].id;
    await workflow.approve(jobId); const reviewed = await workflow.refresh(jobId);
    expect(reviewed.jobs[0].outcome).toBe("declined");
    expect(() => workflow.apply(jobId)).toThrow("cannot be applied");
    expect(workflow.state().shifts[0].status).toBe("scheduled");
  });

  it("applies a confirmed result without changing the shift time", async () => {
    const { workflow } = make();
    const created = workflow.createJob({ employeeId: "emp-ana", shiftId: "shift-1", fakeOutcome: "confirmed" });
    const jobId = created.jobs[0].id;
    await workflow.approve(jobId);
    const reviewed = await workflow.refresh(jobId);
    expect(reviewed.jobs[0].result.outcome).toBe("confirmed");
    const applied = workflow.apply(jobId);
    expect(applied.jobs[0].status).toBe("applied");
    expect(applied.shifts[0]).toMatchObject({ status: "confirmed", date: "2026-09-07", startTime: "09:00" });
  });

  it("rejects a completed result and keeps the shift unchanged", async () => {
    const { workflow } = make();
    const created = workflow.createJob({ employeeId: "emp-ana", shiftId: "shift-1", fakeOutcome: "confirmed" });
    const jobId = created.jobs[0].id;
    await workflow.approve(jobId);
    await workflow.refresh(jobId);
    const rejected = workflow.reject(jobId);
    expect(rejected.jobs[0].status).toBe("rejected");
    expect(rejected.approvals[0].status).toBe("rejected");
    expect(rejected.shifts[0].status).toBe("scheduled");
  });

  it("keeps an unknown result in review and supports pre-call cancellation", async () => {
    const { workflow } = make();
    const created = workflow.createJob({ employeeId: "emp-ana", shiftId: "shift-1", fakeOutcome: "unknown" });
    const jobId = created.jobs[0].id;
    const canceled = await workflow.cancel(jobId);
    expect(canceled.jobs[0].status).toBe("canceled");
    expect(canceled.approvals[0].status).toBe("canceled");
    expect(canceled.jobs[0].providerCallId).toBeNull();

    const second = workflow.createJob({ employeeId: "emp-ana", shiftId: "shift-1", fakeOutcome: "unknown" });
    const secondId = second.jobs[0].id;
    await workflow.approve(secondId);
    const reviewed = await workflow.refresh(secondId);
    expect(reviewed.jobs[0].result.outcome).toBe("unknown");
    expect(() => workflow.apply(secondId)).toThrow("cannot be applied");
  });

  it("retries a failed create with the same idempotency key", async () => {
    let attempts = 0;
    let firstKey = "";
    const provider = {
      name: "fake",
      createCall(request) {
        attempts += 1;
        firstKey ||= request.idempotencyKey;
        expect(request.idempotencyKey).toBe(firstKey);
        if (attempts === 1) throw new Error("temporary provider failure");
        return { id: "call_fake_retry", status: "queued" };
      },
      getCall(id) {
        return { id, status: "completed", structured_result: { outcome: "confirmed", requested_date: "", requested_time: "", employee_message: "Confirmed.", confidence: 0.9, needs_manager_review: false }, evidence: ["Confirmed."], transcript_turns: [] };
      },
    };
    const { workflow } = make();
    workflow.provider = provider;
    const created = workflow.createJob({ employeeId: "emp-ana", shiftId: "shift-1", fakeOutcome: "confirmed" });
    const jobId = created.jobs[0].id;
    expect((await workflow.approve(jobId)).jobs[0].status).toBe("failed");
    expect((await workflow.retry(jobId)).jobs[0].providerCallId).toBe("call_fake_retry");
    expect(attempts).toBe(2);
  });

  it("surfaces a fake provider failure and cancels a queued fake call", async () => {
    const failedWorkflow = make().workflow;
    const failedJob = failedWorkflow.createJob({ employeeId: "emp-ana", shiftId: "shift-1", fakeOutcome: "failed" });
    const failedId = failedJob.jobs[0].id;
    const failed = await failedWorkflow.approve(failedId);
    expect(failed.jobs[0].status).toBe("failed");
    const refreshedFailure = await failedWorkflow.refresh(failedId);
    expect(refreshedFailure.jobs[0]).toMatchObject({ status: "failed", failureCode: "fake_provider_failure" });
    expect(refreshedFailure.shifts[0].status).toBe("scheduled");

    const cancelContext = make();
    cancelContext.workflow.provider = new FakeCallProvider({ clock: () => 1000, queuedMs: 1000, inProgressMs: 5000 });
    const queuedJob = cancelContext.workflow.createJob({ employeeId: "emp-ana", shiftId: "shift-1", fakeOutcome: "confirmed" });
    const queuedId = queuedJob.jobs[0].id;
    const queued = await cancelContext.workflow.approve(queuedId);
    expect(queued.jobs[0].status).toBe("queued");
    const canceled = await cancelContext.workflow.cancel(queuedId);
    expect(canceled.jobs[0].status).toBe("canceled");
    expect(canceled.shifts[0].status).toBe("scheduled");
  });

  it("uses a server-only live test phone override without changing seeded data", async () => {
    const context = make();
    const requests = [];
    context.workflow.config = {
      ...context.workflow.config,
      calleLiveEnabled: true,
      calleTestPhone: "+14155552671",
      calleTestEmployeeId: "emp-ana",
      calleTestRegion: "US",
      calleTestLocale: "en-US",
    };
    context.workflow.provider = {
      name: "live",
      async createCall(request) { requests.push(request); return { id: "call_live_test", status: "queued" }; },
      async getCall(id) { return { id, status: "queued" }; },
    };
    const preview = context.workflow.preview({ employeeId: "emp-ana", shiftId: "shift-1" });
    expect(preview.employee.phone).toBe("+141•••••671");
    const created = context.workflow.createJob({ employeeId: "emp-ana", shiftId: "shift-1" });
    await context.workflow.approve(created.jobs[0].id);
    expect(requests[0].body.recipients[0].phones).toEqual(["+14155552671"]);
    expect(context.workflow.state().employees[0].phone).toBe("+15550101001");
    expect(context.workflow.response().runtime).toMatchObject({ region: "US", language: "en-US" });
  });

  it("reads CALL-E attempt transcripts and blocks malformed alternate times", async () => {
    const context = make();
    context.workflow.provider = {
      name: "live",
      async createCall(request) { return { id: "call_live_transcript", status: "queued", request }; },
      async getCall(id) {
        return {
          id,
          status: "completed",
          structured_result: { outcome: "reschedule_requested", requested_date: "tomorrow", requested_time: "morning", employee_message: "Needs another time.", confidence: 0.8, needs_manager_review: true },
          recipients: [{ attempts: [{ transcript_turns: [{ speaker: "bot", text: "Can you work it?" }, { speaker: "user", text: "Not at that time." }] }] }],
          evidence: ["Not at that time."],
        };
      },
    };
    const created = context.workflow.createJob({ employeeId: "emp-ana", shiftId: "shift-1" });
    const jobId = created.jobs[0].id;
    await context.workflow.approve(jobId);
    const reviewed = await context.workflow.refresh(jobId);
    expect(reviewed.jobs[0].transcript).toHaveLength(2);
    expect(() => context.workflow.apply(jobId)).toThrow("invalid format");
    expect(() => context.workflow.preview({ employeeId: "emp-ana", shiftId: "shift-1", proposedDate: "tomorrow" })).toThrow("YYYY-MM-DD");
  });
});
