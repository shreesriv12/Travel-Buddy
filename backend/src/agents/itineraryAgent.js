import { z } from "zod";
import prisma from "../config/db.js";
import { generateGroqText } from "../config/groq.js";
import { sendTripItineraryEmail } from "../utils/emailUtils.js";
import PDFDocument from "pdfkit";

// --------------------
// Argument schema
// --------------------
const ItineraryArgs = z.object({
  tripId: z.string().uuid(),
  destination: z.string().min(1),
  days: z.number().min(1),
  startDate: z.string().optional(),
  adults: z.number().optional().default(1),
  children: z.number().optional().default(0),
  budgetResult: z.any().optional(),
  eventsResult: z.any().optional(),
});

// --------------------
// Extract JSON from LLM text
// --------------------
function extractJson(text) {
  if (!text || typeof text !== "string") throw new Error("Empty LLM output");

  try { return JSON.parse(text.trim()); } catch (e) {}

  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) try { return JSON.parse(codeBlockMatch[1].trim()); } catch(e) {}

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) try { return JSON.parse(jsonMatch[0]); } catch(e) {}

  throw new Error("Failed to extract JSON from LLM output");
}

// --------------------
// Fetch POIs
// --------------------
async function fetchBestPlaces({ destination, days, startDate, preferences = [] }) {
  const prompt = [
    "Return ONLY valid JSON array. Do not include markdown or code fences.",
    `Generate ${days} days worth of POIs for ${destination} starting ${startDate || "soon"}.`,
    preferences.length ? `Favor these travel preferences learned from the user's prior feedback: ${preferences.join(", ")}.` : "",
    "Each object MUST include: name, area, category, suggested_time_hrs, description",
    "Categories can be: landmark, museum, park, restaurant, shopping, entertainment, cultural, nature",
    "Example format:",
    `[{"name": "Eiffel Tower", "area": "Champ de Mars", "category": "landmark", "suggested_time_hrs": 2, "description": "Iconic iron tower"}]`
  ].join("\n");

  const text = await generateGroqText("You are a precise travel itinerary planner.", prompt, 0.2);

  const Poi = z.object({
    name: z.string(),
    area: z.string().optional().default(""),
    category: z.string().optional().default("landmark"),
    suggested_time_hrs: z.number().optional().default(2),
    description: z.string().optional().default(""),
  });

  return z.array(Poi).parse(extractJson(text));
}

// --------------------
// Allocate POIs to days
// --------------------
function allocatePoisToDays(pois, days) {
  const perDay = Array.from({ length: days }, () => ({ hrs: 0, items: [] }));
  const sorted = [...pois].sort((a, b) => (b.suggested_time_hrs || 2) - (a.suggested_time_hrs || 2));

  for (const p of sorted) {
    perDay.sort((a, b) => a.hrs - b.hrs);
    perDay[0].items.push(p);
    perDay[0].hrs += p.suggested_time_hrs || 2;
  }

  return perDay.map(d => d.items);
}

// --------------------
// Format date
// --------------------
function formatDate(date) {
  return date.toISOString().split("T")[0];
}

// --------------------
// Generate PDF Buffer (for streaming/attachment)
// --------------------
export function generatePdfBuffer(plan, trip) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Header
    doc.fontSize(24).fillColor("#2C3E50").text("Travel Roadmap", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(18).fillColor("#34495E").text(trip.destination, { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(12).fillColor("#7F8C8D").text(
      `${plan.length} Days • ${trip.adults || 1} Adults${trip.children ? ` • ${trip.children} Children` : ""}`,
      { align: "center" }
    );
    doc.moveDown(1);

    // Trip Overview
    doc.fontSize(14).fillColor("#2C3E50").text("Trip Overview", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#34495E");
    doc.text(`Dates: ${plan[0].date} to ${plan[plan.length - 1].date}`);
    doc.text(`Total Budget: $${plan[0].budget.total_estimated}`);
    doc.text(`Daily Budget: $${plan[0].budget.daily_estimated}`);
    doc.moveDown(1.5);

    // Daily Itinerary
    plan.forEach((day, idx) => {
      if (doc.y > 650) doc.addPage();

      // Day Header
      doc.fontSize(16).fillColor("#E74C3C").text(`Day ${day.day} - ${day.date}`, { underline: true });
      doc.moveDown(0.3);

      // Weather
      doc.fontSize(10).fillColor("#3498DB");
      doc.text(`Weather: ${day.weather.condition} | ${day.weather.temp_low}°C - ${day.weather.temp_high}°C`);
      doc.moveDown(0.3);

      // Daily Summary
      doc.fontSize(10).fillColor("#7F8C8D");
      doc.text(`Estimated Time: ${day.est_hours} hours | Budget: $${day.budget.daily_estimated}`);
      doc.moveDown(0.5);

      // Places
      day.places.forEach((place, pIdx) => {
        if (doc.y > 700) doc.addPage();

        doc.fontSize(12).fillColor("#2C3E50").text(`${pIdx + 1}. ${place.name}`);
        doc.fontSize(9).fillColor("#95A5A6");
        doc.text(`   ${place.area} • ${place.category} • ${place.suggested_time_hrs} hrs`, { indent: 20 });
        doc.fontSize(9).fillColor("#34495E");
        doc.text(`   ${place.description}`, { indent: 20 });
        doc.moveDown(0.5);
      });

      doc.moveDown(1);
      
      if (idx < plan.length - 1) {
        doc.strokeColor("#BDC3C7").lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(1);
      }
    });

    // Footer
    doc.fontSize(8).fillColor("#95A5A6").text(
      `Generated on ${new Date().toLocaleDateString()} | Powered by AI Trip Planner`,
      50,
      doc.page.height - 50,
      { align: "center" }
    );

    doc.end();
  });
}

// --------------------
// Send itinerary notification email
// --------------------
async function sendItineraryNotification(tripId, userEmail) {
  try {
    console.log(`[ItineraryAgent] Attempting to send email to: ${userEmail}`);
    
    if (userEmail && (process.env.SMTP_HOST || process.env.EMAIL_USER)) {
      await sendTripItineraryEmail(tripId, userEmail);
      console.log(`✅ Itinerary email sent to ${userEmail}`);
      return true;
    } else {
      console.log('⚠️ Email not configured or user email not available');
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to send itinerary email:', error.message);
    // Don't throw error - email failure shouldn't break itinerary generation
    return false;
  }
}

// --------------------
// Main Execute
// --------------------
export async function itineraryExecute(rawArgs) {
  console.log("Starting itinerary generation...");
  const args = ItineraryArgs.parse(rawArgs);

  // Fetch trip with user data for email
  const trip = await prisma.trip.findUnique({ 
    where: { id: args.tripId },
    include: { user: true }
  });
  
  if (!trip) throw new Error(`Trip ${args.tripId} not found`);

  // Feedback is a lightweight continuous-learning signal: future trip plans
  // favor categories the traveler explicitly enjoyed on earlier trips.
  const previousFeedback = await prisma.userFeedback.findMany({
    where: { user_id: trip.user_id, trip_id: { not: trip.id }, rating: { gte: 4 } },
    select: { liked_tags: true }, orderBy: { created_at: "desc" }, take: 20,
  });
  const learnedPreferences = [...new Set(previousFeedback.flatMap((entry) => Array.isArray(entry.liked_tags) ? entry.liked_tags : []))].slice(0, 10);

  const totalBudget = args.budgetResult?.budget?.total ?? trip.total_budget ?? 1000;
  const dailyBudget = Math.round(totalBudget / args.days);
  const userEmail = trip.user?.email;

  // Fetch weather data
  const weatherData = await prisma.weatherData.findMany({
    where: {
      trip_id: args.tripId,
      date: { gte: new Date(args.startDate || trip.start_date), lte: new Date(trip.end_date) },
    },
    orderBy: { date: "asc" },
  });

  // Recommended events become itinerary context, rather than remaining a
  // separate discovery result that the traveler must manually reconcile.
  const eventData = await prisma.event.findMany({
    where: { trip_id: args.tripId, is_recommended: true },
    orderBy: { start_datetime: "asc" },
  });

  // Fetch POIs
  let pois = [];
  try { 
    pois = await fetchBestPlaces({ 
      destination: trip.destination, 
      days: args.days, 
      startDate: args.startDate,
      preferences: learnedPreferences,
    }); 
  } catch(e) { 
    console.error("POI fetch failed:", e.message); 
    pois = []; 
  }

  // Allocate POIs to days
  const dailyBuckets = allocatePoisToDays(pois, args.days);

  const baseDate = args.startDate ? new Date(args.startDate) : new Date(trip.start_date);
  const plan = [];

  // Clear existing itinerary items
  await prisma.itineraryItem.deleteMany({ where: { trip_id: args.tripId } });

  for (let i = 0; i < args.days; i++) {
    const dayDate = new Date(baseDate);
    dayDate.setDate(baseDate.getDate() + i);
    const dateStr = formatDate(dayDate);

    const dayWeather = weatherData.find(w => formatDate(w.date) === dateStr) || {};
    const scheduledEvents = eventData
      .filter(event => formatDate(event.start_datetime) === dateStr)
      .map(event => ({
        name: event.title,
        area: event.location || trip.destination,
        category: "local event",
        suggested_time_hrs: 2,
        description: event.description || "Recommended local event",
      }));
    const dayPois = [...scheduledEvents, ...(dailyBuckets[i] || [])];

    const dayPlan = {
      day: i + 1,
      date: dateStr,
      weather: {
        temp_high: dayWeather.temperature_high || 25,
        temp_low: dayWeather.temperature_low || 18,
        condition: dayWeather.conditions || "Partly Cloudy",
      },
      places: dayPois.map(p => ({
        name: p.name,
        area: p.area,
        category: p.category,
        suggested_time_hrs: p.suggested_time_hrs,
        description: p.description,
      })),
      est_hours: dayPois.reduce((sum, p) => sum + (p.suggested_time_hrs || 2), 0),
      budget: { daily_estimated: dailyBudget, total_estimated: totalBudget },
    };

    plan.push(dayPlan);

    // Store in ItineraryItem table
    await prisma.itineraryItem.create({
      data: {
        trip_id: trip.id,
        day_number: i + 1,
        title: `Day ${i + 1} in ${trip.destination}`,
        description: `Activities: ${dayPois.map(p => p.name).join(", ")}`,
        start_time: new Date(`${dateStr}T09:00:00Z`),
        end_time: new Date(`${dateStr}T18:00:00Z`),
        location: trip.destination,
        location_coords: trip.destination_coords || {},
        category: "Day Plan",
        estimated_cost: dailyBudget,
        sort_order: i + 1,
      },
    });
  }

  // Keep a single canonical full plan per trip so a re-run refreshes it.
  await prisma.itinerary.upsert({
    where: { trip_id: trip.id },
    create: {
      trip_id: trip.id,
      tool: "itineraryAgent",
      result_summary: `Generated ${args.days}-day itinerary for ${trip.destination}`,
      full_plan: plan,
    },
    update: {
      tool: "itineraryAgent",
      result_summary: `Generated ${args.days}-day itinerary for ${trip.destination}`,
      full_plan: plan,
    },
  });

  // Send itinerary email (NON-BLOCKING - don't wait for it to complete)
  let emailSent = false;
  try {
    emailSent = await sendItineraryNotification(trip.id, userEmail);
  } catch (emailError) {
    console.error('Email sending failed but continuing:', emailError.message);
  }

  // Print the plan
  console.table(plan.map(d => ({
    day: d.day,
    date: d.date,
    est_hours: d.est_hours,
    daily_budget: d.budget.daily_estimated,
    places: d.places.map(p => p.name).join(", ")
  })));

  return { 
    summary: `Generated ${args.days}-day itinerary for ${trip.destination}`, 
    tripId: trip.id, 
    plan,
    emailSent: emailSent,
    itineraryId: trip.id
  };
}

// --------------------
// Export agent
// --------------------
export const itineraryAgent = {
  name: "itineraryAgent",
  description: "AI-powered itinerary generator with daily POIs, weather, budgets, PDF export, and automatic email sending.",
  jsonSchema: {
    type: "object",
    properties: {
      tripId: { type: "string" },
      destination: { type: "string" },
      days: { type: "number" },
      startDate: { type: "string" },
      adults: { type: "number" },
      children: { type: "number" },
      budgetResult: { type: "object" }
    },
    required: ["tripId", "destination", "days"]
  },
  validate: args => ItineraryArgs.parse(args),
  execute: itineraryExecute,
};
