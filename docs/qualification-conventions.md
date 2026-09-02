# Qualification conventions (Phase 1 baseline)

This document records the operational model used while qualification data is normalized over later phases.

## Principles

1. **Subject is the operational identifier.** Users pick Subject in cash-in, fee rules, and (where applicable) calendar flows.
2. **Qualification is derived, not chosen.** When a flow receives `subjectId`, the server resolves `qualificationId` from `subject.qualificationId` before persisting or matching fees.
/**
 * Do not delete or merge qualifications until Phase 4 tooling has been
 * dry-run and applied deliberately. Phase 1–3 are read-only or forward-looking.
 */

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
- Fee Schedule CASH_IN create (subject optional; qualification derived)
- Cash-in Excel import (board + subject code; qualification columns optional)
- Calendar filter UX unchanged (level pills + board + qualification/subject/series)

## Admin Qualifications page

Read/write still available for metadata and rare fixes. Prefer Subjects + timetable import for operational data.

## Phase 3 — UX alignment

- Fee Schedule CASH_IN: no qualification dropdown (subject-first)
- Cash-in import: subject-first resolution
- Calendar: **keeps** Qualification level pills, Exam board, Qualification / Subject / Series dropdowns (unchanged filter UX)
- Admin qualifications: description clarifies metadata role

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

## Phase 4 — historical merge (destructive)

Merges all qualifications that share the same **exam board + level** into one **level-based** qualification (`code = null`). **Subject IDs never change.**

### What it updates

| Table | Action |
|-------|--------|
| `Subject` | `qualificationId` → canonical |
| `FeeRule` / `FeeSchedule` / `CashInCode` / `CashInRequest` / `Resource` | remap `qualificationId` |
| Old qualifications | delete when empty |

### Pre-checks (hard stop)

- Inventory `fkMismatchCount` must be `0`
- No duplicate `subject.code` across different subjects in the same board+level

### Commands

```bash
# 1. Backup first (production)
npm run backup:database
# or your host backup script

# 2. Gate
npm run db:audit-qualifications -- --fail-on-mismatch

# 3. Dry-run (default — no writes)
npm run db:merge-qualifications -- --dry-run
npm run db:merge-qualifications -- --dry-run --output=tmp/merge-plan.json

# 4. Apply (maintenance window)
npm run db:merge-qualifications -- --apply --output=tmp/merge-result.json

# 5. Verify
npm run db:audit-qualifications -- --output=tmp/post-merge-inventory.json
```

### Production notes

- Prefer **staging full replay** before production
- Keep a DB backup / snapshot you can restore
- App can stay up for dry-run; for `--apply`, prefer a short maintenance window
- No Prisma schema migration is required for this merge
- After success, `syllabusStyleQualificationCount` should drop sharply
