// app/dashboard/trip/[id]/events/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTheme } from '../../../../context/ThemeContext';
import { Sun, Moon, XCircle, CheckCircle, Link } from "lucide-react";
import {
  ArrowLeft,
  PartyPopper,
  Calendar,
  MapPin,
  DollarSign,
  ExternalLink,
  Loader2,
  Star,
  Filter,
  Building2,
} from 'lucide-react';

interface Event {
  id: string;
  title: string;
  venue: string;
  description: string;
  location: string;
  start_datetime: string;
  end_datetime: string;
  category: string;
  price: number;
  booking_url: string | null;
  is_recommended: boolean;
  relevance_score: number;
}

interface EventsData {
  tripId: string;
  totalEvents: number;
  recommendedCount: number;
  events: Event[];
}

const CATEGORY_COLORS: { [key: string]: string } = {
  'cultural': 'bg-purple-100 text-purple-700',
  'music': 'bg-pink-100 text-pink-700',
  'sports': 'bg-green-100 text-green-700',
  'entertainment': 'bg-yellow-100 text-yellow-700',
  'food': 'bg-orange-100 text-orange-700',
  'festival': 'bg-red-100 text-red-700',
  'art': 'bg-indigo-100 text-indigo-700',
  'general': 'bg-gray-100 text-gray-700',
};

const CATEGORY_ICONS: { [key: string]: string } = {
  'cultural': '🎭',
  'music': '🎵',
  'sports': '⚽',
  'entertainment': '🎪',
  'food': '🍽️',
  'festival': '🎉',
  'art': '🎨',
  'general': '📅',
};

export default function EventsPage() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.id as string;

  const [eventsData, setEventsData] = useState<EventsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showRecommendedOnly, setShowRecommendedOnly] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    fetchEvents();
  }, [tripId]);

  const fetchEvents = async () => {
    try {
      const token = localStorage.getItem('token');

      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`http://localhost:5000/api/trips/${tripId}/events`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }

      const data = await response.json();
      setEventsData(data);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatTimeRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const startTime = startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const endTime = endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${startTime} - ${endTime}`;
  };

  const getCategoryColor = (category: string) => {
    return CATEGORY_COLORS[category.toLowerCase()] || CATEGORY_COLORS['general'];
  };

  const getCategoryIcon = (category: string) => {
    return CATEGORY_ICONS[category.toLowerCase()] || CATEGORY_ICONS['general'];
  };

  const categories = eventsData
    ? ['all', ...new Set(eventsData.events.map(e => e.category))]
    : ['all'];

  const filteredEvents = eventsData?.events.filter(event => {
    const matchesCategory = filterCategory === 'all' || event.category === filterCategory;
    const matchesRecommended = !showRecommendedOnly || event.is_recommended;
    return matchesCategory && matchesRecommended;
  }) || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading events...</p>
        </div>
      </div>
    );
  }

  if (error || !eventsData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <PartyPopper className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error || 'No events available'}</p>
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
      {/* Title Section */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <PartyPopper className={`w-8 h-8 ${
            theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
          }`} />
          <h1 className={`text-3xl font-bold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            Local Events & Activities
          </h1>
        </div>
        <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
          {eventsData.totalEvents} events found • {eventsData.recommendedCount} recommended
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className={`rounded-xl shadow-sm p-4 ${
          theme === 'dark'
            ? 'bg-gray-800/50 backdrop-blur-sm border border-gray-700'
            : 'bg-white'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm mb-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>Total Events</p>
              <p className={`text-2xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>{eventsData.totalEvents}</p>
            </div>
            <Calendar className={`w-8 h-8 ${
              theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
            }`} />
          </div>
        </div>

        <div className={`rounded-xl shadow-sm p-4 ${
          theme === 'dark'
            ? 'bg-gray-800/50 backdrop-blur-sm border border-gray-700'
            : 'bg-white'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm mb-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>Recommended</p>
              <p className="text-2xl font-bold text-yellow-500">
                {eventsData.recommendedCount}
              </p>
            </div>
            <Star className="w-8 h-8 text-yellow-500 fill-yellow-500" />
          </div>
        </div>

        <div className={`rounded-xl shadow-sm p-4 ${
          theme === 'dark'
            ? 'bg-gray-800/50 backdrop-blur-sm border border-gray-700'
            : 'bg-white'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm mb-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>Categories</p>
              <p className={`text-2xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>{categories.length - 1}</p>
            </div>
            <Filter className={`w-8 h-8 ${
              theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
            }`} />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={`rounded-xl shadow-sm p-4 mb-6 ${
        theme === 'dark'
          ? 'bg-gray-800/50 backdrop-blur-sm border border-gray-700'
          : 'bg-white'
      }`}>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Filter className={`w-5 h-5 ${
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            }`} />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? (
                    'All Categories'
                  ) : (
                    <>{getCategoryIcon(cat)} {cat.charAt(0).toUpperCase() + cat.slice(1)}</>
                  )}
                </option>
              ))}
            </select>
          </div>

          <label className={`flex items-center gap-2 cursor-pointer px-4 py-2 border rounded-lg transition ${
            theme === 'dark'
              ? 'bg-yellow-900/20 border-yellow-700/50 hover:bg-yellow-900/30'
              : 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'
          }`}>
            <input
              type="checkbox"
              checked={showRecommendedOnly}
              onChange={(e) => setShowRecommendedOnly(e.target.checked)}
              className="w-4 h-4 text-yellow-600 rounded focus:ring-yellow-500"
            />
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            <span className={`text-sm font-medium ${
              theme === 'dark' ? 'text-yellow-400' : 'text-yellow-800'
            }`}>Recommended Only</span>
          </label>
        </div>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredEvents.map((event) => (
          <div
            key={event.id}
            className={`rounded-xl shadow-sm hover:shadow-lg transition overflow-hidden ${
              theme === 'dark'
                ? 'bg-gray-800/50 backdrop-blur-sm border border-gray-700'
                : 'bg-white'
            }`}
          >
            {/* Event Header */}
            <div className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className={`text-xl font-semibold mb-2 line-clamp-2 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    {event.title}
                  </h3>
                  <div className={`flex items-center gap-2 text-sm mb-2 ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    <Building2 className="w-4 h-4" />
                    <span className="font-medium">{event.venue}</span>
                  </div>
                </div>

                {event.is_recommended && (
                  <div className={`flex items-center gap-1 px-3 py-1 rounded-full flex-shrink-0 ${
                    theme === 'dark'
                      ? 'bg-yellow-900/30 border border-yellow-700/50'
                      : 'bg-yellow-100'
                  }`}>
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    <span className={`text-xs font-medium ${
                      theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'
                    }`}>Top Pick</span>
                  </div>
                )}
              </div>

              {/* Description */}
              <p className={`text-sm mb-4 line-clamp-3 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-700'
              }`}>
                {event.description}
              </p>

              {/* Event Details */}
              <div className={`space-y-2 mb-4 pb-4 border-b ${
                theme === 'dark' ? 'border-gray-700' : 'border-gray-100'
              }`}>
                <div className={`flex items-start gap-2 text-sm ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  <Calendar className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className={`font-medium ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>{formatDate(event.start_datetime)}</p>
                    <p className={`text-xs ${
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    }`}>{formatTimeRange(event.start_datetime, event.end_datetime)}</p>
                  </div>
                </div>

                <div className={`flex items-center gap-2 text-sm ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  <MapPin className="w-4 h-4 flex-shrink-0" />
                  <span className="line-clamp-1">{event.location}</span>
                </div>

                {event.price > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="font-semibold text-green-500">${event.price}</span>
                  </div>
                )}

                {event.price === 0 && (
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      theme === 'dark'
                        ? 'bg-green-900/30 text-green-400'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      FREE EVENT
                    </span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(event.category)}`}>
                  {getCategoryIcon(event.category)} {event.category}
                </span>

                {event.booking_url ? (
                  <a
                    href={event.booking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                  >
                    Book Tickets
                    <ExternalLink className="w-4 h-4" />
                  </a>
                ) : (
                  <button
                    disabled
                    className={`px-4 py-2 rounded-lg cursor-not-allowed text-sm font-medium ${
                      theme === 'dark'
                        ? 'bg-gray-700 text-gray-500'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    View Details
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredEvents.length === 0 && (
        <div className={`rounded-xl p-12 text-center ${
          theme === 'dark'
            ? 'bg-gray-800/50 backdrop-blur-sm border border-gray-700'
            : 'bg-white'
        }`}>
          <PartyPopper className={`w-16 h-16 mx-auto mb-4 ${
            theme === 'dark' ? 'text-gray-600' : 'text-gray-300'
          }`} />
          <h3 className={`text-lg font-medium mb-2 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>No Events Found</h3>
          <p className={`mb-4 ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            {showRecommendedOnly
              ? 'No recommended events match your filters. Try showing all events.'
              : 'No events match your current filters. Try adjusting your selection.'}
          </p>
          {(showRecommendedOnly || filterCategory !== 'all') && (
            <button
              onClick={() => {
                setShowRecommendedOnly(false);
                setFilterCategory('all');
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}
    </main>
  </div>
);}