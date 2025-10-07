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
  Loader2,
  Calendar,
  TrendingUp,
  Umbrella
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

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
  const [activeTab, setActiveTab] = useState('overview');

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

  const formatShortDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short'
    });
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}°F
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading weather data...</p>
        </div>
      </div>
    );
  }

  if (error || !weatherData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
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

  // Prepare chart data
  const chartData = weatherData.forecast.map((day, idx) => ({
    day: formatDate(day.date),
    dayShort: formatShortDate(day.date),
    high: day.temp_high,
    low: day.temp_low,
    precipitation: day.precipitation,
    avg: (day.temp_high + day.temp_low) / 2
  }));

  // Calculate stats
  const avgHigh = Math.round(weatherData.forecast.reduce((sum, d) => sum + d.temp_high, 0) / weatherData.forecast.length);
  const avgPrecipitation = Math.round(weatherData.forecast.reduce((sum, d) => sum + d.precipitation, 0) / weatherData.forecast.length);
  const rainyDays = weatherData.forecast.filter(d => d.precipitation > 50).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push(`/dashboard/trip/${tripId}/overview`)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back to Overview</span>
            </button>
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="w-5 h-5" />
              <span className="text-sm">{weatherData.totalDays} Day Forecast</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title Section with Stats */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Weather Forecast
          </h1>
          <p className="text-lg text-gray-600 mb-6">{weatherData.location}</p>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Thermometer className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Avg High</p>
                  <p className="text-xl font-bold text-gray-900">{avgHigh}°F</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Droplets className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Avg Precipitation</p>
                  <p className="text-xl font-bold text-gray-900">{avgPrecipitation}%</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Umbrella className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Rainy Days</p>
                  <p className="text-xl font-bold text-gray-900">{rainyDays}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-white rounded-xl p-1 shadow-sm overflow-x-auto">
          {['overview', 'daily'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Charts Section */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Temperature Trend */}
            <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Temperature Trend
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorHigh" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorLow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="dayShort" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area type="monotone" dataKey="high" stroke="#ef4444" fillOpacity={1} fill="url(#colorHigh)" name="High Temp" />
                  <Area type="monotone" dataKey="low" stroke="#3b82f6" fillOpacity={1} fill="url(#colorLow)" name="Low Temp" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Precipitation Chart */}
            <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Droplets className="w-5 h-5 text-blue-600" />
                Precipitation Chance
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="dayShort" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip />
                  <Bar dataKey="precipitation" fill="#3b82f6" radius={[8, 8, 0, 0]} name="Precipitation %" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Combined Temperature Line Chart */}
            <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Thermometer className="w-5 h-5 text-orange-600" />
                Temperature Comparison
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="dayShort" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line type="monotone" dataKey="high" stroke="#ef4444" strokeWidth={3} dot={{ r: 5 }} name="High" />
                  <Line type="monotone" dataKey="low" stroke="#3b82f6" strokeWidth={3} dot={{ r: 5 }} name="Low" />
                  <Line type="monotone" dataKey="avg" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4 }} name="Average" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Daily Weather Cards */}
        {activeTab === 'daily' && (
          <div className="space-y-4">
            {weatherData.forecast.map((day, index) => (
              <div
                key={index}
                className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
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

                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
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
        )}
      </main>
    </div>
  );
}