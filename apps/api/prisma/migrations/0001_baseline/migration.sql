-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "cities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pois" (
    "id" TEXT NOT NULL,
    "city_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "geohash6" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "importance_score" INTEGER NOT NULL DEFAULT 0,
    "trigger_radius" INTEGER NOT NULL DEFAULT 80,
    "cooldown_minutes" INTEGER NOT NULL DEFAULT 60,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pois_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poi_facts" (
    "id" TEXT NOT NULL,
    "poi_id" TEXT NOT NULL,
    "fact_type" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "source_url" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poi_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personas" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tone_prompt" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "clerk_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "persona_id" TEXT,
    "language_code" TEXT NOT NULL DEFAULT 'en',
    "preferred_categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferred_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notifications_on" BOOLEAN NOT NULL DEFAULT true,
    "prefs_json" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "city_packs" (
    "id" TEXT NOT NULL,
    "city_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_usd" DECIMAL(8,2) NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'base',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "city_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "city_pack_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payment_ref" TEXT,
    "platform" TEXT NOT NULL DEFAULT 'web',
    "purchased_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_whispers" (
    "id" TEXT NOT NULL,
    "poi_id" TEXT,
    "city_id" TEXT NOT NULL,
    "persona_id" TEXT NOT NULL,
    "geohash6" TEXT NOT NULL,
    "time_slot" TEXT NOT NULL,
    "whisper_text" TEXT NOT NULL,
    "audio_url" TEXT,
    "model_used" TEXT NOT NULL,
    "prompt_hash" TEXT NOT NULL,
    "token_count" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'ai',
    "quality_score" DOUBLE PRECISION,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_stale" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_whispers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trails" (
    "id" TEXT NOT NULL,
    "city_id" TEXT NOT NULL,
    "persona_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "estimated_minutes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trail_stops" (
    "id" TEXT NOT NULL,
    "trail_id" TEXT NOT NULL,
    "whisper_id" TEXT NOT NULL,
    "stop_order" INTEGER NOT NULL,
    "transition_text" TEXT,

    CONSTRAINT "trail_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_whisper_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "whisper_id" TEXT NOT NULL,
    "listened" BOOLEAN NOT NULL DEFAULT false,
    "listen_duration_s" INTEGER,
    "triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_whisper_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_jobs" (
    "id" TEXT NOT NULL,
    "whisper_id" TEXT,
    "job_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "queue_name" TEXT NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "scheduled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "generation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pois_city_id_geohash6_idx" ON "pois"("city_id", "geohash6");

-- CreateIndex
CREATE INDEX "pois_city_id_importance_score_idx" ON "pois"("city_id", "importance_score");

-- CreateIndex
CREATE INDEX "poi_facts_poi_id_fact_type_idx" ON "poi_facts"("poi_id", "fact_type");

-- CreateIndex
CREATE UNIQUE INDEX "personas_slug_key" ON "personas"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_clerk_id_key" ON "users"("clerk_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_user_id_key" ON "user_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_payment_ref_key" ON "purchases"("payment_ref");

-- CreateIndex
CREATE INDEX "purchases_user_id_status_idx" ON "purchases"("user_id", "status");

-- CreateIndex
CREATE INDEX "purchases_city_pack_id_idx" ON "purchases"("city_pack_id");

-- CreateIndex
CREATE INDEX "generated_whispers_city_id_is_stale_idx" ON "generated_whispers"("city_id", "is_stale");

-- CreateIndex
CREATE INDEX "generated_whispers_prompt_hash_idx" ON "generated_whispers"("prompt_hash");

-- CreateIndex
CREATE INDEX "generated_whispers_geohash6_persona_id_time_slot_idx" ON "generated_whispers"("geohash6", "persona_id", "time_slot");

-- CreateIndex
CREATE INDEX "generated_whispers_city_id_is_featured_idx" ON "generated_whispers"("city_id", "is_featured");

-- CreateIndex
CREATE INDEX "generated_whispers_city_id_quality_score_idx" ON "generated_whispers"("city_id", "quality_score");

-- CreateIndex
CREATE INDEX "trail_stops_trail_id_stop_order_idx" ON "trail_stops"("trail_id", "stop_order");

-- CreateIndex
CREATE UNIQUE INDEX "trail_stops_trail_id_stop_order_key" ON "trail_stops"("trail_id", "stop_order");

-- CreateIndex
CREATE INDEX "user_whisper_events_user_id_triggered_at_idx" ON "user_whisper_events"("user_id", "triggered_at" DESC);

-- CreateIndex
CREATE INDEX "user_whisper_events_whisper_id_idx" ON "user_whisper_events"("whisper_id");

-- CreateIndex
CREATE INDEX "generation_jobs_whisper_id_job_type_idx" ON "generation_jobs"("whisper_id", "job_type");

-- CreateIndex
CREATE INDEX "generation_jobs_status_scheduled_at_idx" ON "generation_jobs"("status", "scheduled_at");

-- AddForeignKey
ALTER TABLE "pois" ADD CONSTRAINT "pois_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poi_facts" ADD CONSTRAINT "poi_facts_poi_id_fkey" FOREIGN KEY ("poi_id") REFERENCES "pois"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "city_packs" ADD CONSTRAINT "city_packs_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_city_pack_id_fkey" FOREIGN KEY ("city_pack_id") REFERENCES "city_packs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_whispers" ADD CONSTRAINT "generated_whispers_poi_id_fkey" FOREIGN KEY ("poi_id") REFERENCES "pois"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_whispers" ADD CONSTRAINT "generated_whispers_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_whispers" ADD CONSTRAINT "generated_whispers_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trails" ADD CONSTRAINT "trails_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trails" ADD CONSTRAINT "trails_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trail_stops" ADD CONSTRAINT "trail_stops_trail_id_fkey" FOREIGN KEY ("trail_id") REFERENCES "trails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trail_stops" ADD CONSTRAINT "trail_stops_whisper_id_fkey" FOREIGN KEY ("whisper_id") REFERENCES "generated_whispers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_whisper_events" ADD CONSTRAINT "user_whisper_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_whisper_events" ADD CONSTRAINT "user_whisper_events_whisper_id_fkey" FOREIGN KEY ("whisper_id") REFERENCES "generated_whispers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_whisper_id_fkey" FOREIGN KEY ("whisper_id") REFERENCES "generated_whispers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

