import { getJson } from "serpapi";
import { z } from "zod";
import prisma from "../config/db.js";

// --------------------
// Argument schema
// --------------------
const NewsArgs = z.object({
  destination: z.string(),
  tripId: z.string(),
  maxResults: z.number().int().min(1).max(50).default(10),
  timeRange: z.enum(['1d', '1w', '1m', '1y']).default('1m')
});

// --------------------
// Main execute function
// --------------------
async function newsExecute(args) {
  const { destination, tripId, maxResults, timeRange } = NewsArgs.parse(args);

  try {
    console.log(`[NewsAgent] Searching news for: ${destination}`);

    const response = await new Promise((resolve, reject) => {
      getJson({
        engine: "google_news",
        q: `${destination} travel tourism attractions`,
        tbs: `qdr:${timeRange}`,
        num: maxResults,
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

    // Process news results
    const newsArticles = response.news_results?.map((article, index) => ({
      id: `news_${index + 1}`,
      title: article.title || 'No title',
      snippet: article.snippet || 'No description available',
      source: article.source || 'Unknown source',
      date: article.date || 'Unknown date',
      link: article.link,
      thumbnail: article.thumbnail || null,
      position: index + 1
    })) || [];

    console.log(`[NewsAgent] Found ${newsArticles.length} news articles`);

    // If no news found, return fallback data
    if (newsArticles.length === 0) {
      newsArticles.push({
        id: 'fallback_1',
        title: `Travel Guide: ${destination}`,
        snippet: `Discover the best attractions and activities in ${destination}. Plan your perfect trip with local insights and travel tips.`,
        source: 'Travel News',
        date: new Date().toISOString().split('T')[0],
        link: null,
        thumbnail: null,
        position: 1
      });
    }

    const result = {
      summary: `Found ${newsArticles.length} news articles about ${destination} from the past ${timeRange}.`,
      destination: destination,
      totalArticles: newsArticles.length,
      timeRange: timeRange,
      articles: newsArticles,
      searchQuery: `${destination} travel tourism attractions`
    };

    // Store the data in the database
    if (tripId) {
      await prisma.trip.update({
        where: { id: tripId },
        data: { news_data: result },
      });
      console.log(`[NewsAgent] Successfully saved news data to trip ${tripId}.`);
    }

    return result;

  } catch (err) {
    console.error("NewsAgent Error:", err.message);

    // Return fallback news data
    const fallbackArticles = [
      {
        id: 'fallback_1',
        title: `Travel Information: ${destination}`,
        snippet: `Explore ${destination} with our comprehensive travel guide. Find the best places to visit, local cuisine, and cultural experiences.`,
        source: 'Travel Guide',
        date: new Date().toISOString().split('T')[0],
        link: null,
        thumbnail: null,
        position: 1
      }
    ];

    const errorResult = {
      summary: `Using fallback news data for ${destination}. Original error: ${err.message}`,
      destination: destination,
      totalArticles: fallbackArticles.length,
      timeRange: timeRange,
      articles: fallbackArticles,
      searchQuery: `${destination} travel`,
      error: err.message
    };

    // Store the fallback data in the database if an error occurs
    if (tripId) {
      await prisma.trip.update({
        where: { id: tripId },
        data: { news_data: errorResult },
      }).catch(e => console.error("Failed to update trip with news error:", e));
    }

    return errorResult;
  }
}

// --------------------
// Export agent
// --------------------
export const newsAgent = {
  name: "newsAgent",
  description: "Fetches recent news and articles about travel destinations using SerpApi",
  jsonSchema: {
    type: "object",
    properties: {
      destination: {
        type: "string",
        description: "Destination city or country name"
      },
      tripId: {
        type: "string",
        description: "The ID of the trip to store the data for"
      },
      maxResults: {
        type: "integer",
        description: "Maximum number of news articles to fetch (default: 10)"
      },
      timeRange: {
        type: "string",
        enum: ['1d', '1w', '1m', '1y'],
        description: "Time range for news articles (default: 1m)"
      }
    },
    required: ["destination", "tripId"]
  },
  validate: (args) => NewsArgs.parse(args),
  execute: newsExecute
};