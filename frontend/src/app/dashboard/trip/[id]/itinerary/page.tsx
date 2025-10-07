// app/dashboard/trip/[id]/itinerary/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Sun,
  Cloud,
  Loader2,
  Download,
  FileText
} from 'lucide-react';

interface Place {
  name: string;
  area: string;
  category: string;
  suggested_time_hrs: number;
  description: string;
}

interface DayPlan {
  day: number;
  date: string;
  weather: {
    temp_high: number;
    temp_low: number;
    condition: string;
  };
  places: Place[];
  est_hours: number;
  budget: {
    daily_estimated: number;
    total_estimated: number;
  };
}

interface ItineraryData {
  summary: string;
  tripId: string;
  plan: DayPlan[];
}

const CATEGORY_ICONS: { [key: string]: string } = {
  landmark: '🏛️',
  museum: '🏛️',
  park: '🌳',
  restaurant: '🍽️',
  shopping: '🛍️',
  entertainment: '🎭',
  cultural: '🎨',
  nature: '🏞️',
  beach: '🏖️',
  activity: '⚡'
};

export default function ItineraryPage() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.id as string;
  
  const [itineraryData, setItineraryData] = useState<ItineraryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1]));
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetchItinerary();
  }, [tripId]);

  const fetchItinerary = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`http://localhost:5000/api/trips/${tripId}/itinerary`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch itinerary');
      }

      const data = await response.json();
      setItineraryData({
        summary: data.resultSummary,
        tripId: data.tripId,
        plan: data.fullPlan
      });
    } catch (err) {
      console.error('Error fetching itinerary:', err);
      setError(err instanceof Error ? err.message : 'Failed to load itinerary');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`http://localhost:5000/api/itinerary/download-pdf/${tripId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download PDF');
      }

      // Get the blob from response
      const blob = await response.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Itinerary_${tripId}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      // Show success message (optional)
      alert('PDF downloaded successfully!');
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const toggleDay = (day: number) => {
    setExpandedDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(day)) {
        newSet.delete(day);
      } else {
        newSet.add(day);
      }
      return newSet;
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getWeatherIcon = (condition: string) => {
    const conditionLower = condition.toLowerCase();
    if (conditionLower.includes('sun') || conditionLower.includes('clear')) {
      return <Sun className="w-5 h-5 text-yellow-500" />;
    }
    return <Cloud className="w-5 h-5 text-gray-500" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading itinerary...</p>
        </div>
      </div>
    );
  }

  if (error || !itineraryData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error || 'No itinerary available'}</p>
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
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push(`/dashboard/trip/${tripId}/overview`)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Overview
            </button>
            
            {/* Download PDF Button */}
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  <span>Download PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title with PDF Download */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Daily Itinerary</h1>
              <p className="text-gray-600">{itineraryData.summary}</p>
            </div>
            <div className="ml-4">
              <FileText className="w-12 h-12 text-blue-500" />
            </div>
          </div>
          
          {/* Quick Download Card */}
          <div className="mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Download Your Travel Roadmap</h3>
                <p className="text-sm text-gray-600">Get a beautifully formatted PDF with all your trip details</p>
              </div>
              <button
                onClick={handleDownloadPDF}
                disabled={downloading}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {downloading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span>Download PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical Line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>

          {/* Days */}
          <div className="space-y-6">
            {itineraryData.plan.map((day) => {
              const isExpanded = expandedDays.has(day.day);
              
              return (
                <div key={day.day} className="relative">
                  {/* Day Circle */}
                  <div className="absolute left-5 top-6 w-6 h-6 bg-blue-600 rounded-full border-4 border-white shadow-md flex items-center justify-center">
                    <span className="text-white text-xs font-bold">{day.day}</span>
                  </div>

                  {/* Day Card */}
                  <div className="ml-16 bg-white rounded-xl shadow-sm overflow-hidden">
                    {/* Day Header */}
                    <button
                      onClick={() => toggleDay(day.day)}
                      className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition"
                    >
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-gray-900">
                            Day {day.day}
                          </h3>
                          {getWeatherIcon(day.weather.condition)}
                          <span className="text-sm text-gray-600">
                            {day.weather.temp_high}°F / {day.weather.temp_low}°F
                          </span>
                        </div>
                        <p className="text-gray-600">{formatDate(day.date)}</p>
                        <div className="flex gap-4 mt-2 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {day.est_hours} hours
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            ${day.budget.daily_estimated}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {day.places.length} places
                          </span>
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-6 h-6 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-6 h-6 text-gray-400" />
                      )}
                    </button>

                    {/* Day Content */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 p-6 bg-gray-50">
                        <div className="space-y-4">
                          {day.places.map((place, idx) => (
                            <div
                              key={idx}
                              className="bg-white rounded-lg p-4 border border-gray-200"
                            >
                              <div className="flex items-start gap-3">
                                <span className="text-2xl">
                                  {CATEGORY_ICONS[place.category] || '📍'}
                                </span>
                                <div className="flex-1">
                                  <div className="flex items-start justify-between mb-2">
                                    <div>
                                      <h4 className="font-semibold text-gray-900 mb-1">
                                        {place.name}
                                      </h4>
                                      <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <MapPin className="w-3 h-3" />
                                        <span>{place.area}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 px-3 py-1 bg-blue-50 rounded-full">
                                      <Clock className="w-3 h-3 text-blue-600" />
                                      <span className="text-xs font-medium text-blue-600">
                                        {place.suggested_time_hrs}h
                                      </span>
                                    </div>
                                  </div>
                                  <p className="text-sm text-gray-600">{place.description}</p>
                                  <div className="mt-2">
                                    <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                      {place.category}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Day Summary */}
                        <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between text-sm">
                          <span className="text-gray-600">
                            Total time: <span className="font-semibold text-gray-900">{day.est_hours} hours</span>
                          </span>
                          <span className="text-gray-600">
                            Estimated budget: <span className="font-semibold text-blue-600">${day.budget.daily_estimated}</span>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Total Summary with Download Option */}
        <div className="mt-8 bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">Trip Summary</h3>
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition disabled:bg-gray-300 disabled:text-gray-500"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Generating...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span className="text-sm">Save as PDF</span>
                </>
              )}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-blue-200 text-sm mb-1">Total Days</p>
              <p className="text-3xl font-bold">{itineraryData.plan.length}</p>
            </div>
            <div>
              <p className="text-blue-200 text-sm mb-1">Total Places</p>
              <p className="text-3xl font-bold">
                {itineraryData.plan.reduce((sum, day) => sum + day.places.length, 0)}
              </p>
            </div>
            <div>
              <p className="text-blue-200 text-sm mb-1">Total Budget</p>
              <p className="text-3xl font-bold">
                ${itineraryData.plan[0]?.budget.total_estimated || 0}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}