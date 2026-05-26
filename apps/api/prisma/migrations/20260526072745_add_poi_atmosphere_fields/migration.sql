-- AlterTable
ALTER TABLE "pois" ADD COLUMN     "ambient_profile" TEXT,
ADD COLUMN     "content_owner" TEXT,
ADD COLUMN     "emotional_tone" TEXT,
ADD COLUMN     "environmental_texture" TEXT,
ADD COLUMN     "intensity_level" INTEGER,
ADD COLUMN     "movement_context" TEXT,
ADD COLUMN     "review_status" TEXT NOT NULL DEFAULT 'draft',
ADD COLUMN     "source_attribution" TEXT,
ADD COLUMN     "time_of_day_affinity" TEXT;
