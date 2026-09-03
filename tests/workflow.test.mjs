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

describe("shift rescheduling workflow", () => {
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
    expect(applied.shifts[0].status).toBe("rescheduled");
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
});
