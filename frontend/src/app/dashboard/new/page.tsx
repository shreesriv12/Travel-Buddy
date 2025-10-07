// app/dashboard/new/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowRight, 
  Sparkles, 
  CheckCircle, 
  Loader2,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';

interface AgentStatus {
  name: string;
  displayName: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  duration?: string;
}

export default function NewTripPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [agents, setAgents] = useState<AgentStatus[]>([
    { name: 'weatherAgent', displayName: 'Weather Data', status: 'pending' },
    { name: 'flightAgent', displayName: 'Flight Search', status: 'pending' },
    { name: 'hotelsAgent', displayName: 'Hotel Search', status: 'pending' },
    { name: 'newsAgent', displayName: 'News & Updates', status: 'pending' },
    { name: 'budgetAgent', displayName: 'Budget Calculation', status: 'pending' },
    { name: 'eventsAgent', displayName: 'Event Discovery', status: 'pending' },
    { name: 'itineraryAgent', displayName: 'Itinerary Generation', status: 'pending' },
    { name: 'mapsAgent', displayName: 'Route Planning', status: 'pending' },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [tripId, setTripId] = useState<string | null>(null);

  const examplePrompts = [
    "Plan a 5-day trip to Mumbai from Delhi starting October 15th for 2 adults with a budget of $2000",
    "I want to visit Bangalore from Chennai for 3 days next week, budget $1500",
    "Weekend getaway to Goa from Pune, 2 people, leaving this Friday",
    "Family trip to Jaipur from Delhi, 4 days in November, 3 adults"
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsProcessing(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        router.push('/login');
        return;
      }

      // Start trip creation
      const response = await fetch('http://localhost:5000/api/agents/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) {
        throw new Error('Failed to create trip');
      }

      const data = await response.json();
      setTripId(data.tripId);

      // Simulate agent progress (since orchestrator runs sequentially)
      simulateAgentProgress(data.toolResults || []);

      // After completion, redirect to trip overview
      setTimeout(() => {
        router.push(`/dashboard/trip/${data.tripId}/overview`);
      }, 2000);

    } catch (err) {
      console.error('Error creating trip:', err);
      setError(err instanceof Error ? err.message : 'Failed to create trip');
      setIsProcessing(false);
    }
  };

  const simulateAgentProgress = (toolResults: any[]) => {
    let currentIndex = 0;
    
    const interval = setInterval(() => {
      if (currentIndex >= agents.length) {
        clearInterval(interval);
        return;
      }

      setAgents(prev => prev.map((agent, idx) => {
        if (idx < currentIndex) {
          const toolResult = toolResults.find(r => r.tool === agent.name);
          return {
            ...agent,
            status: toolResult?.error ? 'failed' : 'complete',
            duration: '2.3s'
          };
        }
        if (idx === currentIndex) {
          return { ...agent, status: 'running' };
        }
        return agent;
      }));

      currentIndex++;
    }, 1500);
  };

  const getAgentIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'running':
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isProcessing ? (
          // Phase 1: Input Form
          <div className="bg-white rounded-xl shadow-sm p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <Sparkles className="w-8 h-8 text-blue-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Plan Your Next Adventure
              </h1>
              <p className="text-gray-600">
                Describe your trip in natural language and let AI handle the rest
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tell us about your trip
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Example: Plan a 5-day trip to Mumbai from Delhi starting October 15th for 2 adults with a budget of $2000"
                  className="w-full h-32 px-4 py-3 border border-gray-300 text-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  required

                />
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  💡 Try these examples:
                </p>
                <div className="space-y-2">
                  {examplePrompts.map((example, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPrompt(example)}
                      className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition"
                    >
                      "{example}"
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-900">Error</p>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={!prompt.trim()}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-medium"
              >
                Start Planning
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          </div>
        ) : (
          // Phase 2: Processing View
          <div className="bg-white rounded-xl shadow-sm p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Creating Your Trip
              </h1>
              <p className="text-gray-600">
                Our AI agents are working on your perfect itinerary
              </p>
            </div>

            <div className="space-y-4 max-w-2xl mx-auto">
              {agents.map((agent, idx) => (
                <div
                  key={agent.name}
                  className={`flex items-center gap-4 p-4 rounded-lg transition ${
                    agent.status === 'running' 
                      ? 'bg-blue-50 border-2 border-blue-200' 
                      : 'bg-gray-50'
                  }`}
                >
                  {getAgentIcon(agent.status)}
                  
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {agent.displayName}
                    </p>
                    {agent.duration && agent.status === 'complete' && (
                      <p className="text-sm text-gray-500">
                        Completed in {agent.duration}
                      </p>
                    )}
                  </div>

                  {agent.status === 'complete' && (
                    <span className="text-sm font-medium text-green-600">
                      Complete
                    </span>
                  )}
                  {agent.status === 'running' && (
                    <span className="text-sm font-medium text-blue-600">
                      Running...
                    </span>
                  )}
                  {agent.status === 'failed' && (
                    <span className="text-sm font-medium text-red-600">
                      Failed
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8 text-center">
              <p className="text-sm text-gray-500">
                This may take 30-60 seconds. Please don't close this page.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}