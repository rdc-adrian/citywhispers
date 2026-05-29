-- AlterTable
ALTER TABLE "pois" ADD COLUMN     "allow_cluster" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emotional_weight" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "min_separation_meters" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN     "poi_category" TEXT NOT NULL DEFAULT 'drift';
