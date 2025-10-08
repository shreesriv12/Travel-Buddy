'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTheme } from '../../../../context/ThemeContext';
import { Sun, Moon, XCircle, CheckCircle, Link } from "lucide-react";
import {
  ArrowLeft,
  Plane,
  Clock,
  MapPin,
  Loader2,
  ExternalLink,
  Info
} from 'lucide-react';
import { a } from 'framer-motion/client';

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
   const { theme, toggleTheme } = useTheme();

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
  <div className={`rounded-xl shadow-sm p-6 hover:shadow-md transition ${
    theme === 'dark'
      ? 'bg-gray-800/50 backdrop-blur-sm border border-gray-700 hover:border-gray-600'
      : 'bg-white'
  }`}>
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className={`text-lg font-semibold ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          {flight.airline}
        </h3>
        <p className={`text-sm ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
        }`}>
          {flight.flightNumbers}
        </p>
      </div>
      <div className="text-right">
        <p className={`text-2xl font-bold ${
          theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
        }`}>
          {flight.currency} {flight.price || 'N/A'}
        </p>
        <p className={`text-sm ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
        }`}>
          per person
        </p>
      </div>
    </div>

    <div className="flex items-center justify-between mb-4">
      <div className="flex-1">
        <p className={`text-2xl font-bold ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          {flight.departureTime}
        </p>
        <p className={`text-sm ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        }`}>
          {flightsData?.searchParams.origin}
        </p>
      </div>

      <div className="flex-1 flex flex-col items-center px-4">
        <div className="flex items-center w-full mb-1">
          <div className={`h-px flex-1 ${
            theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
          }`}></div>
          <Plane className={`w-5 h-5 mx-2 transform rotate-90 ${
            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
          }`} />
          <div className={`h-px flex-1 ${
            theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
          }`}></div>
        </div>
        <div className="text-center">
          <p className={`text-sm font-medium ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            {formatDuration(flight.duration)}
          </p>
          <p className={`text-xs ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          }`}>
            {flight.stops === 0 ? 'Non-stop' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      <div className="flex-1 text-right">
        <p className={`text-2xl font-bold ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          {flight.arrivalTime}
        </p>
        <p className={`text-sm ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        }`}>
          {flightsData?.searchParams.destination}
        </p>
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
      <button className={`px-4 py-3 border rounded-lg transition font-medium ${
        theme === 'dark'
          ? 'border-gray-600 text-gray-300 hover:bg-gray-700/50'
          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
      }`}>
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
    <div className={`min-h-screen bg-gray-50  ${
      theme === 'dark' 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
        : 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50'
    }`}>
       {/* Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        className="fixed top-6 left-6 z-50 p-3 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-lg hover:scale-110 transition-all duration-300"
      >
        {theme === 'dark' ? (
          <Sun className="w-6 h-6 text-yellow-500" />
        ) : (
          <Moon className="w-6 h-6 text-gray-700" />
        )}
      </button>
      {/* Header */}
      <header className={`shadow-sm ${
        theme === 'dark' ? 'bg-gray-800/50 backdrop-blur-sm' : 'bg-white'
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
        {/* Title & Search Info */}
        <div className="mb-6">
          <h1 className={`text-3xl font-bold mb-2 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>Flight Options</h1>
          <p className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
            {flightsData.summary}
          </p>
        </div>

        {/* Search Parameters */}
        <div className={`rounded-xl shadow-sm p-4 mb-6 ${
          theme === 'dark' 
            ? 'bg-gray-800/50 backdrop-blur-sm border border-gray-700' 
            : 'bg-white'
        }`}>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <MapPin className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
              <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Route:</span>
              <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {flightsData.searchParams.origin} → {flightsData.searchParams.destination}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
              <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Departure:</span>
              <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {flightsData.searchParams.departureDate}
              </span>
            </div>
            {flightsData.searchParams.returnDate && (
              <div className="flex items-center gap-2">
                <Clock className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Return:</span>
                <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {flightsData.searchParams.returnDate}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Travelers:</span>
              <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
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
                  : theme === 'dark'
                  ? 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-gray-700'
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
                  : theme === 'dark'
                  ? 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-gray-700'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Other Options ({flightsData.otherFlights.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Sort by:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className={`px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                theme === 'dark'
                  ? 'bg-gray-800/50 border-gray-700 text-gray-300'
                  : 'border-gray-300'
              }`}
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
            <div className={`rounded-xl p-12 text-center ${
              theme === 'dark' 
                ? 'bg-gray-800/50 backdrop-blur-sm border border-gray-700' 
                : 'bg-white'
            }`}>
              <Plane className={`w-16 h-16 mx-auto mb-4 ${
                theme === 'dark' ? 'text-gray-600' : 'text-gray-300'
              }`} />
              <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                No flights found in this category
              </p>
            </div>
          ) : (
            sortedFlights.map((flight, index) => (
              <FlightCard key={index} flight={flight} />
            ))
          )}
        </div>
      </main>
    </div>
  );}