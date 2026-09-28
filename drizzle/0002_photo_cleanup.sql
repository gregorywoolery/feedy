CREATE TABLE "photo_cleanup_jobs" (
	"storage_key" text PRIMARY KEY NOT NULL,
	"storage_namespace" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
