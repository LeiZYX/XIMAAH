#!/usr/bin/env bash
# Run mysql/mysqladmin inside the mysql container using MYSQL_ROOT_PASSWORD from compose env.
set -euo pipefail

mysql_root_exec() {
  docker compose exec -T mysql sh -ec 'exec "$@"' sh "$@"
}

mysql_root_client() {
  mysql_root_exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$@"
}

mysql_root_ping() {
  mysql_root_exec mysqladmin ping -h localhost -uroot -p"$MYSQL_ROOT_PASSWORD" --silent
}

mysql_root_import_stdin() {
  mysql_root_exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD"
}
