// src/controllers/calendar.controller.js
import { google } from 'googleapis';
import prisma from '../config/db.js';

/**
 * Sync itinerary to Google Calendar
 */
export const syncToGoogleCalendar = async (req, res) => {
  console.log('🎯 Google Calendar sync endpoint called');
  
  try {
    const { tripId, itinerary } = req.body;
    const userId = req.user.userId;

    console.log('📦 Request data:', {
      userId,
      tripId,
      hasItinerary: !!itinerary,
      itineraryLength: itinerary?.length
    });

    // Validate request
    if (!itinerary || !Array.isArray(itinerary) || itinerary.length === 0) {
      console.log('❌ Invalid itinerary data');
      return res.status(400).json({
        success: false,
        message: 'Invalid itinerary data provided'
      });
    }

    // Verify trip belongs to user
    if (tripId) {
      const trip = await prisma.trip.findFirst({
        where: { id: tripId, user_id: userId }
      });

      if (!trip) {
        console.log('❌ Trip not found or unauthorized');
        return res.status(404).json({
          success: false,
          message: 'Trip not found'
        });
      }
    }

    // Get Google OAuth tokens from request headers
    const accessToken = req.headers['x-google-access-token'];
    const refreshToken = req.headers['x-google-refresh-token'];

    console.log('🔑 OAuth tokens:', {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken
    });

    if (!accessToken) {
      console.log('❌ Missing Google access token');
      return res.status(401).json({
        success: false,
        message: 'Missing Google authentication. Please sign in with Google.'
      });
    }

    // Initialize Google OAuth2 client
    console.log('🔧 Initializing Google OAuth2 client...');
    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000'
    );

    // Set credentials
    oAuth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    console.log('📅 Initializing Google Calendar API...');
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

    // Insert events
    const insertedEvents = [];
    console.log(`🔄 Processing ${itinerary.length} events...`);

    for (let idx = 0; idx < itinerary.length; idx++) {
      const event = itinerary[idx];
      console.log(`\n  📍 Event ${idx + 1}/${itinerary.length}: ${event.summary}`);

      // Validate required fields
      if (!event.summary || !event.startTime || !event.endTime) {
        console.error(`  ❌ Missing required fields at index ${idx}`);
        return res.status(400).json({
          success: false,
          message: `Missing required fields at event index ${idx}`
        });
      }

      // Validate datetime formats
      const startMs = Date.parse(event.startTime);
      const endMs = Date.parse(event.endTime);

      if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
        console.error(`  ❌ Invalid datetime format at index ${idx}`);
        return res.status(400).json({
          success: false,
          message: `Invalid datetime format at event index ${idx}`
        });
      }

      if (endMs <= startMs) {
        console.error(`  ❌ End time before start time at index ${idx}`);
        return res.status(400).json({
          success: false,
          message: `End time must be after start time at event index ${idx}`
        });
      }

      // Determine timezone
      const hasOffset = /[+-]\d{2}:\d{2}|Z$/.test(event.startTime) ||
                        /[+-]\d{2}:\d{2}|Z$/.test(event.endTime);
      const timeZone = hasOffset ? undefined : (event.timeZone || 'UTC');

      console.log(`  ⏰ Times:`, {
        start: event.startTime,
        end: event.endTime,
        timeZone
      });

      try {
        console.log(`  📤 Inserting event into Google Calendar...`);
        const result = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: {
            summary: event.summary,
            description: event.description || '',
            start: {
              dateTime: event.startTime,
              timeZone
            },
            end: {
              dateTime: event.endTime,
              timeZone
            },
            colorId: '9', // Blue color for travel events
          },
        });

        console.log(`  ✅ Event inserted successfully:`, result.data.id);
        insertedEvents.push(result.data);
      } catch (insertError) {
        console.error(`  💥 Failed to insert event at index ${idx}:`, insertError.message);
        
        // Handle specific Google API errors
        if (insertError.code === 401) {
          return res.status(401).json({
            success: false,
            message: 'Google authentication expired. Please sign in again.'
          });
        }

        return res.status(500).json({
          success: false,
          message: `Failed to insert event "${event.summary}": ${insertError.message}`
        });
      }
    }

    console.log(`\n✅ All ${insertedEvents.length} events inserted successfully!`);

    // Optionally save sync record to database
    if (tripId) {
      try {
        await prisma.trip.update({
          where: { id: tripId },
          data: {
            last_calendar_sync: new Date()
          }
        });
        console.log('💾 Updated trip calendar sync timestamp');
      } catch (dbError) {
        console.error('⚠️ Failed to update sync timestamp:', dbError.message);
        // Don't fail the request if this fails
      }
    }

    return res.status(200).json({
      success: true,
      message: `Successfully added ${insertedEvents.length} events to your Google Calendar!`,
      count: insertedEvents.length,
      events: insertedEvents.map(e => ({
        id: e.id,
        summary: e.summary,
        start: e.start,
        htmlLink: e.htmlLink
      }))
    });

  } catch (error) {
    console.error('💥 Calendar sync error:', error);
    console.error('💥 Error stack:', error.stack);

    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to sync with Google Calendar'
    });
  }
};

/**
 * Get Google Calendar OAuth URL
 */
export const getGoogleAuthUrl = async (req, res) => {
  try {
    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'
    );

    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
      ],
      prompt: 'consent'
    });

    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
};

/**
 * Handle Google OAuth callback
 */
export const handleGoogleCallback = async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code not provided' });
    }

    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'
    );

    const { tokens } = await oAuth2Client.getToken(code);
    
    res.json({
      success: true,
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date
      }
    });
  } catch (error) {
    console.error('Error handling Google callback:', error);
    res.status(500).json({ error: 'Failed to exchange authorization code' });
  }
};