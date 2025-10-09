'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTheme } from '../../../../context/ThemeContext';
import {  Sun,Moon, XCircle, CheckCircle, Link } from "lucide-react";
import {
  ArrowLeft,
  MapPin,
  Clock,
  DollarSign,
  Navigation,
  Loader2,
  Info,
  ChevronDown,
  ChevronUp,
  Map
} from 'lucide-react';

// Interfaces matching your backend structure
interface Coordinates {
  lat: number;
  lng: number;
}

interface RouteStep {
  distance: {
    text: string;
    value: number;
  };
  duration: {
    text: string;
    value: number;
  };
  html_instructions: string;
  maneuver?: string;
  start_location: {
    lat: number;
    lng: number;
  };
  end_location: {
    lat: number;
    lng: number;
  };
  travel_mode: string;
}

interface Route {
  id: string;
  fromLocation: string;
  toLocation: string;
  transportMode: string;
  distanceKm: number;
  durationMinutes: number;
  estimatedCost: number;
  routeData: {
    steps: RouteStep[];
  };
  fullResponse: {
    routes: Array<{
      legs: Array<{
        steps: RouteStep[];
        distance: {
          text: string;
          value: number;
        };
        duration: {
          text: string;
          value: number;
        };
        start_address: string;
        end_address: string;
      }>;
    }>;
  };
  createdAt: string;
}

interface RoutesData {
  tripId: string;
  totalRoutes: number;
  routes: Route[];
  error?: string;
  message?: string;
}

export default function RoutesPage() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.id as string;

  const [routesData, setRoutesData] = useState<RoutesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set());
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [showMap, setShowMap] = useState(false);
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
    const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    fetchRoutes();
  }, [tripId]);

  useEffect(() => {
    if (showMap && selectedRoute && !mapInstanceRef.current) {
      initializeMap();
    }
  }, [showMap, selectedRoute]);

  const fetchRoutes = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`http://localhost:5000/api/trips/${tripId}/routes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch routes');
      }

      const data = await response.json();
      
      if (data && data.error) {
        setError(data.error);
        setRoutesData(null);
      } else {
        setRoutesData(data);
      }
    } catch (err) {
      console.error('Error fetching routes:', err);
      setError(err instanceof Error ? err.message : 'Failed to load routes');
    } finally {
      setLoading(false);
    }
  };

  const initializeMap = async () => {
    if (!selectedRoute || !mapRef.current) return;

  const L = (await import('leaflet')).default;
    await import('leaflet/dist/leaflet.css');
    
    const steps = selectedRoute.fullResponse?.routes?.[0]?.legs?.[0]?.steps || [];
    if (steps.length === 0) return;

    // Create map centered on the first step
    const map = L.map(mapRef.current).setView(
      [steps[0].start_location.lat, steps[0].start_location.lng],
      13
    );

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Custom icon for markers
    const createIcon = (color: string, number?: number) => {
      return L.divIcon({
        className: 'custom-marker',
        html: `<div style="background-color: ${color}; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">${number || ''}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
    };

    // Add markers for each step
    const bounds: [number, number][] = [];
    
    steps.forEach((step, index) => {
      const { lat, lng } = step.start_location;
      bounds.push([lat, lng]);

      // Create marker
      const marker = L.marker([lat, lng], {
        icon: createIcon('#3B82F6', index + 1)
      }).addTo(map);

      // Strip HTML tags for popup
      const plainText = step.html_instructions.replace(/<[^>]*>/g, '');
      
      // Create popup content
      const popupContent = `
        <div style="min-width: 200px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold;">Step ${index + 1}</h3>
          <p style="margin: 0 0 4px 0; font-size: 12px;">${plainText}</p>
          <div style="display: flex; gap: 8px; font-size: 11px; color: #666; margin-top: 8px;">
            <span>📏 ${step.distance.text}</span>
            <span>⏱️ ${step.duration.text}</span>
          </div>
          ${step.maneuver ? `<div style="margin-top: 4px; font-size: 11px; color: #3B82F6;">${step.maneuver.replace(/-/g, ' ')}</div>` : ''}
        </div>
      `;

      marker.bindPopup(popupContent);
    });

    // Add end location
    const lastStep = steps[steps.length - 1];
    bounds.push([lastStep.end_location.lat, lastStep.end_location.lng]);
    
    L.marker([lastStep.end_location.lat, lastStep.end_location.lng], {
      icon: createIcon('#10B981')
    }).addTo(map).bindPopup(`
      <div style="min-width: 150px;">
        <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold;">Destination</h3>
        <p style="margin: 0; font-size: 12px;">${selectedRoute.toLocation}</p>
      </div>
    `);

    // Draw polyline connecting all points
    const polyline = L.polyline(bounds, {
      color: '#3B82F6',
      weight: 4,
      opacity: 0.7
    }).addTo(map);

    // Fit map to show all markers
    map.fitBounds(polyline.getBounds(), { padding: [50, 50] });

    mapInstanceRef.current = map;
  };

  const toggleRouteExpansion = (routeId: string) => {
    setExpandedRoutes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(routeId)) {
        newSet.delete(routeId);
      } else {
        newSet.add(routeId);
      }
      return newSet;
    });
  };

  const handleShowMap = (route: Route) => {
    setSelectedRoute(route);
    setShowMap(true);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const RouteCard = ({ route }: { route: Route }) => {
  const isExpanded = expandedRoutes.has(route.id);
  const steps = route.fullResponse?.routes?.[0]?.legs?.[0]?.steps || [];
  
  return (
    <div className={`rounded-xl shadow-sm overflow-hidden ${
      theme === 'dark'
        ? 'bg-gray-800/50 backdrop-blur-sm border border-gray-700'
        : 'bg-white'
    }`}>
      <div className="p-6">
        <div 
          className={`cursor-pointer transition rounded-lg p-4 -m-4 mb-4 ${
            theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
          }`}
          onClick={() => toggleRouteExpansion(route.id)}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-5 h-5 text-green-500" />
                <h3 className={`text-lg font-semibold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  {route.fromLocation} → {route.toLocation}
                </h3>
              </div>
              <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full capitalize ${
                theme === 'dark'
                  ? 'bg-blue-900/30 text-blue-400'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {route.transportMode}
              </span>
            </div>
            {isExpanded ? (
              <ChevronUp className={`w-5 h-5 ${
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              }`} />
            ) : (
              <ChevronDown className={`w-5 h-5 ${
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              }`} />
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className={`flex items-center gap-2 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              <Navigation className="w-4 h-4" />
              <div>
                <p className={`text-xs ${
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                }`}>Distance</p>
                <p className={`font-semibold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>{route.distanceKm.toFixed(1)} km</p>
              </div>
            </div>
            <div className={`flex items-center gap-2 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              <Clock className="w-4 h-4" />
              <div>
                <p className={`text-xs ${
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                }`}>Duration</p>
                <p className={`font-semibold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>{formatDuration(route.durationMinutes)}</p>
              </div>
            </div>
            <div className={`flex items-center gap-2 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              <DollarSign className="w-4 h-4" />
              <div>
                <p className={`text-xs ${
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                }`}>Est. Cost</p>
                <p className={`font-semibold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>{formatCurrency(route.estimatedCost)}</p>
              </div>
            </div>
          </div>
        </div>

        {steps.length > 0 && (
          <button
            onClick={() => handleShowMap(route)}
            className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
          >
            <Map className="w-4 h-4" />
            View Route on Map
          </button>
        )}
      </div>

      {isExpanded && steps.length > 0 && (
        <div className={`border-t p-6 ${
          theme === 'dark'
            ? 'border-gray-700 bg-gray-800/30'
            : 'border-gray-200 bg-gray-50'
        }`}>
          <h4 className={`font-semibold mb-4 flex items-center gap-2 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            <Navigation className="w-4 h-4" />
            Turn-by-turn Directions ({steps.length} steps)
          </h4>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {steps.map((step, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
                    {index + 1}
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-0.5 h-full mt-2 ${
                      theme === 'dark' ? 'bg-blue-800' : 'bg-blue-200'
                    }`} />
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <p 
                    className={`mb-1 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-900'
                    }`}
                    dangerouslySetInnerHTML={{ __html: step.html_instructions }}
                  />
                  <div className={`flex gap-4 text-sm flex-wrap ${
                    theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                  }`}>
                    <span>{step.distance.text}</span>
                    <span>•</span>
                    <span>{step.duration.text}</span>
                    {step.maneuver && (
                      <>
                        <span>•</span>
                        <span className="capitalize">{step.maneuver.replace(/-/g, ' ')}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading routes...</p>
        </div>
      </div>
    );
  }

  if (error || !routesData || routesData.routes.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="text-center bg-white p-8 rounded-xl shadow-md">
          <Info className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <p className="text-red-600 mb-4">
            {error || routesData?.message || 'No routes found for this trip.'}
          </p>
          <button
            onClick={() => router.push(`/dashboard/trip/${tripId}/overview`)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Overview
          </button>
        </div>
      </div>
    );
  }

 return (
  <div className={`min-h-screen ${
    theme === 'dark' 
      ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
      : 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50'
  }`}>
    {/* Theme Toggle Button */}
    <button
      onClick={toggleTheme}
      className={`fixed top-6 left-6 z-50 p-3 rounded-full backdrop-blur-sm shadow-lg hover:scale-110 transition-all duration-300 ${
        theme === 'dark' 
          ? 'bg-gray-800/90 hover:bg-gray-700/90' 
          : 'bg-white/90 hover:bg-white'
      }`}
    >
      {theme === 'dark' ? (
        <Sun className="w-6 h-6 text-yellow-500" />
      ) : (
        <Moon className="w-6 h-6 text-gray-700" />
      )}
    </button>
    
    {/* Header */}
    <header className={`shadow-sm ${
      theme === 'dark' 
        ? 'bg-gray-800/50 backdrop-blur-sm border-b border-gray-700' 
        : 'bg-white'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <button
          onClick={() => router.push(`/dashboard/trip/${tripId}/overview`)}
          className={`flex items-center gap-2 transition ${
            theme === 'dark'
              ? 'text-gray-300 hover:text-white'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Overview
        </button>
      </div>
    </header>

    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className={`text-3xl font-bold mb-2 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          Route Details
        </h1>
        <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
          {routesData.totalRoutes} {routesData.totalRoutes === 1 ? 'route' : 'routes'} found for your trip
        </p>
      </div>

      <div className="space-y-4">
        {routesData.routes.map((route) => (
          <RouteCard key={route.id} route={route} />
        ))}
      </div>
    </main>

    {/* Map Modal */}
    {showMap && selectedRoute && (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className={`rounded-xl shadow-xl w-full max-w-6xl h-[80vh] flex flex-col ${
          theme === 'dark'
            ? 'bg-gray-800 border border-gray-700'
            : 'bg-white'
        }`}>
          <div className={`p-4 border-b flex items-center justify-between ${
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <div>
              <h2 className={`text-xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {selectedRoute.fromLocation} → {selectedRoute.toLocation}
              </h2>
              <p className={`text-sm mt-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {selectedRoute.distanceKm.toFixed(1)} km • {formatDuration(selectedRoute.durationMinutes)}
              </p>
            </div>
            <button
              onClick={() => {
                setShowMap(false);
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.remove();
                  mapInstanceRef.current = null;
                }
              }}
              className={`transition ${
                theme === 'dark'
                  ? 'text-gray-500 hover:text-gray-300'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div ref={mapRef} className="flex-1 w-full" />
        </div>
      </div>
    )}
  </div>
);}