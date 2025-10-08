import express from 'express';
import cronService from '../services/cronServices.js';
import { testRecommendations } from '../services/recommendationService.js';

const router = express.Router();

// Manual trigger for testing
router.post('/trigger-recommendations', async (req, res) => {
  try {
    await cronService.triggerRecommendationsNow();
    res.json({ 
      success: true, 
      message: 'Recommendation emails triggered manually' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Test recommendation generation
router.post('/test-recommendation', async (req, res) => {
  try {
    const { email = 'test@example.com', destination = 'Paris' } = req.body;
    
    const recommendations = await testRecommendations(email);
    
    res.json({ 
      success: true, 
      recommendations,
      message: 'Test recommendation generated successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get cron job status
router.get('/status', (req, res) => {
  res.json({
    success: true,
    jobs: Array.from(cronService.jobs.keys()),
    status: 'Running'
  });
});

export default router;