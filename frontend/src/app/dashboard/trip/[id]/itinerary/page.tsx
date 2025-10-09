// app/dashboard/trip/[id]/itinerary/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession, signIn, signOut } from "next-auth/react";
import { useTheme } from '../../../../context/ThemeContext';
import {  Moon, XCircle, CheckCircle, Link } from "lucide-react";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Sun,
  Cloud,
  Loader2,
  Download,
  FileText
} from 'lucide-react';

interface Place {
  name: string;
  area: string;
  category: string;
  suggested_time_hrs: number;
  description: string;
}

interface DayPlan {
  day: number;
  date: string;
  weather: {
    temp_high: number;
    temp_low: number;
    condition: string;
  };
  places: Place[];
  est_hours: number;
  budget: {
    daily_estimated: number;
    total_estimated: number;
  };
}

interface ItineraryData {
  summary: string;
  tripId: string;
  plan: DayPlan[];
}

const CATEGORY_ICONS: { [key: string]: string } = {
  landmark: '🏛️',
  museum: '🏛️',
  park: '🌳',
  restaurant: '🍽️',
  shopping: '🛍️',
  entertainment: '🎭',
  cultural: '🎨',
  nature: '🏞️',
  beach: '🏖️',
  activity: '⚡'
};

export default function ItineraryPage() {
  console.log('🎬 ItineraryPage component rendering');
  
  const router = useRouter();
  const params = useParams();
  const tripId = params.id as string;
  console.log('📍 Trip ID from params:', tripId);
  
  const [itineraryData, setItineraryData] = useState<ItineraryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1]));
  const [downloading, setDownloading] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const { data: session } = useSession();
  console.log('👤 Session state:', session ? 'Authenticated' : 'Not authenticated');
  console.log('👤 Session details:', session);

  useEffect(() => {
    console.log('🔄 useEffect triggered - calling fetchItinerary');
    fetchItinerary();
  }, [tripId]);

  const fetchItinerary = async () => {
    console.log('📥 fetchItinerary started');
    console.log('📥 Current tripId:', tripId);
    
    try {
      const token = localStorage.getItem('token');
      console.log('🔑 Token from localStorage:', token ? `${token.substring(0, 20)}...` : 'NULL');
      
      if (!token) {
        console.log('❌ No token found, redirecting to login');
        router.push('/login');
        return;
      }

      const apiUrl = `http://localhost:5000/api/trips/${tripId}/itinerary`;
      console.log('🌐 Fetching from URL:', apiUrl);
      console.log('🌐 Request headers:', { 'Authorization': `Bearer ${token.substring(0, 20)}...` });

      const response = await fetch(apiUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      console.log('📨 Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        url: response.url
      });

      // Check content type before parsing
      const contentType = response.headers.get('content-type');
      console.log('📋 Content-Type:', contentType);
      
      if (!response.ok) {
        console.log('⚠️ Response not OK, status:', response.status);
        
        // If we get HTML instead of JSON, likely an auth error
        if (contentType?.includes('text/html')) {
          console.error('❌ Received HTML response instead of JSON - likely authentication error');
          console.log('🧹 Clearing invalid token from localStorage');
          localStorage.removeItem('token');
          console.log('↪️ Redirecting to login');
          router.push('/login');
          return;
        }
        
        // Try to parse error message if it's JSON
        if (contentType?.includes('application/json')) {
          console.log('📄 Attempting to parse JSON error response');
          const errorData = await response.json();
          console.log('📄 Error data:', errorData);
          throw new Error(errorData.message || 'Failed to fetch itinerary');
        }
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Ensure we actually got JSON
      if (!contentType?.includes('application/json')) {
        console.error('❌ Server did not return JSON response, got:', contentType);
        throw new Error('Server did not return JSON response');
      }

      console.log('✅ Response OK, parsing JSON...');
      const data = await response.json();
      console.log('📦 Parsed data:', data);
      console.log('📦 Data structure:', {
        hasResultSummary: !!data.resultSummary,
        hasTripId: !!data.tripId,
        hasFullPlan: !!data.fullPlan,
        fullPlanIsArray: Array.isArray(data.fullPlan),
        fullPlanLength: data.fullPlan?.length
      });
      
      // Validate the response structure
      if (!data.fullPlan || !Array.isArray(data.fullPlan)) {
        console.error('❌ Invalid itinerary data structure');
        console.error('Expected data.fullPlan to be an array, got:', typeof data.fullPlan);
        throw new Error('Invalid itinerary data structure');
      }

      console.log('✅ Data validation passed');
      const itineraryPayload = {
        summary: data.resultSummary,
        tripId: data.tripId,
        plan: data.fullPlan
      };
      console.log('💾 Setting itinerary data:', itineraryPayload);
      
      setItineraryData(itineraryPayload);
      console.log('✅ Itinerary data set successfully');
      
    } catch (err) {
      console.error('💥 Error in fetchItinerary:', err);
      console.error('💥 Error type:', err instanceof Error ? 'Error' : typeof err);
      console.error('💥 Error message:', err instanceof Error ? err.message : String(err));
      console.error('💥 Error stack:', err instanceof Error ? err.stack : 'N/A');
      
      setError(err instanceof Error ? err.message : 'Failed to load itinerary');
    } finally {
      console.log('🏁 fetchItinerary finally block - setting loading to false');
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    console.log('📄 handleDownloadPDF started');
    setDownloading(true);
    
    try {
      const token = localStorage.getItem('token');
      console.log('🔑 Token for PDF download:', token ? `${token.substring(0, 20)}...` : 'NULL');
      
      if (!token) {
        console.log('❌ No token found for PDF download');
        alert('Please log in to download PDF');
        router.push('/login');
        return;
      }

      const pdfUrl = `http://localhost:5000/api/itinerary/download-pdf/${tripId}`;
      console.log('🌐 Fetching PDF from URL:', pdfUrl);

      const response = await fetch(pdfUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('📨 PDF Response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      const contentType = response.headers.get('content-type');
      console.log('📋 PDF Content-Type:', contentType);

      if (!response.ok) {
        console.log('⚠️ PDF Response not OK');
        
        // Check if we got HTML (auth error)
        if (contentType?.includes('text/html')) {
          console.error('❌ Authentication failed - received HTML instead of PDF');
          localStorage.removeItem('token');
          alert('Session expired. Please log in again.');
          router.push('/login');
          return;
        }

        // Try to parse JSON error
        if (contentType?.includes('application/json')) {
          console.log('📄 Parsing JSON error for PDF download');
          const errorData = await response.json();
          console.log('📄 PDF Error data:', errorData);
          throw new Error(errorData.message || 'Failed to download PDF');
        }

        throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
      }

      // Verify we got a PDF
      if (!contentType?.includes('application/pdf')) {
        console.error('❌ Expected PDF but got:', contentType);
        throw new Error(`Expected PDF but got: ${contentType}`);
      }

      console.log('✅ PDF response OK, creating blob...');
      const blob = await response.blob();
      console.log('📦 Blob created, size:', blob.size, 'bytes');
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      console.log('🔗 Object URL created:', url);
      
      const filename = `Itinerary_${tripId}_${new Date().toISOString().split('T')[0]}.pdf`;
      console.log('📝 Download filename:', filename);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      console.log('🔗 Download link added to DOM');
      
      a.click();
      console.log('🖱️ Download triggered');
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      console.log('🧹 Cleanup completed');
      
      alert('PDF downloaded successfully!');
      console.log('✅ PDF download completed successfully');
      
    } catch (err) {
      console.error('💥 PDF Download error:', err);
      console.error('💥 Error details:', {
        type: err instanceof Error ? 'Error' : typeof err,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : 'N/A'
      });
      
      alert(err instanceof Error ? err.message : 'Failed to download PDF. Please try again.');
    } finally {
      console.log('🏁 handleDownloadPDF finally block');
      setDownloading(false);
    }
  };

  const toggleDay = (day: number) => {
    console.log('🔄 Toggling day:', day);
    setExpandedDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(day)) {
        console.log('➖ Collapsing day:', day);
        newSet.delete(day);
      } else {
        console.log('➕ Expanding day:', day);
        newSet.add(day);
      }
      console.log('📋 Expanded days:', Array.from(newSet));
      return newSet;
    });
  };

  const formatDate = (dateString: string) => {
    console.log('📅 Formatting date:', dateString);
    const formatted = new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    console.log('📅 Formatted result:', formatted);
    return formatted;
  };

  const getWeatherIcon = (condition: string) => {
    console.log('🌤️ Getting weather icon for condition:', condition);
    const conditionLower = condition.toLowerCase();
    if (conditionLower.includes('sun') || conditionLower.includes('clear')) {
      console.log('☀️ Returning sun icon');
      return <Sun className="w-5 h-5 text-yellow-500" />;
    }
    console.log('☁️ Returning cloud icon');
    return <Cloud className="w-5 h-5 text-gray-500" />;
  };

// Update the saveItinerary function in your page.tsx

const saveItinerary = async () => {
  console.log('💾 saveItinerary started');
  console.log('👤 Current session:', session);
  
  if (!session) {
    console.log('❌ No session, prompting user to sign in');
    alert("Please sign in with Google first");
    return;
  }

  console.log('📦 Current itineraryData:', itineraryData);
  if (!itineraryData || !itineraryData.plan.length) {
    console.log('❌ No itinerary data available');
    alert("No itinerary data available");
    return;
  }

  try {
    console.log('🔄 Transforming itinerary data to events...');
    console.log('📊 Plan length:', itineraryData.plan.length);
    
    // Transform the itinerary data to match the API schema
    const events = itineraryData.plan.flatMap((day, dayIdx) => {
      console.log(`📅 Processing day ${day.day} (index ${dayIdx}):`, {
        date: day.date,
        placesCount: day.places.length
      });
      
      return day.places.map((place, idx) => {
        const startDate = new Date(day.date);
        console.log(`  📍 Place ${idx + 1}/${day.places.length}: ${place.name}`);
        console.log(`    Original date: ${day.date}`);
        
        // Space out events throughout the day (starting at 9 AM, with gaps)
        startDate.setHours(9 + (idx * 2), 0, 0, 0);
        console.log(`    Start time: ${startDate.toISOString()}`);
        
        const endDate = new Date(startDate);
        endDate.setHours(startDate.getHours() + place.suggested_time_hrs);
        console.log(`    End time: ${endDate.toISOString()}`);
        console.log(`    Duration: ${place.suggested_time_hrs} hours`);

        const event = {
          summary: place.name,
          description: `${place.description}\n\nLocation: ${place.area}\nCategory: ${place.category}`,
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
          timeZone: "UTC"
        };
        
        console.log(`    Event created:`, event);
        return event;
      });
    });

    console.log('✅ Events transformed, total count:', events.length);
    console.log('📋 All events:', events);

    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) {
      alert("Please log in to sync with Google Calendar");
      return;
    }

    // Get Google tokens from session
    const accessToken = (session as any).accessToken;
    const refreshToken = (session as any).refreshToken;

    console.log('🔑 Google tokens:', {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken
    });

    if (!accessToken) {
      alert("Google authentication required. Please sign in with Google.");
      return;
    }

    const apiUrl = 'http://localhost:5000/api/calendar/sync';
    console.log('🌐 Posting to:', apiUrl);
    console.log('📤 Request body:', { 
      tripId: itineraryData.tripId,
      itinerary: events 
    });

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "X-Google-Access-Token": accessToken,
        "X-Google-Refresh-Token": refreshToken || ''
      },
      body: JSON.stringify({ 
        tripId: itineraryData.tripId,
        itinerary: events 
      }),
    });

    console.log('📨 Calendar sync response:', {
      status: res.status,
      statusText: res.statusText,
      ok: res.ok,
      url: res.url
    });

    const responseContentType = res.headers.get('content-type');
    console.log('📋 Response Content-Type:', responseContentType);

    // Check if response is JSON
    if (!responseContentType?.includes('application/json')) {
      console.error('❌ Expected JSON but got:', responseContentType);
      const responseText = await res.text();
      console.error('📄 Response body (first 500 chars):', responseText.substring(0, 500));
      alert(`Server returned ${responseContentType} instead of JSON. Check console for details.`);
      return;
    }

    console.log('✅ Response is JSON, parsing...');
    const data = await res.json();
    console.log('📦 Parsed response data:', data);
    
    if (data.success) {
      console.log('✅ Calendar sync successful!');
      console.log('📊 Events added:', data.count || events.length);
      alert(`Successfully added ${data.count || events.length} events to your Google Calendar!`);
    } else {
      console.error('❌ Calendar sync failed');
      console.error('Error message:', data.message);
      alert(`Failed: ${data.message || "Unknown error"}`);
    }
  } catch (err) {
    console.error('💥 Calendar sync error:', err);
    console.error('💥 Error details:', {
      type: err instanceof Error ? 'Error' : typeof err,
      name: err instanceof Error ? err.name : 'N/A',
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : 'N/A'
    });
    
    if (err instanceof SyntaxError && err.message.includes('JSON')) {
      console.error('💥 JSON parsing error - server likely returned HTML');
      alert("Server returned invalid response. Check the console for details.");
    } else {
      alert("Failed to add events to calendar. Please try again.");
    }
  }
};

  console.log('🎨 Rendering component with state:', {
    loading,
    error,
    hasItineraryData: !!itineraryData,
    downloading
  });

  if (loading) {
    console.log('⏳ Rendering loading state');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading itinerary...</p>
        </div>
      </div>
    );
  }

  if (error || !itineraryData) {
    console.log('❌ Rendering error state:', { error, hasItineraryData: !!itineraryData });
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error || 'No itinerary available'}</p>
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

  console.log('✅ Rendering main itinerary view');
  console.log('📊 Itinerary stats:', {
    daysCount: itineraryData.plan.length,
    totalPlaces: itineraryData.plan.reduce((sum, day) => sum + day.places.length, 0),
    expandedDays: Array.from(expandedDays)
  });

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
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              console.log('🔙 Back button clicked, navigating to overview');
              router.push(`/dashboard/trip/${tripId}/overview`);
            }}
            className={`flex items-center gap-2 transition ${
              theme === 'dark'
                ? 'text-gray-300 hover:text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Overview
          </button>
          
          {/* Download PDF Button */}
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              downloading
                ? 'bg-gray-400 cursor-not-allowed'
                : theme === 'dark'
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {downloading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                <span>Download PDF</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>

    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Title with PDF Download */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className={`text-3xl font-bold mb-2 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Daily Itinerary
            </h1>
            <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
              {itineraryData.summary}
            </p>
          </div>
          <div className="ml-4">
            <FileText className={`w-12 h-12 ${
              theme === 'dark' ? 'text-blue-400' : 'text-blue-500'
            }`} />
          </div>
        </div>
        
        {/* Quick Download Card */}
        <div className={`mt-4 rounded-lg p-4 border ${
          theme === 'dark'
            ? 'bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border-blue-700/50'
            : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`font-semibold mb-1 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                Download Your Travel Roadmap
              </h3>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Get a beautifully formatted PDF with all your trip details
              </p>
            </div>
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className={`flex items-center gap-2 px-6 py-3 font-semibold rounded-lg transition whitespace-nowrap ${
                downloading
                  ? 'bg-gray-400 cursor-not-allowed text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {downloading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  <span>Download PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Google Auth & Save */}
      <div className={`mb-6 p-4 border rounded-lg shadow-sm ${
        theme === 'dark'
          ? 'bg-gray-800/50 border-gray-700'
          : 'bg-white border-gray-200'
      }`}>
        {!session ? (
          <div className="text-center">
            <p className={`mb-3 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Save your itinerary to Google Calendar
            </p>
            <button
              onClick={() => {
                console.log('🔐 Sign in button clicked');
                signIn("google");
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Sign in with Google
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                Welcome, {session.user?.name}
              </h2>
              <button
                onClick={() => {
                  console.log('👋 Sign out button clicked');
                  signOut();
                }}
                className={`px-3 py-1 rounded-lg transition text-sm ${
                  theme === 'dark'
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Sign Out
              </button>
            </div>
            <button
              onClick={saveItinerary}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
            >
              Save Itinerary to Google Calendar
            </button>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical Line */}
        <div className={`absolute left-8 top-0 bottom-0 w-0.5 ${
          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
        }`}></div>

        {/* Days */}
        <div className="space-y-6">
          {itineraryData.plan.map((day) => {
            const isExpanded = expandedDays.has(day.day);
            console.log(`🗓️ Rendering day ${day.day}, expanded: ${isExpanded}`);
            
            return (
              <div key={day.day} className="relative">
                {/* Day Circle */}
                <div className={`absolute left-5 top-6 w-6 h-6 rounded-full border-4 shadow-md flex items-center justify-center ${
                  theme === 'dark'
                    ? 'bg-blue-500 border-gray-800'
                    : 'bg-blue-600 border-white'
                }`}>
                  <span className="text-white text-xs font-bold">{day.day}</span>
                </div>

                {/* Day Card */}
                <div className={`ml-16 rounded-xl shadow-sm overflow-hidden ${
                  theme === 'dark'
                    ? 'bg-gray-800/50 backdrop-blur-sm border border-gray-700'
                    : 'bg-white'
                }`}>
                  {/* Day Header */}
                  <button
                    onClick={() => toggleDay(day.day)}
                    className={`w-full p-6 flex items-center justify-between transition ${
                      theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className={`text-xl font-bold ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>
                          Day {day.day}
                        </h3>
                        {getWeatherIcon(day.weather.condition)}
                        <span className={`text-sm ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {day.weather.temp_high}°F / {day.weather.temp_low}°F
                        </span>
                      </div>
                      <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        {formatDate(day.date)}
                      </p>
                      <div className={`flex gap-4 mt-2 text-sm ${
                        theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                      }`}>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {day.est_hours} hours
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          ${day.budget.daily_estimated}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {day.places.length} places
                        </span>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className={`w-6 h-6 ${
                        theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                      }`} />
                    ) : (
                      <ChevronDown className={`w-6 h-6 ${
                        theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                      }`} />
                    )}
                  </button>

                  {/* Day Content */}
                  {isExpanded && (
                    <div className={`border-t p-6 ${
                      theme === 'dark'
                        ? 'border-gray-700 bg-gray-800/30'
                        : 'border-gray-100 bg-gray-50'
                    }`}>
                      <div className="space-y-4">
                        {day.places.map((place, idx) => (
                          <div
                            key={idx}
                            className={`rounded-lg p-4 border ${
                              theme === 'dark'
                                ? 'bg-gray-800/50 border-gray-700'
                                : 'bg-white border-gray-200'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <span className="text-2xl">
                                {CATEGORY_ICONS[place.category] || '📍'}
                              </span>
                              <div className="flex-1">
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <h4 className={`font-semibold mb-1 ${
                                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    }`}>
                                      {place.name}
                                    </h4>
                                    <div className={`flex items-center gap-2 text-sm ${
                                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                    }`}>
                                      <MapPin className="w-3 h-3" />
                                      <span>{place.area}</span>
                                    </div>
                                  </div>
                                  <div className={`flex items-center gap-1 px-3 py-1 rounded-full ${
                                    theme === 'dark'
                                      ? 'bg-blue-900/30 text-blue-400'
                                      : 'bg-blue-50 text-blue-600'
                                  }`}>
                                    <Clock className="w-3 h-3" />
                                    <span className="text-xs font-medium">
                                      {place.suggested_time_hrs}h
                                    </span>
                                  </div>
                                </div>
                                <p className={`text-sm ${
                                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                }`}>
                                  {place.description}
                                </p>
                                <div className="mt-2">
                                  <span className={`inline-block px-2 py-1 text-xs rounded ${
                                    theme === 'dark'
                                      ? 'bg-gray-700 text-gray-300'
                                      : 'bg-gray-100 text-gray-700'
                                  }`}>
                                    {place.category}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Day Summary */}
                      <div className={`mt-4 pt-4 border-t flex items-center justify-between text-sm ${
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      }`}>
                        <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                          Total time: <span className={`font-semibold ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>{day.est_hours} hours</span>
                        </span>
                        <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                          Estimated budget: <span className={`font-semibold ${
                            theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                          }`}>${day.budget.daily_estimated}</span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Total Summary with Download Option */}
      <div className={`mt-8 rounded-xl p-6 text-white ${
        theme === 'dark'
          ? 'bg-gradient-to-r from-blue-700 to-blue-900'
          : 'bg-gradient-to-r from-blue-600 to-blue-800'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">Trip Summary</h3>
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className={`flex items-center gap-2 px-4 py-2 font-semibold rounded-lg transition ${
              downloading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-white text-blue-600 hover:bg-blue-50'
            }`}
          >
            {downloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Generating...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span className="text-sm">Save as PDF</span>
              </>
            )}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className={`text-sm mb-1 ${
              theme === 'dark' ? 'text-blue-300' : 'text-blue-200'
            }`}>Total Days</p>
            <p className="text-3xl font-bold">{itineraryData.plan.length}</p>
          </div>
          <div>
            <p className={`text-sm mb-1 ${
              theme === 'dark' ? 'text-blue-300' : 'text-blue-200'
            }`}>Total Places</p>
            <p className="text-3xl font-bold">
              {itineraryData.plan.reduce((sum, day) => sum + day.places.length, 0)}
            </p>
          </div>
          <div>
            <p className={`text-sm mb-1 ${
              theme === 'dark' ? 'text-blue-300' : 'text-blue-200'
            }`}>Total Budget</p>
            <p className="text-3xl font-bold">
              ${itineraryData.plan[0]?.budget.total_estimated || 0}
            </p>
          </div>
        </div>
      </div>
    </main>
  </div>
);}