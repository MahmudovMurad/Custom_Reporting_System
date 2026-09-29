CREATE TABLE "ingest_parts" (
	"upload_id" text NOT NULL,
	"part" integer NOT NULL,
	"total" integer NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingest_parts_upload_id_part_pk" PRIMARY KEY("upload_id","part")
);
--> statement-breakpoint
ALTER TABLE "sync_runs" ADD COLUMN "source_hash" text;