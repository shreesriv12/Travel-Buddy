-- AlterTable
ALTER TABLE "public"."Trip" ADD COLUMN     "flights_data" JSONB DEFAULT 'null',
ADD COLUMN     "hotels_data" JSONB DEFAULT 'null',
ADD COLUMN     "news_data" JSONB DEFAULT 'null';
