import { db, pool } from "@workspace/db";

// ====== PUBLIC SCHEMA MIGRATIONS (run once on public schema) ======
const MIGRATIONS = [
  // Existing column additions
  {
    name: "employees.photo_url",
    q: "ALTER TABLE employees    ADD COLUMN IF NOT EXISTS photo_url     TEXT",
  },
  {
    name: "maintenance.started_at",
    q: "ALTER TABLE maintenance  ADD COLUMN IF NOT EXISTS started_at   TIMESTAMPTZ",
  },
  {
    name: "maintenance.resolved_at",
    q: "ALTER TABLE maintenance  ADD COLUMN IF NOT EXISTS resolved_at  TIMESTAMPTZ",
  },
  {
    name: "maintenance.notes",
    q: "ALTER TABLE maintenance  ADD COLUMN IF NOT EXISTS notes        TEXT",
  },
  {
    name: "maintenance.reported_by",
    q: "ALTER TABLE maintenance  ADD COLUMN IF NOT EXISTS reported_by  TEXT",
  },
  {
    name: "maintenance.assigned_to",
    q: "ALTER TABLE maintenance  ADD COLUMN IF NOT EXISTS assigned_to  INTEGER",
  },
  {
    name: "maintenance.category",
    q: "ALTER TABLE maintenance  ADD COLUMN IF NOT EXISTS category     TEXT NOT NULL DEFAULT 'maintenance'",
  },
  {
    name: "reservations.nationality",
    q: "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS nationality   TEXT NOT NULL DEFAULT ''",
  },
  {
    name: "reservations.gender",
    q: "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS gender        TEXT NOT NULL DEFAULT ''",
  },
  {
    name: "reservations.employee_code",
    q: "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS employee_code TEXT NOT NULL DEFAULT ''",
  },
  {
    name: "reservations.level",
    q: "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS level         TEXT NOT NULL DEFAULT ''",
  },
  {
    name: "users.property_ids",
    q: "ALTER TABLE users ADD COLUMN IF NOT EXISTS property_ids integer[] NOT NULL DEFAULT '{}'",
  },
  {
    name: "users.email",
    q: "ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT",
  },
  {
    name: "users.phone",
    q: "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT",
  },
  {
    name: "users.last_property_id",
    q: "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_property_id INTEGER",
  },
  {
    name: "activity_logs.ip_address",
    q: "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS ip_address TEXT",
  },
  {
    name: "activity_logs.user_agent",
    q: "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS user_agent TEXT",
  },
  {
    name: "activity_logs.details",
    q: "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS details     TEXT",
  },
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

  // ===== Create public template tables needed for CREATE TABLE ... LIKE when creating properties =====
  // Some tables (portal_documents, activities) were created by tenant migrations but not in public
  {
    name: "public.portal_documents",
    q: "CREATE TABLE IF NOT EXISTS public.portal_documents (id SERIAL PRIMARY KEY, title_ar TEXT NOT NULL, title_en TEXT, file_name TEXT NOT NULL, file_type TEXT NOT NULL, file_data TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'policy', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
  },
  {
    name: "public.activities",
    q: "CREATE TABLE IF NOT EXISTS public.activities (id SERIAL PRIMARY KEY, title_ar TEXT NOT NULL, title_en TEXT NOT NULL, description_ar TEXT, description_en TEXT, category TEXT NOT NULL DEFAULT 'general', location_ar TEXT, location_en TEXT, start_date DATE NOT NULL, end_date DATE, start_time TEXT, max_participants INTEGER, status TEXT NOT NULL DEFAULT 'planned', expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
  },
  {
    name: "public.hr_sync_config",
    q: "CREATE TABLE IF NOT EXISTS public.hr_sync_config (id SERIAL PRIMARY KEY, property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE, api_url TEXT NOT NULL DEFAULT '', api_key TEXT NOT NULL DEFAULT '', field_mapping JSONB NOT NULL DEFAULT '{}', is_active BOOLEAN NOT NULL DEFAULT false, last_sync_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
  },
  {
    name: "public.hr_sync_log",
    q: "CREATE TABLE IF NOT EXISTS public.hr_sync_log (id SERIAL PRIMARY KEY, property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE, sync_type TEXT NOT NULL DEFAULT 'manual', status TEXT NOT NULL DEFAULT 'pending', records_processed INTEGER NOT NULL DEFAULT 0, records_created INTEGER NOT NULL DEFAULT 0, records_updated INTEGER NOT NULL DEFAULT 0, errors TEXT, started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), completed_at TIMESTAMPTZ)",
  },

  // ===== Activity Registrations =====
  {
    name: "public.activity_registrations",
    q: "CREATE TABLE IF NOT EXISTS public.activity_registrations (id SERIAL PRIMARY KEY, employee_id INTEGER NOT NULL, activity_id INTEGER NOT NULL, badge_number TEXT, status TEXT NOT NULL DEFAULT 'joined', attended BOOLEAN NOT NULL DEFAULT false, attended_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
  },
  {
    name: "public.portal_contacts",
    q: `CREATE TABLE IF NOT EXISTS public.portal_contacts (
    id SERIAL PRIMARY KEY, property_id INTEGER, name_ar TEXT NOT NULL, name_en TEXT NOT NULL,
    role_ar TEXT, role_en TEXT, email TEXT, phone TEXT, extension TEXT,
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
  {
    name: "evaluations.expires_at",
    q: "ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ",
  },

  // ===== Public template tables for new property provisioning =====
  {
    name: "public.evaluations",
    q: `CREATE TABLE IF NOT EXISTS public.evaluations (
    id SERIAL PRIMARY KEY, employee_id INTEGER, employee_response TEXT, employee_rating REAL,
    category TEXT NOT NULL DEFAULT 'general', title_ar TEXT, title_en TEXT,
    description_ar TEXT, description_en TEXT, department TEXT, survey_template_id INTEGER,
    status TEXT NOT NULL DEFAULT 'pending', submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  },
  {
    name: "public.evaluations.status",
    q: "ALTER TABLE public.evaluations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'",
  },
  {
    name: "public.survey_items",
    q: `CREATE TABLE IF NOT EXISTS public.survey_items (
    id SERIAL PRIMARY KEY, template_id INTEGER NOT NULL, title_ar TEXT NOT NULL,
    title_en TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'rating',
    required BOOLEAN NOT NULL DEFAULT true, order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  },
  {
    name: "public.survey_item_responses",
    q: `CREATE TABLE IF NOT EXISTS public.survey_item_responses (
    id SERIAL PRIMARY KEY, template_id INTEGER NOT NULL, employee_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL, rating_value REAL, text_value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  },
  {
    name: "public.room_locks",
    q: `CREATE TABLE IF NOT EXISTS public.room_locks (
    id SERIAL PRIMARY KEY, property_id INTEGER NOT NULL, room_id INTEGER NOT NULL,
    lock_number TEXT NOT NULL, protocol TEXT NOT NULL DEFAULT 'mifare',
    status TEXT NOT NULL DEFAULT 'active', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  },
  {
    name: "public.room_keys",
    q: `CREATE TABLE IF NOT EXISTS public.room_keys (
    id SERIAL PRIMARY KEY, property_id INTEGER NOT NULL, assignment_id INTEGER,
    room_id INTEGER NOT NULL, lock_id INTEGER, employee_id INTEGER,
    card_number TEXT, card_type TEXT NOT NULL DEFAULT 'guest', issued_by INTEGER,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ, revoked_by INTEGER, status TEXT NOT NULL DEFAULT 'active',
    notes TEXT
  )`,
  },
  {
    name: "public.key_audit_log",
    q: `CREATE TABLE IF NOT EXISTS public.key_audit_log (
    id SERIAL PRIMARY KEY, property_id INTEGER NOT NULL, key_id INTEGER,
    action TEXT NOT NULL, performed_by INTEGER, card_number TEXT,
    room_number TEXT, details JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  },
  {
    name: "public.property_hotek_servers",
    q: `CREATE TABLE IF NOT EXISTS public.property_hotek_servers (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    protocol TEXT NOT NULL DEFAULT 'fidelio',
    workstation TEXT NOT NULL DEFAULT 'WS1',
    server_code TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    last_seen_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  },
  {
    name: "public.property_hotek_encoders",
    q: `CREATE TABLE IF NOT EXISTS public.property_hotek_encoders (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    server_id INTEGER NOT NULL REFERENCES public.property_hotek_servers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    encoder_code TEXT NOT NULL,
    desk_name TEXT,
    ip_address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    last_seen_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  },
  {
    name: "idx_property_hotek_servers_property",
    q: "CREATE INDEX IF NOT EXISTS idx_property_hotek_servers_property ON public.property_hotek_servers(property_id)",
  },
  {
    name: "idx_property_hotek_servers_active",
    q: "CREATE INDEX IF NOT EXISTS idx_property_hotek_servers_active ON public.property_hotek_servers(property_id, is_active)",
  },
  {
    name: "idx_property_hotek_encoders_property",
    q: "CREATE INDEX IF NOT EXISTS idx_property_hotek_encoders_property ON public.property_hotek_encoders(property_id)",
  },
  {
    name: "idx_property_hotek_encoders_server",
    q: "CREATE INDEX IF NOT EXISTS idx_property_hotek_encoders_server ON public.property_hotek_encoders(server_id)",
  },
  {
    name: "idx_property_hotek_encoders_active",
    q: "CREATE INDEX IF NOT EXISTS idx_property_hotek_encoders_active ON public.property_hotek_encoders(property_id, is_active)",
  },
  {
    name: "public.portal_notifications",
    q: `CREATE TABLE IF NOT EXISTS public.portal_notifications (
    id SERIAL PRIMARY KEY, property_id INTEGER NOT NULL, title TEXT NOT NULL,
    title_ar TEXT, message TEXT NOT NULL, message_ar TEXT,
    type TEXT NOT NULL DEFAULT 'announcement', priority TEXT NOT NULL DEFAULT 'medium',
    target_all BOOLEAN NOT NULL DEFAULT true, department TEXT,
    created_by INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ
  )`,
  },
  {
    name: "public.portal_notification_reads",
    q: `CREATE TABLE IF NOT EXISTS public.portal_notification_reads (
    id SERIAL PRIMARY KEY, notification_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL, read_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  },
  {
    name: "public.push_subscriptions",
    q: `CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id SERIAL PRIMARY KEY, employee_id INTEGER NOT NULL, property_id INTEGER NOT NULL,
    endpoint TEXT NOT NULL, p256dh_key TEXT NOT NULL, auth_key TEXT NOT NULL,
    user_agent TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_used_at TIMESTAMPTZ
  )`,
  },

  // === Maintenance Photo ===
  {
    name: "maintenance.photo_url",
    q: "ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS photo_url TEXT",
  },

  // ===== PERFORMANCE INDEXES =====
  {
    name: "idx_employees_employee_id",
    q: "CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON employees(employee_id)",
  },
  {
    name: "idx_employees_status",
    q: "CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status)",
  },
  {
    name: "idx_assignments_employee_status",
    q: "CREATE INDEX IF NOT EXISTS idx_assignments_employee_status ON assignments(employee_id, status)",
  },
  {
    name: "idx_assignments_checkout_date",
    q: "CREATE INDEX IF NOT EXISTS idx_assignments_checkout_date ON assignments(status, expected_check_out_date)",
  },
  {
    name: "idx_rooms_building_floor",
    q: "CREATE INDEX IF NOT EXISTS idx_rooms_building_floor ON rooms(building_id, floor_id)",
  },
  {
    name: "idx_rooms_occupancy",
    q: "CREATE INDEX IF NOT EXISTS idx_rooms_occupancy ON rooms(current_occupancy, capacity)",
  },
  {
    name: "idx_maintenance_status_priority",
    q: "CREATE INDEX IF NOT EXISTS idx_maintenance_status_priority ON maintenance(status, priority)",
  },
  {
    name: "idx_maintenance_room",
    q: "CREATE INDEX IF NOT EXISTS idx_maintenance_room ON maintenance(room_id)",
  },
  {
    name: "idx_reservations_status_date",
    q: "CREATE INDEX IF NOT EXISTS idx_reservations_status_date ON reservations(status, check_in_date)",
  },
  {
    name: "idx_activity_logs_timestamp",
    q: "CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp DESC)",
  },
  {
    name: "idx_activity_logs_module",
    q: "CREATE INDEX IF NOT EXISTS idx_activity_logs_module ON activity_logs(module)",
  },
  {
    name: "idx_evaluations_survey",
    q: "CREATE INDEX IF NOT EXISTS idx_evaluations_survey ON evaluations(survey_template_id)",
  },
  {
    name: "idx_evaluations_expires",
    q: "CREATE INDEX IF NOT EXISTS idx_evaluations_expires ON evaluations(expires_at)",
  },

  // ─── Password Policy & Account Lockout Columns (Public Schema) ───────
  {
    name: "users.failed_login_attempts",
    q: "ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0",
  },
  {
    name: "users.locked_until",
    q: "ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ",
  },
  {
    name: "users.password_changed_at",
    q: "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ",
  },
  {
    name: "public.password_history",
    q: `CREATE TABLE IF NOT EXISTS password_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  },
  {
    name: "public.portal_food_menu",
    q: `CREATE TABLE IF NOT EXISTS public.portal_food_menu (
    id SERIAL PRIMARY KEY, property_id INTEGER NOT NULL, name TEXT NOT NULL,
    name_ar TEXT, description TEXT, description_ar TEXT, price TEXT DEFAULT '0',
    meal_type TEXT NOT NULL DEFAULT 'daily', category TEXT NOT NULL DEFAULT 'main',
    date DATE, available BOOLEAN NOT NULL DEFAULT true, image_url TEXT,
    created_by INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  },
  {
    name: "public.portal_meal_orders",
    q: `CREATE TABLE IF NOT EXISTS public.portal_meal_orders (
    id SERIAL PRIMARY KEY, property_id INTEGER NOT NULL, employee_id INTEGER NOT NULL,
    menu_item_id INTEGER NOT NULL, quantity INTEGER NOT NULL DEFAULT 1,
    order_date DATE NOT NULL, status TEXT NOT NULL DEFAULT 'confirmed',
    notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  },
  {
    name: "public.portal_transport_schedules",
    q: `CREATE TABLE IF NOT EXISTS public.portal_transport_schedules (
    id SERIAL PRIMARY KEY, property_id INTEGER NOT NULL, route TEXT NOT NULL,
    route_ar TEXT, location TEXT, location_ar TEXT, departure TEXT NOT NULL,
    arrival TEXT, days TEXT NOT NULL DEFAULT 'daily', custom_days TEXT,
    capacity INTEGER NOT NULL DEFAULT 20, notes TEXT, notes_ar TEXT,
    active BOOLEAN NOT NULL DEFAULT true, created_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  },
  {
    name: "public.portal_transport_bookings",
    q: `CREATE TABLE IF NOT EXISTS public.portal_transport_bookings (
    id SERIAL PRIMARY KEY, property_id INTEGER NOT NULL, employee_id INTEGER NOT NULL,
    schedule_id INTEGER NOT NULL, booking_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  },
  {
    name: "public.portal_conversations",
    q: `CREATE TABLE IF NOT EXISTS public.portal_conversations (
    id SERIAL PRIMARY KEY, property_id INTEGER NOT NULL, subject TEXT,
    is_group BOOLEAN NOT NULL DEFAULT false, created_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  },
  {
    name: "public.portal_conversation_participants",
    q: `CREATE TABLE IF NOT EXISTS public.portal_conversation_participants (
    id SERIAL PRIMARY KEY, conversation_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL, joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_read_at TIMESTAMPTZ
  )`,
  },
  {
    name: "public.portal_messages",
    q: `CREATE TABLE IF NOT EXISTS public.portal_messages (
    id SERIAL PRIMARY KEY, conversation_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL, content TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'text', is_edited BOOLEAN NOT NULL DEFAULT false,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), edited_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
  )`,
  },
  {
    name: "public.portal_message_reads",
    q: `CREATE TABLE IF NOT EXISTS public.portal_message_reads (
    id SERIAL PRIMARY KEY, message_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL, read_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  },
  {
    name: "public.user_signatures",
    q: `CREATE TABLE IF NOT EXISTS public.user_signatures (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES public.users(id),
    signature_image_url VARCHAR(500) NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  },
  {
    name: "public.rename_family_visit_requests",
    q: `DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'family_visit_requests' AND relnamespace = 'public'::regnamespace) THEN
        IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'hosting_requests' AND relnamespace = 'public'::regnamespace) THEN
          ALTER TABLE public.family_visit_requests RENAME TO hosting_requests;
        ELSE
          DROP TABLE public.family_visit_requests;
        END IF;
      END IF;
    END $$`,
  },
  {
    name: "public.rename_family_visit_approval_steps",
    q: `DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'family_visit_approval_steps' AND relnamespace = 'public'::regnamespace) THEN
        IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'hosting_request_approval_steps' AND relnamespace = 'public'::regnamespace) THEN
          ALTER TABLE public.family_visit_approval_steps RENAME TO hosting_request_approval_steps;
        ELSE
          DROP TABLE public.family_visit_approval_steps;
        END IF;
      END IF;
    END $$`,
  },
  {
    name: "public.rename_fvr_request_number_key",
    q: `DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'family_visit_requests_request_number_key') THEN
        EXECUTE 'ALTER INDEX family_visit_requests_request_number_key RENAME TO hosting_requests_request_number_key';
      END IF;
    END $$`,
  },
  {
    name: "public.hosting_requests",
    q: `CREATE TABLE IF NOT EXISTS public.hosting_requests (
    id SERIAL PRIMARY KEY,
    request_number VARCHAR(20) NOT NULL UNIQUE,
    property_id INTEGER NOT NULL REFERENCES public.properties(id),
    hotel_id INTEGER,
    visit_hotel_id INTEGER,
    requester_user_id INTEGER NOT NULL REFERENCES public.users(id),
    employee_name VARCHAR(200) NOT NULL,
    clock_number VARCHAR(50) NOT NULL,
    department VARCHAR(150) NOT NULL,
    position VARCHAR(150) NOT NULL,
    number_of_rooms INTEGER NOT NULL,
    assigned_room_id INTEGER,
    family_members_count INTEGER NOT NULL,
    family_members_included VARCHAR(100),
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    consumed_days INTEGER NOT NULL,
    remarks TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'in_signing',
    current_step_order INTEGER NOT NULL DEFAULT 1,
    rejected_at_step INTEGER,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  },
  {
    name: "public.idx_fvr_status",
    q: "CREATE INDEX IF NOT EXISTS idx_fvr_status ON public.hosting_requests(status)",
  },
  {
    name: "public.idx_fvr_property_id",
    q: "CREATE INDEX IF NOT EXISTS idx_fvr_property_id ON public.hosting_requests(property_id)",
  },
  {
    name: "hosting_requests.guest_hosting_id",
    q: "ALTER TABLE public.hosting_requests ADD COLUMN IF NOT EXISTS guest_hosting_id INTEGER",
  },
  {
    name: "hosting_requests.assigned_room_id",
    q: "ALTER TABLE public.hosting_requests ADD COLUMN IF NOT EXISTS assigned_room_id INTEGER",
  },
  {
    name: "hosting_requests.guest_hosting_status",
    q: "ALTER TABLE public.hosting_requests ADD COLUMN IF NOT EXISTS guest_hosting_status VARCHAR(30)",
  },
  {
    name: "public.hosting_request_approval_steps",
    q: `CREATE TABLE IF NOT EXISTS public.hosting_request_approval_steps (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES public.hosting_requests(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    role_required VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    signed_by_user_id INTEGER REFERENCES public.users(id),
    signed_at TIMESTAMPTZ,
    signature_image_url_snapshot VARCHAR(500),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  },
  {
    name: "public.idx_fvas_request_id",
    q: "CREATE INDEX IF NOT EXISTS idx_fvas_request_id ON public.hosting_request_approval_steps(request_id)",
  },
  {
    name: "public.idx_fvas_status",
    q: "CREATE INDEX IF NOT EXISTS idx_fvas_status ON public.hosting_request_approval_steps(status)",
  },
];

// ====== TENANT SCHEMA MIGRATIONS (run per tenant) ======
const TENANT_MIGRATIONS = [
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
    name: "employees.photo_url",
    q: "ALTER TABLE employees ADD COLUMN IF NOT EXISTS photo_url TEXT",
  },
  {
    name: "employees.email",
    q: "ALTER TABLE employees ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '' NOT NULL",
  },
  {
    name: "employees.emergency_contact",
    q: "ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact TEXT DEFAULT '' NOT NULL",
  },
  {
    name: "employees.third_name",
    q: "ALTER TABLE employees ADD COLUMN IF NOT EXISTS third_name TEXT DEFAULT '' NOT NULL",
  },
  {
    name: "employees.fourth_name",
    q: "ALTER TABLE employees ADD COLUMN IF NOT EXISTS fourth_name TEXT DEFAULT '' NOT NULL",
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
    id SERIAL PRIMARY KEY, employee_id INTEGER, rating REAL,
    comment TEXT, employee_response TEXT, employee_rating REAL,
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
    name: "evaluations.employee_rating",
    q: "ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS employee_rating REAL",
  },
  {
    name: "evaluations.employee_response",
    q: "ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS employee_response TEXT",
  },
  {
    name: "evaluations.expires_at",
    q: "ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ",
  },
  {
    name: "evaluations.make_employee_id_nullable",
    q: "ALTER TABLE evaluations ALTER COLUMN employee_id DROP NOT NULL",
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
    id SERIAL PRIMARY KEY, employee_id INTEGER NOT NULL, activity_id INTEGER NOT NULL,
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
    employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
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

  // === Fix duplicate active assignments: checkout the older one for employee 10575 ===
  {
    name: "fix.duplicate_assignment_10575",
    q: "UPDATE assignments SET status = 'CHECKED_OUT', check_out_date = NOW()::text WHERE employee_id = '10575' AND status = 'ACTIVE' AND id < (SELECT id FROM assignments WHERE employee_id = '10575' AND status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1)",
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
    employee_id INTEGER NOT NULL,
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
    name: "idx_survey_item_responses_employee",
    q: "CREATE INDEX IF NOT EXISTS idx_survey_item_responses_employee ON survey_item_responses(employee_id)",
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
    employee_id INTEGER NOT NULL,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  },
  {
    name: "portal_notification_reads_unique",
    q: "CREATE UNIQUE INDEX IF NOT EXISTS uq_portal_notification_reads ON portal_notification_reads (notification_id, employee_id)",
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
    employee_id INTEGER NOT NULL,
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
    name: "push_subscriptions_employee",
    q: "CREATE INDEX IF NOT EXISTS idx_push_subscriptions_employee ON push_subscriptions (employee_id)",
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
  // === Fix existing duplicate portal accounts (keep most recent per employee_id) ===
  {
    name: "employee_portal_accounts.dedup_keep_latest",
    q: `DELETE FROM employee_portal_accounts
    WHERE id NOT IN (
      SELECT DISTINCT ON (employee_id) id
      FROM employee_portal_accounts
      ORDER BY employee_id, id DESC
    )`,
  },
  // === Add unique constraint on employee_portal_accounts.employee_id ===
  {
    name: "employee_portal_accounts.unique_employee_id",
    q: "CREATE UNIQUE INDEX IF NOT EXISTS uq_portal_accounts_employee_id ON employee_portal_accounts (employee_id)",
  },
];

async function runForAllTenants(query: string): Promise<number> {
  const client = await pool.connect();
  try {
    const { rows: properties } = await client.query(
      "SELECT id, schema_name FROM properties WHERE schema_name IS NOT NULL",
    );
    let count = 0;
    for (const prop of properties) {
      try {
        await client.query(`SET search_path TO ${prop.schema_name}, public`);
        await client.query(query);
        count++;
      } catch (err: any) {
        if (
          !err?.message?.includes("already exists") &&
          !err?.message?.includes("duplicate key") &&
          !err?.message?.includes("cannot be dropped")
        ) {
          console.warn(
            `[migrations] tenant ${prop.id} (${prop.schema_name}): ${err?.message}`,
          );
        }
      }
    }
    return count;
  } finally {
    client.release();
  }
}

export async function runMigrations(): Promise<void> {
  console.info("[migrations] Running startup migrations...");
  let ok = 0;
  for (const m of MIGRATIONS) {
    try {
      await pool.query(m.q);
      ok++;
    } catch (err: any) {
      if (
        !err?.message?.includes("already exists") &&
        !err?.message?.includes("duplicate key")
      ) {
        console.warn(`[migrations] ${m.name}: ${err?.message}`);
      }
    }
  }
  console.info(
    `[migrations] Public schema done — ${ok}/${MIGRATIONS.length} applied.`,
  );

  console.info("[migrations] Running tenant schema migrations...");
  let tOk = 0;
  for (const m of TENANT_MIGRATIONS) {
    try {
      const count = await runForAllTenants(m.q);
      tOk += count;
      console.info(`[migrations] ${m.name}: applied to ${count} tenants`);
    } catch (err: any) {
      console.warn(`[migrations] ${m.name}: ${err?.message}`);
    }
  }
  console.info(
    `[migrations] Tenant migrations done — ${tOk} total tenant-applications.`,
  );
}
