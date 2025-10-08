'use client';

import React from 'react';
import { useRealtimeTripUpdates, AGENT_METADATA } from '@/hooks/useRealtimeTripUpdates';
import { Activity, CheckCircle, Clock, AlertCircle, Zap } from 'lucide-react';

export default function RealtimeAgentMonitor({ tripId, onComplete }) {
  const {
    isConnected,
    logs,
    currentAgent,
    progress,
    status,
    error
  } = useRealtimeTripUpdates(tripId, true);

  const agentMeta = currentAgent ? AGENT_METADATA[currentAgent] : null;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header Card */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${isConnected ? 'bg-green-100' : 'bg-gray-100'}`}>
              <Zap className={`w-6 h-6 ${isConnected ? 'text-green-600' : 'text-gray-400'}`} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Trip Planning in Progress</h2>
              <p className="text-sm text-gray-600">
                {isConnected ? '🟢 Connected' : '🔴 Disconnected'} • Trip #{tripId}
              </p>
            </div>
          </div>
          {status === 'complete' && (
            <CheckCircle className="w-8 h-8 text-green-600" />
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Overall Progress</span>
            <span className="font-semibold text-gray-900">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Current Agent */}
        {agentMeta && status === 'processing' && (
          <div className={`mt-4 p-4 rounded-lg border-2 bg-${agentMeta.color}-100 text-${agentMeta.color}-700 border-${agentMeta.color}-300`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl animate-pulse">{agentMeta.icon}</span>
              <div>
                <p className="font-semibold">{agentMeta.name}</p>
                <p className="text-sm opacity-80">{agentMeta.description}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Activity Logs */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" />
          Real-Time Activity
        </h3>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-2 opacity-50 animate-spin" />
              <p>Waiting for updates...</p>
            </div>
          ) : (
            logs.map((log) => (
              <LogEntry key={log.id} log={log} />
            ))
          )}
        </div>
      </div>

      {/* Status Banners */}
      {status === 'complete' && (
        <div className="mt-6 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-6 text-white text-center">
          <CheckCircle className="w-16 h-16 mx-auto mb-3" />
          <h3 className="text-2xl font-bold mb-2">Trip Planning Complete!</h3>
          <p className="text-green-100">Your personalized itinerary is ready.</p>
          <button
            onClick={onComplete}
            className="mt-4 px-6 py-3 bg-white text-green-600 rounded-lg font-semibold hover:bg-green-50"
          >
            View Trip Details
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="mt-6 bg-gradient-to-r from-red-500 to-rose-600 rounded-xl p-6 text-white text-center">
          <AlertCircle className="w-16 h-16 mx-auto mb-3" />
          <h3 className="text-2xl font-bold mb-2">Planning Failed</h3>
          <p className="text-red-100">{error || 'An error occurred'}</p>
        </div>
      )}
    </div>
  );
}

function LogEntry({ log }) {
  const getLogColor = (type) => {
    switch (type) {
      case 'success': return 'bg-green-50 border-green-200 text-green-800';
      case 'error': return 'bg-red-50 border-red-200 text-red-800';
      case 'progress': return 'bg-blue-50 border-blue-200 text-blue-800';
      default: return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-4 h-4" />;
      case 'error': return <AlertCircle className="w-4 h-4" />;
      case 'progress': return <Clock className="w-4 h-4 animate-spin" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  return (
    <div className={`p-3 rounded-lg border flex items-start gap-3 ${getLogColor(log.type)}`}>
      <div className="flex-shrink-0 mt-0.5">
        {getIcon(log.type)}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{log.message}</p>
        <p className="text-xs opacity-70 mt-1">{log.timestamp}</p>
      </div>
    </div>
  );
}