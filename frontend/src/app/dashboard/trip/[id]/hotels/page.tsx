// app/dashboard/trip/[id]/hotels/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTheme } from '../../../../context/ThemeContext';
import { Sun, Moon, XCircle, CheckCircle, Link } from "lucide-react";
import {
  ArrowLeft,
  Hotel,
  Star,
  DollarSign,
  MapPin,
  Calendar,
  Users,
  Loader2,
  ExternalLink,
  Wifi,
  Coffee,
  Dumbbell,
  Waves
} from 'lucide-react';
import { a } from 'framer-motion/client';

interface HotelData {
  id: string;
  name: string;
  rating: number;
  reviewCount: number;
  price: number;
  currency: string;
  priceDescription: string;
  address: string;
  thumbnail: string | null;
  amenities: string[];
  description: string;
  checkinDate: string;
  checkoutDate: string;
  totalNights: number;
  totalPrice: number;
  bookingLink: string | null;
  position: number;
  type: string;
}

interface HotelsResponse {
  summary: string;
  destination: string;
  checkin: string;
  checkout: string;
  totalHotels: number;
  priceStatistics: {
    min: number;
    max: number;
    average: number;
  };
  currency: string;
  hotels: HotelData[];
  searchParams: {
    adults: number;
    children: number;
    rooms: number;
    sortBy: string;
  };
}

export default function HotelsPage() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.id as string;
  
  const [hotelsData, setHotelsData] = useState<HotelsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'price_low' | 'price_high' | 'rating'>('price_low');
     const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    fetchHotels();
  }, [tripId]);

  const fetchHotels = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`http://localhost:5000/api/trips/${tripId}/hotels`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch hotels');
      }

      const data = await response.json();
      setHotelsData(data);
    } catch (err) {
      console.error('Error fetching hotels:', err);
      setError(err instanceof Error ? err.message : 'Failed to load hotels');
    } finally {
      setLoading(false);
    }
  };

  const sortHotels = (hotels: HotelData[]) => {
    return [...hotels].sort((a, b) => {
      if (sortBy === 'price_low') return a.price - b.price;
      if (sortBy === 'price_high') return b.price - a.price;
      if (sortBy === 'rating') return b.rating - a.rating;
      return 0;
    });
  };

  const getAmenityIcon = (amenity: string) => {
    const amenityLower = amenity.toLowerCase();
    if (amenityLower.includes('wifi')) return <Wifi className="w-4 h-4" />;
    if (amenityLower.includes('breakfast') || amenityLower.includes('coffee')) return <Coffee className="w-4 h-4" />;
    if (amenityLower.includes('gym') || amenityLower.includes('fitness')) return <Dumbbell className="w-4 h-4" />;
    if (amenityLower.includes('pool') || amenityLower.includes('swimming')) return <Waves className="w-4 h-4" />;
    return null;
  };

  const HotelCard = ({ hotel }: { hotel: HotelData }) => (
    <div className={`rounded-xl shadow-sm overflow-hidden hover:shadow-md transition ${
      theme === 'dark'
        ? 'bg-gray-800/50 backdrop-blur-sm border border-gray-700 hover:border-gray-600'
        : 'bg-white'
    }`}>
      <div className="flex flex-col md:flex-row">
        {/* Image */}
        <div className={`md:w-1/3 relative ${
          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
        }`}>
          {hotel.thumbnail ? (
            <img
              src={hotel.thumbnail}
              alt={hotel.name}
              className="w-full h-64 md:h-full object-cover"
            />
          ) : (
            <div className="w-full h-64 md:h-full flex items-center justify-center">
              <Hotel className={`w-16 h-16 ${
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              }`} />
            </div>
          )}
          {hotel.position <= 3 && (
            <div className="absolute top-4 left-4 bg-yellow-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
              Top {hotel.position}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-6">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className={`text-xl font-semibold mb-1 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {hotel.name}
              </h3>
              <div className={`flex items-center gap-2 text-sm mb-2 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {/* <MapPin className="w-4 h-4" /> */}
                {/* <span>{hotel.address}</span> */}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  {/* <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" /> */}
                  {/* <span className={`font-semibold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>{hotel.rating.toFixed(1)}</span> */}
                </div>
                <span className={`text-sm ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  ({hotel.reviewCount} reviews)
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-bold ${
                theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
              }`}>
                {hotel.currency} {hotel.price}
              </p>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                per night
              </p>
              {/* <p className={`text-xs mt-1 ${
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              }`}>{hotel.priceDescription}</p> */}
            </div>
          </div>

          <p className={`text-sm mb-4 line-clamp-2 ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
          }`}>
            {hotel.description}
          </p>

          {/* Amenities */}
          {hotel.amenities && hotel.amenities.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {hotel.amenities.slice(0, 6).map((amenity, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs ${
                    theme === 'dark'
                      ? 'bg-gray-700/50 text-gray-300'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {getAmenityIcon(amenity)}
                  <span>{amenity}</span>
                </div>
              ))}
              {hotel.amenities.length > 6 && (
                <div className={`px-3 py-1 rounded-full text-xs ${
                  theme === 'dark'
                    ? 'bg-gray-700/50 text-gray-300'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  +{hotel.amenities.length - 6} more
                </div>
              )}
            </div>
          )}

          {/* Booking Info */}
          <div className={`flex items-center justify-between pt-4 border-t ${
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <div className={`text-sm ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              <span className={`font-medium ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {hotel.totalNights} nights
              </span> 
            </div>
            <div className="flex gap-2">
              {hotel.bookingLink && (
                <a
                  href={hotel.bookingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm"
                >
                  Book Now
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
              <button className={`px-4 py-2 border rounded-lg transition font-medium text-sm ${
                theme === 'dark'
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700/50'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}>
                View Details
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading hotels...</p>
        </div>
      </div>
    );
  }

  if (error || !hotelsData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Hotel className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error || 'No hotels available'}</p>
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

  const sortedHotels = sortHotels(hotelsData.hotels);

 return (
    <div className={`min-h-screen bg-gray-50 ${
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
        {/* Title */}
        <div className="mb-6">
          <h1 className={`text-3xl font-bold mb-2 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            Hotels in {hotelsData.destination}
          </h1>
          <p className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
            {hotelsData.summary}
          </p>
        </div>

        {/* Search Info & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className={`rounded-xl shadow-sm p-4 ${
            theme === 'dark' 
              ? 'bg-gray-800/50 backdrop-blur-sm border border-gray-700' 
              : 'bg-white'
          }`}>
            <div className={`flex items-center gap-2 text-sm mb-1 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              <Calendar className="w-4 h-4" />
              <span>Check-in / Check-out</span>
            </div>
            <p className={`font-medium ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {new Date(hotelsData.checkin).toLocaleDateString()} - {new Date(hotelsData.checkout).toLocaleDateString()}
            </p>
          </div>

          <div className={`rounded-xl shadow-sm p-4 ${
            theme === 'dark' 
              ? 'bg-gray-800/50 backdrop-blur-sm border border-gray-700' 
              : 'bg-white'
          }`}>
            <div className={`flex items-center gap-2 text-sm mb-1 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              <Users className="w-4 h-4" />
              <span>Guests & Rooms</span>
            </div>
            <p className={`font-medium ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {hotelsData.searchParams.adults} adults, {hotelsData.searchParams.rooms} room(s)
            </p>
          </div>

          {/* <div className={`rounded-xl shadow-sm p-4 ${
            theme === 'dark' 
              ? 'bg-gray-800/50 backdrop-blur-sm border border-gray-700' 
              : 'bg-white'
          }`}>
            <div className={`flex items-center gap-2 text-sm mb-1 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              <DollarSign className="w-4 h-4" />
              <span>Price Range</span>
            </div>
            <p className={`font-medium ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {hotelsData.currency} {hotelsData.priceStatistics.min} - {hotelsData.priceStatistics.max}/night
            </p>
          </div> */}
        </div>

        {/* Sort Controls */}
        <div className="flex items-center justify-between mb-6">
          <p className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
            Showing {sortedHotels.length} propert{sortedHotels.length === 1 ? 'y' : 'ies'}
          </p>
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
              <option value="price_low">Price (Low to High)</option>
              <option value="price_high">Price (High to Low)</option>
              <option value="rating">Rating (High to Low)</option>
            </select>
          </div>
        </div>

        {/* Hotels List */}
        <div className="space-y-6">
          {sortedHotels.map((hotel) => (
            <HotelCard key={hotel.id} hotel={hotel} />
          ))}
        </div>
      </main>
    </div>
  );
}