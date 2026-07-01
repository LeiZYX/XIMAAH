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
uvicorn app.main:app --port 8001
```

Set in Next.js `.env`:

```
DATA_PROCESSOR_URL=http://localhost:8001
```

## Docker

**Production** (`docker-compose.yml`) — internal only, no host port:

```bash
docker compose up -d --build
```

The `app` service uses `DATA_PROCESSOR_URL=http://data-processor:8001`.

**Local dev** (`docker-compose.dev.yml`) — exposes `8001` on the host:

```bash
docker compose -f docker-compose.dev.yml up -d data-processor
```
