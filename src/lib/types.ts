export type CallStatus = "awaiting_approval" | "queued" | "in_progress" | "needs_review" | "failed" | "canceled" | "applied" | "rejected";
export type CallOutcome = "confirmed" | "reschedule_requested" | "declined" | "unknown";
export type FakeOutcome = CallOutcome | "failed";

export interface Employee {
  id: string;
  name: string;
  role: string;
  phone: string;
  locale: string;
  region: string;
}

export interface Shift {
  id: string;
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string;
  status: "scheduled" | "confirmed" | "rescheduled";
}

export interface CallResult {
  outcome: CallOutcome;
  requested_date: string;
  requested_time: string;
  employee_message: string;
  confidence: number;
  needs_manager_review: boolean;
}

export interface TranscriptTurn { speaker: string; text: string }

export interface CallJob {
  id: string;
  employeeId: string;
  shiftId: string;
  proposedDate: string;
  proposedTime: string;
  fakeOutcome: FakeOutcome;
  task: string;
  status: CallStatus;
  provider: "fake" | "live";
  providerStatus: string | null;
  providerCallId: string | null;
  outcome: CallOutcome | null;
  result: CallResult | null;
  evidence: string[];
  transcript: TranscriptTurn[];
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: string;
  updatedAt: string;
  idempotencyKey: string;
  approvalId: string;
}

export interface Approval { id: string; jobId: string; status: "pending" | "approved"; createdAt: string; decidedAt: string | null }
export interface Event { id: string; type: string; message: string; createdAt: string; jobId?: string }
export interface RuntimeConfig { provider: "fake" | "live"; liveEnabled: boolean; language: string; region: string }
export interface AppState { version: number; employees: Employee[]; shifts: Shift[]; jobs: CallJob[]; approvals: Approval[]; events: Event[]; runtime: RuntimeConfig }
export interface Preview { employee: Pick<Employee, "id" | "name" | "role" | "phone">; shift: Shift; proposedDate: string; proposedTime: string; task: string; provider: string; fakeOutcome?: FakeOutcome; safety: { ok: boolean; reason: string } }
