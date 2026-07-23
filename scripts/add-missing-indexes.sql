-- ============================================================
-- Sunrise Housing — Missing Indexes Migration
-- File: scripts/add-missing-indexes.sql
-- Run with: psql $DATABASE_URL -f scripts/add-missing-indexes.sql
-- ============================================================
-- Uses CONCURRENTLY where possible to avoid locking tables.
-- Safe to run multiple times (IF NOT EXISTS).
-- ============================================================

-- ─── Schema columns that were previously added via startup ALTER TABLE ────
-- These are safe no-ops if columns already exist:

ALTER TABLE users ADD COLUMN IF NOT EXISTS property_ids integer[] NOT NULL DEFAULT '{}';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- ─── assignments ──────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignments_employee_id
  ON assignments(employee_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignments_room_id
  ON assignments(room_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignments_status
  ON assignments(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignments_created_at
  ON assignments(created_at DESC);

-- ─── rooms ────────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rooms_building_id
  ON rooms(building_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rooms_floor_id
  ON rooms(floor_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rooms_status
  ON rooms(status);

-- ─── employees ────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employees_employee_id
  ON employees(employee_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employees_status
  ON employees(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employees_department
  ON employees(department);

-- ─── hostings ─────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hostings_employee_id
  ON hostings(employee_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hostings_room_id
  ON hostings(room_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hostings_status
  ON hostings(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hostings_expected_from
  ON hostings(expected_from);

-- ─── reservations ─────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reservations_employee_id
  ON reservations(employee_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reservations_room_id
  ON reservations(room_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reservations_status
  ON reservations(status);

-- ─── maintenance ──────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_maintenance_room_id
  ON maintenance(room_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_maintenance_status
  ON maintenance(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_maintenance_created_at
  ON maintenance(created_at DESC);

-- ─── activity_logs ────────────────────────────────────────────────────────
-- This table is VERY hot — every user action logs here
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_logs_property_id
  ON activity_logs(property_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_logs_created_at
  ON activity_logs(created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_logs_module
  ON activity_logs(module);

-- ─── room_keys ────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_room_keys_room_id
  ON room_keys(room_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_room_keys_status
  ON room_keys(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_room_keys_assignment_id
  ON room_keys(assignment_id);

-- ─── employee_portal_accounts ─────────────────────────────────────────────
-- Hot table — every portal login queries this
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portal_accounts_employee_id
  ON employee_portal_accounts(employee_id);

-- ─── hosting_companions ───────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hosting_companions_hosting_id
  ON hosting_companions(hosting_id);

-- ─── evaluations ──────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_evaluations_employee_id
  ON evaluations(employee_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_evaluations_status
  ON evaluations(status);

-- Done!
-- ============================================================
