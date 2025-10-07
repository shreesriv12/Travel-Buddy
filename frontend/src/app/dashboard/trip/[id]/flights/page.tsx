'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Plane,
  Clock,
  MapPin,
  Loader2,
  ExternalLink,
  Info
} from 'lucide-react';

interface Flight {
  airline: string;
  flightNumbers: string;
  departureTime: string;
  arrivalTime: string;
  duration: number;
  stops: number;
  price: number;
  currency: string;
  bookingLink?: string;
  flightSegments?: any[];
}

interface FlightsData {
  summary: string;
  bestFlights: Flight[];
  otherFlights: Flight[];
  searchParams: {
    origin: string;
    destination: string;
    departureDate: string;
    returnDate?: string;
    adults: number;
    children: number;
    currency: string;
  };
  error?: string; // Add an optional error field for graceful handling
}

export default function FlightsPage() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.id as string;

  const [flightsData, setFlightsData] = useState<FlightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'best' | 'other'>('best');
  const [sortBy, setSortBy] = useState<'price' | 'duration' | 'stops'>('price');

  useEffect(() => {
    fetchFlights();
  }, [tripId]);

  const fetchFlights = async () => {
    try {
      const token = localStorage.getItem('token');

      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`http://localhost:5000/api/trips/${tripId}/flights`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch flights from the server.');
      }

      const data = await response.json();

      // Check for a specific error from the backend (if data was not found)
      if (data && data.error) {
        setError(data.error);
        setFlightsData(null);
      } else {
        setFlightsData(data);
      }

    } catch (err) {
      console.error('Error fetching flights:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred while loading flights.');
    } finally {
      setLoading(false);
    }
  };

  const sortFlights = (flights: Flight[]) => {
    return [...flights].sort((a, b) => {
      if (sortBy === 'price') return a.price - b.price;
      if (sortBy === 'duration') return a.duration - b.duration;
      if (sortBy === 'stops') return a.stops - b.stops;
      return 0;
    });
  };

  const formatDuration = (minutes: number) => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };
  
  const FlightCard = ({ flight }: { flight: Flight }) => (
    <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{flight.airline}</h3>
          <p className="text-sm text-gray-500">{flight.flightNumbers}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-blue-600">
            {flight.currency} {flight.price || 'N/A'}
          </p>
          <p className="text-sm text-gray-500">per person</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <p className="text-2xl font-bold text-gray-900">{flight.departureTime}</p>
          <p className="text-sm text-gray-600">{flightsData?.searchParams.origin}</p>
        </div>

        <div className="flex-1 flex flex-col items-center px-4">
          <div className="flex items-center w-full mb-1">
            <div className="h-px bg-gray-300 flex-1"></div>
            <Plane className="w-5 h-5 text-gray-400 mx-2 transform rotate-90" />
            <div className="h-px bg-gray-300 flex-1"></div>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-900">{formatDuration(flight.duration)}</p>
            <p className="text-xs text-gray-500">
              {flight.stops === 0 ? 'Non-stop' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        <div className="flex-1 text-right">
          <p className="text-2xl font-bold text-gray-900">{flight.arrivalTime}</p>
          <p className="text-sm text-gray-600">{flightsData?.searchParams.destination}</p>
        </div>
      </div>

      <div className="flex gap-3">
        {flight.bookingLink && (
          <a
            href={flight.bookingLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            Book Now
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
        <button className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium">
          View Details
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading flights...</p>
        </div>
      </div>
    );
  }
  
  // Conditionally render based on whether data exists or an error occurred
  if (error || !flightsData || (flightsData.bestFlights.length === 0 && flightsData.otherFlights.length === 0)) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="text-center bg-white p-8 rounded-xl shadow-md">
          <Info className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error || 'No flight data found. The agent may not have run or did not find any results.'}</p>
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
  
  const displayFlights = activeTab === 'best' ? flightsData.bestFlights : flightsData.otherFlights;
  const sortedFlights = sortFlights(displayFlights);

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
        {/* Title & Search Info */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Flight Options</h1>
          <p className="text-gray-600">{flightsData.summary}</p>
        </div>

        {/* Search Parameters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">Route:</span>
              <span className="font-medium text-gray-900">
                {flightsData.searchParams.origin} → {flightsData.searchParams.destination}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">Departure:</span>
              <span className="font-medium text-gray-900">{flightsData.searchParams.departureDate}</span>
            </div>
            {flightsData.searchParams.returnDate && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Return:</span>
                <span className="font-medium text-gray-900">{flightsData.searchParams.returnDate}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Travelers:</span>
              <span className="font-medium text-gray-900">
                {flightsData.searchParams.adults} adult{flightsData.searchParams.adults > 1 ? 's' : ''}
                {flightsData.searchParams.children > 0 && `, ${flightsData.searchParams.children} child${flightsData.searchParams.children > 1 ? 'ren' : ''}`}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs & Filters */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('best')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'best'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Best Flights ({flightsData.bestFlights.length})
            </button>
            <button
              onClick={() => setActiveTab('other')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'other'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Other Options ({flightsData.otherFlights.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="price">Price (Low to High)</option>
              <option value="duration">Duration (Shortest)</option>
              <option value="stops">Stops (Fewest)</option>
            </select>
          </div>
        </div>

        {/* Flights List */}
        <div className="space-y-4">
          {sortedFlights.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center">
              <Plane className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No flights found in this category</p>
            </div>
          ) : (
            sortedFlights.map((flight, index) => (
              <FlightCard key={index} flight={flight} />
            ))
          )}
        </div>
      </main>
    </div>
  );
}