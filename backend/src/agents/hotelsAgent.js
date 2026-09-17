import { getJson } from "serpapi";
import { z } from "zod";
import prisma from "../config/db.js";

const numericPrice = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const match = String(value ?? "").replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
};

// --------------------
// Argument schema
// --------------------
const HotelsArgs = z.object({
  destination: z.string(),
  checkin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkout: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tripId: z.string(),
  adults: z.number().int().min(1).max(10).default(2),
  children: z.number().int().min(0).max(10).default(0),
  rooms: z.number().int().min(1).max(5).default(1),
  currency: z.string().default("USD"),
  sortBy: z.enum(['relevance', 'price_low', 'price_high', 'rating']).default('relevance')
});

// --------------------
// Main execute function
// --------------------
async function hotelsExecute(args) {
  const { destination, checkin, checkout, tripId, adults, children, rooms, currency, sortBy } = HotelsArgs.parse(args);

  try {
    console.log(`[HotelsAgent] Searching hotels in: ${destination} from ${checkin} to ${checkout}`);

    if (!process.env.SERPAPI_KEY) throw new Error("SERPAPI_KEY is not configured");
    const response = await getJson({
        engine: "google_hotels",
        q: `hotels in ${destination}`,
        check_in_date: checkin,
        check_out_date: checkout,
        adults: adults.toString(),
        children: children > 0 ? children.toString() : undefined,
        rooms: rooms.toString(),
        currency: currency,
        sort: sortBy === 'price_low' ? 'price_low' :
              sortBy === 'price_high' ? 'price_high' :
              sortBy === 'rating' ? 'review_score' : 'relevance',
        api_key: process.env.SERPAPI_KEY,
      });
    if (!response) throw new Error("No response from SerpApi");
    if (response.error) throw new Error(response.error);

    const nights = Math.max(1, Math.ceil((new Date(checkout) - new Date(checkin)) / 86400000));
    const hotels = (response.properties || []).map((hotel, index) => {
      const price = numericPrice(hotel.rate_per_night?.lowest ?? hotel.rate_per_night?.extracted_lowest ?? hotel.extracted_lowest_price ?? hotel.total_rate?.lowest);
      return {
      id: `hotel_${index + 1}`,
      name: hotel.name || 'Unknown Hotel',
      rating: hotel.rating || 0,
      reviewCount: hotel.reviews || 0,
      price,
      currency: hotel.rate_per_night?.currency || currency,
      priceDescription: hotel.rate_per_night?.description || 'Price not available',
      address: hotel.address || 'Address not available',
      thumbnail: hotel.thumbnail || null,
      image: hotel.thumbnail || null,
      amenities: hotel.amenities || [],
      description: hotel.description || 'No description available',
      checkinDate: checkin,
      checkoutDate: checkout,
      totalNights: nights,
      totalPrice: price * nights,
      bookingLink: hotel.link || null,
      position: index + 1,
      type: hotel.type || 'hotel'
    };
    });

    console.log(`[HotelsAgent] Found ${hotels.length} hotels`);

    const prices = hotels.map(h => h.price).filter(p => p > 0);
    const priceStats = {
      min: prices.length > 0 ? Math.min(...prices) : 0,
      max: prices.length > 0 ? Math.max(...prices) : 0,
      average: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0
    };

    const result = {
      summary: hotels.length ? `Found ${hotels.length} live hotel results in ${destination}. Prices shown only where supplied by SerpApi.` : `No live hotel results were returned for ${destination}.`,
      destination: destination,
      checkin: checkin,
      checkout: checkout,
      totalHotels: hotels.length,
      priceStatistics: priceStats,
      currency: currency,
      hotels: hotels,
      searchParams: { adults, children, rooms, sortBy }
    };

    // Store the data in the database
    if (tripId) {
        await prisma.trip.update({
            where: { id: tripId },
            data: { hotels_data: result },
        });
        console.log(`[HotelsAgent] Successfully saved hotel data to trip ${tripId}.`);
    }

    return result;

  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error("HotelsAgent Error:", reason);

    const errorResult = {
      summary: `Live hotel search is unavailable: ${reason}`,
      destination: destination,
      checkin: checkin,
      checkout: checkout,
      totalHotels: 0,
      priceStatistics: { min: 0, max: 0, average: 0 },
      currency: currency,
      hotels: [],
      searchParams: { adults, children, rooms, sortBy },
      error: reason
    };

    // Store the provider failure, never invented accommodation data.
    if (tripId) {
        await prisma.trip.update({
            where: { id: tripId },
            data: { hotels_data: errorResult },
        }).catch(e => console.error("Failed to update trip with hotel error:", e));
    }

    return errorResult;
  }
}

// --------------------
// Export agent
// --------------------
export const hotelsAgent = {
  name: "hotelsAgent",
  description: "Fetches hotel options and prices for destinations using SerpApi",
  jsonSchema: {
    type: "object",
    properties: {
      destination: {
        type: "string",
        description: "Destination city or location name"
      },
      checkin: {
        type: "string",
        description: "Check-in date in YYYY-MM-DD format"
      },
      checkout: {
        type: "string",
        description: "Check-out date in YYYY-MM-DD format"
      },
      tripId: {
        type: "string",
        description: "The ID of the trip to store the data for"
      },
      adults: {
        type: "integer",
        description: "Number of adults (default: 2)"
      },
      children: {
        type: "integer",
        description: "Number of children (default: 0)"
      },
      rooms: {
        type: "integer",
        description: "Number of rooms (default: 1)"
      },
      currency: {
        type: "string",
        description: "Currency code (default: USD)"
      },
      sortBy: {
        type: "string",
        enum: ['relevance', 'price_low', 'price_high', 'rating'],
        description: "Sort results by (default: relevance)"
      }
    },
    required: ["destination", "checkin", "checkout", "tripId"]
  },
  validate: (args) => HotelsArgs.parse(args),
  execute: hotelsExecute
};
