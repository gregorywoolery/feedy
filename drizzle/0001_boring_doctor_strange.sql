CREATE TABLE "photo_objects" (
	"key" text PRIMARY KEY NOT NULL,
	"bytes" "bytea" NOT NULL,
	"mime_type" varchar(80) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photo_objects_key_check" CHECK ("photo_objects"."key" ~ '^[a-f0-9]{64}\.(jpg|png|webp)$'),
	CONSTRAINT "photo_objects_mime_type_check" CHECK ("photo_objects"."mime_type" in ('image/jpeg', 'image/png', 'image/webp'))
);
