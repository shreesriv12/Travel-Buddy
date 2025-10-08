/*
  Warnings:

  - You are about to drop the column `updated_at` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `children` on the `Trip` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `condition` on the `WeatherData` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `WeatherData` table. All the data in the column will be lost.
  - You are about to drop the column `temperature` on the `WeatherData` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `WeatherData` table. All the data in the column will be lost.
  - Made the column `location` on table `Event` required. This step will fail if there are existing NULL values in that column.
  - Made the column `end_datetime` on table `Event` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `estimated_cost` to the `ItineraryItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `location_coords` to the `ItineraryItem` table without a default value. This is not possible if the table is not empty.
  - Made the column `description` on table `ItineraryItem` required. This step will fail if there are existing NULL values in that column.
  - Made the column `location` on table `ItineraryItem` required. This step will fail if there are existing NULL values in that column.
  - Made the column `start_time` on table `ItineraryItem` required. This step will fail if there are existing NULL values in that column.
  - Made the column `end_time` on table `ItineraryItem` required. This step will fail if there are existing NULL values in that column.
  - Made the column `category` on table `ItineraryItem` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `destination_coords` to the `Trip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Trip` table without a default value. This is not possible if the table is not empty.
  - Made the column `start_date` on table `Trip` required. This step will fail if there are existing NULL values in that column.
  - Made the column `end_date` on table `Trip` required. This step will fail if there are existing NULL values in that column.
  - Made the column `adults` on table `Trip` required. This step will fail if there are existing NULL values in that column.
  - Made the column `status` on table `Trip` required. This step will fail if there are existing NULL values in that column.
  - Made the column `total_budget` on table `Trip` required. This step will fail if there are existing NULL values in that column.
  - Made the column `summary` on table `Trip` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `name` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `password_hash` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `conditions` to the `WeatherData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `location` to the `WeatherData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `precipitation` to the `WeatherData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `temperature_high` to the `WeatherData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `temperature_low` to the `WeatherData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `weather_json` to the `WeatherData` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."BudgetItem" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "public"."Event" DROP COLUMN "updated_at",
ADD COLUMN     "raw_json" JSONB,
ALTER COLUMN "location" SET NOT NULL,
ALTER COLUMN "end_datetime" SET NOT NULL,
ALTER COLUMN "price" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."ItineraryItem" ADD COLUMN     "estimated_cost" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "location_coords" JSONB NOT NULL,
ALTER COLUMN "description" SET NOT NULL,
ALTER COLUMN "location" SET NOT NULL,
ALTER COLUMN "start_time" SET NOT NULL,
ALTER COLUMN "end_time" SET NOT NULL,
ALTER COLUMN "category" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."Trip" DROP COLUMN "children",
ADD COLUMN     "destination_coords" JSONB NOT NULL,
ADD COLUMN     "origin" TEXT NOT NULL DEFAULT 'Unknown',
ADD COLUMN     "origin_coords" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "title" TEXT NOT NULL,
ALTER COLUMN "start_date" SET NOT NULL,
ALTER COLUMN "end_date" SET NOT NULL,
ALTER COLUMN "adults" SET NOT NULL,
ALTER COLUMN "status" SET NOT NULL,
ALTER COLUMN "status" DROP DEFAULT,
ALTER COLUMN "total_budget" SET NOT NULL,
ALTER COLUMN "total_budget" DROP DEFAULT,
ALTER COLUMN "summary" SET NOT NULL,
ALTER COLUMN "summary" DROP DEFAULT,
ALTER COLUMN "orchestrator_summary" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "password",
ADD COLUMN     "avatar_url" TEXT,
ADD COLUMN     "google_token" TEXT,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "password_hash" TEXT NOT NULL,
ADD COLUMN     "theme_preference" TEXT;

-- AlterTable
ALTER TABLE "public"."WeatherData" DROP COLUMN "condition",
DROP COLUMN "created_at",
DROP COLUMN "temperature",
DROP COLUMN "updated_at",
ADD COLUMN     "conditions" TEXT NOT NULL,
ADD COLUMN     "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "location" TEXT NOT NULL,
ADD COLUMN     "precipitation" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "temperature_high" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "temperature_low" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "weather_json" JSONB NOT NULL;

-- CreateTable
CREATE TABLE "public"."Itinerary" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "result_summary" TEXT NOT NULL,
    "full_plan" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Itinerary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Route" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "from_location" TEXT NOT NULL,
    "to_location" TEXT NOT NULL,
    "transport_mode" TEXT NOT NULL,
    "distance_km" DOUBLE PRECISION NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "estimated_cost" DOUBLE PRECISION NOT NULL,
    "route_data" JSONB NOT NULL,
    "full_response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AgentTask" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "agent_type" TEXT NOT NULL,
    "task_data" JSONB NOT NULL,
    "result_data" JSONB,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "error_message" TEXT,

    CONSTRAINT "AgentTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "trip_id" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TripComparison" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "comparison_name" TEXT NOT NULL,
    "destinations" JSONB NOT NULL,
    "criteria" JSONB NOT NULL,
    "results" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripComparison_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Itinerary_trip_id_key" ON "public"."Itinerary"("trip_id");

-- AddForeignKey
ALTER TABLE "public"."Itinerary" ADD CONSTRAINT "Itinerary_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Route" ADD CONSTRAINT "Route_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AgentTask" ADD CONSTRAINT "AgentTask_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TripComparison" ADD CONSTRAINT "TripComparison_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
