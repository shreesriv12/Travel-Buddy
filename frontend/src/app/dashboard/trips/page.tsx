'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Users, Clock, Trash2, Eye, Plus, Loader2 } from 'lucide-react';
import { useTheme } from '@/app/context/ThemeContext';
import { Sun, Moon, XCircle, Link } from "lucide-react";

// --- Interface Definitions for Type Safety ---

interface TripCount {
  itinerary_items: number;
  events: number;
  budget_items: number;
}

interface Trip {
  id: string; // Assuming unique string ID (e.g., UUID)
  title: string;
  destination: string;
  start_date: string; // ISO Date string
  end_date: string;   // ISO Date string
  adults: number;
  status: 'planning' | 'in_progress' | 'completed';
  _count: TripCount;
}

interface DeleteModalState {
  show: boolean;
  tripId: string | null;
  tripTitle: string;
}

// --- Component Start ---

const API_BASE_URL = 'http://localhost:5000/api';

const Trips: React.FC = () => {
  // Use explicit types for state
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({ show: false, tripId: null, tripTitle: '' });
    const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    try {
      setLoading(true);
      setError(null); // Clear previous errors
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('Please login to view your trips');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/trips`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch trips. Please check API status.');
      }

      const data = await response.json();
      // Ensure data.trips conforms to Trip[] shape
      setTrips(data.trips as Trip[] || []); 
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message);
      console.error('Error fetching trips:', err);
    } finally {
      setLoading(false);
    }
  };

  // Explicitly type tripId as string
  const handleDeleteTrip = async (tripId: string) => {
    setDeleteModal({ show: false, tripId: null, tripTitle: '' }); // Close modal immediately
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication token missing. Please log in.');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/trips/${tripId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete trip on the server.');
      }

      // Update state to remove the deleted trip
      setTrips(prevTrips => prevTrips.filter(trip => trip.id !== tripId));
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Deletion failed.';
      // Using setError instead of alert()
      setError('Error deleting trip: ' + message); 
      console.error('Error deleting trip:', err);
    }
  };

  // Explicitly type input and output
  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'Invalid Date';
    }
  };

  // Explicitly type inputs and output
  const calculateDuration = (startDate: string, endDate: string): string => {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      
      if (isNaN(days)) return 'N/A';
      if (days < 1) return '1 day'; // Handle same-day trips
      return days === 1 ? '1 day' : `${days} days`;
    } catch {
      return 'Invalid Dates';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="inline-block animate-spin h-12 w-12 text-indigo-600" />
          <p className="mt-4 text-gray-600">Loading your trips...</p>
        </div>
      </div>
    );
  }
 return (
    <div
      className={`min-h-screen transition-all duration-700 ${
        theme === "dark"
          ? "bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800 text-gray-100"
          : "bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 text-gray-800"
      } py-10 px-6`}
    >
      <div className="max-w-7xl mx-auto">
        {/* THEME TOGGLE */}
        <button
          onClick={toggleTheme}
          className="fixed top-6 left-6 z-50 p-3 rounded-full bg-white/80 dark:bg-gray-800/90 backdrop-blur-md border border-gray-200 dark:border-gray-700 shadow-xl hover:scale-110 transition-all duration-300"
        >
          {theme === "dark" ? (
            <Sun className="w-5 h-5 text-yellow-400" />
          ) : (
            <Moon className="w-5 h-5 text-gray-700" />
          )}
        </button>

        {/* HEADER */}
        <div className="mb-10 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight mb-2">
              My Trips
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              {trips.length === 0
                ? "No trips yet"
                : `${trips.length} ${
                    trips.length === 1 ? "trip" : "trips"
                  } planned`}
            </p>
          </div>

          <button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2 transition-all duration-300 shadow-lg hover:shadow-purple-400/30">
            <Plus size={18} />
            New Trip
          </button>
        </div>

        {/* ERROR */}
        {error && (
          <div className="bg-red-100/80 border-l-4 border-red-500 rounded-xl p-4 mb-10 shadow-md text-red-800">
            <p>Error: {error}</p>
          </div>
        )}

        {/* EMPTY STATE */}
        {!error && trips.length === 0 && (
          <div className="bg-white dark:bg-gray-900/60 rounded-2xl shadow-xl p-16 text-center border border-gray-200 dark:border-gray-700">
            <MapPin size={64} className="mx-auto text-indigo-400 mb-6" />
            <h3 className="text-2xl font-semibold mb-3">No trips yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Start planning your next adventure today!
            </p>
            <button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium px-6 py-3 rounded-xl inline-flex items-center gap-2 transition-all shadow-lg">
              <Plus size={18} />
              Plan Your First Trip
            </button>
          </div>
        )}

        {/* TRIPS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {trips.map((trip) => (
            <div
              key={trip.id}
              className={`rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 border ${
                theme === "dark"
                  ? "bg-gray-900/80 border-gray-700"
                  : "bg-white border-gray-200"
              }`}
            >
              {/* HEADER */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
                <h3 className="text-2xl font-bold mb-1 line-clamp-2">
                  {trip.title}
                </h3>
                <div className="flex items-center gap-2 text-indigo-100">
                  <MapPin size={16} />
                  <span>{trip.destination}</span>
                </div>
              </div>

              {/* BODY */}
              <div className="p-6 space-y-4">
                {/* DATES */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Calendar
                      size={20}
                      className="text-indigo-500 dark:text-indigo-400"
                    />
                    <div>
                      <p className="text-sm font-medium">
                        {formatDate(trip.start_date)} –{" "}
                        {formatDate(trip.end_date)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Travel Dates
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-indigo-50 dark:bg-white text-indigo-700 dark:text-indigo-900 px-3 py-1 rounded-full text-xs font-semibold">
                    <Clock size={14} />
                    {calculateDuration(trip.start_date, trip.end_date)}
                  </div>
                </div>

                {/* TRAVELERS */}
                <div className="flex items-center gap-3 border-t border-gray-200 dark:border-gray-700 pt-4">
                  <Users
                    size={20}
                    className="text-gray-400 dark:text-gray-500"
                  />
                  <span className="text-sm font-medium">
                    {trip.adults} {trip.adults === 1 ? "Traveler" : "Travelers"}
                  </span>
                </div>

                {/* STATS */}
                <div className="grid grid-cols-3 gap-2 py-4 border-t border-b border-gray-200 dark:border-gray-700">
                  {[
                    ["Activities", trip._count?.itinerary_items || 0],
                    ["Events", trip._count?.events || 0],
                    ["Budget", trip._count?.budget_items || 0],
                  ].map(([label, count], i) => (
                    <div key={i} className="text-center">
                      <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                        {count}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>

                {/* STATUS */}
                <div>
                  <span
                    className={`inline-block px-4 py-1 rounded-full text-sm font-semibold capitalize ${
                      trip.status === "completed"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : trip.status === "in_progress"
                        ? "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-300"
                        : "bg-yellow-100 text-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-900"
                    }`}
                  >
                    {trip.status.replace("_", " ")}
                  </span>
                </div>

                {/* ACTIONS */}
                
              </div>
            </div>
          ))}
        </div>
      </div>

      
    </div>
  );
};

export default Trips;