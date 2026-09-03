# Product scope

## Product thesis

E-mploye is one virtual employee for routine business phone work. A business owner configures the task, E-mploye prepares and places the CALL-E conversation, then a human reviews the evidence before any appointment, follow-up, or shift commitment is changed.

The product is multirubro through task configuration, not through a collection of unrelated agents. The employee keeps one consistent identity, disclosure, approval boundary, and audit trail.

## Initial task catalog

| Task template | Business context | Recipient | Human-approved output |
| --- | --- | --- | --- |
| Appointment desk | Service businesses | Customer | Confirm or reschedule an appointment |
| Lead follow-up | Sales teams | Prospect | Confirm or move a follow-up time |
| Shift coordination | Operations teams | Team member | Confirm or renegotiate a shift |

All three templates use the same CALL-E provider interface, idempotency key, event log, persisted state, structured result schema, evidence panel, retry path, and human decision gate. The template changes the task instruction and the language used to explain the result.

## Demo strategy

The public demo is fake-only and deterministic. It opens with a seeded appointment-rescheduling case and offers a second seeded team-availability case through **Next case**. This gives every judge a repeatable pair of business contexts while keeping the full video focused on one end-to-end flow.

The lead follow-up template is also available from the task catalog and is covered by automated tests. Judges can exercise any outcome with the fake provider without consuming a CALL-E call.

## Deliberate boundaries

- One virtual employee, one recipient per call, and one explicit manager approval per call.
- No hidden recurring calls, bulk campaigns, automatic commitments, credential collection, payment handling, or sensitive personal data.
- The current scheduled context record stands in for an appointment, follow-up slot, or shift so the prototype can show the approval loop without requiring a calendar or CRM integration.
- Production adapters for calendars, CRMs, workforce systems, and webhooks can be added behind the same workflow/provider contract later.
