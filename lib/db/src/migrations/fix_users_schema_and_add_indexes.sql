-- ============================================================
-- Migration: fix_users_schema_and_add_indexes (CLEAN VERSION)
-- Description: Updated for manual execution without transaction conflicts
-- ============================================================

-- ─── 1. Fix users.property_id: nullable + set null on delete ───────────────
ALTER TABLE users ALTER COLUMN property_id DROP NOT NULL;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_property_id_fkey;

ALTER TABLE users
  ADD CONSTRAINT users_property_id_fkey
  FOREIGN KEY (property_id)
  REFERENCES properties(id)
  ON DELETE SET NULL;

-- ─── 2. Add tracking columns to users ─────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_login_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ─── 3. Performance indexes (Standard mode for error-free execution) ────────

-- Login query fix
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower
  ON users(lower(username));

-- users
CREATE INDEX IF NOT EXISTS idx_users_property_id
  ON users(property_id) WHERE property_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_status
  ON users(status);

-- employees
CREATE INDEX IF NOT EXISTS idx_employees_property_id
  ON employees(property_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_property_emp_id
  ON employees(property_id, employee_id);

CREATE INDEX IF NOT EXISTS idx_employees_property_status
  ON employees(property_id, status);

-- rooms
CREATE INDEX IF NOT EXISTS idx_rooms_property_id
  ON rooms(property_id);

CREATE INDEX IF NOT EXISTS idx_rooms_building_id
  ON rooms(building_id);

CREATE INDEX IF NOT EXISTS idx_rooms_property_status
  ON rooms(property_id, status);

-- assignments
CREATE INDEX IF NOT EXISTS idx_assignments_property_id
  ON assignments(property_id);

CREATE INDEX IF NOT EXISTS idx_assignments_employee_id
  ON assignments(employee_id);

CREATE INDEX IF NOT EXISTS idx_assignments_room_id
  ON assignments(room_id);

-- Partial index: active assignments only
CREATE INDEX IF NOT EXISTS idx_assignments_active
  ON assignments(property_id, status)
  WHERE lower(status) = 'active';

-- Departure alerts
CREATE INDEX IF NOT EXISTS idx_assignments_checkout_date
  ON assignments(property_id, expected_check_out_date)
  WHERE lower(status) = 'active';

-- reservations
CREATE INDEX IF NOT EXISTS idx_reservations_property_id
  ON reservations(property_id);

CREATE INDEX IF NOT EXISTS idx_reservations_property_status
  ON reservations(property_id, status);

-- Arrival alerts
CREATE INDEX IF NOT EXISTS idx_reservations_checkin_date
  ON reservations(property_id, check_in_date)
  WHERE lower(status) = 'upcoming';

-- maintenance
CREATE INDEX IF NOT EXISTS idx_maintenance_property_id
  ON maintenance(property_id);

CREATE INDEX IF NOT EXISTS idx_maintenance_property_status
  ON maintenance(property_id, status);

-- activity_logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_property_ts
  ON activity_logs(property_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id
  ON activity_logs(user_id);

-- ─── 4. ws_sessions table (WebSocket connection tracking) ──────────────
CREATE TABLE IF NOT EXISTS ws_sessions (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
  property_id  INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  session_key  TEXT    NOT NULL UNIQUE,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_ping_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  server_node  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE
);

-- Active connection tracking
CREATE UNIQUE INDEX IF NOT EXISTS idx_ws_sessions_user_property
  ON ws_sessions(user_id, property_id)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_ws_sessions_active
  ON ws_sessions(is_active, last_ping_at);