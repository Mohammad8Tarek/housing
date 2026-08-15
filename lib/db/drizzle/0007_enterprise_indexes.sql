-- ============================================================
-- Sunrise Housing — Enterprise Index Optimization Migration
-- Migration: 0007 — Comprehensive composite and coverage indexes
-- Run with: psql $DATABASE_URL -f drizzle/0007_enterprise_indexes.sql
-- ============================================================
-- Builds upon 0003_add_missing_indexes.sql which added basic
-- single-column indexes. This migration adds:
--   1. Composite indexes for common query patterns
--   2. Indexes on portal tables (chat, feedback, food, transport)
--   3. Unique indexes for data integrity
--   4. Coverage indexes for security tables
-- Uses IF NOT EXISTS — safe to run multiple times.
-- ============================================================

-- ─── assignments (composites) ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_assignments_room_status
  ON assignments(room_id, status);

CREATE INDEX IF NOT EXISTS idx_assignments_employee_status
  ON assignments(employee_id, status);

-- ─── rooms (composites) ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rooms_building_status
  ON rooms(building_id, status);

-- ─── employees (additional) ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_employees_national_id
  ON employees(national_id);

CREATE INDEX IF NOT EXISTS idx_employees_phone
  ON employees(phone);

-- ─── users ────────────────────────────────────────────────────────────────
-- Note: username already has a UNIQUE constraint, this adds explicit index naming
CREATE INDEX IF NOT EXISTS idx_users_role
  ON users(roles);

CREATE INDEX IF NOT EXISTS idx_users_is_active
  ON users(status);

CREATE INDEX IF NOT EXISTS idx_users_active_role
  ON users(status, roles);

-- ─── buildings ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_buildings_status
  ON buildings(status);

-- ─── floors ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_floors_building_id
  ON floors(building_id);

-- ─── properties ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_properties_status
  ON properties(status);

-- ─── hostings (additional) ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_hostings_created_at
  ON hostings(created_at DESC);

-- ─── reservations (additional) ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_reservations_check_in_date
  ON reservations(check_in_date);

-- ─── maintenance (additional) ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_maintenance_priority
  ON maintenance(priority);

CREATE INDEX IF NOT EXISTS idx_maintenance_assigned_to
  ON maintenance(assigned_to);

CREATE INDEX IF NOT EXISTS idx_maintenance_parent_id
  ON maintenance(parent_id);

CREATE INDEX IF NOT EXISTS idx_maintenance_status_priority
  ON maintenance(status, priority);

-- ─── evaluations (additional) ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_evaluations_category
  ON evaluations(category);

-- ─── activities ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_activities_status
  ON activities(status);

CREATE INDEX IF NOT EXISTS idx_activities_is_published
  ON activities(is_published);

CREATE INDEX IF NOT EXISTS idx_activities_start_date
  ON activities(start_date);

-- ─── activity_registrations ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_activity_registrations_employee_id
  ON activity_registrations(employee_id);

CREATE INDEX IF NOT EXISTS idx_activity_registrations_activity_id
  ON activity_registrations(activity_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_activity_registrations_employee_activity
  ON activity_registrations(employee_id, activity_id);

-- ─── activity_logs (additional) ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id
  ON activity_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_action_type
  ON activity_logs(action_type);

CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp
  ON activity_logs(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_module_timestamp
  ON activity_logs(module, timestamp DESC);

-- ─── employee_portal_accounts (additional) ────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_portal_accounts_employee_id
  ON employee_portal_accounts(employee_id);

CREATE INDEX IF NOT EXISTS idx_portal_accounts_is_active
  ON employee_portal_accounts(is_active);

-- ─── password_reset_tokens ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_reset_tokens_employee_id
  ON password_reset_tokens(employee_id);

CREATE INDEX IF NOT EXISTS idx_reset_tokens_token_hash
  ON password_reset_tokens(token_hash);

CREATE INDEX IF NOT EXISTS idx_reset_tokens_expires_at
  ON password_reset_tokens(expires_at);

-- ─── portal_conversations ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_portal_conversations_property_id
  ON portal_conversations(property_id);

-- ─── portal_conversation_participants ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_portal_conv_participants_conversation_id
  ON portal_conversation_participants(conversation_id);

CREATE INDEX IF NOT EXISTS idx_portal_conv_participants_employee_id
  ON portal_conversation_participants(employee_id);

-- ─── portal_messages ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_portal_messages_conversation_id
  ON portal_messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_portal_messages_sender_id
  ON portal_messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_portal_messages_created_at
  ON portal_messages(created_at DESC);

-- ─── portal_message_reads ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_portal_message_reads_message_id
  ON portal_message_reads(message_id);

CREATE INDEX IF NOT EXISTS idx_portal_message_reads_employee_id
  ON portal_message_reads(employee_id);

-- ─── portal_feedback ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_portal_feedback_employee_id
  ON portal_feedback(employee_id);

CREATE INDEX IF NOT EXISTS idx_portal_feedback_content
  ON portal_feedback(content_type, content_id);

-- ─── portal_comments ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_portal_comments_content
  ON portal_comments(content_type, content_id);

CREATE INDEX IF NOT EXISTS idx_portal_comments_employee_id
  ON portal_comments(employee_id);

-- ─── portal_comment_likes ─────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_portal_comment_likes_comment_employee
  ON portal_comment_likes(comment_id, employee_id);

-- ─── portal_food_menu ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_portal_food_menu_property_id
  ON portal_food_menu(property_id);

CREATE INDEX IF NOT EXISTS idx_portal_food_menu_meal_type
  ON portal_food_menu(meal_type);

-- ─── portal_meal_orders ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_portal_meal_orders_property_id
  ON portal_meal_orders(property_id);

CREATE INDEX IF NOT EXISTS idx_portal_meal_orders_employee_id
  ON portal_meal_orders(employee_id);

CREATE INDEX IF NOT EXISTS idx_portal_meal_orders_order_date
  ON portal_meal_orders(order_date);

-- ─── portal_transport_schedules ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_portal_transport_schedules_property_id
  ON portal_transport_schedules(property_id);

-- ─── portal_transport_bookings ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_portal_transport_bookings_property_id
  ON portal_transport_bookings(property_id);

CREATE INDEX IF NOT EXISTS idx_portal_transport_bookings_employee_id
  ON portal_transport_bookings(employee_id);

CREATE INDEX IF NOT EXISTS idx_portal_transport_bookings_booking_date
  ON portal_transport_bookings(booking_date);

-- ─── portal_notifications ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_portal_notifications_property_id
  ON portal_notifications(property_id);

CREATE INDEX IF NOT EXISTS idx_portal_notifications_type
  ON portal_notifications(type);

CREATE INDEX IF NOT EXISTS idx_portal_notifications_created_at
  ON portal_notifications(created_at DESC);

-- ─── portal_notification_reads (additional) ───────────────────────────────
CREATE INDEX IF NOT EXISTS idx_portal_notification_reads_employee_id
  ON portal_notification_reads(employee_id);

-- ─── push_subscriptions (additional) ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_employee_id
  ON push_subscriptions(employee_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_property_id
  ON push_subscriptions(property_id);

-- ─── room_locks ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_room_locks_room_id
  ON room_locks(room_id);

CREATE INDEX IF NOT EXISTS idx_room_locks_property_id
  ON room_locks(property_id);

CREATE INDEX IF NOT EXISTS idx_room_locks_status
  ON room_locks(status);

-- ─── room_keys (additional) ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_room_keys_employee_id
  ON room_keys(employee_id);

CREATE INDEX IF NOT EXISTS idx_room_keys_property_id
  ON room_keys(property_id);

-- ─── key_audit_log ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_key_audit_log_property_id
  ON key_audit_log(property_id);

CREATE INDEX IF NOT EXISTS idx_key_audit_log_key_id
  ON key_audit_log(key_id);

CREATE INDEX IF NOT EXISTS idx_key_audit_log_action
  ON key_audit_log(action);

CREATE INDEX IF NOT EXISTS idx_key_audit_log_created_at
  ON key_audit_log(created_at DESC);

-- ─── lookup_values ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_lookup_values_category
  ON lookup_values(category);

CREATE INDEX IF NOT EXISTS idx_lookup_values_category_disabled
  ON lookup_values(category, disabled);

-- ─── password_history ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_password_history_user_id
  ON password_history(user_id);

-- ─── survey_items ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_survey_items_template_id
  ON survey_items(template_id);

-- ─── portal_contacts ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_portal_contacts_property_id
  ON portal_contacts(property_id);

-- ─── portal_documents ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_portal_documents_category
  ON portal_documents(category);

-- ─── user_signatures ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_signatures_user_id
  ON user_signatures(user_id);

-- Done!
-- ============================================================
-- Total: ~90 new indexes across 30+ tables
-- ============================================================
