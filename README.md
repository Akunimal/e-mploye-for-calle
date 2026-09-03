# E-mploye for CALL-E

E-mploye uses CALL-E to coordinate employee shifts through real phone conversations, converting spoken responses into structured scheduling actions.

The MVP implements one vertical workflow: a manager previews a proposed shift change, explicitly authorizes a call, CALL-E asks the employee about availability, and the manager approves or rejects the resulting scheduling action.

## Safety-first behavior

- Fake mode is the default and places no real calls.
- A manager must create and authorize each call explicitly.
- Phone numbers are validated as E.164 and masked in the UI and event log.
- The CALL-E API key is server-only.
- Stable idempotency keys prevent duplicate provider calls during retries.
- Unknown, declined, failed, and incomplete results remain visible for human review.
- No shift changes are applied automatically.
- There are no hidden recurring calls.

## Run locally

Requirements: Node.js 22+.

```bash
npm install
copy .env.example .env
npm run dev
```

Open <http://localhost:5173>. The API runs on port 8787 and the Vite dashboard on port 5173.

The default fake scenario can simulate confirmed, reschedule-requested, declined, unknown, and failed calls. Use **Reset demo** to return to the initial state.

## Public demo

The fake-only Vercel deployment is available at <https://e-mploye-for-calle.vercel.app>.

It never places real calls and keeps demo state in the serverless instance's temporary storage, so a cold start can restore the seeded demo data. Live CALL-E credentials are not configured in the public deployment.

See [docs/DEMO_RUNBOOK.md](docs/DEMO_RUNBOOK.md) for the complete judging flow and video checklist.

## Live CALL-E mode

Live mode is opt-in:

```text
CALLE_API_KEY=your_server_side_key
CALLE_LIVE_ENABLED=true
CALLE_BASE_URL=https://api.heycall-e.com
CALLE_TEST_PHONE=+15551234567
CALLE_TEST_EMPLOYEE_ID=emp-ana
CALLE_DEFAULT_LANGUAGE=en-US
CALLE_DEFAULT_REGION=MX
```

Never put `CALLE_API_KEY` or `CALLE_TEST_PHONE` in frontend variables or commit them. Before a live demo, set one controlled E.164 test number through these server-only variables, verify the destination region and locale, and keep the manager approval step enabled. The public Vercel deployment overrides these values and stays fake-only.

The live provider uses the CALL-E Developer API to create an asynchronous call with `POST /v1/calls`, then reads status and structured evidence with `GET /v1/calls/{call_id}`. Provider cancellation is not claimed because the current API contract does not expose a cancellation operation.

## Tests and build

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Architecture

```text
React dashboard
    ↓ preview / approve / refresh / apply
Node API
    ↓
CallWorkflow + JsonStateStore
    ├── FakeCallProvider (default)
    └── CalleApiProvider (explicit live mode)
```

The application stores employees, shifts, call jobs, provider status, structured result, evidence, transcript, approvals, and event history in a local JSON snapshot for the prototype.

## Official contribution

The intended community contribution is a runnable TypeScript app under `apps/typescript/e-mploye-for-calle/` in [Awesome Phone Call Agents](https://github.com/CALLE-AI/awesome-phone-call-agents). Repository-facing material will remain in English and the official validation script will be run before opening a pull request.

## Provenance and limitations

E-mploye is a new application created for the CALL-E hackathon. It reuses selected author-owned ideas from an earlier prototype for persistence, safety, and interface foundations, but it is not a submission of that previous application. The CALL-E integration, phone workflow, status and result handling, safety boundaries, tests, documentation, and deployment were built for E-mploye.

This MVP implements shift rescheduling only. Shift confirmations, cancellations, availability checks, reminders, escalations, and production scheduling integrations are future work.
