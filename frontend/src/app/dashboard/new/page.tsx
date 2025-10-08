'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import {
  Plane,
  Cloud,
  DollarSign,
  Calendar,
  Hotel,
  Newspaper,
  Map,
  Train,
  PartyPopper,
  Loader2,
  CheckCircle,
  AlertCircle,
  Send,
  ArrowLeft
} from 'lucide-react';

// Agent configuration matching backend
const AGENTS = [
  { id: 'weather', name: 'Weather Agent', icon: Cloud, color: 'blue' },
  { id: 'flights', name: 'Flight Agent', icon: Plane, color: 'indigo' },
  { id: 'trains', name: 'Train Agent', icon: Train, color: 'purple' },
  { id: 'hotels', name: 'Hotels Agent', icon: Hotel, color: 'pink' },
  { id: 'news', name: 'News Agent', icon: Newspaper, color: 'red' },
  { id: 'budget', name: 'Budget Agent', icon: DollarSign, color: 'green' },
  { id: 'events', name: 'Events Agent', icon: PartyPopper, color: 'yellow' },
  { id: 'itinerary', name: 'Itinerary Agent', icon: Calendar, color: 'orange' },
  { id: 'maps', name: 'Maps Agent', icon: Map, color: 'teal' }
];

interface AgentStatus {
  status: 'pending' | 'running' | 'completed' | 'failed';
  message?: string;
}

export default function NewTripPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalProgress, setGlobalProgress] = useState(0);
  const [currentStepMessage, setCurrentStepMessage] = useState('');
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
  const [jobId, setJobId] = useState<string | null>(null);
  const [tripId, setTripId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const socketRef = useRef<Socket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Initialize WebSocket connection
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const socket = io('http://localhost:5000', {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: maxReconnectAttempts
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      reconnectAttempts.current = 0;
      setError(null);
    });

    socket.on('connected', (data) => {
      console.log('[Socket] Server confirmed connection:', data);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      if (reason === 'io server disconnect') {
        socket.connect();
      }
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
      reconnectAttempts.current++;
      if (reconnectAttempts.current >= maxReconnectAttempts) {
        setError('Connection lost. Please refresh the page.');
      }
    });

    socket.on('trip_update', (data) => {
      console.log('[Socket] Trip update received:', data);
      handleTripUpdate(data);
    });

    return () => {
      if (socket.connected) {
        socket.disconnect();
      }
    };
  }, [router]);

  const handleTripUpdate = (data: any) => {
    const { type, progress, currentStep, agent, message, tripId: updatedTripId, error: updateError } = data;

    if (updatedTripId && !tripId) {
      setTripId(updatedTripId);
    }

    switch (type) {
      case 'PROGRESS':
        setGlobalProgress(progress || 0);
        setCurrentStepMessage(message || `Processing ${agent}...`);
        
        if (agent) {
          setAgentStatuses(prev => {
            const newStatuses = { ...prev };
            newStatuses[currentStep] = { status: 'running', message };
            
            AGENTS.forEach(({ id }) => {
              const agentProgress = getAgentProgress(id);
              if (agentProgress < progress && !prev[id]) {
                newStatuses[id] = { status: 'completed' };
              }
            });
            
            return newStatuses;
          });
        }
        break;

      case 'COMPLETE':
        setGlobalProgress(100);
        setCurrentStepMessage('Trip planning completed successfully!');
        
        const completedStatuses: Record<string, AgentStatus> = {};
        AGENTS.forEach(({ id }) => {
          completedStatuses[id] = { status: 'completed' };
        });
        setAgentStatuses(completedStatuses);
        
        setTimeout(() => {
          if (updatedTripId || tripId) {
            router.push(`/dashboard/trip/${updatedTripId || tripId}/overview`);
          } else {
            router.push('/dashboard');
          }
        }, 2000);
        break;

      case 'ERROR':
        setError(updateError || 'An error occurred during trip planning');
        setCurrentStepMessage('Trip planning failed');
        
        if (agent) {
          setAgentStatuses(prev => ({
            ...prev,
            [currentStep]: { status: 'failed', message: updateError }
          }));
        }
        break;
    }
  };

  const getAgentProgress = (agentId: string): number => {
    const progressMap: Record<string, number> = {
      'parsing': 2,
      'geocoding': 5,
      'weather': 10,
      'flights': 25,
      'trains': 30,
      'hotels': 45,
      'news': 55,
      'budget': 65,
      'events': 75,
      'itinerary': 85,
      'maps': 95,
      'finalizing': 99
    };
    return progressMap[agentId] || 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    setGlobalProgress(0);
    setAgentStatuses({});
    setCurrentStepMessage('Submitting your trip request...');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/agents/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) {
        throw new Error('Failed to start trip planning');
      }

      const data = await response.json();
      setJobId(data.jobId);
      setCurrentStepMessage('Trip planning started! Processing your request...');
      
      const initialStatuses: Record<string, AgentStatus> = {};
      AGENTS.forEach(({ id }) => {
        initialStatuses[id] = { status: 'pending' };
      });
      setAgentStatuses(initialStatuses);

    } catch (err) {
      console.error('Error submitting trip:', err);
      setError(err instanceof Error ? err.message : 'Failed to start trip planning');
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status: AgentStatus['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'running':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />;
    }
  };

  const getColorClass = (color: string, type: 'bg' | 'text' | 'border') => {
    const colors: Record<string, Record<string, string>> = {
      blue: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
      indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200' },
      purple: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' },
      pink: { bg: 'bg-pink-100', text: 'text-pink-600', border: 'border-pink-200' },
      red: { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200' },
      green: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200' },
      yellow: { bg: 'bg-yellow-100', text: 'text-yellow-600', border: 'border-yellow-200' },
      orange: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200' },
      teal: { bg: 'bg-teal-100', text: 'text-teal-600', border: 'border-teal-200' }
    };
    return colors[color]?.[type] || colors.blue[type];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <header className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              disabled={isSubmitting}
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back to Dashboard</span>
            </button>
            <h1 className="text-xl font-bold text-gray-900">Plan New Trip</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isSubmitting ? (
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4">
                  <Plane className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  Plan Your Perfect Trip
                </h2>
                <p className="text-gray-600">
                  Describe your dream vacation and let our AI agents create a comprehensive plan
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Trip Description
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Example: I want to visit Paris for 5 days in July with 2 adults. Budget is $3000. We're interested in art museums and French cuisine."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={6}
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Include: destination, dates, number of travelers, budget, and interests
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={!prompt.trim()}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Send className="w-5 h-5" />
                  Start Planning
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">Overall Progress</h3>
                  <span className="text-2xl font-bold text-blue-600">{Math.round(globalProgress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-500 ease-out"
                    style={{ width: `${globalProgress}%` }}
                  />
                </div>
              </div>

              {currentStepMessage && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800 font-medium">{currentStepMessage}</p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">AI Agents Progress</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {AGENTS.map(({ id, name, icon: Icon, color }) => {
                  const status = agentStatuses[id] || { status: 'pending' };
                  return (
                    <div
                      key={id}
                      className={`border-2 rounded-xl p-4 transition-all ${
                        status.status === 'running'
                          ? `${getColorClass(color, 'border')} ${getColorClass(color, 'bg')}`
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${getColorClass(color, 'bg')}`}>
                            <Icon className={`w-5 h-5 ${getColorClass(color, 'text')}`} />
                          </div>
                          <span className="font-medium text-gray-900">{name}</span>
                        </div>
                        {getStatusIcon(status.status)}
                      </div>
                      {status.message && (
                        <p className="text-xs text-gray-600 mt-2">{status.message}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-red-900 mb-1">Error Occurred</h4>
                    <p className="text-sm text-red-800">{error}</p>
                    <button
                      onClick={() => router.push('/dashboard')}
                      className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                    >
                      Return to Dashboard
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}