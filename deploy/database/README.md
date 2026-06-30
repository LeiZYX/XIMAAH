# Baseline database

`xima_assessment_hub_baseline.sql.gz` is a full MySQL dump (schema + seed data + `_prisma_migrations`).

## Regenerate (development)

```bash
./scripts/export-baseline-database.sh
git add deploy/database/xima_assessment_hub_baseline.sql.gz
git commit -m "Update baseline database dump"
git push
```

## Restore (production server)

```bash
git pull
cp .env.production .env
./scripts/restore-baseline-database.sh
```

This rebuilds the MySQL container and imports the dump. No `prisma migrate deploy` is required.
