from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class TimetableRow(BaseModel):
    date: str
    qualification_level: str
    syllabus_code: str
    paper_code: str
    subject: str
    title: str
    start_time: str
    duration_minutes: int | None = None


class TimetableMeta(BaseModel):
    series_name: str
    year: int
    exam_board: str
    source_filename: str | None = None


class ParseResponse(BaseModel):
    source: str
    rows: list[TimetableRow]
    meta: TimetableMeta
    row_count: int


class ValidationIssue(BaseModel):
    row_index: int | None = None
    severity: Literal["error", "warning"]
    field: str | None = None
    message: str


class ValidationSummary(BaseModel):
    qualifications: int
    subjects: int
    papers: int
    sessions: int


class ImportPreviewRequest(BaseModel):
    source: Literal["pearson-excel", "cambridge-pdf", "oxfordaqa-pdf", "aqa-pdf"]
    rows: list[TimetableRow]
    meta: TimetableMeta


class ImportPreviewResponse(BaseModel):
    valid: bool
    row_count: int
    issues: list[ValidationIssue]
    summary: ValidationSummary
    ai_notes: list[str] = Field(default_factory=list)
