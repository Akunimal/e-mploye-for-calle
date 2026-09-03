import { useEffect, useState } from "react";
import { createJob, createJobInput, getState, jobAction, previewJob, resetState } from "./lib/api";
import type { AppState, FakeOutcome, Preview } from "./lib/types";

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

const App = () => {
  const [state, setState] = useState<AppState | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [fakeOutcome, setFakeOutcome] = useState<FakeOutcome>("confirmed");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try { setState(await getState()); setError(null); } catch (err) { setError(err instanceof Error ? err.message : "Could not load state"); } finally { setBusy(null); }
  };

  useEffect(() => { void load(); }, []);

  const employee = state?.employees.find((item) => item.id === employeeId) || state?.employees[0];
  const shifts = state?.shifts.filter((item) => item.employeeId === employee?.id) || [];
  const shift = shifts.find((item) => item.id === shiftId) || shifts[0];
  const selectedJob = state?.jobs.find((item) => item.id === selectedJobId) || state?.jobs[0] || null;
  const activeJob = selectedJob && ["queued", "in_progress"].includes(selectedJob.status) ? selectedJob : null;

  useEffect(() => {
    if (!employee || employee.id === employeeId) return;
    setEmployeeId(employee.id);
  }, [employee, employeeId]);

  useEffect(() => {
    if (!shift || shift.id === shiftId) return;
    setShiftId(shift.id); setDate(shift.date); setTime(shift.startTime);
  }, [shift, shiftId]);

  useEffect(() => {
    if (!activeJob) return undefined;
    const timer = window.setInterval(async () => {
      try { setState(await jobAction(activeJob.id, "refresh")); } catch { /* visible state remains; manual refresh is available */ }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [activeJob?.id]);

  const doAction = async (label: string, action: string) => {
    if (!selectedJob) return;
    setBusy(label); setError(null);
    try { setState(await jobAction(selectedJob.id, action)); } catch (err) { setError(err instanceof Error ? err.message : "Action failed"); } finally { setBusy(null); }
  };

  const handlePreview = async () => {
    if (!employee || !shift) return;
    setBusy("preview"); setError(null);
    try { setPreview(await previewJob(createJobInput(employee.id, shift.id, date || shift.date, time || shift.startTime, fakeOutcome))); } catch (err) { setError(err instanceof Error ? err.message : "Preview failed"); } finally { setBusy(null); }
  };

  const handleCreate = async () => {
    if (!employee || !shift) return;
    setBusy("create"); setError(null);
    try {
      const next = await createJob(createJobInput(employee.id, shift.id, date || shift.date, time || shift.startTime, fakeOutcome));
      setState(next); setSelectedJobId(next.jobs[0]?.id || null); setPreview(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create job"); } finally { setBusy(null); }
  };

  const handleReset = async () => {
    setBusy("reset"); setError(null);
    try { const next = await resetState(); setState(next); setPreview(null); setSelectedJobId(null); } catch (err) { setError(err instanceof Error ? err.message : "Could not reset"); } finally { setBusy(null); }
  };

  const employeeName = (id: string) => state?.employees.find((item) => item.id === id)?.name || "Unknown employee";
  const shiftLabel = (id: string) => { const item = state?.shifts.find((entry) => entry.id === id); return item ? `${item.date} · ${item.startTime}–${item.endTime}` : "Unknown shift"; };

  if (!state) return <main className="loading"><div className="spinner" />Loading E-mploye…</main>;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark">E</div><div><div className="brand-name">E-mploye</div><div className="brand-sub">Employee coordination for CALL-E</div></div></div>
        <div className="top-actions"><span className={`mode-pill ${state.runtime.provider}`}>{state.runtime.provider === "fake" ? "FAKE · NO CALLS" : "LIVE CALL-E"}</span><button className="ghost-button" onClick={handleReset} disabled={Boolean(busy)}>Reset demo</button></div>
      </header>

      <main className="content">
        <section className="hero"><div><p className="eyebrow">SHIFT RESCHEDULING MVP</p><h1>Turn a phone conversation into a safe scheduling decision.</h1><p className="hero-copy">Preview the exact task, authorize one employee call, inspect the evidence, then decide whether to apply the change.</p></div><div className="hero-note"><span className="dot" /> Human approval stays in the loop<div className="hero-note-small">No schedule mutation happens automatically.</div></div></section>

        {error && <div className="alert error"><strong>Action blocked</strong><span>{error}</span><button onClick={() => setError(null)}>Dismiss</button></div>}

        <div className="workspace-grid">
          <aside className="panel roster-panel"><div className="panel-heading"><div><p className="eyebrow">PEOPLE</p><h2>Employees</h2></div><span className="count-badge">{state.employees.length}</span></div><div className="employee-list">{state.employees.map((item) => <button key={item.id} className={`employee-row ${employee?.id === item.id ? "selected" : ""}`} onClick={() => { setEmployeeId(item.id); setShiftId(""); setPreview(null); }}><span className="avatar">{item.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><span><strong>{item.name}</strong><small>{item.role}</small></span><span className="chevron">›</span></button>)}</div></aside>

          <section className="panel workflow-panel"><div className="panel-heading"><div><p className="eyebrow">1 · PREPARE</p><h2>Call preview</h2></div><span className="step-badge">No call yet</span></div><div className="form-grid"><label>Employee<select value={employee?.id || ""} onChange={(event) => { setEmployeeId(event.target.value); setShiftId(""); setPreview(null); }}>{state.employees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Shift<select value={shift?.id || ""} onChange={(event) => { setShiftId(event.target.value); setPreview(null); }}>{shifts.map((item) => <option key={item.id} value={item.id}>{item.date} · {item.startTime}–{item.endTime}</option>)}</select></label><label>Proposed date<input type="date" value={date || shift?.date || ""} onChange={(event) => setDate(event.target.value)} /></label><label>Proposed start<input type="time" value={time || shift?.startTime || ""} onChange={(event) => setTime(event.target.value)} /></label><label className="wide">Fake response scenario<select value={fakeOutcome} onChange={(event) => setFakeOutcome(event.target.value as FakeOutcome)} disabled={state.runtime.provider === "live"}><option value="confirmed">Confirmed</option><option value="reschedule_requested">Requests another time</option><option value="declined">Declined</option><option value="unknown">Unknown / unclear</option><option value="failed">Provider failure</option></select><small className="field-help">Fake mode lets judges exercise every result without spending a call.</small></label></div><div className="button-row"><button className="secondary-button" onClick={handlePreview} disabled={Boolean(busy)}>Preview task</button><button className="primary-button" onClick={handleCreate} disabled={Boolean(busy)}>Create approval request <span>→</span></button></div>{preview && <div className="preview-card"><div className="preview-top"><div><p className="eyebrow">EXACT TASK TO BE SENT</p><h3>{preview.employee.name} · {preview.proposedDate} at {preview.proposedTime}</h3></div><span className="safe-chip">✓ Safety checks passed</span></div><p className="task-copy">{preview.task}</p><div className="preview-meta"><span>☎ {preview.employee.phone}</span><span>Language {state.runtime.language}</span><span>Region {state.runtime.region}</span><span>Provider {state.runtime.provider}</span></div><div className="preview-warning">Creating this request does not place a call. The next step records manager intent and shows an explicit authorization control.</div></div>}</section>
        </div>

        <section className="panel job-panel"><div className="panel-heading"><div><p className="eyebrow">2 · OPERATE</p><h2>Call jobs</h2></div><span className="step-badge">{state.jobs.length} total</span></div>{selectedJob ? <div className="job-detail"><div className="job-summary"><div><div className="job-title-row"><h3>{employeeName(selectedJob.employeeId)}</h3><span className={`status-pill ${selectedJob.status}`}>{statusLabels[selectedJob.status]}</span></div><p>{shiftLabel(selectedJob.shiftId)} · {selectedJob.provider === "fake" ? "Fake provider" : "CALL-E live provider"}</p></div><div className="job-id">{selectedJob.providerCallId || "Not created"}<small>provider call id</small></div></div>{selectedJob.status === "awaiting_approval" && <div className="approval-box"><div><strong>Manager authorization required</strong><p>Review the task above. Authorizing will create one {selectedJob.provider === "fake" ? "simulated" : "live"} call to the masked number, using a stable idempotency key.</p></div><div className="button-row"><button className="primary-button" onClick={() => void doAction("approve", "approve")} disabled={Boolean(busy)}>Authorize call</button><button className="secondary-button danger-outline" onClick={() => void doAction("cancel", "cancel")} disabled={Boolean(busy)}>Cancel</button></div></div>}{["queued", "in_progress"].includes(selectedJob.status) && <div className="progress-box"><div className="progress-ring" /><div><strong>{selectedJob.status === "queued" ? "Call queued" : "Conversation in progress"}</strong><p>Refreshing status automatically. You can also poll manually.</p></div><button className="secondary-button" onClick={() => void doAction("refresh", "refresh")} disabled={Boolean(busy)}>Refresh</button></div>}{selectedJob.status === "failed" && <div className="approval-box failure-box"><div><strong>Call failed safely</strong><p>{selectedJob.failureMessage || "No provider result was returned."} The shift is unchanged.</p></div><div className="button-row"><button className="primary-button" onClick={() => void doAction("retry", "retry")} disabled={Boolean(busy)}>Retry safely</button><button className="secondary-button" onClick={() => void doAction("cancel", "cancel")} disabled={Boolean(busy)}>Close</button></div></div>}{selectedJob.result && <div className="result-grid"><div className="result-main"><div className="result-heading"><div><p className="eyebrow">3 · REVIEW</p><h3>Structured result</h3></div><span className={`outcome-badge ${selectedJob.outcome}`}>{outcomeLabels[selectedJob.outcome || "unknown"]}</span></div><div className="result-fields"><div><span>Outcome</span><strong>{selectedJob.result.outcome}</strong></div><div><span>Confidence</span><strong>{Math.round(selectedJob.result.confidence * 100)}%</strong></div><div><span>Alternate date</span><strong>{selectedJob.result.requested_date || "—"}</strong></div><div><span>Alternate time</span><strong>{selectedJob.result.requested_time || "—"}</strong></div></div><p className="evidence-quote">“{selectedJob.result.employee_message}”</p>{selectedJob.status === "needs_review" && <div className="button-row"><button className="primary-button" onClick={() => void doAction("apply", "apply")} disabled={Boolean(busy) || !["confirmed", "reschedule_requested"].includes(selectedJob.outcome || "")}>Approve and apply change</button><button className="secondary-button danger-outline" onClick={() => void doAction("reject", "reject")} disabled={Boolean(busy)}>Reject · keep shift unchanged</button></div>}{selectedJob.status === "applied" && <div className="success-note">✓ Human-approved scheduling change applied.</div>}{selectedJob.status === "rejected" && <div className="muted-note">Result rejected. The shift remains unchanged.</div>}</div><div className="evidence-panel"><p className="eyebrow">EVIDENCE</p><h4>Transcript</h4>{selectedJob.transcript.length ? selectedJob.transcript.map((turn, index) => <div className={`transcript-turn ${turn.speaker}`} key={`${turn.speaker}-${index}`}><span>{turn.speaker}</span><p>{turn.text}</p></div>) : <p className="muted-note">No transcript until the call reaches a terminal state.</p>}<h4 className="evidence-heading">Call evidence</h4>{selectedJob.evidence.map((item) => <p className="evidence-item" key={item}>• {item}</p>)}</div></div>}</div> : <div className="empty-state"><div className="empty-icon">☎</div><h3>No call job yet</h3><p>Choose an employee and shift, preview the task, then create an approval request.</p></div>}</section>

        <section className="lower-grid"><section className="panel history-panel"><div className="panel-heading"><div><p className="eyebrow">ACTIVITY</p><h2>History</h2></div></div>{state.jobs.length ? <div className="history-list">{state.jobs.map((job) => <button className={`history-row ${selectedJob?.id === job.id ? "selected" : ""}`} key={job.id} onClick={() => setSelectedJobId(job.id)}><span className={`history-dot ${job.status}`} /><span><strong>{employeeName(job.employeeId)}</strong><small>{shiftLabel(job.shiftId)}</small></span><span className={`status-text ${job.status}`}>{statusLabels[job.status]}</span><span className="chevron">›</span></button>)}</div> : <p className="muted-note">No calls or approval requests have been created.</p>}</section><section className="panel events-panel"><div className="panel-heading"><div><p className="eyebrow">AUDIT TRAIL</p><h2>Recent events</h2></div><span className="step-badge">{state.events.length}</span></div><div className="event-list">{state.events.slice(0, 8).map((event) => <div className="event-row" key={event.id}><span className="event-line" /><div><strong>{event.message}</strong><small>{new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></div></div>)}</div></section></section>
      </main>
      <footer className="footer">E-mploye for CALL-E · fake mode by default · human approval before scheduling changes</footer>
    </div>
  );
};

export default App;
