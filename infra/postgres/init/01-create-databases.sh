set -euo pipefail

create_service_db() {
  local db_name=$1 db_user=$2 db_password=$3

  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<EOSQL
CREATE ROLE ${db_user} WITH LOGIN PASSWORD '${db_password}';
CREATE DATABASE ${db_name} OWNER ${db_user};
REVOKE ALL ON DATABASE ${db_name} FROM PUBLIC;
EOSQL

  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db_name" <<EOSQL
CREATE EXTENSION IF NOT EXISTS citext;
EOSQL

  echo "Created database ${db_name} owned by ${db_user}"
}

create_service_db auth_db      "$AUTH_DB_USER"      "$AUTH_DB_PASSWORD"
create_service_db placement_db "$PLACEMENT_DB_USER" "$PLACEMENT_DB_PASSWORD"
create_service_db community_db "$COMMUNITY_DB_USER" "$COMMUNITY_DB_PASSWORD"