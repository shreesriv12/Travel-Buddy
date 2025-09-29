import weatherAgent from './weatherAgent.js';
import mapsAgent from './mapsAgent.js';
import itineraryAgent from './itineraryAgent.js';
import budgetAgent from './budgetAgent.js';
import eventsAgent from './eventsAgent.js';

export async function runAgents(tripId) {
  const results = {};

  results.weather = await weatherAgent(tripId);
  results.routes = await mapsAgent(tripId);
  results.itinerary = await itineraryAgent(tripId, results.routes);
  results.budget = await budgetAgent(tripId, results.itinerary);
  results.events = await eventsAgent(tripId);

  return results;
}
