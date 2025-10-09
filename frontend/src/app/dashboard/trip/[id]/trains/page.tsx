'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTheme } from '../../../../context/ThemeContext';
import { Sun, Moon, XCircle, CheckCircle, Link } from "lucide-react";
import {
  ArrowLeft,
  Train,
  Clock,
  MapPin,
  Loader2,
  ExternalLink,
  Info,
  IndianRupee
} from 'lucide-react';

interface TrainStop {
  station: string;
  time: string;
}

interface Train {
  id: string;
  trainName: string;
  trainNumber: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  price: number;
  currency: string;
  class: string;
  bookingLink?: string;
  stops: TrainStop[];
  serviceProvider: string;
  type?: string;
  fallback?: boolean;
  generatedBy?: string;
}

interface TrainsData {
  summary: string;
  origin: string;
  destination: string;
  departureDate: string;
  totalTrains: number;
  dataSource: string;
  trains: Train[];
  searchParams: {
    origin: string;
    destination: string;
    departureDate: string;
    adults: number;
    currency: string;
  };
  fallback?: boolean;
  error?: string;
}

export default function TrainsPage() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.id as string;

  const [trainsData, setTrainsData] = useState<TrainsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'price' | 'departure' | 'duration'>('price');
  const [selectedTrain, setSelectedTrain] = useState<Train | null>(null);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    fetchTrains();
  }, [tripId]);

  const fetchTrains = async () => {
    try {
      const token = localStorage.getItem('token');

      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`http://localhost:5000/api/trips/${tripId}/trains`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch trains from the server.');
      }

      const data = await response.json();

      if (data && data.error) {
        setError(data.error);
        setTrainsData(null);
      } else {
        setTrainsData(data);
      }

    } catch (err) {
      console.error('Error fetching trains:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred while loading trains.');
    } finally {
      setLoading(false);
    }
  };

  const sortTrains = (trains: Train[]) => {
    return [...trains].sort((a, b) => {
      if (sortBy === 'price') return a.price - b.price;
      if (sortBy === 'departure') return a.departureTime.localeCompare(b.departureTime);
      if (sortBy === 'duration') {
        const getDurationMinutes = (duration: string) => {
          const match = duration.match(/(\d+)\s*hours?\s*(\d+)?\s*minutes?/i);
          if (match) {
            const hours = parseInt(match[1]) || 0;
            const mins = parseInt(match[2]) || 0;
            return hours * 60 + mins;
          }
          return 0;
        };
        return getDurationMinutes(a.duration) - getDurationMinutes(b.duration);
      }
      return 0;
    });
  };

  const getTrainTypeColor = (type?: string) => {
    if (!type) return 'bg-gray-100 text-gray-700';
    const lowerType = type.toLowerCase();
    if (lowerType.includes('superfast')) return 'bg-purple-100 text-purple-700';
    if (lowerType.includes('express')) return 'bg-blue-100 text-blue-700';
    if (lowerType.includes('mail')) return 'bg-green-100 text-green-700';
    return 'bg-gray-100 text-gray-700';
  };

  const TrainCard = ({ train }: { train: Train }) => (
  <div className={`rounded-xl shadow-sm p-6 hover:shadow-md transition ${
    theme === 'dark'
      ? 'bg-gray-800/50 backdrop-blur-sm border border-gray-700'
      : 'bg-white'
  }`}>
    {/* Header */}
    <div className="flex items-start justify-between mb-4">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h3 className={`text-lg font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            {train.trainName}
          </h3>
          {train.type && (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTrainTypeColor(train.type)}`}>
              {train.type}
            </span>
          )}
        </div>
        <p className={`text-sm ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
        }`}>
          {train.trainNumber} • {train.serviceProvider}
        </p>
        {train.fallback && (
          <span className={`inline-block mt-1 px-2 py-1 text-xs rounded ${
            theme === 'dark'
              ? 'bg-yellow-900/30 text-yellow-400'
              : 'bg-yellow-100 text-yellow-700'
          }`}>
            Simulated Data
          </span>
        )}
      </div>
      <div className="text-right">
        <p className={`text-2xl font-bold ${
          theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
        }`}>
          {train.currency === 'INR' && '₹'}
          {train.currency === 'USD' && '$'}
          {train.price || 'N/A'}
        </p>
        <p className={`text-sm ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
        }`}>
          {train.class}
        </p>
      </div>
    </div>

    {/* Route */}
    <div className="flex items-center justify-between mb-4">
      <div className="flex-1">
        <p className={`text-2xl font-bold ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          {train.departureTime}
        </p>
        <p className={`text-sm ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        }`}>
          {trainsData?.origin}
        </p>
      </div>

      <div className="flex-1 flex flex-col items-center px-4">
        <div className="flex items-center w-full mb-1">
          <div className={`h-px flex-1 ${
            theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
          }`}></div>
          <Train className={`w-5 h-5 mx-2 ${
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
            {train.duration}
          </p>
          <p className={`text-xs ${
            theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
          }`}>
            {train.stops.length} stops
          </p>
        </div>
      </div>

      <div className="flex-1 text-right">
        <p className={`text-2xl font-bold ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          {train.arrivalTime}
        </p>
        <p className={`text-sm ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        }`}>
          {trainsData?.destination}
        </p>
      </div>
    </div>

    {/* Actions */}
    <div className="flex gap-3">
      {train.bookingLink ? (
        <a
          href={train.bookingLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
        >
          Book Now
          <ExternalLink className="w-4 h-4" />
        </a>
      ) : (
        <button
          disabled
          className={`flex-1 px-4 py-3 rounded-lg cursor-not-allowed font-medium ${
            theme === 'dark'
              ? 'bg-gray-700 text-gray-500'
              : 'bg-gray-100 text-gray-400'
          }`}
        >
          Booking Link Not Available
        </button>
      )}
      <button
        onClick={() => setSelectedTrain(selectedTrain?.id === train.id ? null : train)}
        className={`px-4 py-3 border rounded-lg transition font-medium ${
          theme === 'dark'
            ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}
      >
        {selectedTrain?.id === train.id ? 'Hide Details' : 'View Details'}
      </button>
    </div>

    {/* Expandable Details */}
    {selectedTrain?.id === train.id && (
      <div className={`mt-4 pt-4 border-t ${
        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
      }`}>
        <h4 className={`font-semibold mb-3 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          Station Stops
        </h4>
        <div className="space-y-2">
          {train.stops.map((stop, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  index === 0 ? 'bg-green-500' : 
                  index === train.stops.length - 1 ? 'bg-red-500' : 
                  theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
                }`}></div>
                <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                  {stop.station}
                </span>
              </div>
              <span className={`font-mono ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {stop.time}
              </span>
            </div>
          ))}
        </div>
        {train.generatedBy && (
          <p className={`mt-3 text-xs italic ${
            theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
          }`}>
            Generated by {train.generatedBy}
          </p>
        )}
      </div>
    )}
  </div>
);
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading trains...</p>
        </div>
      </div>
    );
  }

  if (error || !trainsData || trainsData.trains.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="text-center bg-white p-8 rounded-xl shadow-md">
          <Info className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <p className="text-red-600 mb-4">
            {error || trainsData?.error || 'No train data found. The agent may not have run or did not find any results.'}
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

  const sortedTrains = sortTrains(trainsData.trains);

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
      {/* Title & Summary */}
      <div className="mb-6">
        <h1 className={`text-3xl font-bold mb-2 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          Train Options
        </h1>
        <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
          {trainsData.summary}
        </p>
        {trainsData.fallback && (
          <div className={`mt-2 p-3 border rounded-lg ${
            theme === 'dark'
              ? 'bg-yellow-900/20 border-yellow-700/50'
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-yellow-400' : 'text-yellow-800'
            }`}>
              ⚠️ Using simulated train data. Real-time data may not be available.
            </p>
          </div>
        )}
      </div>

      {/* Search Parameters */}
      <div className={`rounded-xl shadow-sm p-4 mb-6 ${
        theme === 'dark'
          ? 'bg-gray-800/50 backdrop-blur-sm border border-gray-700'
          : 'bg-white'
      }`}>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <MapPin className={`w-4 h-4 ${
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            }`} />
            <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
              Route:
            </span>
            <span className={`font-medium ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {trainsData.origin} → {trainsData.destination}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className={`w-4 h-4 ${
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            }`} />
            <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
              Date:
            </span>
            <span className={`font-medium ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {trainsData.departureDate}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
              Travelers:
            </span>
            <span className={`font-medium ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {trainsData.searchParams.adults} adult{trainsData.searchParams.adults > 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
              Data Source:
            </span>
            <span className={`font-medium ${
              theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
            }`}>
              {trainsData.dataSource}
            </span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Train className={`w-5 h-5 ${
            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
          }`} />
          <span className={`font-medium ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            {trainsData.totalTrains} train{trainsData.totalTrains !== 1 ? 's' : ''} available
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-sm ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Sort by:
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className={`px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              theme === 'dark'
                ? 'bg-gray-800 border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="price">Price (Low to High)</option>
            <option value="departure">Departure Time</option>
            <option value="duration">Duration (Shortest)</option>
          </select>
        </div>
      </div>

      {/* Trains List */}
      <div className="space-y-4">
        {sortedTrains.length === 0 ? (
          <div className={`rounded-xl p-12 text-center ${
            theme === 'dark'
              ? 'bg-gray-800/50 backdrop-blur-sm border border-gray-700'
              : 'bg-white'
          }`}>
            <Train className={`w-16 h-16 mx-auto mb-4 ${
              theme === 'dark' ? 'text-gray-600' : 'text-gray-300'
            }`} />
            <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
              No trains found
            </p>
          </div>
        ) : (
          sortedTrains.map((train) => (
            <TrainCard key={train.id} train={train} />
          ))
        )}
      </div>
    </main>
  </div>
);}