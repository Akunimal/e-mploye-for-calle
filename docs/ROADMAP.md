# E-mploye for CALL-E roadmap

## Implemented base

- Independent Node.js 22+ repository.
- React/Vite English dashboard.
- Fake CALL-E provider by default.
- Live direct HTTP provider behind `CALLE_LIVE_ENABLED=true`.
- Employee and shift seed data using fictional reserved phone numbers.
- Preview → manager approval → provider call → status polling → structured result → human approval/rejection.
- Atomic JSON persistence, masked phone output, stable idempotency keys, visible failure states, safe retry, and fake cancellation.
- Tests for persistence, safety, provider request construction, and workflow transitions.

## Next work

1. Run the controlled live CALL-E smoke test with a test number and account credentials.
2. Confirm current destination/locale support and tune the result schema against the live API.
3. Add optional webhook reconciliation if polling is insufficient for deployment.
4. Add deployment-specific secret configuration and health checks.
5. Package the contribution at `apps/typescript/e-mploye-for-calle/` in the official repository.
6. Run the official validation script and create the contribution PR.
7. Record the public demo video and prepare the Devpost submission.
