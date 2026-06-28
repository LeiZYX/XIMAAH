from __future__ import annotations

import re

from app.models import TimetableRow
from app.parsers.pdf_common import (
    DATE_AMPM_PATTERN,
    DURATION_PATTERN,
    extract_pdf_text,
    extract_series_meta,
    parse_date,
    parse_duration,
    session_start_time,
)

# Oxford AQA timetables follow a layout similar to AQA
SUBJECT_HEADER = re.compile(r"^(.+?)\s+(A-level|AS|GCSE)\s+(\d{4})\s*$", re.I)


def _map_level(level: str) -> str:
    upper = level.upper()
    if upper == "AS":
        return "AS Level"
    if upper == "GCSE":
        return "GCSE"
    return "A Level"


def _extract_paper_component(rest: str) -> str | None:
    match = re.match(
        r"^(\d+[A-Z]?|[A-Z])(?=Paper|Unit|Non-exam|Study|Externally|Portfolio|[A-Z][a-z])",
        rest,
    )
    return match.group(1) if match else None


def _parse_exam_line(
    line: str,
    subject: str,
    qualification_level: str,
    syllabus_code: str,
) -> TimetableRow | None:
    timing = DATE_AMPM_PATTERN.search(line)
    if not timing:
        return None

    prefix = f"{syllabus_code}/"
    prefix_index = line.find(prefix)
    if prefix_index < 0:
        return None

    before_timing = line[: timing.start()].strip()
    rest = before_timing[prefix_index + len(prefix) :]
    component = _extract_paper_component(rest)
    if not component:
        return None

    title_part = rest[len(component) :]
    duration_match = DURATION_PATTERN.search(title_part)
    if not duration_match:
        return None

    title = title_part[: duration_match.start()].strip()
    parsed_date = parse_date(timing.group(1))
    if not parsed_date or not title:
        return None

    return TimetableRow(
        date=parsed_date,
        qualification_level=qualification_level,
        syllabus_code=syllabus_code,
        paper_code=f"{syllabus_code}/{component}",
        subject=subject,
        title=title,
        start_time=session_start_time(timing.group(2)),
        duration_minutes=parse_duration(duration_match.group(1)),
    )


def parse_oxfordaqa_pdf(content: bytes, filename: str = "timetable.pdf") -> tuple[list[TimetableRow], str, int]:
    text = extract_pdf_text(content)
    series_name, year = extract_series_meta(text, "Summer 2026", 2026)

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    rows: list[TimetableRow] = []
    subject = ""
    qualification_level = ""
    syllabus_code = ""

    for line in lines:
        header = SUBJECT_HEADER.match(line)
        if header:
            subject = header.group(1).strip()
            qualification_level = _map_level(header.group(2))
            syllabus_code = header.group(3)
            continue

        if not subject or not syllabus_code:
            continue

        exam_row = _parse_exam_line(line, subject, qualification_level, syllabus_code)
        if exam_row:
            rows.append(exam_row)

    if not rows:
        raise ValueError(f"No timed exam rows found in Oxford AQA PDF: {filename}")

    return rows, series_name, year
