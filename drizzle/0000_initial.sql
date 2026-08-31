CREATE TABLE "feedback_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"project_version" varchar(80) NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_items_project_version_not_blank_check" CHECK (char_length(btrim("feedback_items"."project_version")) between 1 and 80),
	CONSTRAINT "feedback_items_description_length_check" CHECK (char_length(btrim("feedback_items"."description")) between 1 and 10000)
);
--> statement-breakpoint
CREATE TABLE "feedback_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feedback_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"mime_type" varchar(80) NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_photos_feedback_id_sort_order_unique" UNIQUE("feedback_id","sort_order"),
	CONSTRAINT "feedback_photos_original_filename_not_blank_check" CHECK (char_length(btrim("feedback_photos"."original_filename")) between 1 and 255),
	CONSTRAINT "feedback_photos_mime_type_check" CHECK ("feedback_photos"."mime_type" in ('image/jpeg', 'image/png', 'image/webp')),
	CONSTRAINT "feedback_photos_size_bytes_check" CHECK ("feedback_photos"."size_bytes" between 1 and 10485760),
	CONSTRAINT "feedback_photos_width_check" CHECK ("feedback_photos"."width" is null or "feedback_photos"."width" > 0),
	CONSTRAINT "feedback_photos_height_check" CHECK ("feedback_photos"."height" is null or "feedback_photos"."height" > 0),
	CONSTRAINT "feedback_photos_sort_order_check" CHECK ("feedback_photos"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_name_not_blank_check" CHECK (char_length(btrim("projects"."name")) between 1 and 160),
	CONSTRAINT "projects_description_length_check" CHECK ("projects"."description" is null or char_length("projects"."description") <= 4000)
);
--> statement-breakpoint
ALTER TABLE "feedback_items" ADD CONSTRAINT "feedback_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_photos" ADD CONSTRAINT "feedback_photos_feedback_id_feedback_items_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "feedback_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_items_project_created_at_idx" ON "feedback_items" USING btree ("project_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "feedback_items_project_version_idx" ON "feedback_items" USING btree ("project_version");--> statement-breakpoint
CREATE INDEX "feedback_items_created_at_idx" ON "feedback_items" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "feedback_items_updated_at_idx" ON "feedback_items" USING btree ("updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_photos_storage_key_idx" ON "feedback_photos" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "feedback_photos_feedback_id_sort_order_idx" ON "feedback_photos" USING btree ("feedback_id","sort_order");--> statement-breakpoint
CREATE INDEX "projects_name_lower_idx" ON "projects" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "projects_updated_at_idx" ON "projects" USING btree ("updated_at" DESC NULLS LAST);
