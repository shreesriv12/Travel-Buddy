import { getJson } from "serpapi";
import { z } from "zod";
import prisma from "../config/db.js";

const Args = z.object({ tripId: z.string().uuid(), destination: z.string().min(1), maxPlaces: z.number().int().min(1).max(5).default(3) });

async function reviewsExecute(rawArgs) {
  const { tripId, destination, maxPlaces } = Args.parse(rawArgs);
  if (!process.env.SERPAPI_KEY) throw new Error("SERPAPI_KEY is not configured");
  try {
    // First find place data IDs, then request the structured reviews for each listing.
    const placesResponse = await getJson({ engine: "google_maps", type: "search", q: `top attractions in ${destination}`, api_key: process.env.SERPAPI_KEY });
    if (placesResponse.error) throw new Error(placesResponse.error);
    const places = (placesResponse.local_results || []).filter((place) => place.data_id || place.place_id).slice(0, maxPlaces);
    const placesWithReviews = await Promise.all(places.map(async (place) => {
      const reviewsResponse = await getJson({ engine: "google_maps_reviews", data_id: place.data_id, place_id: place.place_id, sort_by: "qualityScore", hl: "en", api_key: process.env.SERPAPI_KEY });
      if (reviewsResponse.error) throw new Error(reviewsResponse.error);
      return {
        name: place.title || reviewsResponse.place_info?.title || "Unnamed place",
        address: place.address || reviewsResponse.place_info?.address || null,
        rating: reviewsResponse.place_info?.rating ?? place.rating ?? null,
        totalReviews: reviewsResponse.place_info?.reviews ?? place.reviews ?? null,
        reviews: (reviewsResponse.reviews || []).slice(0, 5).map((review) => ({ rating: review.rating, date: review.date, text: review.snippet || review.extracted_snippet?.original || "", author: review.user?.name || null })),
      };
    }));
    const result = { summary: placesWithReviews.length ? `Found live visitor reviews for ${placesWithReviews.length} attractions in ${destination}.` : `No reviewed attractions were returned for ${destination}.`, destination, places: placesWithReviews, provider: "SerpApi Google Maps Reviews" };
    await prisma.trip.update({ where: { id: tripId }, data: { reviews_data: result } });
    return result;
  } catch (error) {
    const result = { summary: `Live reviews search is unavailable: ${error.message}`, destination, places: [], provider: "SerpApi Google Maps Reviews", error: error.message };
    await prisma.trip.update({ where: { id: tripId }, data: { reviews_data: result } }).catch(() => {});
    return result;
  }
}

export const reviewsAgent = { name: "reviewsAgent", description: "Finds current attraction ratings and visitor reviews through SerpApi Google Maps Reviews.", jsonSchema: { type: "object", properties: { tripId: { type: "string" }, destination: { type: "string" }, maxPlaces: { type: "integer" } }, required: ["tripId", "destination"] }, validate: (args) => Args.parse(args), execute: reviewsExecute };
