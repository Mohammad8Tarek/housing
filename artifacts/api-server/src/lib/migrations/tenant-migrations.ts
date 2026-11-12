/**
 * Tenant-schema migrations. Idempotent and run against every property schema
 * (taal_housing, el_waha_new, elwaha_old, ...) plus newly provisioned ones.
 */
import type { Migration } from "./public-migrations.js";

export const TENANT_MIGRATIONS: Migration[] = [
  // === Assignments: Check-out reason ===
  {
    name: "tenant.assignments.check_out_reason",
    q: "ALTER TABLE assignments ADD COLUMN IF NOT EXISTS check_out_reason TEXT",
  },
  {
    name: "tenant.profiles.previous_profile_id",
    q: "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS previous_profile_id TEXT DEFAULT '';",
  },

  // === Settings: Policies, Rules & Contacts ===
  {
    name: "tenant.settings.policy_and_contacts",
    q: `ALTER TABLE settings ADD COLUMN IF NOT EXISTS policy_level_0_capacity INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS policy_level_0_allow_entire BOOLEAN NOT NULL DEFAULT true;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS policy_level_1_capacity INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS policy_level_2_capacity INTEGER NOT NULL DEFAULT 2;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS policy_level_3_capacity INTEGER NOT NULL DEFAULT 3;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS policy_level_4_capacity INTEGER NOT NULL DEFAULT 4;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS policy_level_5_capacity INTEGER NOT NULL DEFAULT 5;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS policy_level_6_capacity INTEGER NOT NULL DEFAULT 6;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS policy_level_1_allow_entire BOOLEAN NOT NULL DEFAULT true;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS policy_level_2_allow_entire BOOLEAN NOT NULL DEFAULT false;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS policy_level_5_allow_entire BOOLEAN NOT NULL DEFAULT false;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS policy_level_6_allow_entire BOOLEAN NOT NULL DEFAULT false;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS custom_level_rules JSONB DEFAULT '[]'::jsonb;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS policy_level_1_allow_entire BOOLEAN NOT NULL DEFAULT true;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS policy_level_2_allow_entire BOOLEAN NOT NULL DEFAULT false;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS policy_department_clustering BOOLEAN NOT NULL DEFAULT true;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS policy_strict_department_segregation BOOLEAN NOT NULL DEFAULT false;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS visit_max_nights INTEGER NOT NULL DEFAULT 7;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS visit_max_visits_per_year INTEGER NOT NULL DEFAULT 2;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS visit_min_service_months INTEGER NOT NULL DEFAULT 6;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS visit_cooldown_days INTEGER NOT NULL DEFAULT 90;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS visit_require_national_id BOOLEAN NOT NULL DEFAULT true;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS curfew_enabled BOOLEAN NOT NULL DEFAULT false;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS curfew_time TEXT NOT NULL DEFAULT '23:00';
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS housing_rules_text TEXT DEFAULT '';
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS family_visit_policy_text TEXT DEFAULT '';
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS housing_policy_text TEXT DEFAULT '';
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS hr_contact_1_name TEXT DEFAULT '';
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS hr_contact_1_title TEXT DEFAULT 'HR Manager';
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS hr_contact_1_phone TEXT DEFAULT '';
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS hr_contact_1_email TEXT DEFAULT '';
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS hr_contact_2_name TEXT DEFAULT '';
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS hr_contact_2_title TEXT DEFAULT 'Assistant HR Manager';
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS hr_contact_2_phone TEXT DEFAULT '';
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS hr_contact_2_email TEXT DEFAULT '';
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS housing_manager_1_name TEXT DEFAULT '';
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS housing_manager_1_title TEXT DEFAULT 'Housing Manager';
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS housing_manager_1_phone TEXT DEFAULT '';
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS housing_manager_1_email TEXT DEFAULT '';
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS housing_manager_2_name TEXT DEFAULT '';
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS housing_manager_2_title TEXT DEFAULT 'Assistant Housing Manager';
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS housing_manager_2_phone TEXT DEFAULT '';
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS housing_manager_2_email TEXT DEFAULT '';`,
  },
  // === Settings ===
  {
    name: "settings.portal_contact_email",
    q: "ALTER TABLE settings ADD COLUMN IF NOT EXISTS portal_contact_email TEXT",
  },
  {
    name: "settings.portal_contact_phone",
    q: "ALTER TABLE settings ADD COLUMN IF NOT EXISTS portal_contact_phone TEXT",
  },
  {
    name: "settings.portal_contact_ext",
    q: "ALTER TABLE settings ADD COLUMN IF NOT EXISTS portal_contact_ext TEXT",
  },
  {
    name: "profiles.photo_url",
    q: "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS photo_url TEXT",
  },
  {
    name: "profiles.email",
    q: "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '' NOT NULL",
  },
  {
    name: "profiles.emergency_contact",
    q: "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact TEXT DEFAULT '' NOT NULL",
  },
  {
    name: "profiles.third_name",
    q: "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS third_name TEXT DEFAULT '' NOT NULL",
  },
  {
    name: "profiles.fourth_name",
    q: "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fourth_name TEXT DEFAULT '' NOT NULL",
  },
  {
    name: "profiles.first_name_ar",
    q: "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name_ar TEXT DEFAULT ''",
  },
  {
    name: "profiles.last_name_ar",
    q: "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name_ar TEXT DEFAULT ''",
  },
  {
    name: "profiles.third_name_ar",
    q: "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS third_name_ar TEXT DEFAULT ''",
  },
  {
    name: "profiles.fourth_name_ar",
    q: "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fourth_name_ar TEXT DEFAULT ''",
  },
  {
    name: "profiles.job_title_ar",
    q: "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS job_title_ar TEXT DEFAULT ''",
  },
  {
    name: "profiles.department_ar",
    q: "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department_ar TEXT DEFAULT ''",
  },
  {
    name: "lookup_values.value_ar",
    q: "ALTER TABLE lookup_values ADD COLUMN IF NOT EXISTS value_ar TEXT DEFAULT ''",
  },
  {
    name: "profiles.date_of_birth",
    q: "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_birth TEXT DEFAULT '' NOT NULL",
  },
  {
    name: "maintenance.started_at",
    q: "ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ",
  },
  {
    name: "maintenance.resolved_at",
    q: "ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ",
  },
  {
    name: "maintenance.notes",
    q: "ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS notes TEXT",
  },
  {
    name: "maintenance.reported_by",
    q: "ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS reported_by TEXT",
  },
  {
    name: "maintenance.assigned_to",
    q: "ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS assigned_to INTEGER",
  },
  {
    name: "maintenance.category",
    q: "ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'maintenance'",
  },
  {
    name: "reservations.nationality",
    q: "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS nationality TEXT NOT NULL DEFAULT ''",
  },
  {
    name: "reservations.gender",
    q: "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL DEFAULT ''",
  },
  {
    name: "reservations.profile_code",
    q: "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS profile_code TEXT NOT NULL DEFAULT ''",
  },
  {
    name: "reservations.level",
    q: "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS level TEXT NOT NULL DEFAULT ''",
  },

  // ─── Password Policy Columns (Tenant Settings) ──────────────────────
  {
    name: "settings.password_min_length",
    q: "ALTER TABLE settings ADD COLUMN IF NOT EXISTS password_min_length INTEGER NOT NULL DEFAULT 8",
  },
  {
    name: "settings.password_require_uppercase",
    q: "ALTER TABLE settings ADD COLUMN IF NOT EXISTS password_require_uppercase BOOLEAN NOT NULL DEFAULT TRUE",
  },
  {
    name: "settings.password_require_lowercase",
    q: "ALTER TABLE settings ADD COLUMN IF NOT EXISTS password_require_lowercase BOOLEAN NOT NULL DEFAULT TRUE",
  },
  {
    name: "settings.password_require_number",
    q: "ALTER TABLE settings ADD COLUMN IF NOT EXISTS password_require_number BOOLEAN NOT NULL DEFAULT TRUE",
  },
  {
    name: "settings.password_require_symbol",
    q: "ALTER TABLE settings ADD COLUMN IF NOT EXISTS password_require_symbol BOOLEAN NOT NULL DEFAULT FALSE",
  },
  {
    name: "settings.password_expiry_days",
    q: "ALTER TABLE settings ADD COLUMN IF NOT EXISTS password_expiry_days INTEGER NOT NULL DEFAULT 90",
  },
  {
    name: "settings.password_history_count",
    q: "ALTER TABLE settings ADD COLUMN IF NOT EXISTS password_history_count INTEGER NOT NULL DEFAULT 5",
  },
  {
    name: "settings.lockout_threshold",
    q: "ALTER TABLE settings ADD COLUMN IF NOT EXISTS lockout_threshold INTEGER NOT NULL DEFAULT 5",
  },
  {
    name: "settings.lockout_duration_minutes",
    q: "ALTER TABLE settings ADD COLUMN IF NOT EXISTS lockout_duration_minutes INTEGER NOT NULL DEFAULT 15",
  },

  // === Maintenance ===
  {
    name: "maintenance.assigned_to",
    q: "ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS assigned_to INTEGER",
  },
  {
    name: "maintenance.category",
    q: "ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'maintenance'",
  },

  // === Evaluations (create if not exists with latest schema, then add columns) ===
  {
    name: "evaluations",
    q: `CREATE TABLE IF NOT EXISTS evaluations (
    id SERIAL PRIMARY KEY, profile_id INTEGER, rating REAL,
    comment TEXT, profile_response TEXT, profile_rating REAL,
    category TEXT NOT NULL DEFAULT 'general',
    title_ar TEXT, title_en TEXT, description_ar TEXT, description_en TEXT,
    department TEXT,
    expires_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  },
  {
    name: "evaluations.title_ar",
    q: "ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS title_ar TEXT",
  },
  {
    name: "evaluations.title_en",
    q: "ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS title_en TEXT",
  },
  {
    name: "evaluations.description_ar",
    q: "ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS description_ar TEXT",
  },
  {
    name: "evaluations.description_en",
    q: "ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS description_en TEXT",
  },
  {
    name: "evaluations.department",
    q: "ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS department TEXT",
  },
  {
    name: "evaluations.profile_rating",
    q: "ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS profile_rating REAL",
  },
  {
    name: "evaluations.profile_response",
    q: "ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS profile_response TEXT",
  },
  {
    name: "evaluations.expires_at",
    q: "ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ",
  },
  {
    name: "evaluations.make_profile_id_nullable",
    q: "ALTER TABLE evaluations ALTER COLUMN profile_id DROP NOT NULL",
  },
  {
    name: "evaluations.make_rating_nullable",
    q: "ALTER TABLE evaluations ALTER COLUMN rating DROP NOT NULL",
  },
  {
    name: "evaluations.survey_template_id",
    q: "ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS survey_template_id INTEGER",
  },
  {
    name: "evaluations.status",
    q: "ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'",
  },

  // === Portal Documents (create if not exists with title_en nullable) ===
  {
    name: "portal_documents",
    q: `CREATE TABLE IF NOT EXISTS portal_documents (
    id SERIAL PRIMARY KEY, title_ar TEXT NOT NULL, title_en TEXT,
    file_name TEXT NOT NULL, file_type TEXT NOT NULL, file_data TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'policy', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  },
  {
    name: "portal_documents.make_title_en_nullable",
    q: "ALTER TABLE portal_documents ALTER COLUMN title_en DROP NOT NULL",
  },

  // === Activities ===
  {
    name: "activities",
    q: `CREATE TABLE IF NOT EXISTS activities (
    id SERIAL PRIMARY KEY, title_ar TEXT NOT NULL, title_en TEXT NOT NULL,
    description_ar TEXT, description_en TEXT, category TEXT NOT NULL DEFAULT 'general',
    location_ar TEXT, location_en TEXT, start_date DATE NOT NULL, end_date DATE,
    start_time TEXT, max_participants INTEGER, status TEXT NOT NULL DEFAULT 'planned',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  },

  // === Activity Cover Image ===
  {
    name: "activities.cover_image",
    q: "ALTER TABLE activities ADD COLUMN IF NOT EXISTS cover_image TEXT",
  },
  {
    name: "activities.is_published",
    q: "ALTER TABLE activities ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT false",
  },
  {
    name: "activities.target_departments",
    q: "ALTER TABLE activities ADD COLUMN IF NOT EXISTS target_departments TEXT[] NOT NULL DEFAULT '{}'",
  },
  {
    name: "activities.expires_at",
    q: "ALTER TABLE activities ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ",
  },

  // === Maintenance Photo ===
  {
    name: "maintenance.photo_url",
    q: "ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS photo_url TEXT",
  },

  // === Maintenance Parent (Sub-tickets) ===
  {
    name: "maintenance.parent_id",
    q: "ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES maintenance(id) ON DELETE CASCADE",
  },

  // === Guest Hosting Companion Documents ===
  {
    name: "hosting_companions.document_type",
    q: "ALTER TABLE hosting_companions ADD COLUMN IF NOT EXISTS document_type TEXT",
  },
  {
    name: "hosting_companions.document_image",
    q: "ALTER TABLE hosting_companions ADD COLUMN IF NOT EXISTS document_image TEXT",
  },
  {
    name: "hosting_companions.document_file_name",
    q: "ALTER TABLE hosting_companions ADD COLUMN IF NOT EXISTS document_file_name TEXT",
  },

  // === Surveys (new table) ===
  // surveys and survey_responses tables removed — replaced by evaluations table with surveyTemplateId pattern

  // === Activity Registrations ===
  {
    name: "activity_registrations",
    q: `CREATE TABLE IF NOT EXISTS activity_registrations (
    id SERIAL PRIMARY KEY, profile_id INTEGER NOT NULL, activity_id INTEGER NOT NULL,
    badge_number TEXT,
    status TEXT NOT NULL DEFAULT 'joined',
    attended BOOLEAN NOT NULL DEFAULT false,
    attended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  },

  // === Portal contacts (per-tenant) ===
  {
    name: "portal_contacts",
    q: `CREATE TABLE IF NOT EXISTS portal_contacts (
    id SERIAL PRIMARY KEY, property_id INTEGER, name_ar TEXT NOT NULL, name_en TEXT NOT NULL,
    role_ar TEXT, role_en TEXT, email TEXT, phone TEXT, extension TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  },

  // === Document Versioning Columns ===
  // is_latest and version_group_id columns removed — versioning feature not implemented

  // HR sync tables are PUBLIC only (with property_id FK), not per-tenant

  // === Smart Lock / Key Card System ===
  {
    name: "room_locks",
    q: `CREATE TABLE IF NOT EXISTS room_locks (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    lock_number TEXT NOT NULL,
    protocol TEXT NOT NULL DEFAULT 'mifare',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  },
  {
    name: "room_keys",
    q: `CREATE TABLE IF NOT EXISTS room_keys (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL,
    assignment_id INTEGER REFERENCES assignments(id) ON DELETE SET NULL,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    lock_id INTEGER REFERENCES room_locks(id) ON DELETE SET NULL,
    profile_id INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
    card_number TEXT,
    card_type TEXT NOT NULL DEFAULT 'guest',
    issued_by INTEGER,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revoked_by INTEGER,
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT
  )`,
  },
  {
    name: "key_audit_log",
    q: `CREATE TABLE IF NOT EXISTS key_audit_log (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL,
    key_id INTEGER REFERENCES room_keys(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    performed_by INTEGER,
    card_number TEXT,
    room_number TEXT,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  },
  {
    name: "idx_room_locks_room",
    q: "CREATE INDEX IF NOT EXISTS idx_room_locks_room ON room_locks(room_id)",
  },
  {
    name: "idx_room_keys_room",
    q: "CREATE INDEX IF NOT EXISTS idx_room_keys_room ON room_keys(room_id)",
  },
  {
    name: "idx_room_keys_assignment",
    q: "CREATE INDEX IF NOT EXISTS idx_room_keys_assignment ON room_keys(assignment_id)",
  },
  {
    name: "idx_room_keys_status",
    q: "CREATE INDEX IF NOT EXISTS idx_room_keys_status ON room_keys(status)",
  },
  {
    name: "idx_key_audit_log_key",
    q: "CREATE INDEX IF NOT EXISTS idx_key_audit_log_key ON key_audit_log(key_id)",
  },
  {
    name: "idx_key_audit_log_property",
    q: "CREATE INDEX IF NOT EXISTS idx_key_audit_log_property ON key_audit_log(property_id)",
  },

  // === Fix duplicate active assignments: checkout the older one for profile 10575 ===
  {
    name: "fix.duplicate_assignment_10575",
    q: "UPDATE assignments SET status = 'CHECKED_OUT', check_out_date = NOW()::text WHERE profile_id = '10575' AND status = 'ACTIVE' AND id < (SELECT id FROM assignments WHERE profile_id = '10575' AND status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1)",
  },

  // === Survey Items (multi-question surveys) ===
  {
    name: "survey_items",
    q: `CREATE TABLE IF NOT EXISTS survey_items (
    id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
    title_ar TEXT NOT NULL,
    title_en TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'rating',
    required BOOLEAN NOT NULL DEFAULT true,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  },
  {
    name: "survey_item_responses",
    q: `CREATE TABLE IF NOT EXISTS survey_item_responses (
    id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
    profile_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL REFERENCES survey_items(id) ON DELETE CASCADE,
    rating_value REAL,
    text_value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  },
  {
    name: "idx_survey_items_template",
    q: "CREATE INDEX IF NOT EXISTS idx_survey_items_template ON survey_items(template_id)",
  },
  {
    name: "idx_survey_item_responses_template",
    q: "CREATE INDEX IF NOT EXISTS idx_survey_item_responses_template ON survey_item_responses(template_id)",
  },
  {
    name: "idx_survey_item_responses_profile",
    q: "CREATE INDEX IF NOT EXISTS idx_survey_item_responses_profile ON survey_item_responses(profile_id)",
  },
  {
    name: "idx_survey_item_responses_item",
    q: "CREATE INDEX IF NOT EXISTS idx_survey_item_responses_item ON survey_item_responses(item_id)",
  },

  // === Portal Notifications (per-tenant) ===
  {
    name: "portal_notifications",
    q: `CREATE TABLE IF NOT EXISTS portal_notifications (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    title_ar TEXT,
    message TEXT NOT NULL,
    message_ar TEXT,
    type TEXT NOT NULL DEFAULT 'announcement',
    priority TEXT NOT NULL DEFAULT 'medium',
    target_all BOOLEAN NOT NULL DEFAULT true,
    department TEXT,
    created_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ
  )`,
  },
  {
    name: "portal_notification_reads",
    q: `CREATE TABLE IF NOT EXISTS portal_notification_reads (
    id SERIAL PRIMARY KEY,
    notification_id INTEGER NOT NULL,
    profile_id INTEGER NOT NULL,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  },
  {
    name: "portal_notification_reads_unique",
    q: "CREATE UNIQUE INDEX IF NOT EXISTS uq_portal_notification_reads ON portal_notification_reads (notification_id, profile_id)",
  },

  // === Activity Registration: badge number + attendance ===
  {
    name: "activity_registrations.badge_number",
    q: "ALTER TABLE activity_registrations ADD COLUMN IF NOT EXISTS badge_number TEXT",
  },
  {
    name: "activity_registrations.attended",
    q: "ALTER TABLE activity_registrations ADD COLUMN IF NOT EXISTS attended BOOLEAN NOT NULL DEFAULT false",
  },
  {
    name: "activity_registrations.attended_at",
    q: "ALTER TABLE activity_registrations ADD COLUMN IF NOT EXISTS attended_at TIMESTAMPTZ",
  },

  // === Push Subscriptions for Web Push Notifications ===
  {
    name: "push_subscriptions",
    q: `CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    profile_id INTEGER NOT NULL,
    property_id INTEGER NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
  )`,
  },
  {
    name: "push_subscriptions_unique",
    q: "CREATE UNIQUE INDEX IF NOT EXISTS uq_push_subscriptions ON push_subscriptions (endpoint)",
  },
  {
    name: "push_subscriptions_profile",
    q: "CREATE INDEX IF NOT EXISTS idx_push_subscriptions_profile ON push_subscriptions (profile_id)",
  },

  // === Device Tokens for native FCM push (Capacitor Android/iOS) ===
  {
    name: "device_tokens",
    q: `CREATE TABLE IF NOT EXISTS device_tokens (
    id SERIAL PRIMARY KEY,
    profile_id INTEGER NOT NULL,
    property_id INTEGER NOT NULL,
    token TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'android',
    device_name TEXT,
    user_agent TEXT,
    failure_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
  )`,
  },
  {
    name: "device_tokens_unique",
    q: "CREATE UNIQUE INDEX IF NOT EXISTS uq_device_tokens_token ON device_tokens (token)",
  },
  {
    name: "device_tokens_profile",
    q: "CREATE INDEX IF NOT EXISTS idx_device_tokens_profile_id ON device_tokens (profile_id)",
  },
  {
    name: "device_tokens_property",
    q: "CREATE INDEX IF NOT EXISTS idx_device_tokens_property_id ON device_tokens (property_id)",
  },

  // === User Sessions for connect-pg-simple ===
  {
    name: "user_sessions_table",
    q: `CREATE TABLE IF NOT EXISTS user_sessions (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL
    )`,
  },
  {
    name: "user_sessions_pkey",
    q: `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_sessions_pkey') THEN ALTER TABLE user_sessions ADD CONSTRAINT user_sessions_pkey PRIMARY KEY ("sid"); END IF; END $$`,
  },
  {
    name: "user_sessions_expire_index",
    q: `CREATE INDEX IF NOT EXISTS idx_user_sessions_expire ON user_sessions ("expire")`,
  },
  // === Fix existing duplicate portal accounts (keep most recent per profile_id) ===
  {
    name: "profile_portal_accounts.dedup_keep_latest",
    q: `DELETE FROM profile_portal_accounts
    WHERE id NOT IN (
      SELECT DISTINCT ON (profile_id) id
      FROM profile_portal_accounts
      ORDER BY profile_id, id DESC
    )`,
  },
  // === Add unique constraint on profile_portal_accounts.profile_id ===
  {
    name: "profile_portal_accounts.unique_profile_id",
    q: "CREATE UNIQUE INDEX IF NOT EXISTS uq_portal_accounts_profile_id ON profile_portal_accounts (profile_id)",
  },
  // === Fix CHECK constraints to include CHECKED_OUT, LEFT, and occupied_vacation ===
  {
    name: "fix_chk_assignments_status",
    q: `DO $$ BEGIN
      ALTER TABLE assignments DROP CONSTRAINT IF EXISTS chk_assignments_status;
      ALTER TABLE assignments ADD CONSTRAINT chk_assignments_status
        CHECK (status IN ('ACTIVE', 'CHECKED_OUT', 'COMPLETED', 'CANCELLED', 'TRANSFERRED', 'MOVED', 'LEFT'));
    END $$`,
  },
  {
    name: "fix_chk_profiles_status",
    q: `DO $$ BEGIN
      ALTER TABLE profiles DROP CONSTRAINT IF EXISTS chk_profiles_status;
      ALTER TABLE profiles ADD CONSTRAINT chk_profiles_status
        CHECK (status IN ('UNASSIGNED', 'IN_HOUSE', 'CHECKED_OUT', 'VACATION', 'ACTIVE', 'INACTIVE', 'TERMINATED', 'PENDING', 'LEFT', 'TRANSFERRED', 'DEPARTED'));
    END $$`,
  },
  {
    name: "fix_chk_profiles_gender",
    q: `DO $$ BEGIN
      ALTER TABLE profiles ALTER COLUMN gender SET DEFAULT 'M';
      ALTER TABLE profiles DROP CONSTRAINT IF EXISTS chk_profiles_gender;
      ALTER TABLE profiles ADD CONSTRAINT chk_profiles_gender
        CHECK (gender IN ('M', 'F', 'OTHER', 'male', 'female', 'other') OR gender IS NULL);
    END $$`,
  },
  {
    name: "fix_chk_rooms_status",
    q: `DO $$ BEGIN
      ALTER TABLE rooms DROP CONSTRAINT IF EXISTS chk_rooms_status;
      ALTER TABLE rooms ADD CONSTRAINT chk_rooms_status
        CHECK (status IN ('available', 'occupied', 'dirty', 'occupied_dirty', 'occupied_vacation', 'out_of_service', 'out_of_order', 'room_vacant', 'bed_vacant', 'room_and_bed_vacant', 'inspected', 'in_cleaning'));
    END $$`,
  },
  {
    name: "assignments.is_entire_room",
    q: "ALTER TABLE assignments ADD COLUMN IF NOT EXISTS is_entire_room BOOLEAN NOT NULL DEFAULT FALSE",
  },
  {
    name: "fix_chk_maintenance_status",
    q: `DO $$ BEGIN
      ALTER TABLE maintenance DROP CONSTRAINT IF EXISTS chk_maintenance_status;
      ALTER TABLE maintenance ADD CONSTRAINT chk_maintenance_status
        CHECK (status IN ('open', 'pending', 'in_progress', 'resolved', 'completed', 'cancelled', 'escalated', 'closed'));
    END $$`,
  },
  {
    name: "fix_chk_maintenance_priority",
    q: `DO $$ BEGIN
      ALTER TABLE maintenance DROP CONSTRAINT IF EXISTS chk_maintenance_priority;
      ALTER TABLE maintenance ADD CONSTRAINT chk_maintenance_priority
        CHECK (priority IN ('low', 'normal', 'medium', 'high', 'urgent', 'emergency', 'LOW', 'MEDIUM', 'HIGH', 'URGENT'));
    END $$`,
  },
  {
    name: "profiles.vacation_start_date",
    q: "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vacation_start_date TEXT",
  },
  {
    name: "profiles.vacation_end_date",
    q: "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vacation_end_date TEXT",
  },
  {
    name: "profiles.vacation_notes",
    q: "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vacation_notes TEXT DEFAULT ''",
  },
  {
    name: "reservations.bed_number",
    q: "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS bed_number TEXT NOT NULL DEFAULT ''",
  },
  {
    name: "lookup_values.extra_value",
    q: "ALTER TABLE lookup_values ADD COLUMN IF NOT EXISTS extra_value TEXT",
  },
  {
    name: "profiles.id_image",
    q: "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS id_image TEXT",
  },
  {
    name: "profiles.employment_type",
    q: "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS employment_type TEXT NOT NULL DEFAULT 'INTERNAL'",
  },
  {
    name: "profiles.company_name",
    q: "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_name TEXT DEFAULT ''",
  },
  {
    name: "profiles.contract_end_date",
    q: "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS contract_end_date TEXT",
  },
  {
    name: "profiles.id_documents",
    q: "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS id_documents JSONB DEFAULT '[]'::jsonb",
  },
  {
    name: "reservations.employment_type",
    q: "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS employment_type TEXT NOT NULL DEFAULT 'INTERNAL'",
  },
  {
    name: "reservations.company_name",
    q: "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS company_name TEXT DEFAULT ''",
  },
  {
    name: "rooms.size_sqm",
    q: "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS size_sqm NUMERIC",
  },
  {
    name: "rooms.features_list",
    q: "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS features_list TEXT[]",
  },
  {
    name: "rooms.is_active",
    q: "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE",
  },
  {
    name: "maintenance.parent_id",
    q: "ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS parent_id INTEGER",
  },
  {
    name: "evaluations.survey_template_id",
    q: "ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS survey_template_id INTEGER",
  },
  {
    name: "activity_registrations.badge_number",
    q: "ALTER TABLE activity_registrations ADD COLUMN IF NOT EXISTS badge_number TEXT",
  },
  {
    name: "activity_registrations.attended",
    q: "ALTER TABLE activity_registrations ADD COLUMN IF NOT EXISTS attended BOOLEAN NOT NULL DEFAULT FALSE",
  },
  {
    name: "activity_registrations.attended_at",
    q: "ALTER TABLE activity_registrations ADD COLUMN IF NOT EXISTS attended_at TIMESTAMPTZ",
  },
  {
    name: "rooms.classification",
    q: "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS classification TEXT",
  },
  {
    name: "profile_portal_accounts.last_login_at",
    q: "ALTER TABLE profile_portal_accounts ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ",
  },
  {
    name: "password_reset_tokens",
    q: `CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      profile_id TEXT NOT NULL,
      property_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
  },
  {
    name: "password_reset_tokens.columns",
    q: `DO $$ BEGIN
      ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS profile_id TEXT NOT NULL;
      ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS property_id INTEGER NOT NULL;
      ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS token_hash TEXT NOT NULL;
      ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL;
      ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;
      ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END $$;`,
  },
  {
    name: "password_reset_tokens.indexes",
    q: `CREATE INDEX IF NOT EXISTS idx_reset_tokens_profile_id ON password_reset_tokens (profile_id);
       CREATE INDEX IF NOT EXISTS idx_reset_tokens_token_hash ON password_reset_tokens (token_hash);
       CREATE INDEX IF NOT EXISTS idx_reset_tokens_expires_at ON password_reset_tokens (expires_at);`,
  },
  {
    name: "room_inventory.table",
    q: `CREATE TABLE IF NOT EXISTS room_inventory (
      id SERIAL PRIMARY KEY,
      room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      item_name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'electronics',
      quantity INTEGER NOT NULL DEFAULT 1,
      condition TEXT NOT NULL DEFAULT 'good',
      barcode TEXT,
      serial_number TEXT,
      model_number TEXT,
      last_inspected_at TIMESTAMPTZ,
      inspected_by TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
  },
  {
    name: "room_inventory.indexes",
    q: `CREATE INDEX IF NOT EXISTS idx_room_inventory_room_id ON room_inventory (room_id);
       CREATE INDEX IF NOT EXISTS idx_room_inventory_condition ON room_inventory (condition);
       CREATE INDEX IF NOT EXISTS idx_room_inventory_category ON room_inventory (category);
       CREATE INDEX IF NOT EXISTS idx_room_inventory_room_category ON room_inventory (room_id, category);`,
  },
  {
    name: "property_whatsapp_configs.tenant_table",
    q: `CREATE TABLE IF NOT EXISTS property_whatsapp_configs (
      id SERIAL PRIMARY KEY,
      property_id INTEGER NOT NULL,
      phone_number TEXT,
      status TEXT NOT NULL DEFAULT 'disconnected',
      qr_code TEXT,
      is_auto_send_enabled BOOLEAN NOT NULL DEFAULT true,
      welcome_template_ar TEXT NOT NULL DEFAULT 'مرحباً بك أ/ {employee_name} في {property_name} 🌴✨\n\nيسعدنا إبلاغك بأنه تم إتمام إجراءات تسكينك بنجاح:\n🏢 المبنى: {building_name} ({floor_name})\n🚪 رقم الغرفة: {room_number}\n🛏️ السرير: {bed_label}\n📅 تاريخ التسكين: {checkin_date}\n\n🌐 رابط بوابة المقيمين:\n{portal_url}\n\n🔑 بيانات وطريقة تسجيل الدخول:\n• اسم المستخدم: {profile_id} (رقمك الوظيفي)\n• كلمة المرور الافتراضية: 1234\n*(يرجى استخدام كلمة المرور الشخصية إذا قمت بتعيينها مسبقاً، أو سيطلب منك النظام تعيين كلمة مرور جديدة فور أول تسجيل دخول)*\n\n📲 من خلال البوابة يمكنك:\n• تسجيل ومتابعة بلاغات الصيانة والأعطال\n• طلب خدمات النظافة والهاوس كيبنج\n• التقديم على تصاريح استضافة الأقارب والزيارات\n• المحادثة المباشرة مع مشرفي إدارة السكن\n\nنتمنى لك إقامة هانئة ومريحة! ✨',
      welcome_template_en TEXT NOT NULL DEFAULT 'Welcome Mr/Ms {employee_name} to {property_name}! 🌴✨\n\nYour accommodation has been successfully confirmed:\n🏢 Building: {building_name} ({floor_name})\n🚪 Room: {room_number}\n🛏️ Bed: {bed_label}\n📅 Check-in Date: {checkin_date}\n\n🌐 Resident Portal Link:\n{portal_url}\n\n🔑 Portal Login Instructions:\n• Username: {profile_id} (Your Employee ID)\n• Default Password: 1234\n*(Please use your personal password if already set, or you will be prompted to set a new password upon your first sign-in)*\n\n📲 Through the portal you can:\n• Submit and track maintenance tickets\n• Request housekeeping & room cleaning\n• Apply for guest and visitor hosting permits\n• Chat directly with Housing Supervisors\n\nWe wish you a pleasant and comfortable stay! ✨',
      supervisor_contact TEXT DEFAULT '',
      is_reservation_send_enabled BOOLEAN NOT NULL DEFAULT true,
      reservation_template_ar TEXT NOT NULL DEFAULT 'مرحباً بك أ/ {guest_name} في {property_name} 🌴✨

يسعدنا تأكيد حجز إقامتك المسبق لدينا:
🔖 رقم الحجز: #{reservation_id}
🏢 المبنى / الغرفة: {room_info}
🛏️ تفاصيل السرير: {bed_info}
📅 تاريخ الوصول المتوقع: {checkin_date}
📅 تاريخ المغادرة المتوقع: {checkout_date}

ℹ️ تنويه: يُرجى التوجه لمكتب الإسكان فور وصولك لاستلام المفتاح وإتمام إجراءات التسكين.

نتمنى لك رحلة موفقة وإقامة سعيدة! ✨',
      reservation_template_en TEXT NOT NULL DEFAULT 'Welcome Mr/Ms {guest_name} to {property_name}! 🌴✨

We are pleased to confirm your upcoming reservation:
🔖 Booking Ref: #{reservation_id}
🏢 Building / Room: {room_info}
🛏️ Bed Info: {bed_info}
📅 Expected Check-in: {checkin_date}
📅 Expected Check-out: {checkout_date}

ℹ️ Note: Please visit the Housing Office upon your arrival to complete check-in and collect your keys.

We wish you a safe trip and a pleasant stay! ✨',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_tenant_prop_whatsapp_property_id ON property_whatsapp_configs (property_id);`,
  },
  {
    name: "property_whatsapp_configs.reservation_fields",
    q: `ALTER TABLE property_whatsapp_configs
        ADD COLUMN IF NOT EXISTS is_reservation_send_enabled BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS reservation_template_ar TEXT NOT NULL DEFAULT 'مرحباً بك أ/ {guest_name} في {property_name} 🌴✨

يسعدنا تأكيد حجز إقامتك المسبق لدينا:
🔖 رقم الحجز: #{reservation_id}
🏢 المبنى / الغرفة: {room_info}
🛏️ تفاصيل السرير: {bed_info}
📅 تاريخ الوصول المتوقع: {checkin_date}
📅 تاريخ المغادرة المتوقع: {checkout_date}

ℹ️ تنويه: يُرجى التوجه لمكتب الإسكان فور وصولك لاستلام المفتاح وإتمام إجراءات التسكين.

نتمنى لك رحلة موفقة وإقامة سعيدة! ✨',
        ADD COLUMN IF NOT EXISTS reservation_template_en TEXT NOT NULL DEFAULT 'Welcome Mr/Ms {guest_name} to {property_name}! 🌴✨

We are pleased to confirm your upcoming reservation:
🔖 Booking Ref: #{reservation_id}
🏢 Building / Room: {room_info}
🛏️ Bed Info: {bed_info}
📅 Expected Check-in: {checkin_date}
📅 Expected Check-out: {checkout_date}

ℹ️ Note: Please visit the Housing Office upon your arrival to complete check-in and collect your keys.

We wish you a safe trip and a pleasant stay! ✨';`,
  },
  {
    name: "whatsapp_delivery_logs.tenant_table",
    q: `CREATE TABLE IF NOT EXISTS whatsapp_delivery_logs (
      id SERIAL PRIMARY KEY,
      property_id INTEGER NOT NULL,
      recipient_phone TEXT NOT NULL,
      recipient_name TEXT,
      message_type TEXT NOT NULL DEFAULT 'CHECKIN_WELCOME',
      message_content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'SENT',
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_tenant_wa_delivery_logs_property_id ON whatsapp_delivery_logs (property_id);
    CREATE INDEX IF NOT EXISTS idx_tenant_wa_delivery_logs_created_at ON whatsapp_delivery_logs (created_at);`,
  },
  {
    name: "allow_transferred_and_departed_in_chk_profiles_status",
    q: `DO $$ BEGIN
      ALTER TABLE profiles DROP CONSTRAINT IF EXISTS chk_profiles_status;
      ALTER TABLE profiles ADD CONSTRAINT chk_profiles_status
        CHECK (status IN ('UNASSIGNED', 'IN_HOUSE', 'CHECKED_OUT', 'VACATION', 'ACTIVE', 'INACTIVE', 'TERMINATED', 'PENDING', 'LEFT', 'TRANSFERRED', 'DEPARTED'));
    END $$;`,
  },
  {
    name: "workers.tenant_table",
    q: `CREATE TABLE IF NOT EXISTS workers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      national_id TEXT DEFAULT '',
      specialty TEXT NOT NULL DEFAULT 'general',
      status TEXT NOT NULL DEFAULT 'available',
      worker_type TEXT NOT NULL DEFAULT 'internal',
      company_name TEXT DEFAULT '',
      daily_rate INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      profile_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE workers ADD COLUMN IF NOT EXISTS name TEXT;
    ALTER TABLE workers ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
    ALTER TABLE workers ADD COLUMN IF NOT EXISTS national_id TEXT DEFAULT '';
    ALTER TABLE workers ADD COLUMN IF NOT EXISTS specialty TEXT DEFAULT 'general';
    ALTER TABLE workers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'available';
    ALTER TABLE workers ADD COLUMN IF NOT EXISTS worker_type TEXT DEFAULT 'internal';
    ALTER TABLE workers ADD COLUMN IF NOT EXISTS company_name TEXT DEFAULT '';
    ALTER TABLE workers ADD COLUMN IF NOT EXISTS daily_rate INTEGER DEFAULT 0;
    ALTER TABLE workers ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
    ALTER TABLE workers ADD COLUMN IF NOT EXISTS profile_id INTEGER;
    ALTER TABLE workers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE workers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    CREATE INDEX IF NOT EXISTS idx_workers_specialty ON workers (specialty);
    CREATE INDEX IF NOT EXISTS idx_workers_status ON workers (status);
    CREATE INDEX IF NOT EXISTS idx_workers_type ON workers (worker_type);
    CREATE INDEX IF NOT EXISTS idx_workers_profile_id ON workers (profile_id);`,
  },
  {
    name: "maintenance.worker_id",
    q: `ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS worker_id INTEGER;
    CREATE INDEX IF NOT EXISTS idx_maintenance_worker_id ON maintenance (worker_id);`,
  },
  {
    name: "activity_logs.property_id_and_indexes",
    q: `ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS property_id INTEGER;
    CREATE INDEX IF NOT EXISTS idx_tenant_activity_logs_property_id ON activity_logs (property_id);
    CREATE INDEX IF NOT EXISTS idx_tenant_activity_logs_severity ON activity_logs (severity);`,
  },
  {
    name: "settings.smtp_columns",
    q: `ALTER TABLE settings ADD COLUMN IF NOT EXISTS smtp_host TEXT;
    ALTER TABLE settings ADD COLUMN IF NOT EXISTS smtp_port INTEGER NOT NULL DEFAULT 587;
    ALTER TABLE settings ADD COLUMN IF NOT EXISTS smtp_secure BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE settings ADD COLUMN IF NOT EXISTS smtp_user TEXT;
    ALTER TABLE settings ADD COLUMN IF NOT EXISTS smtp_pass TEXT;
    ALTER TABLE settings ADD COLUMN IF NOT EXISTS smtp_from TEXT;`,
  },
  {
    name: "tenant.gate_logs",
    q: `CREATE TABLE IF NOT EXISTS gate_logs (
      id SERIAL PRIMARY KEY,
      property_id INTEGER,
      profile_id INTEGER,
      employee_id VARCHAR(50) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      department VARCHAR(100),
      job_title VARCHAR(100),
      room_number VARCHAR(50),
      building_name VARCHAR(100),
      direction VARCHAR(10) NOT NULL DEFAULT 'IN',
      status VARCHAR(20) NOT NULL DEFAULT 'GRANTED',
      reason TEXT,
      scanned_by VARCHAR(100) NOT NULL DEFAULT 'Security Officer',
      scan_method VARCHAR(50) NOT NULL DEFAULT 'QR_SCAN',
      notes TEXT,
      scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_tenant_gate_logs_property_id ON gate_logs (property_id);
    CREATE INDEX IF NOT EXISTS idx_tenant_gate_logs_employee_id ON gate_logs (employee_id);
    CREATE INDEX IF NOT EXISTS idx_tenant_gate_logs_direction ON gate_logs (direction);
    CREATE INDEX IF NOT EXISTS idx_tenant_gate_logs_status ON gate_logs (status);
    CREATE INDEX IF NOT EXISTS idx_tenant_gate_logs_scanned_at ON gate_logs (scanned_at);`,
  },

  // ── profile_documents ──────────────────────────────────────
  {
    name: "create_profile_documents_table",
    q: `
    CREATE TABLE IF NOT EXISTS "profile_documents" (
      "id" SERIAL PRIMARY KEY,
      "profile_id" INTEGER,
      "file_name" TEXT,
      "file_type" TEXT,
      "file_data" TEXT,
      "uploaded_at" TIMESTAMPTZ DEFAULT now()
    );
    ALTER TABLE "profile_documents" ADD COLUMN IF NOT EXISTS "profile_id" INTEGER;
    ALTER TABLE "profile_documents" ADD COLUMN IF NOT EXISTS "file_name" TEXT;
    ALTER TABLE "profile_documents" ADD COLUMN IF NOT EXISTS "file_type" TEXT;
    ALTER TABLE "profile_documents" ADD COLUMN IF NOT EXISTS "file_data" TEXT;
    ALTER TABLE "profile_documents" ADD COLUMN IF NOT EXISTS "uploaded_at" TIMESTAMPTZ DEFAULT now();
    CREATE INDEX IF NOT EXISTS idx_profile_documents_profile_id ON profile_documents (profile_id);`,
  },

  // ── profile_vacations ──────────────────────────────────────
  {
    name: "create_profile_vacations_table",
    q: `
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
    ALTER TABLE "profile_vacations" ADD COLUMN IF NOT EXISTS "profile_id" INTEGER;
    ALTER TABLE "profile_vacations" ADD COLUMN IF NOT EXISTS "start_date" TEXT;
    ALTER TABLE "profile_vacations" ADD COLUMN IF NOT EXISTS "end_date" TEXT;
    ALTER TABLE "profile_vacations" ADD COLUMN IF NOT EXISTS "actual_return_date" TEXT;
    ALTER TABLE "profile_vacations" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT ''::text;
    ALTER TABLE "profile_vacations" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'ACTIVE'::text;
    ALTER TABLE "profile_vacations" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();
    CREATE INDEX IF NOT EXISTS idx_profile_vacations_profile_id ON profile_vacations (profile_id);`,
  },
  {
    name: "room_locks.extra_columns",
    q: `DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema AND table_name = 'room_locks') THEN
        ALTER TABLE room_locks ADD COLUMN IF NOT EXISTS lock_model TEXT;
        ALTER TABLE room_locks ADD COLUMN IF NOT EXISTS encoder_id INTEGER;
        ALTER TABLE room_locks ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
      END IF;
    END $$;`,
  },
  {
    name: "maintenance.rating_columns",
    q: `ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS rating INTEGER;
    ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS rating_comment TEXT;
    ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS rated_at TIMESTAMPTZ;
    ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS rated_by_profile_id INTEGER;
    CREATE INDEX IF NOT EXISTS idx_maintenance_rating ON maintenance(rating);
    CREATE INDEX IF NOT EXISTS idx_maintenance_rated_at ON maintenance(rated_at);`,
  },
  {
    name: "property_whatsapp_configs.portal_login_instructions",
    q: `DO $$
    DECLARE
      schema_record RECORD;
    BEGIN
      -- 1. Update public schema
      UPDATE public.property_whatsapp_configs
      SET welcome_template_ar = 'مرحباً بك أ/ {employee_name} في {property_name} 🌴✨\n\nيسعدنا إبلاغك بأنه تم إتمام إجراءات تسكينك بنجاح:\n🏢 المبنى: {building_name} ({floor_name})\n🚪 رقم الغرفة: {room_number}\n🛏️ السرير: {bed_label}\n📅 تاريخ التسكين: {checkin_date}\n\n🌐 رابط بوابة المقيمين:\n{portal_url}\n\n🔑 بيانات وطريقة تسجيل الدخول:\n• اسم المستخدم: {profile_id} (رقمك الوظيفي)\n• كلمة المرور الافتراضية: 1234\n*(يرجى استخدام كلمة المرور الشخصية إذا قمت بتعيينها مسبقاً، أو سيطلب منك النظام تعيين كلمة مرور جديدة فور أول تسجيل دخول)*\n\n📲 من خلال البوابة يمكنك:\n• تسجيل ومتابعة بلاغات الصيانة والأعطال\n• طلب خدمات النظافة والهاوس كيبنج\n• التقديم على تصاريح استضافة الأقارب والزيارات\n• المحادثة المباشرة مع مشرفي إدارة السكن\n\nنتمنى لك إقامة هانئة ومريحة! ✨',
          welcome_template_en = 'Welcome Mr/Ms {employee_name} to {property_name}! 🌴✨\n\nYour accommodation has been successfully confirmed:\n🏢 Building: {building_name} ({floor_name})\n🚪 Room: {room_number}\n🛏️ Bed: {bed_label}\n📅 Check-in Date: {checkin_date}\n\n🌐 Resident Portal Link:\n{portal_url}\n\n🔑 Portal Login Instructions:\n• Username: {profile_id} (Your Employee ID)\n• Default Password: 1234\n*(Please use your personal password if already set, or you will be prompted to set a new password upon your first sign-in)*\n\n📲 Through the portal you can:\n• Submit and track maintenance tickets\n• Request housekeeping & room cleaning\n• Apply for guest and visitor hosting permits\n• Chat directly with Housing Supervisors\n\nWe wish you a pleasant and comfortable stay! ✨'
      WHERE welcome_template_ar NOT LIKE '%بيانات وطريقة تسجيل الدخول%';

      -- 2. Update tenant schemas
      FOR schema_record IN 
        SELECT schema_name FROM public.properties WHERE schema_name IS NOT NULL
      LOOP
        IF EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = schema_record.schema_name AND table_name = 'property_whatsapp_configs'
        ) THEN
          EXECUTE format('
            UPDATE %I.property_whatsapp_configs
            SET welcome_template_ar = %L,
                welcome_template_en = %L
            WHERE welcome_template_ar NOT LIKE ''%%بيانات وطريقة تسجيل الدخول%%''',
            schema_record.schema_name,
            'مرحباً بك أ/ {employee_name} في {property_name} 🌴✨\n\nيسعدنا إبلاغك بأنه تم إتمام إجراءات تسكينك بنجاح:\n🏢 المبنى: {building_name} ({floor_name})\n🚪 رقم الغرفة: {room_number}\n🛏️ السرير: {bed_label}\n📅 تاريخ التسكين: {checkin_date}\n\n🌐 رابط بوابة المقيمين:\n{portal_url}\n\n🔑 بيانات وطريقة تسجيل الدخول:\n• اسم المستخدم: {profile_id} (رقمك الوظيفي)\n• كلمة المرور الافتراضية: 1234\n*(يرجى استخدام كلمة المرور الشخصية إذا قمت بتعيينها مسبقاً، أو سيطلب منك النظام تعيين كلمة مرور جديدة فور أول تسجيل دخول)*\n\n📲 من خلال البوابة يمكنك:\n• تسجيل ومتابعة بلاغات الصيانة والأعطال\n• طلب خدمات النظافة والهاوس كيبنج\n• التقديم على تصاريح استضافة الأقارب والزيارات\n• المحادثة المباشرة مع مشرفي إدارة السكن\n\nنتمنى لك إقامة هانئة ومريحة! ✨',
            'Welcome Mr/Ms {employee_name} to {property_name}! 🌴✨\n\nYour accommodation has been successfully confirmed:\n🏢 Building: {building_name} ({floor_name})\n🚪 Room: {room_number}\n🛏️ Bed: {bed_label}\n📅 Check-in Date: {checkin_date}\n\n🌐 Resident Portal Link:\n{portal_url}\n\n🔑 Portal Login Instructions:\n• Username: {profile_id} (Your Employee ID)\n• Default Password: 1234\n*(Please use your personal password if already set, or you will be prompted to set a new password upon your first sign-in)*\n\n📲 Through the portal you can:\n• Submit and track maintenance tickets\n• Request housekeeping & room cleaning\n• Apply for guest and visitor hosting permits\n• Chat directly with Housing Supervisors\n\nWe wish you a pleasant and comfortable stay! ✨'
          );
        END IF;
      END LOOP;
    END $$;`,
  },
  {
    name: "whatsapp_outbox_queue",
    q: `CREATE TABLE IF NOT EXISTS "whatsapp_outbox_queue" (
      id SERIAL PRIMARY KEY,
      property_id INTEGER,
      recipient_phone TEXT NOT NULL,
      recipient_name TEXT,
      message_type TEXT NOT NULL DEFAULT 'CHECKIN_WELCOME',
      message_content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processed_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_tenant_wa_outbox_status ON whatsapp_outbox_queue (status);
    CREATE INDEX IF NOT EXISTS idx_tenant_wa_outbox_created_at ON whatsapp_outbox_queue (created_at);`,
  },
  {
    name: "rooms.separator_door_bed_type_view",
    q: `ALTER TABLE rooms ADD COLUMN IF NOT EXISTS separator_door BOOLEAN DEFAULT false;
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS bed_type TEXT DEFAULT 'SINGLE';
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS view TEXT DEFAULT 'STANDARD';`,
  },
  {
    name: "settings.branding_and_departure_alert_columns",
    q: `ALTER TABLE settings ADD COLUMN IF NOT EXISTS system_name TEXT;
    ALTER TABLE settings ADD COLUMN IF NOT EXISTS system_logo TEXT;
    ALTER TABLE settings ADD COLUMN IF NOT EXISTS default_language TEXT DEFAULT 'ar';
    ALTER TABLE settings ADD COLUMN IF NOT EXISTS primary_color TEXT;
    ALTER TABLE settings ADD COLUMN IF NOT EXISTS sidebar_color TEXT;
    ALTER TABLE settings ADD COLUMN IF NOT EXISTS button_color TEXT;
    ALTER TABLE settings ADD COLUMN IF NOT EXISTS departure_alerts_enabled BOOLEAN DEFAULT true;
    ALTER TABLE settings ADD COLUMN IF NOT EXISTS departure_alert_threshold INTEGER DEFAULT 3;
    ALTER TABLE settings ADD COLUMN IF NOT EXISTS report_footer TEXT;`,
  },
  {
    name: "reservations.employee_code",
    q: `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS employee_code TEXT NOT NULL DEFAULT '';`,
  },
  {
    name: "evaluations.employee_rating_and_response",
    q: `DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'evaluations') THEN
        ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS employee_rating REAL;
        ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS employee_response TEXT;
      END IF;
    END $$;`,
  },
  {
    name: "property_whatsapp_configs",
    q: `CREATE TABLE IF NOT EXISTS property_whatsapp_configs (
      id SERIAL PRIMARY KEY,
      property_id INTEGER,
      phone_number TEXT,
      status TEXT NOT NULL DEFAULT 'disconnected',
      qr_code TEXT,
      is_auto_send_enabled BOOLEAN NOT NULL DEFAULT true,
      welcome_template_ar TEXT NOT NULL DEFAULT '',
      welcome_template_en TEXT NOT NULL DEFAULT '',
      supervisor_contact TEXT DEFAULT '',
      is_reservation_send_enabled BOOLEAN NOT NULL DEFAULT true,
      reservation_template_ar TEXT NOT NULL DEFAULT '',
      reservation_template_en TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_tenant_prop_wa_config_prop ON property_whatsapp_configs(property_id);`,
  },
  {
    name: "whatsapp_delivery_logs",
    q: `CREATE TABLE IF NOT EXISTS whatsapp_delivery_logs (
      id SERIAL PRIMARY KEY,
      property_id INTEGER,
      recipient_phone TEXT NOT NULL,
      recipient_name TEXT,
      message_type TEXT NOT NULL DEFAULT 'CHECKIN_WELCOME',
      message_content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'SENT',
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_tenant_wa_del_logs_created ON whatsapp_delivery_logs (created_at);`,
  },
  {
    name: "room_import_jobs",
    q: `CREATE TABLE IF NOT EXISTS room_import_jobs (
      id SERIAL PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'pending',
      total_rooms INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
  },
  {
    name: "ws_sessions",
    q: `CREATE TABLE IF NOT EXISTS ws_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      property_id INTEGER,
      session_key TEXT NOT NULL,
      connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_ping_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      server_node TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true
    );
    CREATE INDEX IF NOT EXISTS idx_tenant_ws_sessions_user ON ws_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_tenant_ws_sessions_prop ON ws_sessions(property_id);
    CREATE INDEX IF NOT EXISTS idx_tenant_ws_sessions_active ON ws_sessions(is_active);`,
  },
  {
    name: "tenant.policy_exceptions_and_advanced_policies",
    q: `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS has_policy_exception BOOLEAN NOT NULL DEFAULT false;
        ALTER TABLE assignments ADD COLUMN IF NOT EXISTS policy_exception_reason TEXT;
        ALTER TABLE assignments ADD COLUMN IF NOT EXISTS policy_approved_by TEXT;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS policy_strict_gender_segregation BOOLEAN NOT NULL DEFAULT true;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS policy_strict_family_segregation BOOLEAN NOT NULL DEFAULT true;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS policy_adaptive_learning BOOLEAN NOT NULL DEFAULT true;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS policy_require_exception_approval BOOLEAN NOT NULL DEFAULT true;`,
  },
  {
    name: "tenant.composite_performance_indexes",
    q: `CREATE INDEX IF NOT EXISTS idx_assignments_room_status ON assignments(room_id, status);
        CREATE INDEX IF NOT EXISTS idx_assignments_profile_status ON assignments(profile_id, status);
        CREATE INDEX IF NOT EXISTS idx_rooms_building_status ON rooms(building_id, status);
        CREATE INDEX IF NOT EXISTS idx_reservations_room_status ON reservations(room_id, status);
        CREATE INDEX IF NOT EXISTS idx_assignments_policy_exception ON assignments(has_policy_exception);`,
  },
  {
    name: "tenant.settings.hosting_request_signature_policy",
    q: `ALTER TABLE settings ADD COLUMN IF NOT EXISTS hosting_request_signature_policy JSONB DEFAULT '[]'::jsonb;`,
  },
  {
    name: "tenant.settings.job_level_policies",
    q: `ALTER TABLE settings ADD COLUMN IF NOT EXISTS job_level_policies JSONB DEFAULT '[]'::jsonb;`,
  },
  {
    name: "tenant.profiles.previous_profile_id",
    q: `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS previous_profile_id TEXT DEFAULT '';`,
  },
  {
    name: "tenant.custom_report_templates",
    q: `CREATE TABLE IF NOT EXISTS custom_report_templates (
      id SERIAL PRIMARY KEY,
      property_id INTEGER,
      name TEXT NOT NULL,
      name_en TEXT,
      data_source TEXT NOT NULL DEFAULT 'in_house',
      columns JSONB NOT NULL DEFAULT '[]'::jsonb,
      filters JSONB NOT NULL DEFAULT '{}'::jsonb,
      layout_options JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_by INTEGER,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );`,
  },
  {
    name: "tenant.assignments.profile_status_active_index",
    q: `CREATE INDEX IF NOT EXISTS idx_assignments_profile_status_active ON assignments(profile_id, status) WHERE status = 'ACTIVE';`,
  },
  {
    name: "tenant.reservations.checkin_status_index",
    q: `CREATE INDEX IF NOT EXISTS idx_reservations_checkin_status ON reservations(check_in_date, status);`,
  },
  {
    name: "tenant.activity_logs.property_timestamp_index",
    q: `CREATE INDEX IF NOT EXISTS idx_activity_logs_property_timestamp ON activity_logs(property_id, "timestamp" DESC);`,
  },
  {
    name: "tenant.profiles.national_id_btree_index",
    q: `CREATE INDEX IF NOT EXISTS idx_profiles_national_id_btree ON profiles(national_id) WHERE national_id IS NOT NULL AND national_id != '';`,
  },
  {
    name: "tenant.property_whatsapp_configs.meta_cloud_fields",
    q: `
      ALTER TABLE property_whatsapp_configs
        ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'baileys',
        ADD COLUMN IF NOT EXISTS meta_access_token TEXT,
        ADD COLUMN IF NOT EXISTS meta_phone_number_id TEXT,
        ADD COLUMN IF NOT EXISTS meta_waba_id TEXT;
    `,
  },
  {
    name: "tenant.clean_duplicate_indexes",
    q: `
      DROP INDEX IF EXISTS assignments_profile_id_idx;
      DROP INDEX IF EXISTS idx_assignments_profile;
      DROP INDEX IF EXISTS assignments_room_id_idx;
      DROP INDEX IF EXISTS idx_assignments_room;
      DROP INDEX IF EXISTS idx_rooms_building;
      DROP INDEX IF EXISTS rooms_building_id_idx;
      DROP INDEX IF EXISTS profiles_national_id_idx;
      DROP INDEX IF EXISTS profiles_profile_id_idx;
    `,
  },
  {
    name: "tenant.rooms.chk_status_inspected",
    q: `DO $$ BEGIN
      ALTER TABLE rooms DROP CONSTRAINT IF EXISTS chk_rooms_status;
      ALTER TABLE rooms ADD CONSTRAINT chk_rooms_status
        CHECK (status IN ('available', 'occupied', 'dirty', 'occupied_dirty', 'occupied_vacation', 'out_of_service', 'out_of_order', 'room_vacant', 'bed_vacant', 'room_and_bed_vacant', 'inspected', 'in_cleaning'));
    END $$`,
  },
  {
    name: "whatsapp_anti_ban_v2",
    q: `
      ALTER TABLE IF EXISTS whatsapp_outbox_queue ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;
      CREATE TABLE IF NOT EXISTS whatsapp_opt_outs (
        id SERIAL PRIMARY KEY,
        property_id INTEGER NOT NULL,
        phone TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'reply',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_wa_opt_outs_prop_phone ON whatsapp_opt_outs (property_id, phone);
    `,
  },
  {
    name: "maintenance.ticket_system_v1",
    q: `
      ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS source TEXT;
      ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
      CREATE TABLE IF NOT EXISTS maintenance_events (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER NOT NULL REFERENCES maintenance(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        from_value TEXT,
        to_value TEXT,
        comment TEXT,
        actor_name TEXT,
        actor_user_id INTEGER,
        actor_profile_id INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_maintenance_events_ticket ON maintenance_events (ticket_id, created_at);
    `,
  },
  {
    name: "settings.maintenance_report",
    q: `ALTER TABLE settings ADD COLUMN IF NOT EXISTS maintenance_report_enabled BOOLEAN NOT NULL DEFAULT false;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS maintenance_report_emails TEXT;`,
  },
];
