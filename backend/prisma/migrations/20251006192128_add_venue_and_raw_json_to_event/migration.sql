-- AlterTable
ALTER TABLE "public"."Event" ADD COLUMN     "raw_json" JSONB,
ADD COLUMN     "venue" TEXT,
ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "category" DROP NOT NULL,
ALTER COLUMN "price" DROP NOT NULL,
ALTER COLUMN "is_recommended" SET DEFAULT false,
ALTER COLUMN "relevance_score" DROP NOT NULL,
ALTER COLUMN "relevance_score" SET DEFAULT 0;
