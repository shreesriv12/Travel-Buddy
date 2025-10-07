"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

// Note: You need to install these packages:
// npm install leaflet react-leaflet
// Add to your layout or page: import 'leaflet/dist/leaflet.css';

// Import Leaflet dynamically to avoid SSR issues
const MapComponent = ({ routes }) => {
  const mapRef = useRef(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !routes || routes.length === 0) return;

    // Import Leaflet only on client side
    import('leaflet').then((L) => {
      // Clear existing map
      if (mapRef.current) {
        mapRef.current.remove();
      }

      // Get the main route
      const mainRoute = routes[0];
      
      // Initialize map
      const map = L.map('map').setView([28.7041, 77.1025], 6);
      mapRef.current = map;

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map);

      // Create custom icons
      const startIcon = L.divIcon({
        className: 'custom-div-icon',
        html: "<div style='background-color:#22c55e;width:30px;height:30px;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;font-weight:bold;color:white;'>S</div>",
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const endIcon = L.divIcon({
        className: 'custom-div-icon',
        html: "<div style='background-color:#ef4444;width:30px;height:30px;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;font-weight:bold;color:white;'>E</div>",
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const waypointIcon = L.divIcon({
        className: 'custom-div-icon',
        html: "<div style='background-color:#3b82f6;width:20px;height:20px;border-radius:50%;border:2px solid white;'></div>",
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      // Add markers for each step
      if (mainRoute.route_data?.steps) {
        const steps = mainRoute.route_data.steps;
        
        steps.forEach((step, index) => {
          if (step.coordinates) {
            let icon = waypointIcon;
            let markerLabel = `${index + 1}`;
            
            if (index === 0) {
              icon = startIcon;
              markerLabel = 'Start';
            } else if (index === steps.length - 1) {
              icon = endIcon;
              markerLabel = 'End';
            }

            const marker = L.marker([step.coordinates.lat, step.coordinates.lng], { icon })
              .addTo(map)
              .bindPopup(`
                <div style="min-width:200px;">
                  <strong>Step ${index + 1}</strong><br/>
                  ${step.instruction}<br/>
                  <small>${step.distance} • ${step.duration}</small>
                </div>
              `);
          }
        });

        // Fit map to show all markers
        const bounds = steps
          .filter(s => s.coordinates)
          .map(s => [s.coordinates.lat, s.coordinates.lng]);
        
        if (bounds.length > 0) {
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      }
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, [isClient, routes]);

  if (!isClient) {
    return <div className="h-full bg-gray-200 animate-pulse rounded-lg"></div>;
  }

  return <div id="map" className="h-full w-full rounded-lg shadow-lg"></div>;
};

export default function RoutesPage() {
  const params = useParams();
  const { id } = params;
  const [routeData, setRouteData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStep, setSelectedStep] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");

    const fetchRoutes = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`http://localhost:5000/api/trips/${id}/routes`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error("Failed to fetch route data");
        }

        const data = await res.json();
        
        // Transform the orchestrator result to match our needs
        let routes = data.routes || [];
        
        // If we have orchestrator result, add it to routes
        if (data.orchestratorResult?.result) {
          const orchestratorRoute = {
            ...data.orchestratorResult.result,
            route_data: {
              steps: data.orchestratorResult.result.steps || []
            }
          };
          routes = [orchestratorRoute, ...routes];
        }

        setRouteData({
          tripId: data.tripId,
          routes: routes
        });
      } catch (err) {
        console.error("Error fetching routes:", err);
        setError(err.message || "Failed to load route data");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchRoutes();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading route data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-700">{error}</p>
          <Link
            href={`/dashboard/trip/${id}/overview`}
            className="mt-4 inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
          >
            Back to Overview
          </Link>
        </div>
      </div>
    );
  }

  if (!routeData || !routeData.routes || routeData.routes.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No route data available</p>
          <Link
            href={`/dashboard/trip/${id}/overview`}
            className="mt-4 inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
          >
            Back to Overview
          </Link>
        </div>
      </div>
    );
  }

  const mainRoute = routeData.routes[0];
  const steps = mainRoute.route_data?.steps || mainRoute.steps || [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <Link
          href={`/dashboard/trip/${id}/overview`}
          className="inline-flex items-center text-indigo-600 hover:text-indigo-800 mb-4"
        >
          ← Back to Overview
        </Link>

        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold mb-4">Route Details</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Origin</p>
              <p className="text-lg font-bold text-green-700">{mainRoute.origin}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Destination</p>
              <p className="text-lg font-bold text-red-700">{mainRoute.destination}</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Distance</p>
              <p className="text-lg font-bold text-blue-700">{mainRoute.distance} km</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Duration</p>
              <p className="text-lg font-bold text-purple-700">
                {Math.floor(mainRoute.duration / 60)}h {mainRoute.duration % 60}m
              </p>
            </div>
          </div>

          {mainRoute.estimated_cost && (
            <div className="mt-4 bg-yellow-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Estimated Cost</p>
              <p className="text-2xl font-bold text-yellow-700">₹{mainRoute.estimated_cost.toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* Map and Steps Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Map */}
          <div className="bg-white rounded-lg shadow-lg p-4" style={{ height: '600px' }}>
            <h2 className="text-xl font-bold mb-4">Route Map</h2>
            <div style={{ height: 'calc(100% - 40px)' }}>
              <MapComponent routes={routeData.routes} />
            </div>
          </div>

          {/* Step-by-Step Directions */}
          <div className="bg-white rounded-lg shadow-lg p-6" style={{ height: '600px', overflowY: 'auto' }}>
            <h2 className="text-xl font-bold mb-4">Turn-by-Turn Directions</h2>
            
            {steps.length === 0 ? (
              <p className="text-gray-500">No step-by-step directions available</p>
            ) : (
              <div className="space-y-3">
                {steps.map((step, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                      selectedStep === index
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-indigo-300'
                    }`}
                    onClick={() => setSelectedStep(selectedStep === index ? null : index)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0
                          ? 'bg-green-500 text-white'
                          : index === steps.length - 1
                          ? 'bg-red-500 text-white'
                          : 'bg-indigo-500 text-white'
                      }`}>
                        {index + 1}
                      </div>
                      
                      <div className="flex-1">
                        <p className="font-medium text-gray-800 mb-1">
                          {step.instruction}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            📏 {step.distance}
                          </span>
                          <span className="flex items-center gap-1">
                            ⏱️ {step.duration}
                          </span>
                        </div>
                        
                        {selectedStep === index && step.coordinates && (
                          <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                            <p>Coordinates: {step.coordinates.lat.toFixed(4)}, {step.coordinates.lng.toFixed(4)}</p>
                            <p>Mode: {step.type}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Additional Route Info */}
        {mainRoute.mode && (
          <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
            <h2 className="text-xl font-bold mb-4">Route Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Travel Mode</p>
                <p className="text-lg font-semibold capitalize">{mainRoute.mode}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Steps</p>
                <p className="text-lg font-semibold">{steps.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Route Status</p>
                <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  Active
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}