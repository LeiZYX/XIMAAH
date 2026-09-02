# Qualification conventions (Phase 1 baseline)

This document records the operational model used while qualification data is normalized over later phases.

## Principles

1. **Subject is the operational identifier.** Users pick Subject in cash-in, fee rules, and (where applicable) calendar flows.
2. **Qualification is derived, not chosen.** When a flow receives `subjectId`, the server resolves `qualificationId` from `subject.qualificationId` before persisting or matching fees.
3. **Do not delete or merge qualifications until Phase 4.** Phase 1–3 are read-only or forward-looking (new imports / UX only).

## Current data reality

Importers (Edexcel/AQA/generic timetable) often create:

- one `Qualification` per syllabus (`code = syllabusCode`, `name = "{level} {subject}"`)
- one `Subject` under that qualification (`code = syllabusCode`)

This is flagged as **syllabus-style** by the audit script. It is expected today and not an FK error.

## FK consistency rules

These entities store both `qualificationId` and `subjectId`. They must stay aligned:

| Entity | Rule |
|--------|------|
| `FeeRule` | When `subjectId` is set, `qualificationId === subject.qualificationId` |
| `FeeSchedule` | When both are set, same rule |
| `CashInCode` | Always aligned with subject |
| `CashInRequest` | Always aligned with subject |

**FK mismatch** = blocking issue for Phase 4 migration. Run the audit before any merge.

## Flows already subject-first

- Cash-in Requests create (POST `/api/cash-in-requests`)
- Cash-in Codes create (POST `/api/cash-in-codes`)
- Registration fee rules create (POST `/api/registration-windows/[id]/fee-rules`)

## Flows that still expose Qualification in UI

- Fee Schedule (CASH_IN) — optional qualification filter (Phase 3)
- Calendar filters (Phase 3)
- Cash-in Excel import columns (Phase 3)

## Audit tooling

```bash
# Human-readable summary
npm run db:audit-qualifications

# JSON report file (for staging baseline)
npm run db:audit-qualifications -- --output=tmp/qualification-inventory.json

# CI / gate before migration
npm run db:audit-qualifications -- --fail-on-mismatch
```

## Regression baseline (manual)

Before Phase 4, record pass/fail on staging:

- [ ] Create cash-in draft → correct code + quote
- [ ] Submit cash-in → fee statement → pay → sent to board
- [ ] Create cash-in code (subject only)
- [ ] Add registration fee rule (subject only) → billing preview unchanged
- [ ] Audit script: `fkMismatchCount === 0`

## Phase 2 — importer behaviour (new imports only)

Timetable importers (`edexcel`, `aqa`, `generic-timetable`) now:

1. **Reuse existing subjects** on the same exam board by `subject.code` (syllabus code), even when they still sit under legacy per-syllabus qualifications.
2. **Create new subjects** under a **level-based qualification** (`code = null`, one per board + level).
3. **Do not migrate** historical qualification rows automatically.

After deploying Phase 2, re-run the audit script and compare `syllabusStyleQualificationCount` over time — it should stop growing for newly imported syllabi, while legacy rows remain until Phase 4.
