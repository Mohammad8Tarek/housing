CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"property_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employee_portal_accounts" ADD COLUMN "reset_failed_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_portal_accounts" ADD COLUMN "reset_locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "family_visit_requests" ADD COLUMN "attachment_data" text;