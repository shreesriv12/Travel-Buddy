"use client";
import { useState, useEffect, useRef } from "react";

export default function TripAgentPage() {
  const [userId, setUserId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    if (result && mapRef.current && window.L && !mapInstanceRef.current) {
      initializeMap();
    }
  }, [result]);

  const initializeMap = () => {
    const mapsTool = result.toolResults?.find((t: any) => t.tool === "mapsTool");
    if (!mapsTool?.result) return;

    const routeData = mapsTool.result;
    const { steps } = routeData;
    if (!steps || steps.length === 0) return;

    const firstStep = steps[0].location;
    const lastStep = steps[steps.length - 1].location;
    const centerLat = (firstStep.lat + lastStep.lat) / 2;
    const centerLng = (firstStep.lon + lastStep.lon) / 2;

    const map = window.L.map(mapRef.current).setView([centerLat, centerLng], 7);
    mapInstanceRef.current = map;

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    const startIcon = window.L.divIcon({
      className: 'custom-icon',
      html: '<div style="background-color: #22c55e; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">A</div>',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    const endIcon = window.L.divIcon({
      className: 'custom-icon',
      html: '<div style="background-color: #ef4444; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">B</div>',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    window.L.marker([firstStep.lat, firstStep.lon], { icon: startIcon })
      .addTo(map)
      .bindPopup(`<b>Start: ${routeData.origin}</b>`);

    window.L.marker([lastStep.lat, lastStep.lon], { icon: endIcon })
      .addTo(map)
      .bindPopup(`<b>End: ${routeData.destination}</b>`);

    const routeCoordinates = steps.map((step: any) => [step.location.lat, step.location.lon]);
    
    window.L.polyline(routeCoordinates, {
      color: '#3b82f6',
      weight: 4,
      opacity: 0.7,
      smoothFactor: 1
    }).addTo(map);

    const bounds = window.L.latLngBounds(routeCoordinates);
    map.fitBounds(bounds, { padding: [50, 50] });
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    try {
      const res = await fetch("http://localhost:5000/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, prompt }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to run trip agent");
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const weatherTool = result?.toolResults?.find((t: any) => t.tool === "weatherTool");
  const budgetTool = result?.toolResults?.find((t: any) => t.tool === "budgetAgent");
  const eventsTool = result?.toolResults?.find((t: any) => t.tool === "eventTool");
  const itineraryTool = result?.toolResults?.find((t: any) => t.tool === "itineraryAgent");
  const mapsTool = result?.toolResults?.find((t: any) => t.tool === "mapsTool");

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Trip Planner Agent</h1>
          <p className="text-gray-600 mb-6">Plan your perfect trip with AI-powered recommendations</p>
          
          <div className="space-y-4">
            <input
              type="text"
              placeholder="User ID"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <textarea
              placeholder="Describe your trip (e.g., 'Plan a 5-day trip to Tokyo for 2 adults')"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold transition-colors"
            >
              {loading ? "Planning Your Trip..." : "Generate Trip Plan"}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 font-semibold">Error: {error}</p>
            </div>
          )}
        </div>

        {result && (
          <div className="space-y-6">
            <div className={`p-4 rounded-lg ${
              result.status === 'SUCCESS' ? 'bg-green-50 border border-green-200' :
              result.status === 'PARTIAL_SUCCESS' ? 'bg-yellow-50 border border-yellow-200' :
              'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`text-2xl ${
                  result.status === 'SUCCESS' ? 'text-green-600' :
                  result.status === 'PARTIAL_SUCCESS' ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {result.status === 'SUCCESS' ? '✓' : result.status === 'PARTIAL_SUCCESS' ? '⚠' : '✗'}
                </span>
                <div>
                  <p className={`font-bold ${
                    result.status === 'SUCCESS' ? 'text-green-700' :
                    result.status === 'PARTIAL_SUCCESS' ? 'text-yellow-700' :
                    'text-red-700'
                  }`}>
                    {result.status}
                  </p>
                  <p className="text-sm text-gray-700">{result.answer}</p>
                </div>
              </div>
            </div>

            {result.summary && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div className={`p-4 rounded-lg text-center ${result.summary.weatherChecked ? 'bg-blue-50 border-2 border-blue-200' : 'bg-gray-100'}`}>
                  <div className="text-2xl mb-1">{result.summary.weatherChecked ? '🌤️' : '⏳'}</div>
                  <p className="text-sm font-semibold">Weather</p>
                </div>
                <div className={`p-4 rounded-lg text-center ${result.summary.budgetCalculated ? 'bg-green-50 border-2 border-green-200' : 'bg-gray-100'}`}>
                  <div className="text-2xl mb-1">{result.summary.budgetCalculated ? '💰' : '⏳'}</div>
                  <p className="text-sm font-semibold">Budget</p>
                </div>
                <div className={`p-4 rounded-lg text-center ${result.summary.eventsFound ? 'bg-purple-50 border-2 border-purple-200' : 'bg-gray-100'}`}>
                  <div className="text-2xl mb-1">{result.summary.eventsFound ? '🎉' : '⏳'}</div>
                  <p className="text-sm font-semibold">Events</p>
                </div>
                <div className={`p-4 rounded-lg text-center ${result.summary.itineraryGenerated ? 'bg-yellow-50 border-2 border-yellow-200' : 'bg-gray-100'}`}>
                  <div className="text-2xl mb-1">{result.summary.itineraryGenerated ? '📋' : '⏳'}</div>
                  <p className="text-sm font-semibold">Itinerary</p>
                </div>
                <div className={`p-4 rounded-lg text-center ${result.summary.routesCalculated ? 'bg-indigo-50 border-2 border-indigo-200' : 'bg-gray-100'}`}>
                  <div className="text-2xl mb-1">{result.summary.routesCalculated ? '🗺️' : '⏳'}</div>
                  <p className="text-sm font-semibold">Routes</p>
                </div>
              </div>
            )}

            {weatherTool?.result?.daily && (
              <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Weather Forecast</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {weatherTool.result.daily.map((day: any) => (
                    <div key={day.date} className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                      <p className="font-bold text-gray-800">{new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                      <p className="text-2xl font-bold text-blue-600">{day.temp_high}°C</p>
                      <p className="text-sm text-gray-600">{day.temp_low}°C</p>
                      <p className="text-xs text-gray-700 mt-2 capitalize">{day.condition}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {budgetTool?.result?.budget && (
              <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Budget Breakdown</h3>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-gray-600">Total Budget</p>
                    <p className="text-2xl font-bold text-green-600">{budgetTool.result.budget.currency} {budgetTool.result.budget.total}</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600">Per Person</p>
                    <p className="text-2xl font-bold text-blue-600">{budgetTool.result.budget.currency} {budgetTool.result.budget.perPerson}</p>
                  </div>
                  <div className={`p-4 rounded-lg ${budgetTool.result.budget.status === 'Within Budget' ? 'bg-green-50' : 'bg-red-50'}`}>
                    <p className="text-sm text-gray-600">Status</p>
                    <p className={`text-lg font-bold ${budgetTool.result.budget.status === 'Within Budget' ? 'text-green-600' : 'text-red-600'}`}>
                      {budgetTool.result.budget.status}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {Object.entries(budgetTool.result.budget.breakdown).map(([key, value]: [string, any]) => (
                    <div key={key} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="capitalize text-gray-700">{key.replace(/([A-Z])/g, ' $1')}</span>
                      <span className="font-semibold text-gray-900">{budgetTool.result.budget.currency} {value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mapsTool?.result && (
              <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Route Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600">Distance</p>
                    <p className="text-2xl font-bold text-blue-600">{mapsTool.result.distance.toFixed(1)} km</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-gray-600">Duration</p>
                    <p className="text-2xl font-bold text-green-600">
                      {Math.floor(mapsTool.result.duration / 60)}h {mapsTool.result.duration % 60}m
                    </p>
                  </div>
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <p className="text-sm text-gray-600">Est. Cost</p>
                    <p className="text-2xl font-bold text-yellow-600">${mapsTool.result.estimated_cost}</p>
                  </div>
                </div>
                <div ref={mapRef} className="w-full h-96 rounded-lg border-2 border-gray-300"></div>
              </div>
            )}

            {eventsTool?.result?.events && eventsTool.result.events.length > 0 && (
              <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Local Events</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {eventsTool.result.events.slice(0, 6).map((event: any, idx: number) => (
                    <div key={idx} className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <p className="font-bold text-gray-800">{event.name}</p>
                      <p className="text-sm text-gray-600">{event.venue}</p>
                      <p className="text-xs text-gray-500 mt-1">{event.start_time}</p>
                      {event.url && (
                        <a href={event.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                          View Details
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {itineraryTool?.result?.plan && (
              <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Day-by-Day Itinerary</h3>
                <div className="space-y-4">
                  {itineraryTool.result.plan.map((day: any) => (
                    <div key={day.day} className="border border-gray-200 rounded-lg p-4 bg-gradient-to-r from-yellow-50 to-orange-50">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-lg font-bold text-gray-800">Day {day.day}</p>
                          <p className="text-sm text-gray-600">{new Date(day.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">{day.weather.condition}</p>
                          <p className="text-sm font-semibold text-gray-700">{day.weather.temp_high}°C / {day.weather.temp_low}°C</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {day.places.map((place: any, idx: number) => (
                          <div key={idx} className="pl-4 border-l-4 border-blue-400 bg-white p-3 rounded">
                            <p className="font-semibold text-gray-800">{place.name}</p>
                            <p className="text-sm text-gray-600">{place.category} • {place.suggested_time_hrs} hrs • {place.area}</p>
                            <p className="text-sm text-gray-500 mt-1">{place.description}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex justify-between items-center text-sm">
                        <span className="text-gray-600">Est. Activity Time: {day.est_hours} hrs</span>
                        <span className="text-gray-600">Daily Budget: ${day.budget.daily_estimated}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}