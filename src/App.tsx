import { useEffect, useRef, useState } from "react";
import { createJob, createJobInput, getState, jobAction, previewJob, resetState } from "./lib/api";
import type { AppState, FakeOutcome, Preview, WorkflowTemplate, WorkflowType } from "./lib/types";

const fallbackWorkflows: WorkflowTemplate[] = [
  {
    id: "appointment_management",
    label: "Appointment desk",
    business: "Service businesses",
    description: "Confirm or reschedule a customer appointment without changing the calendar automatically.",
    recipientLabel: "Customer",
    recordLabel: "Appointment",
    applyLabel: "appointment",
    demoEmployeeId: "emp-ana",
    demoShiftId: "shift-ana-1",
    demoOutcome: "reschedule_requested",
  },
  {
    id: "lead_follow_up",
    label: "Lead follow-up",
    business: "Sales teams",
    description: "Turn a phone conversation into a qualified follow-up time for a prospective customer.",
    recipientLabel: "Prospect",
    recordLabel: "Follow-up",
    applyLabel: "follow-up",
    demoEmployeeId: "emp-diego",
    demoShiftId: "shift-diego-1",
    demoOutcome: "confirmed",
  },
  {
    id: "shift_coordination",
    label: "Shift coordination",
    business: "Operations teams",
    description: "Check a team member's availability and safely confirm or renegotiate a work shift.",
    recipientLabel: "Team member",
    recordLabel: "Shift",
    applyLabel: "shift",
    demoEmployeeId: "emp-lucia",
    demoShiftId: "shift-lucia-1",
    demoOutcome: "declined",
  },
];

const outcomeLabels: Record<FakeOutcome, string> = {
  confirmed: "Confirmed",
  reschedule_requested: "Requests another time",
  declined: "Declined",
  unknown: "Unknown / unclear",
  failed: "Provider failure",
};

const statusLabels: Record<string, string> = {
  awaiting_approval: "Awaiting approval",
  queued: "Queued",
  in_progress: "Call in progress",
  needs_review: "Result needs review",
  failed: "Call failed",
  canceled: "Canceled",
  applied: "Change applied",
  rejected: "Change rejected",
};

const traceLabels: Record<string, string> = {
  approval_required: "Preview and approval request",
  call_authorized: "Manager authorization recorded",
  call_created: "CALL-E call created",
  call_completed: "Structured result received",
  change_applied: "Human-approved change applied",
  change_rejected: "Manager rejected the proposed change",
  call_failed: "Provider failure contained safely",
  call_retrying: "Retrying with the same idempotency key",
  call_canceled: "Call canceled before commitment",
};

const demoCases: Array<{ name: string; detail: string; workflowType: WorkflowType; employeeId: string; shiftId: string; fakeOutcome: FakeOutcome }> = [
  { name: "Customer appointment", detail: "Luna Studio · alternate time", workflowType: "appointment_management", employeeId: "emp-ana", shiftId: "shift-ana-1", fakeOutcome: "reschedule_requested" },
  { name: "Team availability", detail: "Calle Ops · confirmation", workflowType: "shift_coordination", employeeId: "emp-lucia", shiftId: "shift-lucia-1", fakeOutcome: "confirmed" },
];

const formatSlot = (date: string, startTime: string, endTime: string) => `${date} · ${startTime}–${endTime}`;

const App = () => {
  const [state, setState] = useState<AppState | null>(null);
  const [workflowType, setWorkflowType] = useState<WorkflowType>("appointment_management");
  const [employeeId, setEmployeeId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [fakeOutcome, setFakeOutcome] = useState<FakeOutcome>("reschedule_requested");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [demoCaseIndex, setDemoCaseIndex] = useState(0);
  const [busy, setBusy] = useState<string | null>("loading");
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  const workflows = state?.runtime.workflows?.length ? state.runtime.workflows : fallbackWorkflows;
  const workflow = workflows.find((item) => item.id === workflowType) || workflows[0] || fallbackWorkflows[0];
  const employee = state?.employees.find((item) => item.id === employeeId) || state?.employees[0];
  const shifts = state?.shifts.filter((item) => item.employeeId === employee?.id) || [];
  const shift = shifts.find((item) => item.id === shiftId) || shifts[0];
  const selectedJob = state?.jobs.find((item) => item.id === selectedJobId) || null;
  const selectedJobWorkflow = workflows.find((item) => item.id === selectedJob?.workflowType) || workflow;
  const activeJob = selectedJob && ["queued", "in_progress"].includes(selectedJob.status) ? selectedJob : null;
  const selectedJobEvents = selectedJob
    ? state?.events.filter((event) => event.jobId === selectedJob.id).slice(0, 6).reverse() || []
    : [];

  const load = async () => {
    try {
      setState(await getState());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load state");
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => { void load(); }, []);

  const applyDemoCase = (nextIndex: number) => {
    if (!state) return;
    const item = demoCases[nextIndex % demoCases.length];
    const nextShift = state.shifts.find((entry) => entry.id === item.shiftId);
    setDemoCaseIndex(nextIndex % demoCases.length);
    setWorkflowType(item.workflowType);
    setEmployeeId(item.employeeId);
    setShiftId(item.shiftId);
    setDate(nextShift?.date || "");
    setTime(nextShift?.startTime || "");
    setFakeOutcome(item.fakeOutcome);
    setPreview(null);
    setSelectedJobId(null);
    setError(null);
  };

  useEffect(() => {
    if (!state || initialized.current) return;
    initialized.current = true;
    applyDemoCase(0);
    if (state.jobs[0]) setSelectedJobId(state.jobs[0].id);
  }, [state]);

  useEffect(() => {
    if (!activeJob) return undefined;
    const timer = window.setInterval(async () => {
      try { setState(await jobAction(activeJob.id, "refresh")); } catch { /* manual refresh remains available */ }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [activeJob?.id]);

  const doAction = async (label: string, action: string) => {
    if (!selectedJob) return;
    setBusy(label); setError(null);
    try { setState(await jobAction(selectedJob.id, action)); } catch (err) { setError(err instanceof Error ? err.message : "Action failed"); } finally { setBusy(null); }
  };

  const handleWorkflowChange = (nextType: WorkflowType) => {
    const nextWorkflow = workflows.find((item) => item.id === nextType) || workflow;
    const nextEmployee = state?.employees.find((item) => item.id === nextWorkflow.demoEmployeeId);
    const nextShift = state?.shifts.find((item) => item.id === nextWorkflow.demoShiftId);
    setWorkflowType(nextType);
    setEmployeeId(nextEmployee?.id || "");
    setShiftId(nextShift?.id || "");
    setDate(nextShift?.date || "");
    setTime(nextShift?.startTime || "");
    setFakeOutcome(nextWorkflow.demoOutcome);
    setPreview(null);
    setSelectedJobId(null);
  };

  const handleEmployeeChange = (nextEmployeeId: string) => {
    const nextShift = state?.shifts.find((item) => item.employeeId === nextEmployeeId);
    setEmployeeId(nextEmployeeId);
    setShiftId(nextShift?.id || "");
    setDate(nextShift?.date || "");
    setTime(nextShift?.startTime || "");
    setPreview(null);
  };

  const handleShiftChange = (nextShiftId: string) => {
    const nextShift = shifts.find((item) => item.id === nextShiftId);
    setShiftId(nextShiftId);
    setDate(nextShift?.date || "");
    setTime(nextShift?.startTime || "");
    setPreview(null);
  };

  const handlePreview = async () => {
    if (!employee || !shift) return;
    setBusy("preview"); setError(null);
    try { setPreview(await previewJob(createJobInput(employee.id, shift.id, date || shift.date, time || shift.startTime, fakeOutcome, workflowType))); } catch (err) { setError(err instanceof Error ? err.message : "Preview failed"); } finally { setBusy(null); }
  };

  const handleCreate = async () => {
    if (!employee || !shift) return;
    setBusy("create"); setError(null);
    try {
      const next = await createJob(createJobInput(employee.id, shift.id, date || shift.date, time || shift.startTime, fakeOutcome, workflowType));
      setState(next); setSelectedJobId(next.jobs[0]?.id || null); setPreview(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create job"); } finally { setBusy(null); }
  };

  const handleReset = async () => {
    setBusy("reset"); setError(null);
    try { const next = await resetState(); setState(next); setPreview(null); setSelectedJobId(null); } catch (err) { setError(err instanceof Error ? err.message : "Could not reset"); } finally { setBusy(null); }
  };

  const employeeName = (id: string) => state?.employees.find((item) => item.id === id)?.name || "Unknown contact";
  const shiftLabel = (id: string) => { const item = state?.shifts.find((entry) => entry.id === id); return item ? formatSlot(item.date, item.startTime, item.endTime) : "Unknown scheduled item"; };

  if (!state) return <main className="loading"><div className="spinner" />Loading E-mploye…</main>;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark">E</div><div><div className="brand-name">E-mploye</div><div className="brand-sub">One virtual employee · many business workflows</div></div></div>
        <div className="top-actions"><span className="persona-chip">1 AI employee</span><span className={`mode-pill ${state.runtime.provider}`}>{state.runtime.provider === "fake" ? "FAKE · NO CALLS" : "LIVE CALL-E"}</span><button className="ghost-button" onClick={handleReset} disabled={Boolean(busy)}>Reset demo</button></div>
      </header>

      <main className="content">
        <section className="hero"><div><p className="eyebrow">ONE VIRTUAL EMPLOYEE · MANY WORKFLOWS</p><h1>E-mploye handles the routine. You keep the decision.</h1><p className="hero-copy">Configure one phone-based employee for appointments, sales follow-ups, or team operations. Every call is previewed, authorized, evidenced, and kept under human control.</p></div><div className="hero-note"><div><span className="dot" /> Human approval stays in the loop</div><div className="hero-note-small">No commitment is applied automatically.</div><div className="hero-note-small">{workflows.length} reusable task templates</div></div></section>

        {error && <div className="alert error"><strong>Action blocked</strong><span>{error}</span><button onClick={() => setError(null)}>Dismiss</button></div>}

        <section className="panel workflow-gallery"><div className="panel-heading"><div><p className="eyebrow">THE E-MPLOYEE ROLE</p><h2>What should E-mploye handle?</h2><p className="section-copy">Same virtual employee, adapted to the business context and the task at hand.</p></div><span className="count-badge">{workflows.length} tasks</span></div><div className="workflow-cards">{workflows.map((item) => <button key={item.id} className={`workflow-card ${workflow.id === item.id ? "selected" : ""}`} onClick={() => handleWorkflowChange(item.id)} aria-pressed={workflow.id === item.id}><span className="workflow-kind">{item.business}</span><strong>{item.label}</strong><span>{item.description}</span><small>Contact: {item.recipientLabel} · Output: {item.recordLabel}</small></button>)}</div><div className="demo-rail"><div><p className="eyebrow">REPEATABLE DEMO DECK</p><strong>Two seeded cases for every judge</strong><span>Rotate between a customer appointment and a team availability call. The fake provider keeps the result deterministic and free.</span></div><button className="secondary-button" onClick={() => applyDemoCase((demoCaseIndex + 1) % demoCases.length)} disabled={Boolean(busy)}>Next case <span>→</span></button><div className="demo-index"><span>{demoCaseIndex + 1}</span> / {demoCases.length}<small>{demoCases[demoCaseIndex].name}</small></div></div></section>

        <div className="workspace-grid">
          <aside className="panel roster-panel"><div className="panel-heading"><div><p className="eyebrow">RECIPIENTS</p><h2>People E-mploye can reach</h2></div><span className="count-badge">{state.employees.length}</span></div><div className="employee-list">{state.employees.map((item) => <button key={item.id} className={`employee-row ${employee?.id === item.id ? "selected" : ""}`} onClick={() => handleEmployeeChange(item.id)}><span className="avatar">{item.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><span><strong>{item.name}</strong><small>{item.role}</small></span><span className="chevron">›</span></button>)}</div><div className="roster-note"><span className="dot" /> Masked E.164 contacts<br /><small>Only the configured server-side provider can access a live number.</small></div></aside>

          <section className="panel workflow-panel"><div className="panel-heading"><div><p className="eyebrow">1 · CONFIGURE</p><h2>{workflow.label}</h2><p className="section-copy">{workflow.description}</p></div><span className="step-badge">No call yet</span></div><div className="form-grid"><label className="wide">Task template<select value={workflow.id} onChange={(event) => handleWorkflowChange(event.target.value as WorkflowType)}>{workflows.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.business}</option>)}</select></label><label>{workflow.recipientLabel}<select value={employee?.id || ""} onChange={(event) => handleEmployeeChange(event.target.value)}>{state.employees.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.business || item.role}</option>)}</select></label><label>{workflow.recordLabel}<select value={shift?.id || ""} onChange={(event) => handleShiftChange(event.target.value)}>{shifts.map((item) => <option key={item.id} value={item.id}>{formatSlot(item.date, item.startTime, item.endTime)} · {item.role}</option>)}</select></label><label>Proposed date<input type="date" value={date || shift?.date || ""} onChange={(event) => setDate(event.target.value)} /></label><label>Proposed time<input type="time" value={time || shift?.startTime || ""} onChange={(event) => setTime(event.target.value)} /></label><label className="wide">Fake response scenario<select value={fakeOutcome} onChange={(event) => setFakeOutcome(event.target.value as FakeOutcome)} disabled={state.runtime.provider === "live"}><option value="confirmed">Confirmed</option><option value="reschedule_requested">Requests another time</option><option value="declined">Declined</option><option value="unknown">Unknown / unclear</option><option value="failed">Provider failure</option></select><small className="field-help">Exercise every outcome without spending a CALL-E call. The same task can be tested in all three business contexts.</small></label></div><div className="button-row"><button className="secondary-button" onClick={handlePreview} disabled={Boolean(busy)}>Preview task</button><button className="primary-button" onClick={handleCreate} disabled={Boolean(busy)}>Create approval request <span>→</span></button></div>{preview && <div className="preview-card"><div className="preview-top"><div><p className="eyebrow">EXACT TASK TO BE SENT</p><h3>{preview.workflow.label} · {preview.employee.name}</h3></div><span className="safe-chip">✓ Safety checks passed</span></div><p className="task-copy">{preview.task}</p><div className="preview-meta"><span>☎ {preview.employee.phone}</span><span>Business {employee?.business || preview.workflow.business}</span><span>Language {state.runtime.language}</span><span>Region {state.runtime.region}</span><span>Provider {state.runtime.provider}</span></div><div className="preview-warning">Creating this request does not place a call. The next step records manager intent and shows an explicit authorization control.</div></div>}</section>
        </div>

        <section className="panel job-panel"><div className="panel-heading"><div><p className="eyebrow">2 · OPERATE</p><h2>Call runs</h2><p className="section-copy">One approval boundary for every E-mploye task.</p></div><span className="step-badge">{state.jobs.length} total</span></div>{selectedJob ? <div className="job-detail"><div className="job-summary"><div><div className="job-title-row"><h3>{employeeName(selectedJob.employeeId)}</h3><span className={`status-pill ${selectedJob.status}`}>{statusLabels[selectedJob.status]}</span></div><p>{selectedJobWorkflow.label} · {shiftLabel(selectedJob.shiftId)} · {selectedJob.provider === "fake" ? "CALL-E sandbox" : "CALL-E live provider"}</p></div><div className="job-id">{selectedJob.providerCallId || "Not created"}<small>provider call id</small></div></div><div className="call-trace"><div className="trace-head"><div><p className="eyebrow">CALL-E EXECUTION TRACE</p><strong>{selectedJob.provider === "fake" ? "Sandbox execution" : "Live CALL-E execution"}</strong></div><span className={`trace-provider ${selectedJob.provider}`}>{selectedJob.provider === "fake" ? "FAKE · NO CALLS" : "LIVE"}</span></div><div className="trace-list">{selectedJobEvents.map((event) => <div className="trace-event" key={event.id}><span className="trace-dot" /><div><strong>{traceLabels[event.type] || event.type.replaceAll("_", " ")}</strong><span>{event.message}</span></div><small>{new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></div>)}</div></div>{selectedJob.status === "awaiting_approval" && <div className="approval-box"><div><strong>Manager authorization required</strong><p>Review the exact task above. Authorizing creates one {selectedJob.provider === "fake" ? "simulated" : "live"} call and uses a stable idempotency key.</p></div><div className="button-row"><button className="primary-button" onClick={() => void doAction("approve", "approve")} disabled={Boolean(busy)}>Authorize call</button><button className="secondary-button danger-outline" onClick={() => void doAction("cancel", "cancel")} disabled={Boolean(busy)}>Cancel</button></div></div>}{["queued", "in_progress"].includes(selectedJob.status) && <div className="progress-box"><div className="progress-ring" /><div><strong>{selectedJob.status === "queued" ? "Call queued" : "Conversation in progress"}</strong><p>Refreshing status automatically. You can also poll manually.</p></div><div className="button-row"><button className="secondary-button" onClick={() => void doAction("refresh", "refresh")} disabled={Boolean(busy)}>Refresh</button>{selectedJob.provider === "fake" && <button className="secondary-button danger-outline" onClick={() => void doAction("cancel", "cancel")} disabled={Boolean(busy)}>Cancel simulated call</button>}</div></div>}{selectedJob.status === "failed" && <div className="approval-box failure-box"><div><strong>Call failed safely</strong><p>{selectedJob.failureMessage || "No provider result was returned."} The scheduled item is unchanged.</p></div><div className="button-row"><button className="primary-button" onClick={() => void doAction("retry", "retry")} disabled={Boolean(busy)}>Retry safely</button><button className="secondary-button" onClick={() => void doAction("cancel", "cancel")} disabled={Boolean(busy)}>Close</button></div></div>}{selectedJob.result && <div className="result-grid"><div className="result-main"><div className="result-heading"><div><p className="eyebrow">3 · REVIEW</p><h3>Structured result</h3></div><span className={`outcome-badge ${selectedJob.outcome}`}>{outcomeLabels[selectedJob.outcome || "unknown"]}</span></div><div className="result-fields"><div><span>Outcome</span><strong>{selectedJob.result.outcome}</strong></div><div><span>Confidence</span><strong>{Math.round(selectedJob.result.confidence * 100)}%</strong></div><div><span>Alternate date</span><strong>{selectedJob.result.requested_date || "—"}</strong></div><div><span>Alternate time</span><strong>{selectedJob.result.requested_time || "—"}</strong></div></div><p className="evidence-quote">“{selectedJob.result.contact_message}”</p>{selectedJob.status === "needs_review" && <div className="button-row"><button className="primary-button" onClick={() => void doAction("apply", "apply")} disabled={Boolean(busy) || !["confirmed", "reschedule_requested"].includes(selectedJob.outcome || "")}>Approve and apply {selectedJobWorkflow.applyLabel}</button><button className="secondary-button danger-outline" onClick={() => void doAction("reject", "reject")} disabled={Boolean(busy)}>Reject · keep unchanged</button></div>}{selectedJob.status === "applied" && <div className="success-note">✓ Human-approved {selectedJobWorkflow.applyLabel} change applied.</div>}{selectedJob.status === "rejected" && <div className="muted-note">Result rejected. The scheduled item remains unchanged.</div>}</div><div className="evidence-panel"><p className="eyebrow">EVIDENCE</p><h4>Transcript</h4>{selectedJob.transcript.length ? selectedJob.transcript.map((turn, index) => <div className={`transcript-turn ${turn.speaker}`} key={`${turn.speaker}-${index}`}><span>{turn.speaker}</span><p>{turn.text}</p></div>) : <p className="muted-note">No transcript until the call reaches a terminal state.</p>}<h4 className="evidence-heading">Call evidence</h4>{selectedJob.evidence.map((item) => <p className="evidence-item" key={item}>• {item}</p>)}</div></div>}</div> : <div className="empty-state"><div className="empty-icon">☎</div><h3>No call run yet</h3><p>Select a task, preview the instruction, then create an approval request.</p><div className="call-trace trace-empty"><div className="trace-head"><div><p className="eyebrow">CALL-E FLOW</p><strong>Sandbox trace ready</strong></div><span className="trace-provider fake">FAKE · NO CALLS</span></div><div className="trace-flow" aria-label="CALL-E workflow"><span>Preview</span><i>→</i><span>Authorize</span><i>→</i><span>Call</span><i>→</i><span>Review</span><i>→</i><span>Apply</span></div><p className="empty-trace-note">The fake CALL-E provider keeps every step deterministic and free.</p></div></div>}</section>

        <section className="lower-grid"><section className="panel history-panel"><div className="panel-heading"><div><p className="eyebrow">ACTIVITY</p><h2>Call history</h2></div></div>{state.jobs.length ? <div className="history-list">{state.jobs.map((job) => <button className={`history-row ${selectedJob?.id === job.id ? "selected" : ""}`} key={job.id} onClick={() => setSelectedJobId(job.id)}><span className={`history-dot ${job.status}`} /><span><strong>{workflows.find((item) => item.id === job.workflowType)?.label || "E-mploye task"}</strong><small>{employeeName(job.employeeId)} · {shiftLabel(job.shiftId)}</small></span><span className={`status-text ${job.status}`}>{statusLabels[job.status]}</span><span className="chevron">›</span></button>)}</div> : <p className="muted-note">No calls or approval requests have been created.</p>}</section><section className="panel events-panel"><div className="panel-heading"><div><p className="eyebrow">AUDIT TRAIL</p><h2>Recent events</h2></div><span className="step-badge">{state.events.length}</span></div><div className="event-list">{state.events.slice(0, 8).map((event) => <div className="event-row" key={event.id}><span className="event-line" /><div><strong>{event.message}</strong><small>{new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></div></div>)}</div></section></section>
      </main>
      <footer className="footer">E-mploye for CALL-E · one virtual employee · many workflows · human approval before commitments</footer>
    </div>
  );
};

export default App;
