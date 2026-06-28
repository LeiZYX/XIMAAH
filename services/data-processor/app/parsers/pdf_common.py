from __future__ import annotations

import re
from io import BytesIO

import pdfplumber

MONTHS = (
    "January|February|March|April|May|June|July|August|September|"
    "October|November|December"
)
DATE_PATTERN = re.compile(rf"(\d{{1,2}}\s+(?:{MONTHS})\s+\d{{4}})", re.I)
DATE_AMPM_PATTERN = re.compile(rf"(\d{{1,2}}\s+(?:{MONTHS})\s+\d{{4}})\s*(am|pm)\b", re.I)
DURATION_PATTERN = re.compile(r"(\d+h(?:\s*\d+m)?|\d+m)", re.I)
SERIES_PATTERN = re.compile(r"(May/June|June|November)\s+(\d{4})", re.I)


def extract_pdf_text(content: bytes) -> str:
    lines: list[str] = []
    with pdfplumber.open(BytesIO(content)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            lines.extend(text.splitlines())
    return "\n".join(lines)


def parse_date(raw: str) -> str | None:
    match = DATE_PATTERN.search(raw)
    if not match:
        return None
    try:
        parsed = __import__("datetime").datetime.strptime(match.group(1), "%d %B %Y")
        return parsed.date().isoformat()
    except ValueError:
        try:
            parsed = __import__("datetime").datetime.strptime(match.group(1), "%d %b %Y")
            return parsed.date().isoformat()
        except ValueError:
            return None


def parse_duration(raw: str) -> int | None:
    normalized = re.sub(r"\s+", "", raw)
    hours_minutes = re.match(r"(\d+)h(?:(\d+)m)?", normalized, re.I)
    if hours_minutes:
        return int(hours_minutes.group(1)) * 60 + int(hours_minutes.group(2) or 0)
    minutes_only = re.match(r"(\d+)m", normalized, re.I)
    if minutes_only:
        return int(minutes_only.group(1))
    return None


def session_start_time(slot: str) -> str:
    return "13:30" if slot.lower() == "pm" else "09:00"


def extract_series_meta(text: str, default_series: str, default_year: int) -> tuple[str, int]:
    match = SERIES_PATTERN.search(text)
    if not match:
        return default_series, default_year
    series_label = match.group(1).replace("/", " ")
    return f"{series_label.title()} {match.group(2)}", int(match.group(2))
