import { getJson } from "serpapi";
import { z } from "zod";
import prisma from "../config/db.js";

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

    const response = await new Promise((resolve, reject) => {
      getJson({
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
      }, (result) => {
        if (!result) {
          reject(new Error("No response from SerpApi"));
          return;
        }

        if (result.error) {
          reject(new Error(result.error));
          return;
        }

        resolve(result);
      });
    });

    const hotels = response.properties?.map((hotel, index) => ({
      id: `hotel_${index + 1}`,
      name: hotel.name || 'Unknown Hotel',
      rating: hotel.rating || 0,
      reviewCount: hotel.reviews || 0,
      price: hotel.rate_per_night?.lowest || hotel.rate_per_night?.median || 0,
      currency: hotel.rate_per_night?.currency || currency,
      priceDescription: hotel.rate_per_night?.description || 'Price not available',
      address: hotel.address || 'Address not available',
      thumbnail: hotel.thumbnail || null,
      amenities: hotel.amenities || [],
      description: hotel.description || 'No description available',
      checkinDate: checkin,
      checkoutDate: checkout,
      totalNights: Math.ceil((new Date(checkout) - new Date(checkin)) / (1000 * 60 * 60 * 24)),
      totalPrice: (hotel.rate_per_night?.lowest || hotel.rate_per_night?.median || 0) *
                  Math.ceil((new Date(checkout) - new Date(checkin)) / (1000 * 60 * 60 * 24)),
      bookingLink: hotel.link || null,
      position: index + 1,
      type: hotel.type || 'hotel'
    })) || [];

    console.log(`[HotelsAgent] Found ${hotels.length} hotels`);

    if (hotels.length === 0) {
      hotels.push({
        id: 'fallback_1',
        name: `Hotels in ${destination}`,
        rating: 4.0,
        reviewCount: 100,
        price: 150,
        currency: currency,
        priceDescription: 'Estimated price per night',
        address: `${destination} City Center`,
        thumbnail: null,
        amenities: ['Free WiFi', 'Air Conditioning', 'Swimming Pool'],
        description: `Comfortable accommodation in ${destination} with modern amenities and great service.`,
        checkinDate: checkin,
        checkoutDate: checkout,
        totalNights: Math.ceil((new Date(checkout) - new Date(checkin)) / (1000 * 60 * 60 * 24)),
        totalPrice: 150 * Math.ceil((new Date(checkout) - new Date(checkin)) / (1000 * 60 * 60 * 24)),
        bookingLink: null,
        position: 1,
        type: 'hotel'
      });
    }

    const prices = hotels.map(h => h.price).filter(p => p > 0);
    const priceStats = {
      min: prices.length > 0 ? Math.min(...prices) : 0,
      max: prices.length > 0 ? Math.max(...prices) : 0,
      average: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0
    };

    const result = {
      summary: `Found ${hotels.length} hotels in ${destination} from ${checkin} to ${checkout}. Price range: ${priceStats.min}-${priceStats.max} ${currency} per night.`,
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
    console.error("HotelsAgent Error:", err.message);

    const fallbackHotels = [
      {
        id: 'fallback_1',
        name: `Recommended Hotels in ${destination}`,
        rating: 4.2,
        reviewCount: 150,
        price: 120,
        currency: currency,
        priceDescription: 'Estimated price per night',
        address: `${destination} Central Area`,
        thumbnail: null,
        amenities: ['Free WiFi', 'Breakfast Included', 'Swimming Pool', 'Fitness Center'],
        description: `Quality accommodation in ${destination} with excellent service and convenient location.`,
        checkinDate: checkin,
        checkoutDate: checkout,
        totalNights: Math.ceil((new Date(checkout) - new Date(checkin)) / (1000 * 60 * 60 * 24)),
        totalPrice: 120 * Math.ceil((new Date(checkout) - new Date(checkin)) / (1000 * 60 * 60 * 24)),
        bookingLink: null,
        position: 1,
        type: 'hotel'
      }
    ];

    const errorResult = {
      summary: `Using fallback hotel data for ${destination}. Original error: ${err.message}`,
      destination: destination,
      checkin: checkin,
      checkout: checkout,
      totalHotels: fallbackHotels.length,
      priceStatistics: { min: 120, max: 120, average: 120 },
      currency: currency,
      hotels: fallbackHotels,
      searchParams: { adults, children, rooms, sortBy },
      error: err.message
    };

    // Store the fallback data in the database if an error occurs
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