#!/usr/bin/env bash
set -e

# ============================================================================
# Household Management Add-on Entry Point
# Starts PostgreSQL, applies migrations, starts the Node.js backend, and nginx
# ============================================================================

# Source bashio library for HA add-on config access
# shellcheck source=/dev/null
source /usr/lib/bashio/bashio.sh

echo "============================================"
echo " Household Management Add-on Starting..."
echo "============================================"

# Read configuration from Home Assistant add-on options
DB_PASSWORD=$(bashio::config 'db_password')
DB_NAME=$(bashio::config 'db_name')
DB_USER=$(bashio::config 'db_user')

export DB_PASSWORD
export DB_NAME
export DB_USER

# ============================================================================
# PostgreSQL Setup
# ============================================================================

PGDATA="/config/postgres"

echo "[postgres] Initializing PostgreSQL..."

# Create directories for PostgreSQL
mkdir -p "$PGDATA" /run/postgresql
chown -R postgres:postgres "$PGDATA" /run/postgresql

# Initialize database if not already done
if [ ! -f "$PGDATA/PG_VERSION" ]; then
    echo "[postgres] First run - initializing database cluster..."
    su - postgres -c "initdb -D $PGDATA --auth=trust --encoding=UTF8"
    
    # Configure PostgreSQL for local connections
    echo "host all all 127.0.0.1/32 md5" >> "$PGDATA/pg_hba.conf"
    echo "local all all trust" >> "$PGDATA/pg_hba.conf"
    
    # Tune PostgreSQL for small devices (HA Green has 4GB RAM)
    cat >> "$PGDATA/postgresql.conf" <<EOF
listen_addresses = '127.0.0.1'
port = 5432
max_connections = 20
shared_buffers = 64MB
effective_cache_size = 256MB
work_mem = 4MB
maintenance_work_mem = 32MB
wal_buffers = 4MB
logging_collector = off
log_destination = 'stderr'
EOF
fi

# Start PostgreSQL
echo "[postgres] Starting PostgreSQL..."
su - postgres -c "pg_ctl start -D $PGDATA -l /config/postgres/logfile -w"

# Wait for PostgreSQL to be ready
echo "[postgres] Waiting for PostgreSQL to be ready..."
for i in $(seq 1 30); do
    if su - postgres -c "pg_isready -h 127.0.0.1" > /dev/null 2>&1; then
        echo "[postgres] PostgreSQL is ready!"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "[postgres] ERROR: PostgreSQL failed to start within 30 seconds"
        exit 1
    fi
    sleep 1
done

# Create database and user if they don't exist
echo "[postgres] Setting up database..."
su - postgres -c "psql -h 127.0.0.1 -tc \"SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER'\" | grep -q 1" || \
    su - postgres -c "psql -h 127.0.0.1 -c \"CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';\""

su - postgres -c "psql -h 127.0.0.1 -tc \"SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'\" | grep -q 1" || \
    su - postgres -c "psql -h 127.0.0.1 -c \"CREATE DATABASE $DB_NAME OWNER $DB_USER;\""

# Grant privileges
su - postgres -c "psql -h 127.0.0.1 -c \"GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;\""

# Apply schema
echo "[postgres] Applying database schema..."
su - postgres -c "psql -h 127.0.0.1 -d $DB_NAME -f /app/backend/schema.sql" 2>/dev/null || true

# Apply migrations
echo "[postgres] Applying migrations..."
for migration in /app/backend/migrations/*.sql; do
    if [ -f "$migration" ]; then
        echo "[postgres] Applying migration: $(basename "$migration")"
        su - postgres -c "psql -h 127.0.0.1 -d $DB_NAME -f $migration" 2>/dev/null || true
    fi
done

# Run seed script (only seeds if data doesn't exist due to ON CONFLICT)
echo "[postgres] Running seed script..."
export POSTGRES_USER="$DB_USER"
export POSTGRES_DB="$DB_NAME"
if [ -f /app/scripts/init-db.sh ]; then
    su - postgres -c "POSTGRES_USER=$DB_USER POSTGRES_DB=$DB_NAME bash /app/scripts/init-db.sh" 2>/dev/null || echo "[postgres] Seed script skipped or completed with warnings"
else
    echo "[postgres] No seed script found, skipping..."
fi

# Grant table permissions to app user
su - postgres -c "psql -h 127.0.0.1 -d $DB_NAME -c \"GRANT ALL ON ALL TABLES IN SCHEMA public TO $DB_USER; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;\""

echo "[postgres] Database setup complete!"

# ============================================================================
# Backend (Node.js) Setup
# ============================================================================

echo "[backend] Starting Node.js backend..."

cd /app/backend

# Set environment variables for the backend
export NODE_ENV=production
export PORT=3000
export HOST=0.0.0.0
export DB_HOST=127.0.0.1
export DB_PORT=5432
export CORS_ORIGIN="*"
export REMINDER_CHECK_INTERVAL=300000
export REMINDER_ADVANCE_HOURS=24

# Start the backend in the background
node dist/index.js &
BACKEND_PID=$!

# Wait for backend to be ready
echo "[backend] Waiting for backend to be ready..."
for i in $(seq 1 30); do
    if curl -s http://127.0.0.1:3000/health > /dev/null 2>&1; then
        echo "[backend] Backend is ready!"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "[backend] WARNING: Backend health check not responding after 30s"
    fi
    sleep 1
done

# ============================================================================
# Nginx Setup
# ============================================================================

echo "[nginx] Starting nginx on port 8023..."

# Start nginx in the foreground (keeps container alive)
nginx -g 'daemon off;' &
NGINX_PID=$!

echo "============================================"
echo " Household Management Add-on is running!"
echo " Web UI: port 8023 (via ingress)"
echo " API: port 3000 (internal)"
echo "============================================"

# ============================================================================
# Graceful Shutdown
# ============================================================================

shutdown() {
    echo "Shutting down Household Management Add-on..."
    
    # Stop nginx
    if [ -n "$NGINX_PID" ]; then
        kill "$NGINX_PID" 2>/dev/null || true
    fi
    
    # Stop backend
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    
    # Stop PostgreSQL
    su - postgres -c "pg_ctl stop -D $PGDATA -m fast" 2>/dev/null || true
    
    echo "Shutdown complete."
    exit 0
}

trap shutdown SIGTERM SIGINT

# Wait for any process to exit
wait
