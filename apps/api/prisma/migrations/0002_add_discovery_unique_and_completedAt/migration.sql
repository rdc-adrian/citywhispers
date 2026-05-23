-- AlterTable
ALTER TABLE "user_whisper_events" ADD COLUMN "completed_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "user_whisper_events_user_id_whisper_id_key" ON "user_whisper_events"("user_id", "whisper_id");
