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

    if (!process.env.SERPAPI_KEY) throw new Error("SERPAPI_KEY is not configured");
    const response = await getJson({
        engine: "google_news",
        q: `${destination} travel tourism attractions`,
        tbs: `qdr:${timeRange}`,
        num: maxResults,
        api_key: process.env.SERPAPI_KEY,
      });
    if (!response) throw new Error("No response from SerpApi");
    if (response.error) throw new Error(response.error);

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

    const result = {
      summary: newsArticles.length ? `Found ${newsArticles.length} live news articles about ${destination}.` : `No live news articles were returned for ${destination}.`,
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
    const reason = err instanceof Error ? err.message : String(err);
    console.error("NewsAgent Error:", reason);

    const errorResult = {
      summary: `Live news search is unavailable: ${reason}`,
      destination: destination,
      totalArticles: 0,
      timeRange: timeRange,
      articles: [],
      searchQuery: `${destination} travel`,
      error: reason
    };

    // Persist the provider failure, never placeholder articles.
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
