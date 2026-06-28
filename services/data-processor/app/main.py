from __future__ import annotations

import os

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.models import ImportPreviewRequest, ImportPreviewResponse, ParseResponse, TimetableMeta
from app.parsers.cambridge_pdf import parse_cambridge_pdf
from app.parsers.oxfordaqa_pdf import parse_oxfordaqa_pdf
from app.parsers.pearson_excel import parse_pearson_excel
from app.validation.import_preview import validate_import_preview

app = FastAPI(
    title="XIMA Data Processor",
    description="Parse and validate exam timetable imports for XIMA Assessment Hub",
    version="0.1.0",
)

allowed_origins = os.getenv("DATA_PROCESSOR_CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "xima-data-processor"}


@app.post("/parse/pearson-excel", response_model=ParseResponse)
async def parse_pearson_excel_endpoint(file: UploadFile = File(...)) -> ParseResponse:
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Upload an Excel file (.xlsx or .xls)")

    content = await file.read()
    try:
        rows = parse_pearson_excel(content, file.filename)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    return ParseResponse(
        source="pearson-excel",
        rows=rows,
        meta=TimetableMeta(
            series_name="Pearson Edexcel",
            year=2026,
            exam_board="EDEXCEL",
            source_filename=file.filename,
        ),
        row_count=len(rows),
    )


@app.post("/parse/cambridge-pdf", response_model=ParseResponse)
async def parse_cambridge_pdf_endpoint(file: UploadFile = File(...)) -> ParseResponse:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Upload a PDF file")

    content = await file.read()
    try:
        rows, series_name, year = parse_cambridge_pdf(content, file.filename)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    return ParseResponse(
        source="cambridge-pdf",
        rows=rows,
        meta=TimetableMeta(
            series_name=series_name,
            year=year,
            exam_board="CIE",
            source_filename=file.filename,
        ),
        row_count=len(rows),
    )


@app.post("/parse/oxfordaqa-pdf", response_model=ParseResponse)
async def parse_oxfordaqa_pdf_endpoint(file: UploadFile = File(...)) -> ParseResponse:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Upload a PDF file")

    content = await file.read()
    try:
        rows, series_name, year = parse_oxfordaqa_pdf(content, file.filename)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    return ParseResponse(
        source="oxfordaqa-pdf",
        rows=rows,
        meta=TimetableMeta(
            series_name=series_name,
            year=year,
            exam_board="OXFORDAQA",
            source_filename=file.filename,
        ),
        row_count=len(rows),
    )


@app.post("/validate/import-preview", response_model=ImportPreviewResponse)
def validate_import_preview_endpoint(payload: ImportPreviewRequest) -> ImportPreviewResponse:
    return validate_import_preview(payload)
