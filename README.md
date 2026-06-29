# XIMA Assessment Hub

Exam planning and scheduling for assessment centres. Manage exam boards, qualifications, subjects, papers, exam series, sessions, and key dates — then view everything in a filterable calendar.

## Tech Stack

- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **MySQL** + **Prisma**
- **FullCalendar**

## Getting Started

### Prerequisites

- Node.js 20+
- MySQL database

### Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment file and set your database URL:

```bash
cp .env.example .env
```

3. Start MySQL and phpMyAdmin (Docker):

```bash
docker compose -f docker-compose.dev.yml up -d mysql phpmyadmin
```

phpMyAdmin: http://localhost:8080 (root / rootpassword)

4. Apply migrations and seed sample data:

```bash
npm run db:migrate
npm run db:seed
```

4. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll land on the calendar view.

## Features

### Admin Dashboard (`/admin`)

- **Exam Boards** — AQA, Edexcel, OCR, etc.
- **Qualifications** — GCSE, A-Level linked to boards
- **Subjects** — Subject codes under qualifications
- **Papers** — Individual exam papers with duration
- **Exam Series** — Summer 2026, November resits, etc.
- **Exam Sessions** — Scheduled sittings with time and venue
- **Key Dates** — Deadlines, results days, registration windows
- **Import** — Bulk CSV import for all entity types

### Calendar (`/calendar`)

- Month, week, and list views via FullCalendar
- Filter by exam board, subject, and exam series
- Toggle exam sessions and key dates
- Click events for detail panel

## Data Model

```
ExamBoard
  └── Qualification
        └── Subject
              └── Paper
                    └── ExamSession ← ExamSeries
  └── ExamSeries
  └── KeyDate (optional links to Subject / ExamSeries)
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Generate Prisma client and build |
| `npm run db:migrate` | Apply migrations (preferred) |
| `npm run db:push` | Push schema without migration files |
| `npm run db:seed` | Seed sample data |
| `npm run db:studio` | Open Prisma Studio |

## Production Deployment (Ubuntu + Docker Compose)

Production stack: **Next.js app** + **MySQL 8** in Docker, with **Nginx** on the Ubuntu host as reverse proxy for `https://exam.shssip-iedu.cn`.

### Prerequisites

- Ubuntu server with Docker Engine and Docker Compose plugin
- Nginx installed on the host
- DNS `exam.shssip-iedu.cn` pointing to the server

### Deploy steps

1. Copy the production environment template:

```bash
cp .env.production.example .env
```

2. Edit `.env` — set strong values for `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD`, `AUTH_SECRET`, `ADMIN_PASSWORD`, and ensure `DATABASE_URL` uses host `mysql` (the Docker service name).

3. Build and start containers:

```bash
docker compose up -d --build
```

4. Apply database migrations:

```bash
docker compose exec app npx prisma migrate deploy
```

5. Seed initial data (admin user and sample records):

```bash
docker compose exec app npx prisma db seed
```

6. Configure Nginx on the host:

```bash
sudo cp deploy/nginx/exam.shssip-iedu.cn.conf /etc/nginx/sites-available/exam.shssip-iedu.cn.conf
sudo ln -sf /etc/nginx/sites-available/exam.shssip-iedu.cn.conf /etc/nginx/sites-enabled/
sudo certbot --nginx -d exam.shssip-iedu.cn
sudo nginx -t && sudo systemctl reload nginx
```

The app container listens on `127.0.0.1:3000` only. MySQL is not exposed publicly.

### Production files

| File | Purpose |
|------|---------|
| `Dockerfile` | Production Next.js image (`prisma generate`, `next build`, `npm run start`) |
| `docker-compose.yml` | Production `app` + `mysql` services |
| `docker-compose.dev.yml` | Local dev MySQL / phpMyAdmin / data-processor |
| `.env.production.example` | Production environment template |
| `deploy/nginx/exam.shssip-iedu.cn.conf` | Nginx reverse proxy config |
| `scripts/backup-mysql.sh` | MySQL backup to `backups/mysql/` |
| `scripts/restore-mysql.sh` | Restore MySQL from a backup file |

### Database backup & restore

```bash
chmod +x scripts/backup-mysql.sh scripts/restore-mysql.sh
./scripts/backup-mysql.sh
./scripts/restore-mysql.sh backups/mysql/xima_assessment_hub_YYYYMMDD_HHMMSS.sql.gz
```

### Useful commands

```bash
docker compose logs -f app
docker compose ps
docker compose exec app npx prisma migrate deploy
docker compose up -d --build
```

## CSV Import Format

See the Import page in the admin dashboard for full documentation. Each row requires an `entity` column:

- `examboard` — name, code, description
- `subject` — name, code, qualificationId
- `paper` — code, title, subjectId, duration
- `exam_session` — paperId, examSeriesId, date, startTime, endTime, venue
- `key_date` — title, date, type, description, examBoardId, subjectId, examSeriesId
