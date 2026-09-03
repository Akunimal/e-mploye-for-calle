# E-mploye for CALL-E

E-mploye is one configurable virtual employee for everyday business calls. It uses CALL-E to turn conversations into structured, reviewable actions while keeping a human responsible for every commitment.

The prototype ships with three task templates using the same virtual employee and the same safety-first execution engine:

- **Appointment desk** for service businesses: confirm or reschedule a customer appointment.
- **Lead follow-up** for sales teams: agree a qualified follow-up time with a prospect.
- **Shift coordination** for operations teams: confirm or renegotiate a team member's availability.

The full demo path uses appointment rescheduling. The other templates are runnable through the fake provider and share the same preview → approval → call → evidence → human decision flow.

## Safety-first behavior

- Fake mode is the default and places no real calls.
- A manager must create and authorize each call explicitly.
- Phone numbers are validated as E.164 and masked in the UI and event log.
- The CALL-E API key is server-only.
- Stable idempotency keys prevent duplicate provider calls during retries.
- Unknown, declined, failed, and incomplete results remain visible for human review.
- No appointment, follow-up, or shift change is applied automatically.
- There are no hidden recurring calls.

## Run locally

Requirements: Node.js 22+.

```bash
npm install
copy .env.example .env
npm run dev
```

Open <http://localhost:5173>. The API runs on port 8787 and the Vite dashboard on port 5173.

The default fake scenario can simulate confirmed, reschedule-requested, declined, unknown, and failed calls across all three task templates. Use **Reset demo** to return to the initial state, or use **Next case** to rotate through the two seeded demo paths.

## Public demo

The fake-only Vercel deployment is available at <https://e-mploye-for-calle.vercel.app>.

It never places real calls and keeps demo state in the serverless instance's temporary storage, so a cold start can restore the seeded demo data. Live CALL-E credentials are not configured in the public deployment.

See [docs/DEMO_RUNBOOK.md](docs/DEMO_RUNBOOK.md) for the complete judging flow and video checklist.

## Live CALL-E mode

Live mode is opt-in and becomes active only when the server has all three required pieces: `CALLE_LIVE_ENABLED=true`, a `CALLE_API_KEY`, and a controlled `CALLE_TEST_PHONE`. The dashboard exposes their readiness without ever returning the secret value to the browser:

```text
CALLE_API_KEY=your_server_side_key
CALLE_LIVE_ENABLED=true
CALLE_BASE_URL=https://api.heycall-e.com
CALLE_TEST_PHONE=+15551234567
CALLE_TEST_EMPLOYEE_ID=emp-ana
CALLE_TEST_REGION=US
CALLE_TEST_LOCALE=en-US
CALLE_DEFAULT_LANGUAGE=en-US
CALLE_DEFAULT_REGION=MX
```

Never put `CALLE_API_KEY` or `CALLE_TEST_PHONE` in frontend variables or commit them. Before a live demo, set one controlled E.164 test number through these server-only variables, verify the destination region and locale, and keep the manager approval step enabled. The public Vercel deployment overrides these values and stays fake-only. If any required piece is missing, the server safely falls back to the fake provider instead of claiming to be live.

The test number must belong to a CALL-E-supported recipient region and the region/locale must match. Argentina (`AR`) is not currently listed. The published integration guide says that international destinations use CALL-E's international phone lines and are primarily intended for testing; buying a phone number in the dashboard is not documented as a prerequisite for the one-shot Calls API. See the [CALL-E integrations guide](https://github.com/CALLE-AI/call-e-integrations#-supported-regions-and-languages) before attempting a live call.

The live provider uses the CALL-E Developer API to create an asynchronous call with `POST /v1/calls`, then reads status and structured evidence with `GET /v1/calls/{call_id}`. Provider cancellation is not claimed because the current API contract does not expose a cancellation operation.

## Tests and build

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Product model

E-mploye is intentionally one role, not a collection of separate agents:

```text
E-mploye · one virtual employee
    ├── Appointment desk
    ├── Lead follow-up
    └── Shift coordination
```

Each template supplies the business context, recipient language, task instruction, result interpretation, and final action. Calls, approvals, persistence, idempotency, evidence, retries, and cancellation remain shared capabilities.

## Architecture

```text
React dashboard
    ↓ choose task / preview / approve / refresh / apply
Node API
    ↓
CallWorkflow + JsonStateStore
    ├── FakeCallProvider (default)
    └── CalleApiProvider (explicit live mode)
```

The application stores recipients, scheduled context records, task type, call jobs, provider status, structured result, evidence, transcript, approvals, and event history in a local JSON snapshot for the prototype.

## Official contribution

The intended community contribution is a runnable TypeScript app under `apps/typescript/e-mploye-for-calle/` in [Awesome Phone Call Agents](https://github.com/CALLE-AI/awesome-phone-call-agents). Repository-facing material will remain in English and the official validation script will be run before opening a pull request.

## Provenance and limitations

E-mploye is a new application created for the CALL-E hackathon. It reuses selected author-owned ideas from an earlier prototype for persistence, safety, and interface foundations, but it is not a submission of that previous application. The single virtual employee concept, task catalog, CALL-E integration, phone workflow, status and result handling, safety boundaries, tests, documentation, and deployment were built for E-mploye.

This prototype intentionally keeps the business surface bounded: it demonstrates three repeatable workflows without pretending to be a full CRM, calendar, payroll, or workforce management system. Calendar/CRM adapters, recurring campaigns, multi-recipient escalation, reminders, and production integrations are future work.
