-- AlterTable
ALTER TABLE "public"."Trip" ADD COLUMN     "adults" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "origin" TEXT NOT NULL DEFAULT 'Unknown',
ADD COLUMN     "origin_coords" JSONB NOT NULL DEFAULT '{}';
