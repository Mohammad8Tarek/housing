CREATE TABLE "properties" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"schema_name" text,
	"code" text NOT NULL,
	"display_name" text,
	"logo" text,
	"primary_color" text DEFAULT '#0F2A44' NOT NULL,
	"default_language" text DEFAULT 'en' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "properties_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer,
	"username" text NOT NULL,
	"email" text,
	"phone" text,
	"department" text,
	"job_title" text,
	"password_hash" text NOT NULL,
	"roles" text[] DEFAULT '{}' NOT NULL,
	"permissions" text[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"property_ids" integer[] DEFAULT '{}' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "buildings" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"capacity" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "floors" (
	"id" serial PRIMARY KEY NOT NULL,
	"building_id" integer NOT NULL,
	"floor_number" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"building_id" integer NOT NULL,
	"floor_id" integer NOT NULL,
	"room_number" text NOT NULL,
	"room_type" text DEFAULT 'single' NOT NULL,
	"capacity" integer DEFAULT 1 NOT NULL,
	"current_occupancy" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"gender" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"national_id" text NOT NULL,
	"nationality" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"job_title" text DEFAULT '' NOT NULL,
	"level" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"department" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"hire_date" text NOT NULL,
	"gender" text DEFAULT 'male' NOT NULL,
	"id_image" text,
	"photo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"room_id" integer NOT NULL,
	"bed_number" integer,
	"check_in_date" text NOT NULL,
	"expected_check_out_date" text,
	"check_out_date" text,
	"notes" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer,
	"room_type" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"check_in_date" text NOT NULL,
	"check_out_date" text,
	"notes" text DEFAULT '' NOT NULL,
	"guest_id_card_number" text DEFAULT '' NOT NULL,
	"guest_phone" text DEFAULT '' NOT NULL,
	"job_title" text DEFAULT '' NOT NULL,
	"department" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'UPCOMING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hostings" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"hosting_type" text DEFAULT 'SAME_ROOM' NOT NULL,
	"guests_count" integer DEFAULT 1 NOT NULL,
	"expected_from" text NOT NULL,
	"expected_to" text NOT NULL,
	"actual_check_in" text,
	"actual_check_out" text,
	"room_id" integer,
	"room_type" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_id" integer,
	"room_id" integer NOT NULL,
	"category" text DEFAULT 'maintenance' NOT NULL,
	"problem_type" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"reported_by" text,
	"assigned_to" integer,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"due_date" text,
	"notes" text,
	"photo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"user_id" integer,
	"user_role" text,
	"action" text NOT NULL,
	"action_type" text DEFAULT 'INFO' NOT NULL,
	"module" text DEFAULT 'system' NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"entity_type" text,
	"entity_id" bigint,
	"ip_address" text,
	"user_agent" text,
	"details" text,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"system_name" text DEFAULT 'Sunrise Staff Housing' NOT NULL,
	"system_logo" text,
	"default_language" text DEFAULT 'en' NOT NULL,
	"primary_color" text DEFAULT '#0F2A44' NOT NULL,
	"sidebar_color" text DEFAULT '#1e293b' NOT NULL,
	"button_color" text DEFAULT '#C9A24D' NOT NULL,
	"departure_alerts_enabled" boolean DEFAULT true NOT NULL,
	"departure_alert_threshold" integer DEFAULT 3 NOT NULL,
	"report_footer" text DEFAULT 'Generated by Sunrise Housing System' NOT NULL,
	"portal_contact_email" text,
	"portal_contact_phone" text,
	"portal_contact_ext" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lookup_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"value" text NOT NULL,
	"parent_value" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hosting_companions" (
	"id" serial PRIMARY KEY NOT NULL,
	"hosting_id" integer NOT NULL,
	"name" text NOT NULL,
	"id_number" text,
	"document_type" text,
	"document_image" text,
	"document_file_name" text,
	"relation" text,
	"is_child" integer DEFAULT 0 NOT NULL,
	"age" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_portal_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"password_hash" text NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"password_changed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluations" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer,
	"employee_response" text,
	"employee_rating" real,
	"category" text DEFAULT 'general' NOT NULL,
	"title_ar" text,
	"title_en" text,
	"description_ar" text,
	"description_en" text,
	"department" text,
	"survey_template_id" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"title_ar" text NOT NULL,
	"title_en" text,
	"file_name" text NOT NULL,
	"file_type" text NOT NULL,
	"file_data" text NOT NULL,
	"category" text DEFAULT 'policy' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"role_ar" text,
	"role_en" text,
	"email" text,
	"phone" text,
	"extension" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"title_ar" text NOT NULL,
	"title_en" text NOT NULL,
	"description_ar" text,
	"description_en" text,
	"category" text DEFAULT 'general' NOT NULL,
	"location_ar" text,
	"location_en" text,
	"start_date" date NOT NULL,
	"end_date" date,
	"start_time" text,
	"max_participants" integer,
	"status" text DEFAULT 'planned' NOT NULL,
	"cover_image" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"target_departments" text[] DEFAULT '{}' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_registrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"activity_id" integer NOT NULL,
	"badge_number" text,
	"status" text DEFAULT 'joined' NOT NULL,
	"attended" boolean DEFAULT false NOT NULL,
	"attended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_notification_reads" (
	"id" serial PRIMARY KEY NOT NULL,
	"notification_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"title" text NOT NULL,
	"title_ar" text,
	"message" text NOT NULL,
	"message_ar" text,
	"type" text DEFAULT 'announcement' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"target_all" boolean DEFAULT true NOT NULL,
	"department" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"property_id" integer NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh_key" text NOT NULL,
	"auth_key" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "portal_comment_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"comment_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"content_type" text NOT NULL,
	"content_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"text" text NOT NULL,
	"parent_comment_id" integer,
	"likes_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"content_type" text NOT NULL,
	"content_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"rating" real,
	"comment" text,
	"helpful" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_item_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"rating_value" real,
	"text_value" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL,
	"title_ar" text NOT NULL,
	"title_en" text NOT NULL,
	"type" text DEFAULT 'rating' NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "key_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"key_id" integer,
	"action" text NOT NULL,
	"performed_by" integer,
	"card_number" text,
	"room_number" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"assignment_id" integer,
	"room_id" integer NOT NULL,
	"lock_id" integer,
	"employee_id" integer,
	"card_number" text,
	"card_type" text DEFAULT 'guest' NOT NULL,
	"issued_by" integer,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "room_locks" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"room_id" integer NOT NULL,
	"lock_number" text NOT NULL,
	"protocol" text DEFAULT 'mifare' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "floors" ADD CONSTRAINT "floors_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_floor_id_floors_id_fk" FOREIGN KEY ("floor_id") REFERENCES "public"."floors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hostings" ADD CONSTRAINT "hostings_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hostings" ADD CONSTRAINT "hostings_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance" ADD CONSTRAINT "maintenance_parent_id_maintenance_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."maintenance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance" ADD CONSTRAINT "maintenance_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance" ADD CONSTRAINT "maintenance_assigned_to_employees_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hosting_companions" ADD CONSTRAINT "hosting_companions_hosting_id_hostings_id_fk" FOREIGN KEY ("hosting_id") REFERENCES "public"."hostings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_item_responses" ADD CONSTRAINT "survey_item_responses_template_id_evaluations_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_item_responses" ADD CONSTRAINT "survey_item_responses_item_id_survey_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."survey_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_items" ADD CONSTRAINT "survey_items_template_id_evaluations_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_audit_log" ADD CONSTRAINT "key_audit_log_key_id_room_keys_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."room_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_keys" ADD CONSTRAINT "room_keys_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_keys" ADD CONSTRAINT "room_keys_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_keys" ADD CONSTRAINT "room_keys_lock_id_room_locks_id_fk" FOREIGN KEY ("lock_id") REFERENCES "public"."room_locks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_keys" ADD CONSTRAINT "room_keys_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_locks" ADD CONSTRAINT "room_locks_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_portal_notification_reads" ON "portal_notification_reads" USING btree ("notification_id","employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_push_subscriptions" ON "push_subscriptions" USING btree ("endpoint");