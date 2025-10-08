import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import prisma from "../config/db.js";
import { sendRecommendationEmail } from "./emailService.js";

// Initialize Gemini
const geminiModel = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "gemini-2.0-flash",
  temperature: 0.7,
});

// Generate personalized travel recommendations using Gemini
export async function generateTravelRecommendations(userId, destination, userEmail) {
  try {
    console.log(`🧠 Generating recommendations for ${userEmail} - ${destination}`);
    
    // Get user's travel history for context
    const userTrips = await prisma.trip.findMany({
      where: { 
        user_id: userId,
        // status: 'COMPLETED'
      },
      orderBy: { created_at: 'desc' },
      take: 5
    });

    // Get recent news about the destination
    const recentNews = await getDestinationNews(destination);
    
    // Get seasonal recommendations
    const seasonalInfo = getSeasonalInfo();

    const prompt = `You are a friendly travel expert. Generate personalized travel recommendations for someone who previously visited ${destination}.

USER CONTEXT:
- Previously visited: ${destination}
- Travel history: ${userTrips.map(t => t.destination).join(', ') || 'First-time traveler'}
- Current season: ${seasonalInfo.season}

RECENT UPDATES:
${recentNews ? `Recent news: ${recentNews}` : 'No recent updates available'}

GENERATE 3-4 SPECIFIC RECOMMENDATIONS IN THIS EXACT JSON FORMAT:
{
  "greeting": "Friendly greeting mentioning their previous trip",
  "recommendations": [
    {
      "title": "Recommendation title",
      "category": "cultural/nature/food/adventure/relaxation",
      "description": "2-3 sentence engaging description",
      "why_now": "Why this is a good time to visit",
      "pro_tip": "Helpful tip for this recommendation"
    }
  ],
  "seasonal_highlight": "One special seasonal activity or event",
  "closing": "Warm closing message"
}

Make it personal, engaging, and specific to their travel history and current timing.`;

    const response = await geminiModel.invoke([new HumanMessage(prompt)]);
    const recommendations = parseGeminiResponse(response.content);

    if (recommendations) {
      // Send email with recommendations
      await sendRecommendationEmail(userEmail, destination, recommendations);
      return recommendations;
    }

    return null;

  } catch (error) {
    console.error('❌ Error generating recommendations:', error);
    return null;
  }
}

// Parse Gemini response
function parseGeminiResponse(content) {
  try {
    // Try to extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to parse Gemini response:', error);
    
    // Fallback recommendations
    return {
      greeting: "Hope you're having a great time exploring the world!",
      recommendations: [
        {
          title: "Local Cultural Experience",
          category: "cultural",
          description: "Discover hidden local gems and authentic cultural experiences that most tourists miss.",
          why_now: "Perfect timing to avoid peak tourist seasons",
          pro_tip: "Visit during weekdays for a more local experience"
        }
      ],
      seasonal_highlight: "Check out seasonal festivals and local events happening soon",
      closing: "Happy travels and can't wait to hear about your next adventure!"
    };
  }
}

// Get recent news about destination (you can enhance this with your newsAgent)
async function getDestinationNews(destination) {
  try {
    // You can integrate with your existing newsAgent here
    // For now, return a simple string or fetch from a news API
    return `Great time to visit ${destination} with pleasant weather and local festivals coming up!`;
  } catch (error) {
    console.error('Error fetching destination news:', error);
    return null;
  }
}

// Get seasonal information
function getSeasonalInfo() {
  const now = new Date();
  const month = now.getMonth() + 1;
  
  const seasons = {
    winter: [12, 1, 2],
    spring: [3, 4, 5],
    summer: [6, 7, 8],
    autumn: [9, 10, 11]
  };

  let currentSeason = 'spring';
  for (const [season, months] of Object.entries(seasons)) {
    if (months.includes(month)) {
      currentSeason = season;
      break;
    }
  }

  return {
    season: currentSeason,
    month: month
  };
}

// Manual trigger for testing
export async function testRecommendations(userEmail = 'test@example.com') {
  const recommendations = await generateTravelRecommendations(
    'test-user-id',
    'Paris',
    userEmail
  );
  return recommendations;
}