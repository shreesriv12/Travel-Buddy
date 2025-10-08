'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Users, Clock, Trash2, Eye, Plus, Loader2 } from 'lucide-react';

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">My Trips</h1>
            <p className="text-gray-600">
              {trips.length === 0 ? 'No trips yet' : `${trips.length} ${trips.length === 1 ? 'trip' : 'trips'} planned`}
            </p>
          </div>
          {/* Note: This button needs a proper handler for navigation/modal */}
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-indigo-300/50 hover:shadow-indigo-400/60">
            <Plus size={20} />
            New Trip
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 mb-8 shadow-md">
            <p className="font-medium text-red-800">Error: {error}</p>
          </div>
        )}

        {/* Empty State */}
        {!error && trips.length === 0 && (
          <div className="bg-white rounded-xl shadow-xl p-12 text-center border border-gray-100">
            <MapPin size={64} className="mx-auto text-indigo-300 mb-6" />
            <h3 className="text-2xl font-semibold text-gray-800 mb-2">No trips yet</h3>
            <p className="text-gray-600 mb-6">Start planning your next adventure!</p>
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl inline-flex items-center gap-2 transition-colors shadow-lg shadow-indigo-300/50">
              <Plus size={20} />
              Plan Your First Trip
            </button>
          </div>
        )}

        {/* Trips Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {trips.map((trip) => (
            <div
              key={trip.id}
              className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100"
            >
              {/* Trip Header */}
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
                <h3 className="text-2xl font-extrabold mb-2 line-clamp-2">{trip.title}</h3>
                <div className="flex items-center gap-2 text-indigo-200">
                  <MapPin size={18} />
                  <span className="text-base">{trip.destination}</span>
                </div>
              </div>

              {/* Trip Details */}
              <div className="p-6 space-y-4">
                {/* Dates & Duration */}
                <div className="flex justify-between items-start pt-1">
                  <div className="flex items-center gap-3">
                    <Calendar size={20} className="text-indigo-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {formatDate(trip.start_date)} - {formatDate(trip.end_date)}
                      </p>
                      <p className="text-xs text-gray-500">Travel Dates</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold">
                    <Clock size={14} />
                    {calculateDuration(trip.start_date, trip.end_date)}
                  </div>
                </div>

                {/* Travelers */}
                <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
                  <Users size={20} className="text-gray-400" />
                  <span className="text-sm text-gray-700 font-medium">
                    {trip.adults} {trip.adults === 1 ? 'Traveler' : 'Travelers'}
                  </span>
                </div>

                {/* Trip Stats */}
                <div className="grid grid-cols-3 gap-2 py-4 border-t border-b border-gray-100">
                  <div className="text-center">
                    <p className="text-xl font-bold text-indigo-600">
                      {trip._count?.itinerary_items || 0}
                    </p>
                    <p className="text-xs text-gray-500">Activities</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-indigo-600">
                      {trip._count?.events || 0}
                    </p>
                    <p className="text-xs text-gray-500">Events</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-indigo-600">
                      {trip._count?.budget_items || 0}
                    </p>
                    <p className="text-xs text-gray-500">Budget Items</p>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="pt-2">
                  <span className={`inline-block px-4 py-1 rounded-full text-sm font-semibold ${
                    trip.status === 'completed' ? 'bg-green-100 text-green-700' :
                    trip.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {trip.status === 'planning' ? 'Planning' :
                     trip.status === 'in_progress' ? 'In Progress' : 'Completed'}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => window.location.href = `/trips/${trip.id}`}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-md hover:shadow-lg"
                  >
                    <Eye size={16} />
                    View Details
                  </button>
                  <button
                    onClick={() => setDeleteModal({ show: true, tripId: trip.id, tripTitle: trip.title })}
                    className="bg-white border border-red-300 hover:bg-red-50 text-red-600 p-3 rounded-xl transition-colors shadow-md"
                    title="Delete Trip"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 transition-opacity">
          <div className="bg-white rounded-xl max-w-sm w-full p-8 shadow-2xl transform scale-100 transition-transform">
            <div className="text-center mb-6">
              <Trash2 size={40} className="mx-auto text-red-500 mb-4" />
              <h3 className="text-2xl font-bold text-gray-800">Confirm Deletion</h3>
            </div>
            <p className="text-gray-600 text-center mb-8">
              Are you sure you want to delete the trip: <strong className="text-indigo-600">"{deleteModal.tripTitle}"</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setDeleteModal({ show: false, tripId: null, tripTitle: '' })}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 px-4 rounded-xl font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                // Use non-null assertion since tripId is guaranteed to be set when modal.show is true
                onClick={() => handleDeleteTrip(deleteModal.tripId!)} 
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-xl font-medium transition-colors shadow-md shadow-red-300/50"
              >
                Delete Trip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Trips;
