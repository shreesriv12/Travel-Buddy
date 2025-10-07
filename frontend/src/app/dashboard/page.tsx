// app/dashboard/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Calendar, 
  MapPin, 
  PlusCircle, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  LogOut,
  Plane
} from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
}

interface Trip {
  id: string;
  title: string;
  destination: string;
  origin: string;
  start_date: string;
  end_date: string;
  status: string;
  adults: number;
  total_budget: number;
  _count?: {
    itinerary_items: number;
    events: number;
    budget_items: number;
  };
}

export default function Dashboard() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        router.push('/login');
        return;
      }

      // Fetch user info
      const userRes = await fetch('http://localhost:5000/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!userRes.ok) {
        throw new Error('Failed to fetch user');
      }
      
      const userData = await userRes.json();
      setUser(userData);

      // Fetch recent trips
      const tripsRes = await fetch('http://localhost:5000/api/trips', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!tripsRes.ok) {
        throw new Error('Failed to fetch trips');
      }
      
      const tripsData = await tripsRes.json();
      setTrips(tripsData.trips || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'COMPLETE_SUCCESS': 'bg-green-100 text-green-800',
      'PARTIAL_SUCCESS': 'bg-yellow-100 text-yellow-800',
      'PROCESSING': 'bg-blue-100 text-blue-800',
      'FAILED': 'bg-red-100 text-red-800',
      'planned': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'COMPLETE_SUCCESS') return <CheckCircle className="w-4 h-4" />;
    if (status === 'PROCESSING') return <Clock className="w-4 h-4 animate-spin" />;
    if (status === 'FAILED') return <AlertCircle className="w-4 h-4" />;
    return <Calendar className="w-4 h-4" />;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Travel Planner</h1>
              <p className="text-sm text-gray-600">Welcome back, {user?.name}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Action Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Plan New Trip Card */}
          <div 
            onClick={() => router.push('/dashboard/new')}
            className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white cursor-pointer hover:shadow-lg transition transform hover:scale-105"
          >
            <PlusCircle className="w-12 h-12 mb-4" />
            <h3 className="text-xl font-bold mb-2">Plan New Trip</h3>
            <p className="text-blue-100">Start planning your next adventure with AI-powered insights</p>
          </div>

          {/* My Trips Card */}
          <div 
            onClick={() => router.push('/dashboard/trips')}
            className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <MapPin className="w-12 h-12 text-blue-600" />
              <span className="text-3xl font-bold text-gray-900">{trips.length}</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">My Trips</h3>
            <p className="text-gray-600">View and manage all your trips</p>
          </div>

          {/* Stats Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <Calendar className="w-12 h-12 text-blue-600 mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Quick Stats</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Trips</span>
                <span className="font-semibold text-red-700">{trips.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Completed</span>
                <span className="font-semibold text-green-600">
                  {trips.filter(t => t.status === 'COMPLETE_SUCCESS').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">In Progress</span>
                <span className="font-semibold text-blue-600">
                  {trips.filter(t => t.status === 'PROCESSING').length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Trips */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Recent Activity</h2>
            {trips.length > 3 && (
              <button
                onClick={() => router.push('/dashboard/trips')}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                View All
              </button>
            )}
          </div>

          {trips.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No trips yet</h3>
              <p className="text-gray-600 mb-6">Start planning your first adventure!</p>
              <button
                onClick={() => router.push('/dashboard/new')}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Plan New Trip
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {trips.slice(0, 3).map((trip) => (
                <div
                  key={trip.id}
                  onClick={() => router.push(`/dashboard/trip/${trip.id}/overview`)}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {trip.title}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Plane className="w-4 h-4" />
                        <span>{trip.origin} → {trip.destination}</span>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(trip.status)}`}>
                      {getStatusIcon(trip.status)}
                      {trip.status}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(trip.start_date)} - {formatDate(trip.end_date)}</span>
                    </div>
                    <div>
                      {trip.adults} traveler{trip.adults > 1 ? 's' : ''}
                    </div>
                    {trip.total_budget > 0 && (
                      <div className="font-medium text-blue-600">
                        ${trip.total_budget.toLocaleString()}
                      </div>
                    )}
                  </div>

                  {trip._count && (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex gap-4 text-xs text-gray-500">
                      <span>{trip._count.itinerary_items} itinerary items</span>
                      <span>{trip._count.events} events</span>
                      <span>{trip._count.budget_items} budget items</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}