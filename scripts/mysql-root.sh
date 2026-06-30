#!/usr/bin/env bash
# Run mysql/mysqladmin inside the mysql container using MYSQL_ROOT_PASSWORD from compose env.
set -euo pipefail

mysql_root_ping() {
  docker compose exec -T mysql sh -ec 'mysqladmin ping -h localhost -uroot -p"$MYSQL_ROOT_PASSWORD" --silent'
}

mysql_root_import_stdin() {
  docker compose exec -T mysql sh -ec 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD"'
}

mysql_root_dump() {
  local database="$1"
  docker compose exec -T mysql sh -ec \
    'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers --databases '"${database}"
}
