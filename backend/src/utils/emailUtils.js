// emailUtils.js - FIXED VERSION
import { sendItineraryEmail } from '../services/emailService.js'; 
import prisma from '../config/db.js';

export const sendTripItineraryEmail = async (tripId, userEmail) => {
  try {
    console.log(`[EmailUtils] Starting email generation for trip ${tripId} to ${userEmail}`);
    
    // Fetch all trip data
    const [trip, itineraryItems, budgetItems, weatherData, events] = await Promise.all([
      prisma.trip.findUnique({ 
        where: { id: tripId },
        include: { user: true } // Include user data
      }),
      prisma.itineraryItem.findMany({
        where: { trip_id: tripId },
        orderBy: [{ day_number: 'asc' }, { sort_order: 'asc' }]
      }),
      prisma.budgetItem.findMany({ where: { trip_id: tripId } }),
      prisma.weatherData.findMany({
        where: { trip_id: tripId },
        orderBy: { date: 'asc' }
      }),
      prisma.event.findMany({
        where: { trip_id: tripId },
        orderBy: { start_datetime: 'asc' }
      })
    ]);

    if (!trip) {
      throw new Error('Trip not found');
    }

    if (!userEmail) {
      userEmail = trip.user?.email;
      if (!userEmail) {
        throw new Error('No user email available');
      }
    }

    console.log(`[EmailUtils] Found ${itineraryItems.length} itinerary items, ${budgetItems.length} budget items`);

    // Format itinerary data
    const itineraryData = [];
    const baseDate = new Date(trip.start_date);
    const totalDays = Math.ceil((new Date(trip.end_date) - baseDate) / (1000 * 60 * 60 * 24));
    
    for (let i = 0; i < totalDays; i++) {
      const currentDate = new Date(baseDate);
      currentDate.setDate(baseDate.getDate() + i);
      
      const dayItems = itineraryItems.filter(item => item.day_number === i + 1);
      const dayWeather = weatherData.find(w => 
        w.date.toISOString().split('T')[0] === currentDate.toISOString().split('T')[0]
      );

      itineraryData.push({
        day: i + 1,
        date: currentDate.toISOString().split('T')[0],
        places: dayItems.map(item => ({
          name: item.title,
          description: item.description,
          suggested_time_hrs: 2, // Default value
          category: item.category
        })),
        weather: dayWeather ? {
          condition: dayWeather.conditions,
          temp_high: dayWeather.temperature_high,
          temp_low: dayWeather.temperature_low
        } : null,
        budget: {
          daily_estimated: dayItems.reduce((sum, item) => sum + (item.estimated_cost || 0), 0)
        }
      });
    }

    // Format budget data
    const budgetData = {
      total: trip.total_budget,
      breakdown: budgetItems.reduce((acc, item) => {
        acc[item.category] = item.estimated_amount;
        return acc;
      }, {})
    };

    // Send email
    console.log(`[EmailUtils] Sending email to ${userEmail}`);
    const emailResult = await sendItineraryEmail(userEmail, trip, itineraryData, budgetData, weatherData);
    
    // Update trip to mark email as sent
    await prisma.trip.update({
      where: { id: tripId },
      data: {
        summary: {
          ...(trip.summary || {}),
          emailSent: true,
          emailSentAt: new Date().toISOString()
        }
      }
    });

    console.log(`[EmailUtils] Email sent successfully: ${emailResult.messageId}`);
    return { success: true, message: 'Itinerary email sent successfully', messageId: emailResult.messageId };
  } catch (error) {
    console.error('❌ Error sending itinerary email:', error);
    throw error;
  }
};