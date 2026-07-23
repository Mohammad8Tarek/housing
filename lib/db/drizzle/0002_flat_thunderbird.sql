CREATE TABLE "user_signatures" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"signature_image_url" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_signatures_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "family_visit_approval_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"step_order" integer NOT NULL,
	"role_required" varchar(50) NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"signed_by_user_id" integer,
	"signed_at" timestamp with time zone,
	"signature_image_url_snapshot" text,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_visit_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_number" varchar(20) NOT NULL,
	"property_id" integer NOT NULL,
	"hotel_id" integer,
	"visit_hotel_id" integer,
	"requester_user_id" integer NOT NULL,
	"employee_name" varchar(200) NOT NULL,
	"clock_number" varchar(50) NOT NULL,
	"department" varchar(150) NOT NULL,
	"position" varchar(150) NOT NULL,
	"number_of_rooms" integer NOT NULL,
	"assigned_room_id" integer,
	"family_members_count" integer NOT NULL,
	"family_members_included" varchar(100),
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"consumed_days" integer NOT NULL,
	"remarks" text,
	"status" varchar(30) DEFAULT 'in_signing' NOT NULL,
	"current_step_order" integer DEFAULT 1 NOT NULL,
	"rejected_at_step" integer,
	"rejection_reason" text,
	"guest_hosting_id" integer,
	"guest_hosting_status" varchar(30),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "family_visit_requests_request_number_unique" UNIQUE("request_number")
);
--> statement-breakpoint
ALTER TABLE "user_signatures" ADD CONSTRAINT "user_signatures_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_visit_approval_steps" ADD CONSTRAINT "family_visit_approval_steps_request_id_family_visit_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."family_visit_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_visit_approval_steps" ADD CONSTRAINT "family_visit_approval_steps_signed_by_user_id_users_id_fk" FOREIGN KEY ("signed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_visit_requests" ADD CONSTRAINT "family_visit_requests_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_visit_requests" ADD CONSTRAINT "family_visit_requests_requester_user_id_users_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "index_fvas_request_id" ON "family_visit_approval_steps" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "index_fvas_status" ON "family_visit_approval_steps" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_fvr_status" ON "family_visit_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_fvr_property_id" ON "family_visit_requests" USING btree ("property_id");