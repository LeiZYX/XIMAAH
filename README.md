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
docker compose up -d mysql phpmyadmin
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

## CSV Import Format

See the Import page in the admin dashboard for full documentation. Each row requires an `entity` column:

- `examboard` — name, code, description
- `subject` — name, code, qualificationId
- `paper` — code, title, subjectId, duration
- `exam_session` — paperId, examSeriesId, date, startTime, endTime, venue
- `key_date` — title, date, type, description, examBoardId, subjectId, examSeriesId
