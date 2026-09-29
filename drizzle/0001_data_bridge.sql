CREATE TABLE "crm_facts" (
	"day" date NOT NULL,
	"brand" text NOT NULL,
	"model" text NOT NULL,
	"nov" text NOT NULL,
	"kanal" text NOT NULL,
	"satis" text NOT NULL,
	"haradan" text NOT NULL,
	"cnt" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "datasets" (
	"id" serial PRIMARY KEY NOT NULL,
	"sync_run_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hash" text NOT NULL,
	"payload" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locks" (
	"name" text PRIMARY KEY NOT NULL,
	"until" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_facts" (
	"ym" text NOT NULL,
	"brand" text NOT NULL,
	"model" text NOT NULL,
	"cnt" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_rows" (
	"snapshot_id" integer NOT NULL,
	"pos" smallint NOT NULL,
	"brand" text NOT NULL,
	"model" text NOT NULL,
	"version" text NOT NULL,
	"year" smallint,
	"price" double precision,
	"faiz" double precision,
	"ilkin" double precision,
	"muddet" text NOT NULL,
	"ayliq" double precision,
	"stok" integer NOT NULL,
	"real" integer NOT NULL,
	"hedef" integer NOT NULL,
	"actual" integer NOT NULL,
	"beh" integer NOT NULL,
	"qeyd" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"sync_run_id" integer,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hash" text NOT NULL,
	"row_count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"trigger" text NOT NULL,
	"user_id" uuid,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_ms" integer,
	"crm_records" integer,
	"crm_skipped" integer,
	"crm_rows" integer,
	"market_records" integer,
	"stock_rows" integer,
	"data_start" date,
	"data_end" date,
	"data_hash" text,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_sync_run_id_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."sync_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_rows" ADD CONSTRAINT "stock_rows_snapshot_id_stock_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."stock_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_snapshots" ADD CONSTRAINT "stock_snapshots_sync_run_id_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."sync_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crm_facts_day_idx" ON "crm_facts" USING btree ("day");--> statement-breakpoint
CREATE INDEX "stock_rows_snapshot_idx" ON "stock_rows" USING btree ("snapshot_id","pos");--> statement-breakpoint
CREATE INDEX "sync_runs_started_idx" ON "sync_runs" USING btree ("started_at");