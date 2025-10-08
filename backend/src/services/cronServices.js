import cron from 'node-cron';
import prisma from '../config/db.js';
import { sendRecommendationEmail } from './emailService.js';
import { generateTravelRecommendations } from './recommendationService.js';

class CronService {
  constructor() {
    this.jobs = new Map();
  }

  // Initialize all cron jobs
  init() {
    console.log('🚀 Initializing Cron Jobs...');
    
    // Schedule job to run every 3 days at 9 AM
    this.scheduleRecommendationEmails();
    
    // Schedule health check job (optional)
    this.scheduleHealthCheck();
    
    console.log('✅ Cron Jobs Initialized');
  }

  // Schedule recommendation emails every 3 days
 // Schedule recommendation emails every minute for testing
scheduleRecommendationEmails() {
  // Run every minute - for testing
  const job = cron.schedule('*/2 * * * *', async () => {
    console.log('🕒 Running scheduled recommendation emails (TEST MODE - Every minute)...');
    await this.sendScheduledRecommendations();
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata" // Adjust to your timezone
  });

  this.jobs.set('recommendationEmails', job);
  console.log('📧 Recommendation emails scheduled: Every minute (TEST MODE)');
}

  // Health check job (optional)
  // Health check job (optional) - every minute for testing
scheduleHealthCheck() {
  const job = cron.schedule('*/2 * * * *', () => {
    console.log('❤️ Cron Service Health Check: Running normally (Every minute)');
  });

  this.jobs.set('healthCheck', job);
}

  // Main function to send scheduled recommendations
  async sendScheduledRecommendations() {
    try {
      console.log('📨 Starting scheduled recommendation emails...');
      
      // Get all active users with trips
      const usersWithTrips = await prisma.user.findMany({
        include: {
          trips: {
            where: {
              // status: 'COMPLETED',
              // Only include trips from last 30 days for relevance
              created_at: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
              }
            },
            orderBy: {
              created_at: 'desc'
            },
            take: 1 // Get most recent trip
          }
        }
      });

      console.log(`👥 Found ${usersWithTrips.length} users with trips`);

      let sentCount = 0;
      let errorCount = 0;

      // Process each user
      for (const user of usersWithTrips) {
        if (user.trips.length === 0) continue;

        const latestTrip = user.trips[0];
        
        try {
          // Generate recommendations using Gemini
          const recommendations = await generateTravelRecommendations(
            user.id,
            latestTrip.destination,
            user.email
          );

          if (recommendations) {
            sentCount++;
            console.log(`✅ Sent recommendations to ${user.email}`);
          }
        } catch (error) {
          errorCount++;
          console.error(`❌ Failed to send to ${user.email}:`, error.message);
        }

        // Small delay to avoid overwhelming APIs
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`📊 Recommendation emails completed: ${sentCount} sent, ${errorCount} failed`);

    } catch (error) {
      console.error('❌ Scheduled recommendations job failed:', error);
    }
  }

  // Manual trigger for testing
  async triggerRecommendationsNow() {
    console.log('🚀 Manually triggering recommendation emails...');
    await this.sendScheduledRecommendations();
  }

  // Stop all cron jobs
  stop() {
    for (const [name, job] of this.jobs) {
      job.stop();
      console.log(`⏹️ Stopped cron job: ${name}`);
    }
    this.jobs.clear();
  }
}

export default new CronService();