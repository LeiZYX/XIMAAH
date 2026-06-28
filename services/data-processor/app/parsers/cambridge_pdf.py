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

# Cambridge IGCSE / A Level timetable patterns
SUBJECT_HEADER = re.compile(
    r"^(.+?)\s+(IGCSE|O Level|AS Level|A Level|International AS|International A)\s+(\d{4})\s*$",
    re.I,
)
SYLLABUS_LINE = re.compile(r"\b(\d{4}/\d{2})\b")
PAPER_COMPONENT = re.compile(r"^(\d{2}|[A-Z]\d?)(?=Paper|Component|Written|Practical|\s)", re.I)


def _map_level(level: str) -> str:
    normalized = level.strip().lower()
    if normalized in {"igcse", "o level"}:
        return "IGCSE"
    if "as" in normalized and "a level" not in normalized:
        return "AS Level"
    return "A Level"


def parse_cambridge_pdf(content: bytes, filename: str = "timetable.pdf") -> tuple[list[TimetableRow], str, int]:
    text = extract_pdf_text(content)
    series_name, year = extract_series_meta(text, "June 2026", 2026)

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

        if not subject:
            syllabus_match = SYLLABUS_LINE.search(line)
            if syllabus_match and not DATE_AMPM_PATTERN.search(line):
                parts = syllabus_match.group(1).split("/")
                syllabus_code = parts[0]
                subject = line.split(syllabus_match.group(1))[0].strip() or subject
                continue

        timing = DATE_AMPM_PATTERN.search(line)
        if not timing or not syllabus_code:
            continue

        code_match = SYLLABUS_LINE.search(line)
        paper_token = code_match.group(1) if code_match else f"{syllabus_code}/01"
        parsed_date = parse_date(timing.group(1))
        if not parsed_date:
            continue

        duration_match = DURATION_PATTERN.search(line)
        title = line
        if duration_match:
            title = line[: duration_match.start()].strip()
        title = re.sub(rf"^{re.escape(paper_token)}\s*", "", title).strip() or paper_token

        rows.append(
            TimetableRow(
                date=parsed_date,
                qualification_level=qualification_level or "IGCSE",
                syllabus_code=syllabus_code,
                paper_code=paper_token if "/" in paper_token else f"{syllabus_code}/{paper_token}",
                subject=subject or "Unknown",
                title=title,
                start_time=session_start_time(timing.group(2)),
                duration_minutes=parse_duration(duration_match.group(1)) if duration_match else None,
            )
        )

    if not rows:
        raise ValueError(f"No timed exam rows found in Cambridge PDF: {filename}")

    return rows, series_name, year
