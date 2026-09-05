-- ============================================================
-- MASTER MIGRATION: 20260904_complete_schema_and_constraints.sql
-- Description: Complete schema definitions, column additions, indexes & constraints
-- Applicable to: Both public schema and all tenant schemas (taal_housing, el_waha_new, etc.)
-- Safe & Idempotent: Can be executed multiple times without errors or data loss
-- ============================================================

DO $$
DECLARE
  schema_names text[];
  current_schema text;
BEGIN
  -- 1. Ensure required extensions exist in public
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";

  -- 2. First snapshot all target schemas into an array so NO table cursors are open
  SELECT array_agg(s_name) INTO schema_names FROM (
    SELECT 'public' AS s_name
    UNION
    SELECT schema_name AS s_name 
    FROM public.properties 
    WHERE schema_name IS NOT NULL AND schema_name <> ''
  ) t;

  IF schema_names IS NULL THEN
    schema_names := ARRAY['public'];
  END IF;

  FOREACH current_schema IN ARRAY schema_names
  LOOP
    RAISE NOTICE '>>> Applying master migrations to schema: %', current_schema;
    EXECUTE 'SET search_path TO ' || quote_ident(current_schema) || ', public';

    -- --------------------------------------------------------
    -- Table: activities
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "activities" (
      "id" SERIAL PRIMARY KEY,
      "title_ar" TEXT,
      "title_en" TEXT,
      "description_ar" TEXT,
      "description_en" TEXT,
      "category" TEXT DEFAULT 'general'::text,
      "location_ar" TEXT,
      "location_en" TEXT,
      "start_date" DATE,
      "end_date" DATE,
      "start_time" TEXT,
      "max_participants" INTEGER,
      "status" TEXT DEFAULT 'planned'::text,
      "created_at" TIMESTAMPTZ DEFAULT now(),
      "cover_image" TEXT,
      "expires_at" TIMESTAMPTZ,
      "is_published" BOOLEAN DEFAULT false,
      "target_departments" TEXT[] DEFAULT '{}'::text[]
    );

    -- Ensure all columns exist
    ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "title_ar" TEXT;
    ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "title_en" TEXT;
    ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "description_ar" TEXT;
    ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "description_en" TEXT;
    ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT 'general'::text;
    ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "location_ar" TEXT;
    ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "location_en" TEXT;
    ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "start_date" DATE;
    ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "end_date" DATE;
    ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "start_time" TEXT;
    ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "max_participants" INTEGER;
    ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'planned'::text;
    ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "cover_image" TEXT;
    ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ;
    ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "is_published" BOOLEAN DEFAULT false;
    ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "target_departments" TEXT[] DEFAULT '{}'::text[];

    -- --------------------------------------------------------
    -- Table: activity_logs
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "activity_logs" (
      "id" SERIAL PRIMARY KEY,
      "property_id" INTEGER,
      "username" TEXT,
      "user_id" INTEGER,
      "user_role" TEXT,
      "action" TEXT,
      "action_type" TEXT DEFAULT 'INFO'::text,
      "module" TEXT DEFAULT 'system'::text,
      "severity" TEXT DEFAULT 'info'::text,
      "entity_type" TEXT,
      "entity_id" BIGINT,
      "timestamp" TIMESTAMPTZ DEFAULT now(),
      "details" TEXT,
      "ip_address" TEXT,
      "user_agent" TEXT
    );

    -- Ensure all columns exist
    ALTER TABLE "activity_logs" ADD COLUMN IF NOT EXISTS "property_id" INTEGER;
    ALTER TABLE "activity_logs" ADD COLUMN IF NOT EXISTS "username" TEXT;
    ALTER TABLE "activity_logs" ADD COLUMN IF NOT EXISTS "user_id" INTEGER;
    ALTER TABLE "activity_logs" ADD COLUMN IF NOT EXISTS "user_role" TEXT;
    ALTER TABLE "activity_logs" ADD COLUMN IF NOT EXISTS "action" TEXT;
    ALTER TABLE "activity_logs" ADD COLUMN IF NOT EXISTS "action_type" TEXT DEFAULT 'INFO'::text;
    ALTER TABLE "activity_logs" ADD COLUMN IF NOT EXISTS "module" TEXT DEFAULT 'system'::text;
    ALTER TABLE "activity_logs" ADD COLUMN IF NOT EXISTS "severity" TEXT DEFAULT 'info'::text;
    ALTER TABLE "activity_logs" ADD COLUMN IF NOT EXISTS "entity_type" TEXT;
    ALTER TABLE "activity_logs" ADD COLUMN IF NOT EXISTS "entity_id" BIGINT;
    ALTER TABLE "activity_logs" ADD COLUMN IF NOT EXISTS "timestamp" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "activity_logs" ADD COLUMN IF NOT EXISTS "details" TEXT;
    ALTER TABLE "activity_logs" ADD COLUMN IF NOT EXISTS "ip_address" TEXT;
    ALTER TABLE "activity_logs" ADD COLUMN IF NOT EXISTS "user_agent" TEXT;

    -- --------------------------------------------------------
    -- Table: activity_registrations
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "activity_registrations" (
      "id" SERIAL PRIMARY KEY,
      "profile_id" INTEGER,
      "activity_id" INTEGER,
      "status" TEXT DEFAULT 'joined'::text,
      "created_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "activity_registrations" ADD COLUMN IF NOT EXISTS "profile_id" INTEGER;
    ALTER TABLE "activity_registrations" ADD COLUMN IF NOT EXISTS "activity_id" INTEGER;
    ALTER TABLE "activity_registrations" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'joined'::text;
    ALTER TABLE "activity_registrations" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: assignments
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "assignments" (
      "id" SERIAL PRIMARY KEY,
      "property_id" INTEGER,
      "profile_id" INTEGER,
      "room_id" INTEGER,
      "bed_number" INTEGER,
      "check_in_date" TEXT,
      "expected_check_out_date" TEXT,
      "check_out_date" TEXT,
      "notes" TEXT DEFAULT ''::text,
      "status" TEXT DEFAULT 'ACTIVE'::text,
      "created_at" TIMESTAMPTZ DEFAULT now(),
      "contract_end_date" TEXT,
      "is_entire_room" BOOLEAN DEFAULT false
    );

    -- Ensure all columns exist
    ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "property_id" INTEGER;
    ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "profile_id" INTEGER;
    ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "room_id" INTEGER;
    ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "bed_number" INTEGER;
    ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "check_in_date" TEXT;
    ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "expected_check_out_date" TEXT;
    ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "check_out_date" TEXT;
    ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT ''::text;
    ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'ACTIVE'::text;
    ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "contract_end_date" TEXT;
    ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "is_entire_room" BOOLEAN DEFAULT false;

    -- --------------------------------------------------------
    -- Table: buildings
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "buildings" (
      "id" SERIAL PRIMARY KEY,
      "property_id" INTEGER,
      "name" TEXT,
      "location" TEXT DEFAULT ''::text,
      "capacity" INTEGER DEFAULT 0,
      "status" TEXT DEFAULT 'active'::text,
      "created_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "buildings" ADD COLUMN IF NOT EXISTS "property_id" INTEGER;
    ALTER TABLE "buildings" ADD COLUMN IF NOT EXISTS "name" TEXT;
    ALTER TABLE "buildings" ADD COLUMN IF NOT EXISTS "location" TEXT DEFAULT ''::text;
    ALTER TABLE "buildings" ADD COLUMN IF NOT EXISTS "capacity" INTEGER DEFAULT 0;
    ALTER TABLE "buildings" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'active'::text;
    ALTER TABLE "buildings" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: evaluations
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "evaluations" (
      "id" SERIAL PRIMARY KEY,
      "profile_id" INTEGER,
      "rating" REAL,
      "comment" TEXT,
      "category" TEXT DEFAULT 'general'::text,
      "submitted_at" TIMESTAMPTZ DEFAULT now(),
      "created_at" TIMESTAMPTZ DEFAULT now(),
      "title_ar" TEXT,
      "title_en" TEXT,
      "description_ar" TEXT,
      "description_en" TEXT,
      "department" TEXT,
      "profile_rating" REAL,
      "profile_response" TEXT,
      "expires_at" TIMESTAMPTZ,
      "status" TEXT DEFAULT 'pending'::text
    );

    -- Ensure all columns exist
    ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "profile_id" INTEGER;
    ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "rating" REAL;
    ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "comment" TEXT;
    ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT 'general'::text;
    ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "title_ar" TEXT;
    ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "title_en" TEXT;
    ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "description_ar" TEXT;
    ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "description_en" TEXT;
    ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "department" TEXT;
    ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "profile_rating" REAL;
    ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "profile_response" TEXT;
    ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ;
    ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'pending'::text;

    -- --------------------------------------------------------
    -- Table: floors
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "floors" (
      "id" SERIAL PRIMARY KEY,
      "property_id" INTEGER,
      "building_id" INTEGER,
      "floor_number" TEXT,
      "description" TEXT DEFAULT ''::text,
      "created_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "floors" ADD COLUMN IF NOT EXISTS "property_id" INTEGER;
    ALTER TABLE "floors" ADD COLUMN IF NOT EXISTS "building_id" INTEGER;
    ALTER TABLE "floors" ADD COLUMN IF NOT EXISTS "floor_number" TEXT;
    ALTER TABLE "floors" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT ''::text;
    ALTER TABLE "floors" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: hosting_companions
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "hosting_companions" (
      "id" SERIAL PRIMARY KEY,
      "hosting_id" INTEGER,
      "name" TEXT,
      "id_number" TEXT,
      "relation" TEXT,
      "is_child" INTEGER DEFAULT 0,
      "age" INTEGER,
      "created_at" TIMESTAMPTZ DEFAULT now(),
      "document_type" TEXT,
      "document_image" TEXT,
      "document_file_name" TEXT
    );

    -- Ensure all columns exist
    ALTER TABLE "hosting_companions" ADD COLUMN IF NOT EXISTS "hosting_id" INTEGER;
    ALTER TABLE "hosting_companions" ADD COLUMN IF NOT EXISTS "name" TEXT;
    ALTER TABLE "hosting_companions" ADD COLUMN IF NOT EXISTS "id_number" TEXT;
    ALTER TABLE "hosting_companions" ADD COLUMN IF NOT EXISTS "relation" TEXT;
    ALTER TABLE "hosting_companions" ADD COLUMN IF NOT EXISTS "is_child" INTEGER DEFAULT 0;
    ALTER TABLE "hosting_companions" ADD COLUMN IF NOT EXISTS "age" INTEGER;
    ALTER TABLE "hosting_companions" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "hosting_companions" ADD COLUMN IF NOT EXISTS "document_type" TEXT;
    ALTER TABLE "hosting_companions" ADD COLUMN IF NOT EXISTS "document_image" TEXT;
    ALTER TABLE "hosting_companions" ADD COLUMN IF NOT EXISTS "document_file_name" TEXT;

    -- --------------------------------------------------------
    -- Table: hosting_request_approval_steps
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "hosting_request_approval_steps" (
      "id" SERIAL PRIMARY KEY,
      "request_id" INTEGER,
      "step_order" INTEGER,
      "role_required" VARCHAR(50),
      "status" VARCHAR(30) DEFAULT 'pending'::character varying,
      "signed_by_user_id" INTEGER,
      "signed_at" TIMESTAMPTZ,
      "signature_image_url_snapshot" TEXT,
      "comment" TEXT,
      "created_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "hosting_request_approval_steps" ADD COLUMN IF NOT EXISTS "request_id" INTEGER;
    ALTER TABLE "hosting_request_approval_steps" ADD COLUMN IF NOT EXISTS "step_order" INTEGER;
    ALTER TABLE "hosting_request_approval_steps" ADD COLUMN IF NOT EXISTS "role_required" VARCHAR(50);
    ALTER TABLE "hosting_request_approval_steps" ADD COLUMN IF NOT EXISTS "status" VARCHAR(30) DEFAULT 'pending'::character varying;
    ALTER TABLE "hosting_request_approval_steps" ADD COLUMN IF NOT EXISTS "signed_by_user_id" INTEGER;
    ALTER TABLE "hosting_request_approval_steps" ADD COLUMN IF NOT EXISTS "signed_at" TIMESTAMPTZ;
    ALTER TABLE "hosting_request_approval_steps" ADD COLUMN IF NOT EXISTS "signature_image_url_snapshot" TEXT;
    ALTER TABLE "hosting_request_approval_steps" ADD COLUMN IF NOT EXISTS "comment" TEXT;
    ALTER TABLE "hosting_request_approval_steps" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: hosting_requests
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "hosting_requests" (
      "id" SERIAL PRIMARY KEY,
      "request_number" VARCHAR(20),
      "property_id" INTEGER,
      "hotel_id" INTEGER,
      "visit_hotel_id" INTEGER,
      "requester_user_id" INTEGER,
      "profile_name" VARCHAR(200),
      "clock_number" VARCHAR(50),
      "department" VARCHAR(150),
      "position" VARCHAR(150),
      "number_of_rooms" INTEGER,
      "family_members_count" INTEGER,
      "family_members_included" VARCHAR(100),
      "from_date" DATE,
      "to_date" DATE,
      "consumed_days" INTEGER,
      "remarks" TEXT,
      "status" VARCHAR(30) DEFAULT 'in_signing'::character varying,
      "current_step_order" INTEGER DEFAULT 1,
      "rejected_at_step" INTEGER,
      "rejection_reason" TEXT,
      "created_at" TIMESTAMPTZ DEFAULT now(),
      "updated_at" TIMESTAMPTZ DEFAULT now(),
      "guest_hosting_id" INTEGER,
      "guest_hosting_status" VARCHAR(30),
      "assigned_room_id" INTEGER,
      "attachment_data" TEXT
    );

    -- Ensure all columns exist
    ALTER TABLE "hosting_requests" ADD COLUMN IF NOT EXISTS "request_number" VARCHAR(20);
    ALTER TABLE "hosting_requests" ADD COLUMN IF NOT EXISTS "property_id" INTEGER;
    ALTER TABLE "hosting_requests" ADD COLUMN IF NOT EXISTS "hotel_id" INTEGER;
    ALTER TABLE "hosting_requests" ADD COLUMN IF NOT EXISTS "visit_hotel_id" INTEGER;
    ALTER TABLE "hosting_requests" ADD COLUMN IF NOT EXISTS "requester_user_id" INTEGER;
    ALTER TABLE "hosting_requests" ADD COLUMN IF NOT EXISTS "profile_name" VARCHAR(200);
    ALTER TABLE "hosting_requests" ADD COLUMN IF NOT EXISTS "clock_number" VARCHAR(50);
    ALTER TABLE "hosting_requests" ADD COLUMN IF NOT EXISTS "department" VARCHAR(150);
    ALTER TABLE "hosting_requests" ADD COLUMN IF NOT EXISTS "position" VARCHAR(150);
    ALTER TABLE "hosting_requests" ADD COLUMN IF NOT EXISTS "number_of_rooms" INTEGER;
    ALTER TABLE "hosting_requests" ADD COLUMN IF NOT EXISTS "family_members_count" INTEGER;
    ALTER TABLE "hosting_requests" ADD COLUMN IF NOT EXISTS "family_members_included" VARCHAR(100);
    ALTER TABLE "hosting_requests" ADD COLUMN IF NOT EXISTS "from_date" DATE;
    ALTER TABLE "hosting_requests" ADD COLUMN IF NOT EXISTS "to_date" DATE;
    ALTER TABLE "hosting_requests" ADD COLUMN IF NOT EXISTS "consumed_days" INTEGER;
    ALTER TABLE "hosting_requests" ADD COLUMN IF NOT EXISTS "remarks" TEXT;
    ALTER TABLE "hosting_requests" ADD COLUMN IF NOT EXISTS "status" VARCHAR(30) DEFAULT 'in_signing'::character varying;
    ALTER TABLE "hosting_requests" ADD COLUMN IF NOT EXISTS "current_step_order" INTEGER DEFAULT 1;
    ALTER TABLE "hosting_requests" ADD COLUMN IF NOT EXISTS "rejected_at_step" INTEGER;
    ALTER TABLE "hosting_requests" ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT;
    ALTER TABLE "hosting_requests" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "hosting_requests" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "hosting_requests" ADD COLUMN IF NOT EXISTS "guest_hosting_id" INTEGER;
    ALTER TABLE "hosting_requests" ADD COLUMN IF NOT EXISTS "guest_hosting_status" VARCHAR(30);
    ALTER TABLE "hosting_requests" ADD COLUMN IF NOT EXISTS "assigned_room_id" INTEGER;
    ALTER TABLE "hosting_requests" ADD COLUMN IF NOT EXISTS "attachment_data" TEXT;

    -- --------------------------------------------------------
    -- Table: hostings
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "hostings" (
      "id" SERIAL PRIMARY KEY,
      "property_id" INTEGER,
      "profile_id" INTEGER,
      "hosting_type" TEXT DEFAULT 'SAME_ROOM'::text,
      "guests_count" INTEGER DEFAULT 1,
      "expected_from" TEXT,
      "expected_to" TEXT,
      "actual_check_in" TEXT,
      "actual_check_out" TEXT,
      "room_id" INTEGER,
      "room_type" TEXT,
      "status" TEXT DEFAULT 'PENDING'::text,
      "notes" TEXT DEFAULT ''::text,
      "created_by" TEXT,
      "created_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "hostings" ADD COLUMN IF NOT EXISTS "property_id" INTEGER;
    ALTER TABLE "hostings" ADD COLUMN IF NOT EXISTS "profile_id" INTEGER;
    ALTER TABLE "hostings" ADD COLUMN IF NOT EXISTS "hosting_type" TEXT DEFAULT 'SAME_ROOM'::text;
    ALTER TABLE "hostings" ADD COLUMN IF NOT EXISTS "guests_count" INTEGER DEFAULT 1;
    ALTER TABLE "hostings" ADD COLUMN IF NOT EXISTS "expected_from" TEXT;
    ALTER TABLE "hostings" ADD COLUMN IF NOT EXISTS "expected_to" TEXT;
    ALTER TABLE "hostings" ADD COLUMN IF NOT EXISTS "actual_check_in" TEXT;
    ALTER TABLE "hostings" ADD COLUMN IF NOT EXISTS "actual_check_out" TEXT;
    ALTER TABLE "hostings" ADD COLUMN IF NOT EXISTS "room_id" INTEGER;
    ALTER TABLE "hostings" ADD COLUMN IF NOT EXISTS "room_type" TEXT;
    ALTER TABLE "hostings" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'PENDING'::text;
    ALTER TABLE "hostings" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT ''::text;
    ALTER TABLE "hostings" ADD COLUMN IF NOT EXISTS "created_by" TEXT;
    ALTER TABLE "hostings" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: hr_sync_config
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "hr_sync_config" (
      "id" SERIAL PRIMARY KEY,
      "property_id" INTEGER,
      "api_url" TEXT DEFAULT ''::text,
      "api_key" TEXT DEFAULT ''::text,
      "field_mapping" JSONB DEFAULT '{}'::jsonb,
      "is_active" BOOLEAN DEFAULT false,
      "last_sync_at" TIMESTAMPTZ,
      "created_at" TIMESTAMPTZ DEFAULT now(),
      "updated_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "hr_sync_config" ADD COLUMN IF NOT EXISTS "property_id" INTEGER;
    ALTER TABLE "hr_sync_config" ADD COLUMN IF NOT EXISTS "api_url" TEXT DEFAULT ''::text;
    ALTER TABLE "hr_sync_config" ADD COLUMN IF NOT EXISTS "api_key" TEXT DEFAULT ''::text;
    ALTER TABLE "hr_sync_config" ADD COLUMN IF NOT EXISTS "field_mapping" JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE "hr_sync_config" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;
    ALTER TABLE "hr_sync_config" ADD COLUMN IF NOT EXISTS "last_sync_at" TIMESTAMPTZ;
    ALTER TABLE "hr_sync_config" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "hr_sync_config" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: hr_sync_log
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "hr_sync_log" (
      "id" SERIAL PRIMARY KEY,
      "property_id" INTEGER,
      "sync_type" TEXT DEFAULT 'manual'::text,
      "status" TEXT DEFAULT 'pending'::text,
      "records_processed" INTEGER DEFAULT 0,
      "records_created" INTEGER DEFAULT 0,
      "records_updated" INTEGER DEFAULT 0,
      "errors" TEXT,
      "started_at" TIMESTAMPTZ DEFAULT now(),
      "completed_at" TIMESTAMPTZ
    );

    -- Ensure all columns exist
    ALTER TABLE "hr_sync_log" ADD COLUMN IF NOT EXISTS "property_id" INTEGER;
    ALTER TABLE "hr_sync_log" ADD COLUMN IF NOT EXISTS "sync_type" TEXT DEFAULT 'manual'::text;
    ALTER TABLE "hr_sync_log" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'pending'::text;
    ALTER TABLE "hr_sync_log" ADD COLUMN IF NOT EXISTS "records_processed" INTEGER DEFAULT 0;
    ALTER TABLE "hr_sync_log" ADD COLUMN IF NOT EXISTS "records_created" INTEGER DEFAULT 0;
    ALTER TABLE "hr_sync_log" ADD COLUMN IF NOT EXISTS "records_updated" INTEGER DEFAULT 0;
    ALTER TABLE "hr_sync_log" ADD COLUMN IF NOT EXISTS "errors" TEXT;
    ALTER TABLE "hr_sync_log" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "hr_sync_log" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ;

    -- --------------------------------------------------------
    -- Table: key_audit_log
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "key_audit_log" (
      "id" SERIAL PRIMARY KEY,
      "property_id" INTEGER,
      "key_id" INTEGER,
      "action" TEXT,
      "performed_by" INTEGER,
      "card_number" TEXT,
      "room_number" TEXT,
      "details" JSONB,
      "created_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "key_audit_log" ADD COLUMN IF NOT EXISTS "property_id" INTEGER;
    ALTER TABLE "key_audit_log" ADD COLUMN IF NOT EXISTS "key_id" INTEGER;
    ALTER TABLE "key_audit_log" ADD COLUMN IF NOT EXISTS "action" TEXT;
    ALTER TABLE "key_audit_log" ADD COLUMN IF NOT EXISTS "performed_by" INTEGER;
    ALTER TABLE "key_audit_log" ADD COLUMN IF NOT EXISTS "card_number" TEXT;
    ALTER TABLE "key_audit_log" ADD COLUMN IF NOT EXISTS "room_number" TEXT;
    ALTER TABLE "key_audit_log" ADD COLUMN IF NOT EXISTS "details" JSONB;
    ALTER TABLE "key_audit_log" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: lookup_values
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "lookup_values" (
      "id" SERIAL PRIMARY KEY,
      "property_id" INTEGER,
      "category" TEXT,
      "value" TEXT,
      "parent_value" TEXT,
      "sort_order" INTEGER DEFAULT 0,
      "created_at" TIMESTAMPTZ DEFAULT now(),
      "disabled" BOOLEAN DEFAULT false,
      "extra_value" TEXT
    );

    -- Ensure all columns exist
    ALTER TABLE "lookup_values" ADD COLUMN IF NOT EXISTS "property_id" INTEGER;
    ALTER TABLE "lookup_values" ADD COLUMN IF NOT EXISTS "category" TEXT;
    ALTER TABLE "lookup_values" ADD COLUMN IF NOT EXISTS "value" TEXT;
    ALTER TABLE "lookup_values" ADD COLUMN IF NOT EXISTS "parent_value" TEXT;
    ALTER TABLE "lookup_values" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER DEFAULT 0;
    ALTER TABLE "lookup_values" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "lookup_values" ADD COLUMN IF NOT EXISTS "disabled" BOOLEAN DEFAULT false;
    ALTER TABLE "lookup_values" ADD COLUMN IF NOT EXISTS "extra_value" TEXT;

    -- --------------------------------------------------------
    -- Table: maintenance
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "maintenance" (
      "id" SERIAL PRIMARY KEY,
      "property_id" INTEGER,
      "room_id" INTEGER,
      "problem_type" TEXT,
      "description" TEXT DEFAULT ''::text,
      "status" TEXT DEFAULT 'open'::text,
      "priority" TEXT DEFAULT 'medium'::text,
      "reported_at" TIMESTAMPTZ DEFAULT now(),
      "due_date" TEXT,
      "created_at" TIMESTAMPTZ DEFAULT now(),
      "started_at" TIMESTAMPTZ,
      "resolved_at" TIMESTAMPTZ,
      "notes" TEXT,
      "reported_by" TEXT,
      "category" TEXT DEFAULT 'maintenance'::text,
      "assigned_to" INTEGER,
      "photo_url" TEXT
    );

    -- Ensure all columns exist
    ALTER TABLE "maintenance" ADD COLUMN IF NOT EXISTS "property_id" INTEGER;
    ALTER TABLE "maintenance" ADD COLUMN IF NOT EXISTS "room_id" INTEGER;
    ALTER TABLE "maintenance" ADD COLUMN IF NOT EXISTS "problem_type" TEXT;
    ALTER TABLE "maintenance" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT ''::text;
    ALTER TABLE "maintenance" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'open'::text;
    ALTER TABLE "maintenance" ADD COLUMN IF NOT EXISTS "priority" TEXT DEFAULT 'medium'::text;
    ALTER TABLE "maintenance" ADD COLUMN IF NOT EXISTS "reported_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "maintenance" ADD COLUMN IF NOT EXISTS "due_date" TEXT;
    ALTER TABLE "maintenance" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "maintenance" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMPTZ;
    ALTER TABLE "maintenance" ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMPTZ;
    ALTER TABLE "maintenance" ADD COLUMN IF NOT EXISTS "notes" TEXT;
    ALTER TABLE "maintenance" ADD COLUMN IF NOT EXISTS "reported_by" TEXT;
    ALTER TABLE "maintenance" ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT 'maintenance'::text;
    ALTER TABLE "maintenance" ADD COLUMN IF NOT EXISTS "assigned_to" INTEGER;
    ALTER TABLE "maintenance" ADD COLUMN IF NOT EXISTS "photo_url" TEXT;

    -- --------------------------------------------------------
    -- Table: password_history
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "password_history" (
      "id" SERIAL PRIMARY KEY,
      "user_id" INTEGER,
      "password_hash" TEXT,
      "created_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "password_history" ADD COLUMN IF NOT EXISTS "user_id" INTEGER;
    ALTER TABLE "password_history" ADD COLUMN IF NOT EXISTS "password_hash" TEXT;
    ALTER TABLE "password_history" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: portal_comment_likes
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "portal_comment_likes" (
      "id" SERIAL PRIMARY KEY,
      "comment_id" INTEGER,
      "profile_id" INTEGER,
      "created_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "portal_comment_likes" ADD COLUMN IF NOT EXISTS "comment_id" INTEGER;
    ALTER TABLE "portal_comment_likes" ADD COLUMN IF NOT EXISTS "profile_id" INTEGER;
    ALTER TABLE "portal_comment_likes" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: portal_comments
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "portal_comments" (
      "id" SERIAL PRIMARY KEY,
      "content_type" TEXT,
      "content_id" INTEGER,
      "profile_id" INTEGER,
      "text" TEXT,
      "parent_comment_id" INTEGER,
      "likes_count" INTEGER DEFAULT 0,
      "created_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "portal_comments" ADD COLUMN IF NOT EXISTS "content_type" TEXT;
    ALTER TABLE "portal_comments" ADD COLUMN IF NOT EXISTS "content_id" INTEGER;
    ALTER TABLE "portal_comments" ADD COLUMN IF NOT EXISTS "profile_id" INTEGER;
    ALTER TABLE "portal_comments" ADD COLUMN IF NOT EXISTS "text" TEXT;
    ALTER TABLE "portal_comments" ADD COLUMN IF NOT EXISTS "parent_comment_id" INTEGER;
    ALTER TABLE "portal_comments" ADD COLUMN IF NOT EXISTS "likes_count" INTEGER DEFAULT 0;
    ALTER TABLE "portal_comments" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: portal_contacts
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "portal_contacts" (
      "id" SERIAL PRIMARY KEY,
      "property_id" INTEGER,
      "name_ar" TEXT,
      "name_en" TEXT,
      "role_ar" TEXT,
      "role_en" TEXT,
      "email" TEXT,
      "phone" TEXT,
      "extension" TEXT,
      "created_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "portal_contacts" ADD COLUMN IF NOT EXISTS "property_id" INTEGER;
    ALTER TABLE "portal_contacts" ADD COLUMN IF NOT EXISTS "name_ar" TEXT;
    ALTER TABLE "portal_contacts" ADD COLUMN IF NOT EXISTS "name_en" TEXT;
    ALTER TABLE "portal_contacts" ADD COLUMN IF NOT EXISTS "role_ar" TEXT;
    ALTER TABLE "portal_contacts" ADD COLUMN IF NOT EXISTS "role_en" TEXT;
    ALTER TABLE "portal_contacts" ADD COLUMN IF NOT EXISTS "email" TEXT;
    ALTER TABLE "portal_contacts" ADD COLUMN IF NOT EXISTS "phone" TEXT;
    ALTER TABLE "portal_contacts" ADD COLUMN IF NOT EXISTS "extension" TEXT;
    ALTER TABLE "portal_contacts" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: portal_conversation_participants
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "portal_conversation_participants" (
      "id" SERIAL PRIMARY KEY,
      "conversation_id" INTEGER,
      "profile_id" INTEGER,
      "joined_at" TIMESTAMPTZ DEFAULT now(),
      "last_read_at" TIMESTAMPTZ
    );

    -- Ensure all columns exist
    ALTER TABLE "portal_conversation_participants" ADD COLUMN IF NOT EXISTS "conversation_id" INTEGER;
    ALTER TABLE "portal_conversation_participants" ADD COLUMN IF NOT EXISTS "profile_id" INTEGER;
    ALTER TABLE "portal_conversation_participants" ADD COLUMN IF NOT EXISTS "joined_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "portal_conversation_participants" ADD COLUMN IF NOT EXISTS "last_read_at" TIMESTAMPTZ;

    -- --------------------------------------------------------
    -- Table: portal_conversations
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "portal_conversations" (
      "id" SERIAL PRIMARY KEY,
      "property_id" INTEGER,
      "subject" TEXT,
      "is_group" BOOLEAN DEFAULT false,
      "created_by" INTEGER,
      "created_at" TIMESTAMPTZ DEFAULT now(),
      "updated_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "portal_conversations" ADD COLUMN IF NOT EXISTS "property_id" INTEGER;
    ALTER TABLE "portal_conversations" ADD COLUMN IF NOT EXISTS "subject" TEXT;
    ALTER TABLE "portal_conversations" ADD COLUMN IF NOT EXISTS "is_group" BOOLEAN DEFAULT false;
    ALTER TABLE "portal_conversations" ADD COLUMN IF NOT EXISTS "created_by" INTEGER;
    ALTER TABLE "portal_conversations" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "portal_conversations" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: portal_documents
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "portal_documents" (
      "id" SERIAL PRIMARY KEY,
      "title_ar" TEXT,
      "title_en" TEXT,
      "file_name" TEXT,
      "file_type" TEXT,
      "file_data" TEXT,
      "category" TEXT DEFAULT 'policy'::text,
      "created_at" TIMESTAMPTZ DEFAULT now(),
      "is_latest" BOOLEAN DEFAULT true,
      "version_group_id" UUID
    );

    -- Ensure all columns exist
    ALTER TABLE "portal_documents" ADD COLUMN IF NOT EXISTS "title_ar" TEXT;
    ALTER TABLE "portal_documents" ADD COLUMN IF NOT EXISTS "title_en" TEXT;
    ALTER TABLE "portal_documents" ADD COLUMN IF NOT EXISTS "file_name" TEXT;
    ALTER TABLE "portal_documents" ADD COLUMN IF NOT EXISTS "file_type" TEXT;
    ALTER TABLE "portal_documents" ADD COLUMN IF NOT EXISTS "file_data" TEXT;
    ALTER TABLE "portal_documents" ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT 'policy'::text;
    ALTER TABLE "portal_documents" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "portal_documents" ADD COLUMN IF NOT EXISTS "is_latest" BOOLEAN DEFAULT true;
    ALTER TABLE "portal_documents" ADD COLUMN IF NOT EXISTS "version_group_id" UUID;

    -- --------------------------------------------------------
    -- Table: portal_feedback
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "portal_feedback" (
      "id" SERIAL PRIMARY KEY,
      "content_type" TEXT,
      "content_id" INTEGER,
      "profile_id" INTEGER,
      "rating" REAL,
      "comment" TEXT,
      "helpful" TEXT,
      "created_at" TIMESTAMPTZ DEFAULT now(),
      "updated_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "portal_feedback" ADD COLUMN IF NOT EXISTS "content_type" TEXT;
    ALTER TABLE "portal_feedback" ADD COLUMN IF NOT EXISTS "content_id" INTEGER;
    ALTER TABLE "portal_feedback" ADD COLUMN IF NOT EXISTS "profile_id" INTEGER;
    ALTER TABLE "portal_feedback" ADD COLUMN IF NOT EXISTS "rating" REAL;
    ALTER TABLE "portal_feedback" ADD COLUMN IF NOT EXISTS "comment" TEXT;
    ALTER TABLE "portal_feedback" ADD COLUMN IF NOT EXISTS "helpful" TEXT;
    ALTER TABLE "portal_feedback" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "portal_feedback" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: portal_food_menu
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "portal_food_menu" (
      "id" SERIAL PRIMARY KEY,
      "property_id" INTEGER,
      "name" TEXT,
      "name_ar" TEXT,
      "description" TEXT,
      "description_ar" TEXT,
      "price" TEXT DEFAULT '0'::text,
      "meal_type" TEXT DEFAULT 'daily'::text,
      "category" TEXT DEFAULT 'main'::text,
      "date" DATE,
      "available" BOOLEAN DEFAULT true,
      "image_url" TEXT,
      "created_by" INTEGER,
      "created_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "portal_food_menu" ADD COLUMN IF NOT EXISTS "property_id" INTEGER;
    ALTER TABLE "portal_food_menu" ADD COLUMN IF NOT EXISTS "name" TEXT;
    ALTER TABLE "portal_food_menu" ADD COLUMN IF NOT EXISTS "name_ar" TEXT;
    ALTER TABLE "portal_food_menu" ADD COLUMN IF NOT EXISTS "description" TEXT;
    ALTER TABLE "portal_food_menu" ADD COLUMN IF NOT EXISTS "description_ar" TEXT;
    ALTER TABLE "portal_food_menu" ADD COLUMN IF NOT EXISTS "price" TEXT DEFAULT '0'::text;
    ALTER TABLE "portal_food_menu" ADD COLUMN IF NOT EXISTS "meal_type" TEXT DEFAULT 'daily'::text;
    ALTER TABLE "portal_food_menu" ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT 'main'::text;
    ALTER TABLE "portal_food_menu" ADD COLUMN IF NOT EXISTS "date" DATE;
    ALTER TABLE "portal_food_menu" ADD COLUMN IF NOT EXISTS "available" BOOLEAN DEFAULT true;
    ALTER TABLE "portal_food_menu" ADD COLUMN IF NOT EXISTS "image_url" TEXT;
    ALTER TABLE "portal_food_menu" ADD COLUMN IF NOT EXISTS "created_by" INTEGER;
    ALTER TABLE "portal_food_menu" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: portal_meal_orders
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "portal_meal_orders" (
      "id" SERIAL PRIMARY KEY,
      "property_id" INTEGER,
      "profile_id" INTEGER,
      "menu_item_id" INTEGER,
      "quantity" INTEGER DEFAULT 1,
      "order_date" DATE,
      "status" TEXT DEFAULT 'confirmed'::text,
      "notes" TEXT,
      "created_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "portal_meal_orders" ADD COLUMN IF NOT EXISTS "property_id" INTEGER;
    ALTER TABLE "portal_meal_orders" ADD COLUMN IF NOT EXISTS "profile_id" INTEGER;
    ALTER TABLE "portal_meal_orders" ADD COLUMN IF NOT EXISTS "menu_item_id" INTEGER;
    ALTER TABLE "portal_meal_orders" ADD COLUMN IF NOT EXISTS "quantity" INTEGER DEFAULT 1;
    ALTER TABLE "portal_meal_orders" ADD COLUMN IF NOT EXISTS "order_date" DATE;
    ALTER TABLE "portal_meal_orders" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'confirmed'::text;
    ALTER TABLE "portal_meal_orders" ADD COLUMN IF NOT EXISTS "notes" TEXT;
    ALTER TABLE "portal_meal_orders" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: portal_message_reads
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "portal_message_reads" (
      "id" SERIAL PRIMARY KEY,
      "message_id" INTEGER,
      "profile_id" INTEGER,
      "read_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "portal_message_reads" ADD COLUMN IF NOT EXISTS "message_id" INTEGER;
    ALTER TABLE "portal_message_reads" ADD COLUMN IF NOT EXISTS "profile_id" INTEGER;
    ALTER TABLE "portal_message_reads" ADD COLUMN IF NOT EXISTS "read_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: portal_messages
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "portal_messages" (
      "id" SERIAL PRIMARY KEY,
      "conversation_id" INTEGER,
      "sender_id" INTEGER,
      "content" TEXT,
      "content_type" TEXT DEFAULT 'text'::text,
      "is_edited" BOOLEAN DEFAULT false,
      "is_deleted" BOOLEAN DEFAULT false,
      "created_at" TIMESTAMPTZ DEFAULT now(),
      "edited_at" TIMESTAMPTZ,
      "deleted_at" TIMESTAMPTZ
    );

    -- Ensure all columns exist
    ALTER TABLE "portal_messages" ADD COLUMN IF NOT EXISTS "conversation_id" INTEGER;
    ALTER TABLE "portal_messages" ADD COLUMN IF NOT EXISTS "sender_id" INTEGER;
    ALTER TABLE "portal_messages" ADD COLUMN IF NOT EXISTS "content" TEXT;
    ALTER TABLE "portal_messages" ADD COLUMN IF NOT EXISTS "content_type" TEXT DEFAULT 'text'::text;
    ALTER TABLE "portal_messages" ADD COLUMN IF NOT EXISTS "is_edited" BOOLEAN DEFAULT false;
    ALTER TABLE "portal_messages" ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN DEFAULT false;
    ALTER TABLE "portal_messages" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "portal_messages" ADD COLUMN IF NOT EXISTS "edited_at" TIMESTAMPTZ;
    ALTER TABLE "portal_messages" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ;

    -- --------------------------------------------------------
    -- Table: portal_notification_reads
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "portal_notification_reads" (
      "id" SERIAL PRIMARY KEY,
      "notification_id" INTEGER,
      "profile_id" INTEGER,
      "read_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "portal_notification_reads" ADD COLUMN IF NOT EXISTS "notification_id" INTEGER;
    ALTER TABLE "portal_notification_reads" ADD COLUMN IF NOT EXISTS "profile_id" INTEGER;
    ALTER TABLE "portal_notification_reads" ADD COLUMN IF NOT EXISTS "read_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: portal_notifications
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "portal_notifications" (
      "id" SERIAL PRIMARY KEY,
      "property_id" INTEGER,
      "title" TEXT,
      "title_ar" TEXT,
      "message" TEXT,
      "message_ar" TEXT,
      "type" TEXT DEFAULT 'announcement'::text,
      "priority" TEXT DEFAULT 'medium'::text,
      "target_all" BOOLEAN DEFAULT true,
      "department" TEXT,
      "created_by" INTEGER,
      "created_at" TIMESTAMPTZ DEFAULT now(),
      "expires_at" TIMESTAMPTZ
    );

    -- Ensure all columns exist
    ALTER TABLE "portal_notifications" ADD COLUMN IF NOT EXISTS "property_id" INTEGER;
    ALTER TABLE "portal_notifications" ADD COLUMN IF NOT EXISTS "title" TEXT;
    ALTER TABLE "portal_notifications" ADD COLUMN IF NOT EXISTS "title_ar" TEXT;
    ALTER TABLE "portal_notifications" ADD COLUMN IF NOT EXISTS "message" TEXT;
    ALTER TABLE "portal_notifications" ADD COLUMN IF NOT EXISTS "message_ar" TEXT;
    ALTER TABLE "portal_notifications" ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT 'announcement'::text;
    ALTER TABLE "portal_notifications" ADD COLUMN IF NOT EXISTS "priority" TEXT DEFAULT 'medium'::text;
    ALTER TABLE "portal_notifications" ADD COLUMN IF NOT EXISTS "target_all" BOOLEAN DEFAULT true;
    ALTER TABLE "portal_notifications" ADD COLUMN IF NOT EXISTS "department" TEXT;
    ALTER TABLE "portal_notifications" ADD COLUMN IF NOT EXISTS "created_by" INTEGER;
    ALTER TABLE "portal_notifications" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "portal_notifications" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ;

    -- --------------------------------------------------------
    -- Table: portal_transport_bookings
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "portal_transport_bookings" (
      "id" SERIAL PRIMARY KEY,
      "property_id" INTEGER,
      "profile_id" INTEGER,
      "schedule_id" INTEGER,
      "booking_date" DATE,
      "status" TEXT DEFAULT 'confirmed'::text,
      "created_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "portal_transport_bookings" ADD COLUMN IF NOT EXISTS "property_id" INTEGER;
    ALTER TABLE "portal_transport_bookings" ADD COLUMN IF NOT EXISTS "profile_id" INTEGER;
    ALTER TABLE "portal_transport_bookings" ADD COLUMN IF NOT EXISTS "schedule_id" INTEGER;
    ALTER TABLE "portal_transport_bookings" ADD COLUMN IF NOT EXISTS "booking_date" DATE;
    ALTER TABLE "portal_transport_bookings" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'confirmed'::text;
    ALTER TABLE "portal_transport_bookings" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: portal_transport_schedules
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "portal_transport_schedules" (
      "id" SERIAL PRIMARY KEY,
      "property_id" INTEGER,
      "route" TEXT,
      "route_ar" TEXT,
      "location" TEXT,
      "location_ar" TEXT,
      "departure" TEXT,
      "arrival" TEXT,
      "days" TEXT DEFAULT 'daily'::text,
      "custom_days" TEXT,
      "capacity" INTEGER DEFAULT 20,
      "notes" TEXT,
      "notes_ar" TEXT,
      "active" BOOLEAN DEFAULT true,
      "created_by" INTEGER,
      "created_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "portal_transport_schedules" ADD COLUMN IF NOT EXISTS "property_id" INTEGER;
    ALTER TABLE "portal_transport_schedules" ADD COLUMN IF NOT EXISTS "route" TEXT;
    ALTER TABLE "portal_transport_schedules" ADD COLUMN IF NOT EXISTS "route_ar" TEXT;
    ALTER TABLE "portal_transport_schedules" ADD COLUMN IF NOT EXISTS "location" TEXT;
    ALTER TABLE "portal_transport_schedules" ADD COLUMN IF NOT EXISTS "location_ar" TEXT;
    ALTER TABLE "portal_transport_schedules" ADD COLUMN IF NOT EXISTS "departure" TEXT;
    ALTER TABLE "portal_transport_schedules" ADD COLUMN IF NOT EXISTS "arrival" TEXT;
    ALTER TABLE "portal_transport_schedules" ADD COLUMN IF NOT EXISTS "days" TEXT DEFAULT 'daily'::text;
    ALTER TABLE "portal_transport_schedules" ADD COLUMN IF NOT EXISTS "custom_days" TEXT;
    ALTER TABLE "portal_transport_schedules" ADD COLUMN IF NOT EXISTS "capacity" INTEGER DEFAULT 20;
    ALTER TABLE "portal_transport_schedules" ADD COLUMN IF NOT EXISTS "notes" TEXT;
    ALTER TABLE "portal_transport_schedules" ADD COLUMN IF NOT EXISTS "notes_ar" TEXT;
    ALTER TABLE "portal_transport_schedules" ADD COLUMN IF NOT EXISTS "active" BOOLEAN DEFAULT true;
    ALTER TABLE "portal_transport_schedules" ADD COLUMN IF NOT EXISTS "created_by" INTEGER;
    ALTER TABLE "portal_transport_schedules" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: profile_documents
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "profile_documents" (
      "id" SERIAL PRIMARY KEY,
      "profile_id" INTEGER,
      "file_name" TEXT,
      "file_type" TEXT,
      "file_data" TEXT,
      "uploaded_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "profile_documents" ADD COLUMN IF NOT EXISTS "profile_id" INTEGER;
    ALTER TABLE "profile_documents" ADD COLUMN IF NOT EXISTS "file_name" TEXT;
    ALTER TABLE "profile_documents" ADD COLUMN IF NOT EXISTS "file_type" TEXT;
    ALTER TABLE "profile_documents" ADD COLUMN IF NOT EXISTS "file_data" TEXT;
    ALTER TABLE "profile_documents" ADD COLUMN IF NOT EXISTS "uploaded_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: profile_portal_accounts
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "profile_portal_accounts" (
      "id" SERIAL PRIMARY KEY,
      "property_id" INTEGER,
      "profile_id" TEXT,
      "password_hash" TEXT,
      "must_change_password" BOOLEAN DEFAULT true,
      "is_active" BOOLEAN DEFAULT true,
      "failed_attempts" INTEGER DEFAULT 0,
      "locked_until" TIMESTAMPTZ,
      "last_login_at" TIMESTAMPTZ,
      "password_changed_at" TIMESTAMPTZ,
      "created_at" TIMESTAMPTZ DEFAULT now(),
      "updated_at" TIMESTAMPTZ DEFAULT now(),
      "reset_required" BOOLEAN DEFAULT true
    );

    -- Ensure all columns exist
    ALTER TABLE "profile_portal_accounts" ADD COLUMN IF NOT EXISTS "property_id" INTEGER;
    ALTER TABLE "profile_portal_accounts" ADD COLUMN IF NOT EXISTS "profile_id" TEXT;
    ALTER TABLE "profile_portal_accounts" ADD COLUMN IF NOT EXISTS "password_hash" TEXT;
    ALTER TABLE "profile_portal_accounts" ADD COLUMN IF NOT EXISTS "must_change_password" BOOLEAN DEFAULT true;
    ALTER TABLE "profile_portal_accounts" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT true;
    ALTER TABLE "profile_portal_accounts" ADD COLUMN IF NOT EXISTS "failed_attempts" INTEGER DEFAULT 0;
    ALTER TABLE "profile_portal_accounts" ADD COLUMN IF NOT EXISTS "locked_until" TIMESTAMPTZ;
    ALTER TABLE "profile_portal_accounts" ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMPTZ;
    ALTER TABLE "profile_portal_accounts" ADD COLUMN IF NOT EXISTS "password_changed_at" TIMESTAMPTZ;
    ALTER TABLE "profile_portal_accounts" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "profile_portal_accounts" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "profile_portal_accounts" ADD COLUMN IF NOT EXISTS "reset_required" BOOLEAN DEFAULT true;

    -- --------------------------------------------------------
    -- Table: profile_vacations
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "profile_vacations" (
      "id" SERIAL PRIMARY KEY,
      "profile_id" INTEGER,
      "start_date" TEXT,
      "end_date" TEXT,
      "actual_return_date" TEXT,
      "notes" TEXT DEFAULT ''::text,
      "status" TEXT DEFAULT 'ACTIVE'::text,
      "created_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "profile_vacations" ADD COLUMN IF NOT EXISTS "profile_id" INTEGER;
    ALTER TABLE "profile_vacations" ADD COLUMN IF NOT EXISTS "start_date" TEXT;
    ALTER TABLE "profile_vacations" ADD COLUMN IF NOT EXISTS "end_date" TEXT;
    ALTER TABLE "profile_vacations" ADD COLUMN IF NOT EXISTS "actual_return_date" TEXT;
    ALTER TABLE "profile_vacations" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT ''::text;
    ALTER TABLE "profile_vacations" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'ACTIVE'::text;
    ALTER TABLE "profile_vacations" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: profiles
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "profiles" (
      "id" SERIAL PRIMARY KEY,
      "property_id" INTEGER,
      "profile_id" TEXT,
      "first_name" TEXT,
      "last_name" TEXT,
      "national_id" TEXT,
      "nationality" TEXT DEFAULT ''::text,
      "address" TEXT DEFAULT ''::text,
      "job_title" TEXT DEFAULT ''::text,
      "level" TEXT DEFAULT ''::text,
      "phone" TEXT DEFAULT ''::text,
      "department" TEXT DEFAULT ''::text,
      "status" TEXT DEFAULT 'active'::text,
      "hire_date" TEXT,
      "gender" TEXT DEFAULT 'M'::text,
      "id_image" TEXT,
      "created_at" TIMESTAMPTZ DEFAULT now(),
      "photo_url" TEXT,
      "email" TEXT DEFAULT ''::text,
      "emergency_contact" TEXT DEFAULT ''::text,
      "third_name" TEXT DEFAULT ''::text,
      "fourth_name" TEXT DEFAULT ''::text,
      "date_of_birth" TEXT DEFAULT ''::text,
      "vacation_start_date" TEXT,
      "vacation_end_date" TEXT,
      "vacation_notes" TEXT DEFAULT ''::text,
      "employment_type" TEXT DEFAULT 'INTERNAL'::text,
      "company_name" TEXT,
      "contract_end_date" TEXT,
      "id_documents" JSONB DEFAULT '[]'::jsonb
    );

    -- Ensure all columns exist
    ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "property_id" INTEGER;
    ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "profile_id" TEXT;
    ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "first_name" TEXT;
    ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "last_name" TEXT;
    ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "national_id" TEXT;
    ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "nationality" TEXT DEFAULT ''::text;
    ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "address" TEXT DEFAULT ''::text;
    ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "job_title" TEXT DEFAULT ''::text;
    ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "level" TEXT DEFAULT ''::text;
    ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "phone" TEXT DEFAULT ''::text;
    ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "department" TEXT DEFAULT ''::text;
    ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'active'::text;
    ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "hire_date" TEXT;
    ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "gender" TEXT DEFAULT 'M'::text;
    ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "id_image" TEXT;
    ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "photo_url" TEXT;
    ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "email" TEXT DEFAULT ''::text;
    ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "emergency_contact" TEXT DEFAULT ''::text;
    ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "third_name" TEXT DEFAULT ''::text;
    ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "fourth_name" TEXT DEFAULT ''::text;
    ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "date_of_birth" TEXT DEFAULT ''::text;
    ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "vacation_start_date" TEXT;
    ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "vacation_end_date" TEXT;
    ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "vacation_notes" TEXT DEFAULT ''::text;
    ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "employment_type" TEXT DEFAULT 'INTERNAL'::text;
    ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "company_name" TEXT;
    ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "contract_end_date" TEXT;
    ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "id_documents" JSONB DEFAULT '[]'::jsonb;

    -- --------------------------------------------------------
    -- Table: properties
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "properties" (
      "id" SERIAL PRIMARY KEY,
      "name" TEXT,
      "code" TEXT,
      "display_name" TEXT,
      "logo" TEXT,
      "primary_color" TEXT DEFAULT '#0F2A44'::text,
      "default_language" TEXT DEFAULT 'en'::text,
      "status" TEXT DEFAULT 'active'::text,
      "created_at" TIMESTAMPTZ DEFAULT now(),
      "schema_name" TEXT
    );

    -- Ensure all columns exist
    ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "name" TEXT;
    ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "code" TEXT;
    ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "display_name" TEXT;
    ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "logo" TEXT;
    ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "primary_color" TEXT DEFAULT '#0F2A44'::text;
    ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "default_language" TEXT DEFAULT 'en'::text;
    ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'active'::text;
    ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "schema_name" TEXT;

    -- --------------------------------------------------------
    -- Table: property_hotek_encoders
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "property_hotek_encoders" (
      "id" SERIAL PRIMARY KEY,
      "property_id" INTEGER,
      "server_id" INTEGER,
      "name" TEXT,
      "encoder_code" TEXT,
      "desk_name" TEXT,
      "ip_address" TEXT,
      "is_active" BOOLEAN DEFAULT true,
      "is_default" BOOLEAN DEFAULT false,
      "last_seen_at" TIMESTAMPTZ,
      "last_error" TEXT,
      "created_at" TIMESTAMPTZ DEFAULT now(),
      "updated_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "property_hotek_encoders" ADD COLUMN IF NOT EXISTS "property_id" INTEGER;
    ALTER TABLE "property_hotek_encoders" ADD COLUMN IF NOT EXISTS "server_id" INTEGER;
    ALTER TABLE "property_hotek_encoders" ADD COLUMN IF NOT EXISTS "name" TEXT;
    ALTER TABLE "property_hotek_encoders" ADD COLUMN IF NOT EXISTS "encoder_code" TEXT;
    ALTER TABLE "property_hotek_encoders" ADD COLUMN IF NOT EXISTS "desk_name" TEXT;
    ALTER TABLE "property_hotek_encoders" ADD COLUMN IF NOT EXISTS "ip_address" TEXT;
    ALTER TABLE "property_hotek_encoders" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT true;
    ALTER TABLE "property_hotek_encoders" ADD COLUMN IF NOT EXISTS "is_default" BOOLEAN DEFAULT false;
    ALTER TABLE "property_hotek_encoders" ADD COLUMN IF NOT EXISTS "last_seen_at" TIMESTAMPTZ;
    ALTER TABLE "property_hotek_encoders" ADD COLUMN IF NOT EXISTS "last_error" TEXT;
    ALTER TABLE "property_hotek_encoders" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "property_hotek_encoders" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: property_hotek_servers
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "property_hotek_servers" (
      "id" SERIAL PRIMARY KEY,
      "property_id" INTEGER,
      "name" TEXT,
      "host" TEXT,
      "port" INTEGER,
      "protocol" TEXT DEFAULT 'fidelio'::text,
      "workstation" TEXT DEFAULT 'WS1'::text,
      "server_code" TEXT,
      "is_active" BOOLEAN DEFAULT true,
      "is_default" BOOLEAN DEFAULT false,
      "last_seen_at" TIMESTAMPTZ,
      "last_success_at" TIMESTAMPTZ,
      "last_error" TEXT,
      "created_at" TIMESTAMPTZ DEFAULT now(),
      "updated_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "property_hotek_servers" ADD COLUMN IF NOT EXISTS "property_id" INTEGER;
    ALTER TABLE "property_hotek_servers" ADD COLUMN IF NOT EXISTS "name" TEXT;
    ALTER TABLE "property_hotek_servers" ADD COLUMN IF NOT EXISTS "host" TEXT;
    ALTER TABLE "property_hotek_servers" ADD COLUMN IF NOT EXISTS "port" INTEGER;
    ALTER TABLE "property_hotek_servers" ADD COLUMN IF NOT EXISTS "protocol" TEXT DEFAULT 'fidelio'::text;
    ALTER TABLE "property_hotek_servers" ADD COLUMN IF NOT EXISTS "workstation" TEXT DEFAULT 'WS1'::text;
    ALTER TABLE "property_hotek_servers" ADD COLUMN IF NOT EXISTS "server_code" TEXT;
    ALTER TABLE "property_hotek_servers" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT true;
    ALTER TABLE "property_hotek_servers" ADD COLUMN IF NOT EXISTS "is_default" BOOLEAN DEFAULT false;
    ALTER TABLE "property_hotek_servers" ADD COLUMN IF NOT EXISTS "last_seen_at" TIMESTAMPTZ;
    ALTER TABLE "property_hotek_servers" ADD COLUMN IF NOT EXISTS "last_success_at" TIMESTAMPTZ;
    ALTER TABLE "property_hotek_servers" ADD COLUMN IF NOT EXISTS "last_error" TEXT;
    ALTER TABLE "property_hotek_servers" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "property_hotek_servers" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: push_subscriptions
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "push_subscriptions" (
      "id" SERIAL PRIMARY KEY,
      "profile_id" INTEGER,
      "property_id" INTEGER,
      "endpoint" TEXT,
      "p256dh_key" TEXT,
      "auth_key" TEXT,
      "user_agent" TEXT,
      "created_at" TIMESTAMPTZ DEFAULT now(),
      "last_used_at" TIMESTAMPTZ
    );

    -- Ensure all columns exist
    ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "profile_id" INTEGER;
    ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "property_id" INTEGER;
    ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "endpoint" TEXT;
    ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "p256dh_key" TEXT;
    ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "auth_key" TEXT;
    ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "user_agent" TEXT;
    ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "last_used_at" TIMESTAMPTZ;

    -- --------------------------------------------------------
    -- Table: reservations
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "reservations" (
      "id" SERIAL PRIMARY KEY,
      "property_id" INTEGER,
      "room_id" INTEGER,
      "room_type" TEXT,
      "first_name" TEXT,
      "last_name" TEXT,
      "check_in_date" TEXT,
      "check_out_date" TEXT,
      "notes" TEXT DEFAULT ''::text,
      "guest_id_card_number" TEXT DEFAULT ''::text,
      "guest_phone" TEXT DEFAULT ''::text,
      "job_title" TEXT DEFAULT ''::text,
      "department" TEXT DEFAULT ''::text,
      "status" TEXT DEFAULT 'UPCOMING'::text,
      "created_at" TIMESTAMPTZ DEFAULT now(),
      "nationality" TEXT DEFAULT ''::text,
      "gender" TEXT DEFAULT ''::text,
      "profile_code" TEXT DEFAULT ''::text,
      "level" TEXT DEFAULT ''::text,
      "bed_number" TEXT,
      "employment_type" TEXT DEFAULT 'INTERNAL'::text,
      "company_name" TEXT DEFAULT ''::text
    );

    -- Ensure all columns exist
    ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "property_id" INTEGER;
    ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "room_id" INTEGER;
    ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "room_type" TEXT;
    ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "first_name" TEXT;
    ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "last_name" TEXT;
    ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "check_in_date" TEXT;
    ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "check_out_date" TEXT;
    ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT ''::text;
    ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "guest_id_card_number" TEXT DEFAULT ''::text;
    ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "guest_phone" TEXT DEFAULT ''::text;
    ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "job_title" TEXT DEFAULT ''::text;
    ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "department" TEXT DEFAULT ''::text;
    ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'UPCOMING'::text;
    ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "nationality" TEXT DEFAULT ''::text;
    ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "gender" TEXT DEFAULT ''::text;
    ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "profile_code" TEXT DEFAULT ''::text;
    ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "level" TEXT DEFAULT ''::text;
    ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "bed_number" TEXT;
    ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "employment_type" TEXT DEFAULT 'INTERNAL'::text;
    ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "company_name" TEXT DEFAULT ''::text;

    -- --------------------------------------------------------
    -- Table: room_beds
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "room_beds" (
      "id" SERIAL PRIMARY KEY,
      "room_id" INTEGER,
      "bed_number" INTEGER,
      "bed_type" TEXT,
      "status" TEXT DEFAULT 'AVAILABLE'::text,
      "created_at" TIMESTAMPTZ DEFAULT now(),
      "updated_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "room_beds" ADD COLUMN IF NOT EXISTS "room_id" INTEGER;
    ALTER TABLE "room_beds" ADD COLUMN IF NOT EXISTS "bed_number" INTEGER;
    ALTER TABLE "room_beds" ADD COLUMN IF NOT EXISTS "bed_type" TEXT;
    ALTER TABLE "room_beds" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'AVAILABLE'::text;
    ALTER TABLE "room_beds" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "room_beds" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: room_import_history
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "room_import_history" (
      "id" SERIAL PRIMARY KEY,
      "property_id" INTEGER,
      "building_id" INTEGER,
      "file_name" TEXT,
      "uploaded_by" INTEGER,
      "uploaded_by_name" TEXT,
      "upload_date" TIMESTAMPTZ DEFAULT now(),
      "import_mode" TEXT DEFAULT 'create_update'::text,
      "total_rows" INTEGER DEFAULT 0,
      "created_rows" INTEGER DEFAULT 0,
      "updated_rows" INTEGER DEFAULT 0,
      "failed_rows" INTEGER DEFAULT 0,
      "status" TEXT DEFAULT 'COMPLETED'::text,
      "errors" JSONB DEFAULT '[]'::jsonb,
      "warnings" JSONB DEFAULT '[]'::jsonb,
      "created_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "room_import_history" ADD COLUMN IF NOT EXISTS "property_id" INTEGER;
    ALTER TABLE "room_import_history" ADD COLUMN IF NOT EXISTS "building_id" INTEGER;
    ALTER TABLE "room_import_history" ADD COLUMN IF NOT EXISTS "file_name" TEXT;
    ALTER TABLE "room_import_history" ADD COLUMN IF NOT EXISTS "uploaded_by" INTEGER;
    ALTER TABLE "room_import_history" ADD COLUMN IF NOT EXISTS "uploaded_by_name" TEXT;
    ALTER TABLE "room_import_history" ADD COLUMN IF NOT EXISTS "upload_date" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "room_import_history" ADD COLUMN IF NOT EXISTS "import_mode" TEXT DEFAULT 'create_update'::text;
    ALTER TABLE "room_import_history" ADD COLUMN IF NOT EXISTS "total_rows" INTEGER DEFAULT 0;
    ALTER TABLE "room_import_history" ADD COLUMN IF NOT EXISTS "created_rows" INTEGER DEFAULT 0;
    ALTER TABLE "room_import_history" ADD COLUMN IF NOT EXISTS "updated_rows" INTEGER DEFAULT 0;
    ALTER TABLE "room_import_history" ADD COLUMN IF NOT EXISTS "failed_rows" INTEGER DEFAULT 0;
    ALTER TABLE "room_import_history" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'COMPLETED'::text;
    ALTER TABLE "room_import_history" ADD COLUMN IF NOT EXISTS "errors" JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE "room_import_history" ADD COLUMN IF NOT EXISTS "warnings" JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE "room_import_history" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: room_import_jobs
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "room_import_jobs" (
      "id" SERIAL PRIMARY KEY,
      "status" TEXT DEFAULT 'pending'::text,
      "total_rooms" INTEGER DEFAULT 0,
      "created_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "room_import_jobs" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'pending'::text;
    ALTER TABLE "room_import_jobs" ADD COLUMN IF NOT EXISTS "total_rooms" INTEGER DEFAULT 0;
    ALTER TABLE "room_import_jobs" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: room_import_templates
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "room_import_templates" (
      "id" SERIAL PRIMARY KEY,
      "property_id" INTEGER,
      "name" TEXT,
      "description" TEXT,
      "column_mapping" JSONB,
      "created_at" TIMESTAMPTZ DEFAULT now(),
      "updated_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "room_import_templates" ADD COLUMN IF NOT EXISTS "property_id" INTEGER;
    ALTER TABLE "room_import_templates" ADD COLUMN IF NOT EXISTS "name" TEXT;
    ALTER TABLE "room_import_templates" ADD COLUMN IF NOT EXISTS "description" TEXT;
    ALTER TABLE "room_import_templates" ADD COLUMN IF NOT EXISTS "column_mapping" JSONB;
    ALTER TABLE "room_import_templates" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "room_import_templates" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: room_keys
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "room_keys" (
      "id" SERIAL PRIMARY KEY,
      "property_id" INTEGER,
      "assignment_id" INTEGER,
      "room_id" INTEGER,
      "lock_id" INTEGER,
      "profile_id" INTEGER,
      "card_number" TEXT,
      "card_type" TEXT DEFAULT 'guest'::text,
      "issued_by" INTEGER,
      "issued_at" TIMESTAMPTZ DEFAULT now(),
      "expires_at" TIMESTAMPTZ,
      "revoked_at" TIMESTAMPTZ,
      "revoked_by" INTEGER,
      "status" TEXT DEFAULT 'active'::text,
      "notes" TEXT
    );

    -- Ensure all columns exist
    ALTER TABLE "room_keys" ADD COLUMN IF NOT EXISTS "property_id" INTEGER;
    ALTER TABLE "room_keys" ADD COLUMN IF NOT EXISTS "assignment_id" INTEGER;
    ALTER TABLE "room_keys" ADD COLUMN IF NOT EXISTS "room_id" INTEGER;
    ALTER TABLE "room_keys" ADD COLUMN IF NOT EXISTS "lock_id" INTEGER;
    ALTER TABLE "room_keys" ADD COLUMN IF NOT EXISTS "profile_id" INTEGER;
    ALTER TABLE "room_keys" ADD COLUMN IF NOT EXISTS "card_number" TEXT;
    ALTER TABLE "room_keys" ADD COLUMN IF NOT EXISTS "card_type" TEXT DEFAULT 'guest'::text;
    ALTER TABLE "room_keys" ADD COLUMN IF NOT EXISTS "issued_by" INTEGER;
    ALTER TABLE "room_keys" ADD COLUMN IF NOT EXISTS "issued_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "room_keys" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ;
    ALTER TABLE "room_keys" ADD COLUMN IF NOT EXISTS "revoked_at" TIMESTAMPTZ;
    ALTER TABLE "room_keys" ADD COLUMN IF NOT EXISTS "revoked_by" INTEGER;
    ALTER TABLE "room_keys" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'active'::text;
    ALTER TABLE "room_keys" ADD COLUMN IF NOT EXISTS "notes" TEXT;

    -- --------------------------------------------------------
    -- Table: room_locks
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "room_locks" (
      "id" SERIAL PRIMARY KEY,
      "property_id" INTEGER,
      "room_id" INTEGER,
      "lock_number" TEXT,
      "protocol" TEXT DEFAULT 'mifare'::text,
      "status" TEXT DEFAULT 'active'::text,
      "created_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "room_locks" ADD COLUMN IF NOT EXISTS "property_id" INTEGER;
    ALTER TABLE "room_locks" ADD COLUMN IF NOT EXISTS "room_id" INTEGER;
    ALTER TABLE "room_locks" ADD COLUMN IF NOT EXISTS "lock_number" TEXT;
    ALTER TABLE "room_locks" ADD COLUMN IF NOT EXISTS "protocol" TEXT DEFAULT 'mifare'::text;
    ALTER TABLE "room_locks" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'active'::text;
    ALTER TABLE "room_locks" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: rooms
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "rooms" (
      "id" SERIAL PRIMARY KEY,
      "property_id" INTEGER,
      "building_id" INTEGER,
      "floor_id" INTEGER,
      "room_number" TEXT,
      "room_type" TEXT DEFAULT 'single'::text,
      "capacity" INTEGER DEFAULT 1,
      "current_occupancy" INTEGER DEFAULT 0,
      "status" TEXT DEFAULT 'available'::text,
      "gender" TEXT,
      "created_at" TIMESTAMPTZ DEFAULT now(),
      "view" TEXT,
      "bed_type" TEXT,
      "classification" TEXT,
      "separator_door" BOOLEAN DEFAULT false,
      "size" TEXT,
      "size_sqm" INTEGER,
      "features" TEXT,
      "features_list" JSONB DEFAULT '[]'::jsonb,
      "notes" TEXT DEFAULT ''::text,
      "is_active" BOOLEAN DEFAULT true,
      "updated_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "property_id" INTEGER;
    ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "building_id" INTEGER;
    ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "floor_id" INTEGER;
    ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "room_number" TEXT;
    ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "room_type" TEXT DEFAULT 'single'::text;
    ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "capacity" INTEGER DEFAULT 1;
    ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "current_occupancy" INTEGER DEFAULT 0;
    ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'available'::text;
    ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "gender" TEXT;
    ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "view" TEXT;
    ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "bed_type" TEXT;
    ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "classification" TEXT;
    ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "separator_door" BOOLEAN DEFAULT false;
    ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "size" TEXT;
    ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "size_sqm" INTEGER;
    ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "features" TEXT;
    ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "features_list" JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT ''::text;
    ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT true;
    ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: settings
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "settings" (
      "id" SERIAL PRIMARY KEY,
      "property_id" INTEGER,
      "system_name" TEXT DEFAULT 'Sunrise Staff Housing'::text,
      "system_logo" TEXT,
      "default_language" TEXT DEFAULT 'en'::text,
      "primary_color" TEXT DEFAULT '#0F2A44'::text,
      "sidebar_color" TEXT DEFAULT '#1e293b'::text,
      "button_color" TEXT DEFAULT '#C9A24D'::text,
      "departure_alerts_enabled" BOOLEAN DEFAULT true,
      "departure_alert_threshold" INTEGER DEFAULT 3,
      "report_footer" TEXT DEFAULT 'Generated by Sunrise Housing System'::text,
      "updated_at" TIMESTAMPTZ DEFAULT now(),
      "portal_contact_email" TEXT,
      "portal_contact_phone" TEXT,
      "portal_contact_ext" TEXT
    );

    -- Ensure all columns exist
    ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "property_id" INTEGER;
    ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "system_name" TEXT DEFAULT 'Sunrise Staff Housing'::text;
    ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "system_logo" TEXT;
    ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "default_language" TEXT DEFAULT 'en'::text;
    ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "primary_color" TEXT DEFAULT '#0F2A44'::text;
    ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "sidebar_color" TEXT DEFAULT '#1e293b'::text;
    ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "button_color" TEXT DEFAULT '#C9A24D'::text;
    ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "departure_alerts_enabled" BOOLEAN DEFAULT true;
    ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "departure_alert_threshold" INTEGER DEFAULT 3;
    ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "report_footer" TEXT DEFAULT 'Generated by Sunrise Housing System'::text;
    ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "portal_contact_email" TEXT;
    ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "portal_contact_phone" TEXT;
    ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "portal_contact_ext" TEXT;

    -- --------------------------------------------------------
    -- Table: survey_item_responses
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "survey_item_responses" (
      "id" SERIAL PRIMARY KEY,
      "template_id" INTEGER,
      "profile_id" INTEGER,
      "item_id" INTEGER,
      "rating_value" REAL,
      "text_value" TEXT,
      "created_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "survey_item_responses" ADD COLUMN IF NOT EXISTS "template_id" INTEGER;
    ALTER TABLE "survey_item_responses" ADD COLUMN IF NOT EXISTS "profile_id" INTEGER;
    ALTER TABLE "survey_item_responses" ADD COLUMN IF NOT EXISTS "item_id" INTEGER;
    ALTER TABLE "survey_item_responses" ADD COLUMN IF NOT EXISTS "rating_value" REAL;
    ALTER TABLE "survey_item_responses" ADD COLUMN IF NOT EXISTS "text_value" TEXT;
    ALTER TABLE "survey_item_responses" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: survey_items
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "survey_items" (
      "id" SERIAL PRIMARY KEY,
      "template_id" INTEGER,
      "title_ar" TEXT,
      "title_en" TEXT,
      "type" TEXT DEFAULT 'rating'::text,
      "required" BOOLEAN DEFAULT true,
      "order_index" INTEGER DEFAULT 0,
      "created_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "survey_items" ADD COLUMN IF NOT EXISTS "template_id" INTEGER;
    ALTER TABLE "survey_items" ADD COLUMN IF NOT EXISTS "title_ar" TEXT;
    ALTER TABLE "survey_items" ADD COLUMN IF NOT EXISTS "title_en" TEXT;
    ALTER TABLE "survey_items" ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT 'rating'::text;
    ALTER TABLE "survey_items" ADD COLUMN IF NOT EXISTS "required" BOOLEAN DEFAULT true;
    ALTER TABLE "survey_items" ADD COLUMN IF NOT EXISTS "order_index" INTEGER DEFAULT 0;
    ALTER TABLE "survey_items" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: survey_responses
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "survey_responses" (
      "id" SERIAL PRIMARY KEY,
      "survey_id" INTEGER,
      "profile_id" INTEGER,
      "rating" REAL,
      "comment" TEXT,
      "created_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "survey_responses" ADD COLUMN IF NOT EXISTS "survey_id" INTEGER;
    ALTER TABLE "survey_responses" ADD COLUMN IF NOT EXISTS "profile_id" INTEGER;
    ALTER TABLE "survey_responses" ADD COLUMN IF NOT EXISTS "rating" REAL;
    ALTER TABLE "survey_responses" ADD COLUMN IF NOT EXISTS "comment" TEXT;
    ALTER TABLE "survey_responses" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: surveys
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "surveys" (
      "id" SERIAL PRIMARY KEY,
      "title_ar" TEXT,
      "title_en" TEXT,
      "description_ar" TEXT,
      "description_en" TEXT,
      "category" TEXT DEFAULT 'general'::text,
      "department" TEXT,
      "status" TEXT DEFAULT 'active'::text,
      "created_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "title_ar" TEXT;
    ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "title_en" TEXT;
    ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "description_ar" TEXT;
    ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "description_en" TEXT;
    ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT 'general'::text;
    ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "department" TEXT;
    ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'active'::text;
    ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: user_sessions
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "user_sessions" (
      "sid" VARCHAR(255),
      "sess" JSONB,
      "expire" TIMESTAMP
    );

    -- Ensure all columns exist
    ALTER TABLE "user_sessions" ADD COLUMN IF NOT EXISTS "sid" VARCHAR(255);
    ALTER TABLE "user_sessions" ADD COLUMN IF NOT EXISTS "sess" JSONB;
    ALTER TABLE "user_sessions" ADD COLUMN IF NOT EXISTS "expire" TIMESTAMP;

    -- --------------------------------------------------------
    -- Table: user_signatures
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "user_signatures" (
      "id" SERIAL PRIMARY KEY,
      "user_id" INTEGER,
      "signature_image_url" TEXT,
      "uploaded_at" TIMESTAMPTZ DEFAULT now(),
      "updated_at" TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure all columns exist
    ALTER TABLE "user_signatures" ADD COLUMN IF NOT EXISTS "user_id" INTEGER;
    ALTER TABLE "user_signatures" ADD COLUMN IF NOT EXISTS "signature_image_url" TEXT;
    ALTER TABLE "user_signatures" ADD COLUMN IF NOT EXISTS "uploaded_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "user_signatures" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT now();

    -- --------------------------------------------------------
    -- Table: users
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "users" (
      "id" SERIAL PRIMARY KEY,
      "property_id" INTEGER,
      "username" TEXT,
      "password_hash" TEXT,
      "roles" TEXT[] DEFAULT '{}'::text[],
      "permissions" TEXT[] DEFAULT '{}'::text[],
      "status" TEXT DEFAULT 'active'::text,
      "created_at" TIMESTAMPTZ DEFAULT now(),
      "property_ids" TEXT[] DEFAULT '{}'::integer[],
      "photo_url" TEXT,
      "last_login_at" TIMESTAMPTZ,
      "updated_at" TIMESTAMPTZ DEFAULT now(),
      "email" TEXT,
      "phone" TEXT,
      "department" TEXT,
      "job_title" TEXT,
      "failed_login_attempts" INTEGER DEFAULT 0,
      "locked_until" TIMESTAMPTZ,
      "password_changed_at" TIMESTAMPTZ,
      "last_property_id" INTEGER
    );

    -- Ensure all columns exist
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "property_id" INTEGER;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" TEXT;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" TEXT;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "roles" TEXT[] DEFAULT '{}'::text[];
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "permissions" TEXT[] DEFAULT '{}'::text[];
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'active'::text;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "property_ids" TEXT[] DEFAULT '{}'::integer[];
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "photo_url" TEXT;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMPTZ;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" TEXT;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" TEXT;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "department" TEXT;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "job_title" TEXT;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "failed_login_attempts" INTEGER DEFAULT 0;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "locked_until" TIMESTAMPTZ;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_changed_at" TIMESTAMPTZ;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_property_id" INTEGER;

    -- --------------------------------------------------------
    -- Table: ws_sessions
    -- --------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "ws_sessions" (
      "id" SERIAL PRIMARY KEY,
      "user_id" INTEGER,
      "property_id" INTEGER,
      "session_key" TEXT,
      "connected_at" TIMESTAMPTZ DEFAULT now(),
      "last_ping_at" TIMESTAMPTZ DEFAULT now(),
      "server_node" TEXT,
      "is_active" BOOLEAN DEFAULT true
    );

    -- Ensure all columns exist
    ALTER TABLE "ws_sessions" ADD COLUMN IF NOT EXISTS "user_id" INTEGER;
    ALTER TABLE "ws_sessions" ADD COLUMN IF NOT EXISTS "property_id" INTEGER;
    ALTER TABLE "ws_sessions" ADD COLUMN IF NOT EXISTS "session_key" TEXT;
    ALTER TABLE "ws_sessions" ADD COLUMN IF NOT EXISTS "connected_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "ws_sessions" ADD COLUMN IF NOT EXISTS "last_ping_at" TIMESTAMPTZ DEFAULT now();
    ALTER TABLE "ws_sessions" ADD COLUMN IF NOT EXISTS "server_node" TEXT;
    ALTER TABLE "ws_sessions" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT true;


    -- ========================================================
    -- CONSTRAINTS & DATA CLEANING
    -- ========================================================

    -- Profiles status & gender & employment_type
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema AND table_name = 'profiles') THEN
      UPDATE profiles SET gender = 'M' 
        WHERE gender IS NULL OR gender = '' OR lower(gender) IN ('m', 'male', 'ذكر');
      UPDATE profiles SET gender = 'F' 
        WHERE lower(gender) IN ('f', 'female', 'أنثى', 'انثى');
      UPDATE profiles SET gender = 'M' 
        WHERE gender NOT IN ('M', 'F', 'OTHER');

      UPDATE profiles SET status = 'UNASSIGNED' 
        WHERE status IS NULL OR status = '' OR status NOT IN ('UNASSIGNED', 'IN_HOUSE', 'CHECKED_OUT', 'VACATION', 'ACTIVE', 'INACTIVE', 'TERMINATED', 'PENDING', 'LEFT');

      UPDATE profiles SET employment_type = 'INTERNAL' 
        WHERE employment_type IS NULL OR employment_type = '' OR employment_type NOT IN ('INTERNAL', 'THIRD_PARTY', 'CONTRACTOR', 'GUEST', 'TEMPORARY');

      ALTER TABLE profiles DROP CONSTRAINT IF EXISTS chk_profiles_status;
      ALTER TABLE profiles ADD CONSTRAINT chk_profiles_status 
        CHECK (status IN ('UNASSIGNED', 'IN_HOUSE', 'CHECKED_OUT', 'VACATION', 'ACTIVE', 'INACTIVE', 'TERMINATED', 'PENDING', 'LEFT'));

      ALTER TABLE profiles DROP CONSTRAINT IF EXISTS chk_profiles_gender;
      ALTER TABLE profiles ADD CONSTRAINT chk_profiles_gender 
        CHECK (gender IN ('M', 'F', 'OTHER') OR gender IS NULL);

      ALTER TABLE profiles DROP CONSTRAINT IF EXISTS chk_profiles_employment_type;
      ALTER TABLE profiles ADD CONSTRAINT chk_profiles_employment_type 
        CHECK (employment_type IN ('INTERNAL', 'THIRD_PARTY', 'CONTRACTOR', 'GUEST', 'TEMPORARY'));
    END IF;

    -- Reservations status
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema AND table_name = 'reservations') THEN
      UPDATE reservations 
        SET status = 'UPCOMING' 
        WHERE status IS NULL OR status = '' OR status NOT IN ('UPCOMING', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW', 'COMPLETED');

      ALTER TABLE reservations DROP CONSTRAINT IF EXISTS chk_reservations_status;
      ALTER TABLE reservations ADD CONSTRAINT chk_reservations_status 
        CHECK (status IN ('UPCOMING', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW', 'COMPLETED'));
    END IF;

    -- Assignments status
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema AND table_name = 'assignments') THEN
      UPDATE assignments 
        SET status = 'ACTIVE' 
        WHERE status IS NULL OR status = '' OR status NOT IN ('ACTIVE', 'CHECKED_OUT', 'COMPLETED', 'CANCELLED', 'TRANSFERRED', 'MOVED', 'LEFT');

      ALTER TABLE assignments DROP CONSTRAINT IF EXISTS chk_assignments_status;
      ALTER TABLE assignments ADD CONSTRAINT chk_assignments_status 
        CHECK (status IN ('ACTIVE', 'CHECKED_OUT', 'COMPLETED', 'CANCELLED', 'TRANSFERRED', 'MOVED', 'LEFT'));
    END IF;

    -- Rooms status and occupancy
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema AND table_name = 'rooms') THEN
      UPDATE rooms SET capacity = 1 WHERE capacity IS NULL OR capacity < 1;
      UPDATE rooms SET current_occupancy = 0 WHERE current_occupancy IS NULL OR current_occupancy < 0;
      UPDATE rooms SET status = 'available' 
        WHERE status IS NULL OR status = '' OR status NOT IN ('available', 'occupied', 'dirty', 'occupied_dirty', 'occupied_vacation', 'out_of_service', 'out_of_order');

      ALTER TABLE rooms DROP CONSTRAINT IF EXISTS chk_rooms_capacity;
      ALTER TABLE rooms ADD CONSTRAINT chk_rooms_capacity CHECK (capacity >= 1);

      ALTER TABLE rooms DROP CONSTRAINT IF EXISTS chk_rooms_occupancy;
      ALTER TABLE rooms ADD CONSTRAINT chk_rooms_occupancy CHECK (current_occupancy >= 0);

      ALTER TABLE rooms DROP CONSTRAINT IF EXISTS chk_rooms_status;
      ALTER TABLE rooms ADD CONSTRAINT chk_rooms_status 
        CHECK (status IN ('available', 'occupied', 'dirty', 'occupied_dirty', 'occupied_vacation', 'out_of_service', 'out_of_order'));
    END IF;

    -- Maintenance status and priority
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema AND table_name = 'maintenance') THEN
      UPDATE maintenance SET status = 'pending' 
        WHERE status IS NULL OR status = '' OR status NOT IN ('open', 'pending', 'in_progress', 'resolved', 'completed', 'cancelled', 'escalated', 'closed');
      UPDATE maintenance SET priority = 'normal' 
        WHERE priority IS NULL OR priority = '' OR priority NOT IN ('low', 'normal', 'medium', 'high', 'urgent', 'emergency', 'LOW', 'MEDIUM', 'HIGH', 'URGENT');

      ALTER TABLE maintenance DROP CONSTRAINT IF EXISTS chk_maintenance_status;
      ALTER TABLE maintenance ADD CONSTRAINT chk_maintenance_status 
        CHECK (status IN ('open', 'pending', 'in_progress', 'resolved', 'completed', 'cancelled', 'escalated', 'closed'));

      ALTER TABLE maintenance DROP CONSTRAINT IF EXISTS chk_maintenance_priority;
      ALTER TABLE maintenance ADD CONSTRAINT chk_maintenance_priority 
        CHECK (priority IN ('low', 'normal', 'medium', 'high', 'urgent', 'emergency', 'LOW', 'MEDIUM', 'HIGH', 'URGENT'));
    END IF;

    -- ========================================================
    -- PERFORMANCE INDEXES
    -- ========================================================
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema AND table_name = 'rooms') THEN
      CREATE INDEX IF NOT EXISTS idx_rooms_building ON rooms(building_id);
      CREATE INDEX IF NOT EXISTS idx_rooms_floor ON rooms(floor_id);
      CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
      CREATE INDEX IF NOT EXISTS idx_rooms_number ON rooms(room_number);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema AND table_name = 'profiles') THEN
      CREATE INDEX IF NOT EXISTS idx_profiles_profile_id ON profiles(profile_id);
      CREATE INDEX IF NOT EXISTS idx_profiles_national_id ON profiles(national_id);
      CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
      CREATE INDEX IF NOT EXISTS idx_profiles_department ON profiles(department);
      CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema AND table_name = 'assignments') THEN
      CREATE INDEX IF NOT EXISTS idx_assignments_profile ON assignments(profile_id);
      CREATE INDEX IF NOT EXISTS idx_assignments_room ON assignments(room_id);
      CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema AND table_name = 'reservations') THEN
      CREATE INDEX IF NOT EXISTS idx_reservations_room_id ON reservations(room_id);
      CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
      CREATE INDEX IF NOT EXISTS idx_reservations_check_in ON reservations(check_in_date);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema AND table_name = 'maintenance') THEN
      CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance(status);
      CREATE INDEX IF NOT EXISTS idx_maintenance_priority ON maintenance(priority);
      CREATE INDEX IF NOT EXISTS idx_maintenance_room_id ON maintenance(room_id);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema AND table_name = 'activity_logs') THEN
      CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs("timestamp" DESC);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema AND table_name = 'portal_messages') THEN
      CREATE INDEX IF NOT EXISTS idx_portal_messages_conv ON portal_messages(conversation_id);
    END IF;

  END LOOP;

  -- Reset search path back to public
  SET search_path TO public;
  RAISE NOTICE '>>> All schemas, tables, and constraints migrated successfully!';
END $$;
