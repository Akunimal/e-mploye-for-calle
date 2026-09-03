# Public demo runbook

Public URL: <https://e-mploye-for-calle.vercel.app>

The production deployment is fake-only. It never places a real phone call, and the fake response selector lets a reviewer exercise every outcome without spending CALL-E credits. E-mploye is one virtual employee with three task templates; the public demo uses two seeded cases so every judge sees the same reproducible product surface.

## Primary video path: safe reschedule

1. Open the public URL and point out `FAKE · NO CALLS` and `1 AI employee` in the header.
2. Point out the three task cards: **Appointment desk**, **Lead follow-up**, and **Shift coordination**.
3. Keep the first seeded case, **Appointment desk** for Luna Studio, with **Requests another time** selected.
4. Click **Preview task**. Show the masked phone number, language/region, exact task, and `Safety checks passed`.
5. Click **Create approval request**. Explain that previewing does not call anyone.
6. Click **Authorize call**. This is the explicit manager approval boundary.
7. Wait for the fake call to complete, or click **Refresh**. The job should reach **Result needs review**.
8. Show the structured result, confidence, alternate date/time, transcript, and evidence.
9. Click **Approve and apply change**. The shift should become **rescheduled** for `2026-09-08 · 10:00`.
10. Point out the audit trail events and the human-approved success message.

## Second seeded case

After resetting the demo, click **Next case**. The dashboard loads **Team availability** for Calle Ops with a confirmed fake response. Repeat the same preview → authorize → review → apply sequence. This demonstrates that the same E-mploye identity and approval engine work for a different business context.

The **Lead follow-up** card is a third runnable template for exploration. It is covered by automated tests and uses the same fake outcomes.

## Optional safety branches

Use **Reset demo** between branches so the screen stays clean.

| Scenario | Expected result | Manager action |
| --- | --- | --- |
| Confirmed | Structured `confirmed` result | Apply → shift becomes `confirmed` |
| Requests another time | Structured alternate date/time | Apply → scheduled item becomes `rescheduled` |
| Declined | Structured `declined` result | Reject → shift remains unchanged |
| Unknown / unclear | Structured `unknown` result | Apply is disabled; keep it for review or reject |
| Provider failure | Failed call with no shift mutation | Retry safely or close |
| Queued fake call | Fake call remains in progress | Cancel simulated call |

## Talking points

- One E-mploye identity can be configured for different business tasks.
- The manager previews the exact instruction before any call.
- Each call requires explicit authorization and uses a stable idempotency key.
- Phone numbers are masked in the UI and audit trail.
- Structured results are evidence, not automatic appointment, follow-up, or shift mutations.
- Unknown, declined, and failed outcomes stay under human control.
- The public deployment is deliberately fake-only; live CALL-E mode remains opt-in and server-side.

## Reset before handing off

Click **Reset demo** before recording the final frame so the reviewer starts from the seeded employee list and empty call history.

## Controlled live verification (local only)

The public Vercel deployment must remain fake-only. For the one live CALL-E proof, configure a local `.env` with a server-side key and one authorized E.164 test number:

```text
CALLE_API_KEY=your_server_side_key
CALLE_LIVE_ENABLED=true
CALLE_TEST_PHONE=your_authorized_e164_test_number
CALLE_TEST_EMPLOYEE_ID=emp-ana
CALLE_TEST_REGION=US
CALLE_TEST_LOCALE=en-US
```

Run the local server, verify the preview shows the masked test number, authorize the call once, and inspect the returned status/result before applying any scheduling change. The number must be yours or explicitly authorized and must match one of CALL-E's currently supported recipient regions; Argentina (`AR`) is not currently listed as supported. CALL-E documents international lines as primarily intended for testing and does not document buying a dashboard phone number as a prerequisite for the one-shot Calls API. Never commit this `.env` or put the key in frontend variables.
