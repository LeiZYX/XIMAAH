# XIMA Data Processor

Python FastAPI service for exam timetable parsing and import validation.
Next.js handles authentication, permissions, and database writes.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health check |
| POST | `/parse/pearson-excel` | Parse Pearson Edexcel XLSX timetable |
| POST | `/parse/cambridge-pdf` | Parse Cambridge International PDF timetable |
| POST | `/parse/oxfordaqa-pdf` | Parse Oxford AQA PDF timetable |
| POST | `/validate/import-preview` | Validate parsed rows before import |

## Run locally

```bash
cd services/data-processor
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

Set in Next.js `.env`:

```
DATA_PROCESSOR_URL=http://localhost:8001
```

## Docker

From the repo root:

```bash
docker compose up data-processor
```
