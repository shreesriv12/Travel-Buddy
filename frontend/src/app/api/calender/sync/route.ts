// app/api/calendar/sync/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { google } from "googleapis";

interface ItineraryEvent {
  summary: string;
  description?: string;
  startTime: string;
  endTime: string;
  timeZone?: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Not authenticated. Please sign in with Google." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { itinerary } = body;

    if (!itinerary || !Array.isArray(itinerary) || itinerary.length === 0) {
      return NextResponse.json(
        { success: false, message: "Invalid itinerary data provided" },
        { status: 400 }
      );
    }

    const accessToken = (session as any).accessToken as string | undefined;
    const refreshToken = (session as any).refreshToken as string | undefined;
    const accessTokenExpires = (session as any).accessTokenExpires as number | undefined;

    if (!accessToken && !refreshToken) {
      return NextResponse.json(
        { success: false, message: "Missing Google authentication tokens. Please sign in again." },
        { status: 401 }
      );
    }

    // Initialize Google OAuth2 client
    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    // Set credentials with auto-refresh capability
    oAuth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: accessTokenExpires,
    });

    const calendar = google.calendar({ version: "v3", auth: oAuth2Client });

    // Validate and insert each event
    const insertedEvents = [];
    for (let idx = 0; idx < itinerary.length; idx++) {
      const event = itinerary[idx] as ItineraryEvent;

      // Validate required fields
      if (!event.summary || !event.startTime || !event.endTime) {
        return NextResponse.json(
          { success: false, message: `Missing required fields at event index ${idx}` },
          { status: 400 }
        );
      }

      // Validate datetime formats
      const startMs = Date.parse(event.startTime);
      const endMs = Date.parse(event.endTime);
      
      if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
        return NextResponse.json(
          { success: false, message: `Invalid datetime format at event index ${idx}` },
          { status: 400 }
        );
      }

      if (endMs <= startMs) {
        return NextResponse.json(
          { success: false, message: `End time must be after start time at event index ${idx}` },
          { status: 400 }
        );
      }

      // Determine if we need to specify timeZone
      const hasOffset = /[+-]\d{2}:\d{2}|Z$/.test(event.startTime) || 
                        /[+-]\d{2}:\d{2}|Z$/.test(event.endTime);
      const timeZone = hasOffset ? undefined : (event.timeZone || "UTC");

      try {
        const result = await calendar.events.insert({
          calendarId: "primary",
          requestBody: {
            summary: event.summary,
            description: event.description || "",
            start: { 
              dateTime: event.startTime, 
              timeZone 
            },
            end: { 
              dateTime: event.endTime, 
              timeZone 
            },
            colorId: "9", // Blue color for travel events
          },
        });

        insertedEvents.push(result.data);
      } catch (insertError: any) {
        console.error(`Failed to insert event at index ${idx}:`, insertError);
        return NextResponse.json(
          { 
            success: false, 
            message: `Failed to insert event "${event.summary}": ${insertError.message || "Unknown error"}` 
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully added ${insertedEvents.length} events to your Google Calendar!`,
      count: insertedEvents.length
    });

  } catch (error: any) {
    console.error("Calendar sync error:", error);
    
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to sync with Google Calendar",
      },
      { status: 500 }
    );
  }
}