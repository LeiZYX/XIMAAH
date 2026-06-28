from __future__ import annotations

import re
from collections import Counter

from app.models import (
    ImportPreviewRequest,
    ImportPreviewResponse,
    TimetableRow,
    ValidationIssue,
    ValidationSummary,
)

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIME_RE = re.compile(r"^\d{2}:\d{2}$")


def _validate_row(row: TimetableRow, index: int) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []

    if not DATE_RE.match(row.date):
        issues.append(
            ValidationIssue(
                row_index=index,
                severity="error",
                field="date",
                message=f"Invalid date format: {row.date}",
            )
        )

    if not row.subject.strip():
        issues.append(
            ValidationIssue(
                row_index=index,
                severity="error",
                field="subject",
                message="Subject is required",
            )
        )

    if not row.paper_code.strip():
        issues.append(
            ValidationIssue(
                row_index=index,
                severity="error",
                field="paper_code",
                message="Paper code is required",
            )
        )

    if not TIME_RE.match(row.start_time):
        issues.append(
            ValidationIssue(
                row_index=index,
                severity="warning",
                field="start_time",
                message=f"Unusual start time: {row.start_time}",
            )
        )

    if row.duration_minutes is not None and row.duration_minutes <= 0:
        issues.append(
            ValidationIssue(
                row_index=index,
                severity="warning",
                field="duration_minutes",
                message="Duration should be positive",
            )
        )

    if not row.title.strip():
        issues.append(
            ValidationIssue(
                row_index=index,
                severity="warning",
                field="title",
                message="Paper title is empty",
            )
        )

    return issues


def _build_summary(rows: list[TimetableRow]) -> ValidationSummary:
    qualifications = len({(row.qualification_level, row.syllabus_code[:4]) for row in rows})
    subjects = len({(row.syllabus_code, row.subject) for row in rows})
    papers = len({row.paper_code for row in rows})
    sessions = len({(row.paper_code, row.date, row.start_time) for row in rows})
    return ValidationSummary(
        qualifications=qualifications,
        subjects=subjects,
        papers=papers,
        sessions=sessions,
    )


def _ai_validation_notes(rows: list[TimetableRow], source: str) -> list[str]:
    notes: list[str] = []

    if len(rows) < 5:
        notes.append("Very few rows parsed — verify the uploaded file matches the expected board format.")

    duplicate_keys = Counter((row.paper_code, row.date, row.start_time) for row in rows)
    duplicate_count = sum(count - 1 for count in duplicate_keys.values() if count > 1)
    if duplicate_count:
        notes.append(f"{duplicate_count} duplicate session(s) detected in the parsed preview.")

    missing_duration = sum(1 for row in rows if row.duration_minutes is None)
    if missing_duration > len(rows) * 0.5:
        notes.append("More than half of rows are missing duration — check parser coverage.")

    if source == "cambridge-pdf" and not any("IGCSE" in row.qualification_level for row in rows):
        notes.append("No IGCSE rows detected — confirm this is a Cambridge International timetable.")

    if source == "pearson-excel" and not any(row.paper_code.count("/") >= 1 for row in rows):
        notes.append("Paper codes may not be normalised correctly for Pearson import.")

    return notes


def validate_import_preview(payload: ImportPreviewRequest) -> ImportPreviewResponse:
    issues: list[ValidationIssue] = []

    if not payload.rows:
        issues.append(
            ValidationIssue(
                severity="error",
                message="No rows supplied for validation",
            )
        )
        return ImportPreviewResponse(
            valid=False,
            row_count=0,
            issues=issues,
            summary=ValidationSummary(qualifications=0, subjects=0, papers=0, sessions=0),
            ai_notes=["Upload and parse a timetable before running validation."],
        )

    for index, row in enumerate(payload.rows):
        issues.extend(_validate_row(row, index))

    has_errors = any(issue.severity == "error" for issue in issues)
    summary = _build_summary(payload.rows)
    ai_notes = _ai_validation_notes(payload.rows, payload.source)

    return ImportPreviewResponse(
        valid=not has_errors,
        row_count=len(payload.rows),
        issues=issues,
        summary=summary,
        ai_notes=ai_notes,
    )
