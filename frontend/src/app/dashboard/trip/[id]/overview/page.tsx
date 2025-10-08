// app/dashboard/trip/[id]/overview/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Users,
  DollarSign,
  Cloud,
  Plane,
  Hotel,
  MapPin,
  List,
  Navigation,
  PartyPopper,
  Newspaper,
  Loader2,
  TrendingUp,
  Train
} from 'lucide-react';

interface TripSummary {
  tripDetails: {
    id: string;
    title: string;
    origin: string;
    destination: string;
    startDate: string;
    endDate: string;
    duration: number;
    adults: number;
    status: string;
  };
  budget: {
    total: number;
    itemsCount: number;
  };
  weather: {
    avgTemp: number;
    condition: string;
    daysCount: number;
  } | null;
  itinerary: {
    daysCount: number;
    hasFullPlan: boolean;
  };
  events: {
    total: number;
    recommended: number;
  };
  routes: {
    count: number;
  };
}

export default function TripOverviewPage() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.id as string;
  
  const [summary, setSummary] = useState<TripSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTripSummary();
  }, [tripId]);

  const fetchTripSummary = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`http://localhost:5000/api/trips/${tripId}/summary`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch trip summary');
      }

      const data = await response.json();
      setSummary(data.summary);
    } catch (err) {
      console.error('Error fetching trip summary:', err);
      setError(err instanceof Error ? err.message : 'Failed to load trip');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const navigationCards = [
    {
      title: 'Weather Forecast',
      icon: Cloud,
      path: `/dashboard/trip/${tripId}/weather`,
      stat: summary?.weather ? `${summary.weather.avgTemp}°F avg` : 'N/A',
      color: 'bg-blue-500'
    },
    {
      title: 'Flight Options',
      icon: Plane,
      path: `/dashboard/trip/${tripId}/flights`,
      stat: 'View Options',
      color: 'bg-indigo-500'
    },
    {
      title: 'Train Options',
      icon: Train,
      path: `/dashboard/trip/${tripId}/trains`,
      stat: 'Find Trains',
      color: 'bg-emerald-500'
    },
    {
      title: 'Hotels',
      icon: Hotel,
      path: `/dashboard/trip/${tripId}/hotels`,
      stat: 'Find Stays',
      color: 'bg-purple-500'
    },
    {
      title: 'News & Updates',
      icon: Newspaper,
      path: `/dashboard/trip/${tripId}/news`,
      stat: 'Latest Info',
      color: 'bg-orange-500'
    },
    {
      title: 'Budget Breakdown',
      icon: DollarSign,
      path: `/dashboard/trip/${tripId}/budget`,
      stat: summary ? `$${summary.budget.total.toLocaleString()}` : 'N/A',
      color: 'bg-green-500'
    },
    {
      title: 'Daily Itinerary',
      icon: List,
      path: `/dashboard/trip/${tripId}/itinerary`,
      stat: summary ? `${summary.itinerary.daysCount} days` : 'N/A',
      color: 'bg-pink-500'
    },
    {
      title: 'Routes & Maps',
      icon: Navigation,
      path: `/dashboard/trip/${tripId}/routes`,
      stat: summary ? `${summary.routes.count} routes` : 'N/A',
      color: 'bg-teal-500'
    },
    {
      title: 'Local Events',
      icon: PartyPopper,
      path: `/dashboard/trip/${tripId}/events`,
      stat: summary ? `${summary.events.total} events` : 'N/A',
      color: 'bg-yellow-500'
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading trip details...</p>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Trip not found'}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
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
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-8 text-white mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">{summary.tripDetails.title}</h1>
              <div className="flex items-center gap-2 text-blue-100 mb-4">
                <MapPin className="w-5 h-5" />
                <span className="text-lg">
                  {summary.tripDetails.origin} → {summary.tripDetails.destination}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {formatDate(summary.tripDetails.startDate)} - {formatDate(summary.tripDetails.endDate)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>{summary.tripDetails.adults} traveler(s)</span>
                </div>
              </div>
            </div>
            <span className="px-4 py-2 bg-white/20 rounded-full text-sm font-medium backdrop-blur">
              {summary.tripDetails.status}
            </span>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">Total Budget</span>
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">
              ${summary.budget.total.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {summary.budget.itemsCount} budget items
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">Duration</span>
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {summary.tripDetails.duration} days
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {summary.itinerary.daysCount} planned days
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">Weather</span>
              <Cloud className="w-5 h-5 text-sky-600" />
            </div>
            {summary.weather ? (
              <>
                <p className="text-3xl font-bold text-gray-900">
                  {summary.weather.avgTemp}°F
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {summary.weather.condition}
                </p>
              </>
            ) : (
              <p className="text-gray-400">No weather data</p>
            )}
          </div>
        </div>

        {/* Navigation Cards */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Explore Your Trip</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {navigationCards.map((card) => (
              <button
                key={card.path}
                onClick={() => router.push(card.path)}
                className="group relative bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-6 hover:shadow-lg hover:border-gray-300 transition text-left"
              >
                <div className={`inline-flex items-center justify-center w-12 h-12 ${card.color} rounded-lg mb-4 group-hover:scale-110 transition`}>
                  <card.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition">
                  {card.title}
                </h3>
                <p className="text-sm text-gray-600">{card.stat}</p>
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}