'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  X,
  Cloud,
  DollarSign,
  PartyPopper,
  Calendar,
  MapPin,
  TrendingUp,
  TrendingDown,
  Loader2,
  Users,
  Thermometer,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface Trip {
  id: string;
  title: string;
  origin: string;
  destination: string;
  startDate: string;
  endDate: string;
  duration: number;
  adults: number;
  status: string;
}

interface TripComparison {
  tripId: string;
  tripDetails: Trip;
  weather: {
    avgTemp: number;
    condition: string;
    totalPrecipitation: number;
    daysCount: number;
  } | null;
  budget: {
    total: number;
    perPerson: number;
    perDay: number;
    itemsCount: number;
  };
  events: {
    total: number;
    recommended: number;
  };
}

export default function TripsComparisonPage() {
  const router = useRouter();
  const [availableTrips, setAvailableTrips] = useState<Trip[]>([]);
  const [selectedTripIds, setSelectedTripIds] = useState<string[]>([]);
  const [comparisons, setComparisons] = useState<TripComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTripSelector, setShowTripSelector] = useState(false);

  useEffect(() => {
    fetchAvailableTrips();
  }, []);

  const fetchAvailableTrips = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch('http://localhost:5000/api/trips', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch trips');
      }

      const data = await response.json();
      setAvailableTrips(data.trips || []);
    } catch (err) {
      console.error('Error fetching trips:', err);
      setError(err instanceof Error ? err.message : 'Failed to load trips');
    } finally {
      setLoading(false);
    }
  };

  const addTripToComparison = async (tripId: string) => {
    if (selectedTripIds.includes(tripId)) return;
    if (selectedTripIds.length >= 4) {
      alert('You can compare up to 4 trips at a time');
      return;
    }

    setComparing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/trips/${tripId}/summary`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch trip data');

      const data = await response.json();
      const comparison: TripComparison = {
        tripId,
        tripDetails: data.summary.tripDetails,
        weather: data.summary.weather,
        budget: data.summary.budget,
        events: data.summary.events
      };

      setComparisons(prev => [...prev, comparison]);
      setSelectedTripIds(prev => [...prev, tripId]);
      setShowTripSelector(false);
    } catch (err) {
      console.error('Error adding trip:', err);
      alert('Failed to add trip to comparison');
    } finally {
      setComparing(false);
    }
  };

  const removeTripFromComparison = (tripId: string) => {
    setComparisons(prev => prev.filter(c => c.tripId !== tripId));
    setSelectedTripIds(prev => prev.filter(id => id !== tripId));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getBestValue = (type: 'weather' | 'budget' | 'events') => {
    if (comparisons.length === 0) return null;

    switch (type) {
      case 'weather':
        return comparisons.reduce((best, current) => {
          if (!current.weather) return best;
          if (!best.weather) return current;
          const currentScore = (current.weather.avgTemp >= 60 && current.weather.avgTemp <= 80 ? 10 : 0) +
                             (current.weather.totalPrecipitation < 30 ? 10 : 0);
          const bestScore = (best.weather.avgTemp >= 60 && best.weather.avgTemp <= 80 ? 10 : 0) +
                          (best.weather.totalPrecipitation < 30 ? 10 : 0);
          return currentScore > bestScore ? current : best;
        });
      case 'budget':
        return comparisons.reduce((best, current) => 
          current.budget.perDay < best.budget.perDay ? current : best
        );
      case 'events':
        return comparisons.reduce((best, current) => 
          current.events.total > best.events.total ? current : best
        );
      default:
        return null;
    }
  };

  const ComparisonMetric = ({ 
    icon: Icon, 
    label, 
    values, 
    bestTripId 
  }: { 
    icon: any; 
    label: string; 
    values: (string | number | null)[]; 
    bestTripId?: string;
  }) => (
    <div className="border-b border-gray-200 last:border-b-0">
      <div className="grid grid-cols-5 gap-4 py-4">
        <div className="flex items-center gap-2 text-gray-700 font-medium">
          <Icon className="w-5 h-5 text-gray-500" />
          <span>{label}</span>
        </div>
        {values.map((value, idx) => {
          const tripId = comparisons[idx]?.tripId;
          const isBest = bestTripId === tripId;
          return (
            <div
              key={idx}
              className={`text-center p-3 rounded-lg ${
                isBest ? 'bg-green-50 border-2 border-green-500' : 'bg-gray-50'
              }`}
            >
              {value !== null && value !== undefined ? (
                <div className="flex items-center justify-center gap-2">
                  {isBest && <CheckCircle className="w-4 h-4 text-green-600" />}
                  <span className={`font-semibold ${isBest ? 'text-green-700' : 'text-gray-900'}`}>
                    {value}
                  </span>
                </div>
              ) : (
                <span className="text-gray-400">N/A</span>
              )}
            </div>
          );
        })}
        {Array.from({ length: 4 - values.length }).map((_, idx) => (
          <div key={`empty-${idx}`} className="text-center p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-300">-</span>
          </div>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading trips...</p>
        </div>
      </div>
    );
  }

  const bestWeatherTrip = getBestValue('weather');
  const bestBudgetTrip = getBestValue('budget');
  const bestEventsTrip = getBestValue('events');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Compare Trips</h1>
          <p className="text-gray-600">
            Select up to 4 trips to compare side-by-side based on weather, costs, and events
          </p>
        </div>

        {/* Add Trip Button */}
        {comparisons.length < 4 && (
          <div className="mb-6">
            <button
              onClick={() => setShowTripSelector(true)}
              disabled={comparing}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition font-medium"
            >
              {comparing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Adding Trip...
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Add Trip to Compare
                </>
              )}
            </button>
          </div>
        )}

        {/* Trip Selector Modal */}
        {showTripSelector && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Select a Trip</h2>
                <button
                  onClick={() => setShowTripSelector(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto">
                <div className="space-y-3">
                  {availableTrips
                    .filter(trip => !selectedTripIds.includes(trip.id))
                    .map(trip => (
                      <button
                        key={trip.id}
                        onClick={() => addTripToComparison(trip.id)}
                        className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
                      >
                        <h3 className="font-semibold text-gray-900 mb-2">{trip.title}</h3>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {trip.origin} → {trip.destination}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(trip.startDate)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {trip.adults} travelers
                          </span>
                        </div>
                      </button>
                    ))}
                  {availableTrips.filter(trip => !selectedTripIds.includes(trip.id)).length === 0 && (
                    <p className="text-center text-gray-500 py-8">
                      No more trips available to compare
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {comparisons.length === 0 && (
          <div className="bg-white rounded-xl p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No Trips Selected
            </h2>
            <p className="text-gray-600 mb-6">
              Add trips to start comparing their weather, costs, and events
            </p>
          </div>
        )}

        {/* Comparison View */}
        {comparisons.length > 0 && (
          <div className="space-y-8">
            {/* Trip Headers */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="grid grid-cols-5 gap-4 p-6 bg-gradient-to-r from-blue-600 to-blue-800 text-white">
                <div className="font-semibold">Metric</div>
                {comparisons.map(comparison => (
                  <div key={comparison.tripId} className="relative">
                    <button
                      onClick={() => removeTripFromComparison(comparison.tripId)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="pr-6">
                      <h3 className="font-bold mb-1 line-clamp-1">
                        {comparison.tripDetails.title}
                      </h3>
                      <p className="text-sm text-blue-100 line-clamp-1">
                        {comparison.tripDetails.destination}
                      </p>
                    </div>
                  </div>
                ))}
                {Array.from({ length: 4 - comparisons.length }).map((_, idx) => (
                  <div key={`empty-header-${idx}`} className="text-center opacity-50">
                    <span className="text-sm">Empty Slot</span>
                  </div>
                ))}
              </div>

              {/* Trip Details */}
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Trip Details</h3>
                <ComparisonMetric
                  icon={Calendar}
                  label="Duration"
                  values={comparisons.map(c => `${c.tripDetails.duration} days`)}
                />
                <ComparisonMetric
                  icon={Users}
                  label="Travelers"
                  values={comparisons.map(c => `${c.tripDetails.adults} adults`)}
                />
                <ComparisonMetric
                  icon={Calendar}
                  label="Start Date"
                  values={comparisons.map(c => formatDate(c.tripDetails.startDate))}
                />
              </div>
            </div>

            {/* Weather Comparison */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 bg-sky-50 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cloud className="w-6 h-6 text-sky-600" />
                    <h3 className="text-lg font-bold text-gray-900">Weather Forecast</h3>
                  </div>
                  {bestWeatherTrip && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                      Best: {bestWeatherTrip.tripDetails.destination}
                    </span>
                  )}
                </div>
              </div>
              <div className="p-6">
                <ComparisonMetric
                  icon={Thermometer}
                  label="Avg Temperature"
                  values={comparisons.map(c => c.weather ? `${c.weather.avgTemp}°F` : null)}
                  bestTripId={bestWeatherTrip?.tripId}
                />
                <ComparisonMetric
                  icon={Cloud}
                  label="Condition"
                  values={comparisons.map(c => c.weather?.condition || null)}
                />
                <ComparisonMetric
                  icon={Cloud}
                  label="Precipitation"
                  values={comparisons.map(c => c.weather ? `${c.weather.totalPrecipitation}%` : null)}
                />
              </div>
            </div>

            {/* Budget Comparison */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 bg-green-50 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-6 h-6 text-green-600" />
                    <h3 className="text-lg font-bold text-gray-900">Budget & Costs</h3>
                  </div>
                  {bestBudgetTrip && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                      Best Value: {bestBudgetTrip.tripDetails.destination}
                    </span>
                  )}
                </div>
              </div>
              <div className="p-6">
                <ComparisonMetric
                  icon={DollarSign}
                  label="Total Budget"
                  values={comparisons.map(c => `$${c.budget.total.toLocaleString()}`)}
                />
                <ComparisonMetric
                  icon={Users}
                  label="Per Person"
                  values={comparisons.map(c => `$${Math.round(c.budget.perPerson).toLocaleString()}`)}
                />
                <ComparisonMetric
                  icon={Calendar}
                  label="Per Day"
                  values={comparisons.map(c => `$${Math.round(c.budget.perDay).toLocaleString()}`)}
                  bestTripId={bestBudgetTrip?.tripId}
                />
              </div>
            </div>

            {/* Events Comparison */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 bg-purple-50 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PartyPopper className="w-6 h-6 text-purple-600" />
                    <h3 className="text-lg font-bold text-gray-900">Events & Activities</h3>
                  </div>
                  {bestEventsTrip && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                      Most Events: {bestEventsTrip.tripDetails.destination}
                    </span>
                  )}
                </div>
              </div>
              <div className="p-6">
                <ComparisonMetric
                  icon={PartyPopper}
                  label="Total Events"
                  values={comparisons.map(c => c.events.total)}
                  bestTripId={bestEventsTrip?.tripId}
                />
                <ComparisonMetric
                  icon={CheckCircle}
                  label="Recommended"
                  values={comparisons.map(c => c.events.recommended)}
                />
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-6 text-white">
              <h3 className="text-xl font-bold mb-4">Comparison Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
                  <div className="flex items-center gap-2 mb-2">
                    <Cloud className="w-5 h-5" />
                    <span className="font-medium">Best Weather</span>
                  </div>
                  <p className="text-lg font-bold">
                    {bestWeatherTrip?.tripDetails.destination || 'N/A'}
                  </p>
                </div>
                <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-5 h-5" />
                    <span className="font-medium">Best Value</span>
                  </div>
                  <p className="text-lg font-bold">
                    {bestBudgetTrip?.tripDetails.destination || 'N/A'}
                  </p>
                </div>
                <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
                  <div className="flex items-center gap-2 mb-2">
                    <PartyPopper className="w-5 h-5" />
                    <span className="font-medium">Most Events</span>
                  </div>
                  <p className="text-lg font-bold">
                    {bestEventsTrip?.tripDetails.destination || 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}