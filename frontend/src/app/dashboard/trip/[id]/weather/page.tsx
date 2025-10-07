// app/dashboard/trip/[id]/weather/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Cloud,
  CloudRain,
  Sun,
  CloudDrizzle,
  Wind,
  Droplets,
  Thermometer,
  Loader2
} from 'lucide-react';

interface WeatherDay {
  date: string;
  temp_high: number;
  temp_low: number;
  condition: string;
  precipitation: number;
  weather_json: any;
  fetched_at: string;
}

interface WeatherData {
  location: string;
  totalDays: number;
  forecast: WeatherDay[];
}

export default function WeatherPage() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.id as string;
  
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWeatherData();
  }, [tripId]);

  const fetchWeatherData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`http://localhost:5000/api/trips/${tripId}/weather`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch weather data');
      }

      const data = await response.json();
      setWeatherData(data);
    } catch (err) {
      console.error('Error fetching weather:', err);
      setError(err instanceof Error ? err.message : 'Failed to load weather');
    } finally {
      setLoading(false);
    }
  };

  const getWeatherIcon = (condition: string) => {
    const conditionLower = condition.toLowerCase();
    if (conditionLower.includes('rain') || conditionLower.includes('shower')) {
      return <CloudRain className="w-12 h-12 text-blue-500" />;
    }
    if (conditionLower.includes('cloud') || conditionLower.includes('overcast')) {
      return <Cloud className="w-12 h-12 text-gray-500" />;
    }
    if (conditionLower.includes('drizzle')) {
      return <CloudDrizzle className="w-12 h-12 text-blue-400" />;
    }
    return <Sun className="w-12 h-12 text-yellow-500" />;
  };

  const getPackingSuggestion = (tempHigh: number, tempLow: number, condition: string) => {
    const suggestions = [];
    
    if (tempHigh > 85) {
      suggestions.push('Light, breathable clothing');
      suggestions.push('Sunscreen and sunglasses');
    } else if (tempHigh > 70) {
      suggestions.push('Comfortable summer wear');
      suggestions.push('Light jacket for evenings');
    } else if (tempHigh > 50) {
      suggestions.push('Layers for changing temperatures');
      suggestions.push('Light jacket or sweater');
    } else {
      suggestions.push('Warm clothing');
      suggestions.push('Heavy jacket');
    }

    if (condition.toLowerCase().includes('rain')) {
      suggestions.push('Umbrella and rain jacket');
    }

    return suggestions;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading weather data...</p>
        </div>
      </div>
    );
  }

  if (error || !weatherData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Cloud className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error || 'No weather data available'}</p>
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => router.push(`/dashboard/trip/${tripId}/overview`)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Overview
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Weather Forecast</h1>
          <p className="text-gray-600">
            {weatherData.totalDays}-day forecast for {weatherData.location}
          </p>
        </div>

        {/* Weather Timeline */}
        <div className="space-y-4">
          {weatherData.forecast.map((day, index) => (
            <div
              key={index}
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {formatDate(day.date)}
                  </h3>
                  <p className="text-sm text-gray-500">Day {index + 1}</p>
                </div>
                {getWeatherIcon(day.condition)}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Thermometer className="w-5 h-5 text-red-500" />
                  <div>
                    <p className="text-sm text-gray-600">High</p>
                    <p className="text-lg font-semibold text-gray-900">{day.temp_high}°F</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Thermometer className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-sm text-gray-600">Low</p>
                    <p className="text-lg font-semibold text-gray-900">{day.temp_low}°F</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600">Condition</p>
                    <p className="text-sm font-medium text-gray-900">{day.condition}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Droplets className="w-5 h-5 text-blue-400" />
                  <div>
                    <p className="text-sm text-gray-600">Precipitation</p>
                    <p className="text-sm font-medium text-gray-900">{day.precipitation}%</p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  📦 Packing Suggestions:
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                  {getPackingSuggestion(day.temp_high, day.temp_low, day.condition).map((suggestion, idx) => (
                    <li key={idx}>• {suggestion}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}