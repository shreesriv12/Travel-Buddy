// hooks/useRealtimeTripUpdates.js
// Custom React hook for real-time trip updates via WebSocket

import { useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

export function useRealtimeTripUpdates(tripId, enabled = true) {
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState([]);
  const [currentAgent, setCurrentAgent] = useState(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('disconnected'); // disconnected, connecting, processing, complete, error
  const [error, setError] = useState(null);
  
  const socketRef = useRef(null);

  const addLog = useCallback((message, type = 'info') => {
    setLogs(prev => [...prev, {
      id: Date.now() + Math.random(),
      message,
      type,
      timestamp: new Date().toLocaleTimeString()
    }]);
  }, []);

  useEffect(() => {
    if (!enabled || !tripId) return;

    const token = localStorage.getItem('token');
    if (!token) {
      setError('No authentication token found');
      return;
    }

    setStatus('connecting');
    console.log('[WebSocket] Initializing connection...');

    // Initialize Socket.IO connection
    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000', {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000
    });

    socketRef.current = socket;

    // Connection established
    socket.on('connect', () => {
      console.log('[WebSocket] Connected:', socket.id);
      setIsConnected(true);
      setStatus('processing');
      setError(null);
      addLog('🟢 Connected to real-time updates', 'success');
    });

    // Connection confirmed by server
    socket.on('connected', (data) => {
      console.log('[WebSocket] Connection confirmed:', data);
      addLog(`✅ Monitoring trip #${tripId}`, 'info');
    });

    // Trip update events
    socket.on('trip_update', (data) => {
      console.log('[WebSocket] Trip update:', data);
      handleTripUpdate(data);
    });

    // Disconnection
    socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason);
      setIsConnected(false);
      
      if (status !== 'complete') {
        setStatus('disconnected');
        addLog('🔴 Disconnected from server', 'error');
      }
    });

    // Connection errors
    socket.on('connect_error', (err) => {
      console.error('[WebSocket] Connection error:', err);
      setError(err.message);
      setStatus('error');
      addLog(`❌ Connection error: ${err.message}`, 'error');
    });

    // General errors
    socket.on('error', (err) => {
      console.error('[WebSocket] Error:', err);
      setError(err.message);
      addLog(`❌ Error: ${err.message}`, 'error');
    });

    // Cleanup
    return () => {
      console.log('[WebSocket] Cleaning up connection');
      socket.close();
      socketRef.current = null;
    };
  }, [tripId, enabled, addLog]);

  const handleTripUpdate = useCallback((data) => {
    const { type, agent, message, progress: progressValue, status: updateStatus, tripId: updatedTripId } = data;

    // Update current agent
    if (agent) {
      setCurrentAgent(agent);
    }

    // Update progress
    if (progressValue !== undefined) {
      setProgress(progressValue);
    }

    // Handle different update types
    switch (type) {
      case 'PROGRESS':
        addLog(`🔄 ${agent || 'System'}: ${message}`, 'progress');
        break;

      case 'COMPLETE':
        addLog(`✅ ${message || 'Trip planning completed successfully!'}`, 'success');
        setStatus('complete');
        setProgress(100);
        setCurrentAgent(null);
        break;

      case 'ERROR':
        addLog(`❌ Error: ${message}`, 'error');
        setStatus('error');
        setError(message);
        break;

      case 'INFO':
        addLog(`ℹ️ ${message}`, 'info');
        break;

      default:
        addLog(`${message}`, 'info');
    }
  }, [addLog]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const reconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.connect();
    }
  }, []);

  return {
    isConnected,
    logs,
    currentAgent,
    progress,
    status,
    error,
    clearLogs,
    reconnect
  };
}

// Helper function to format agent names
export function formatAgentName(agentName) {
  const names = {
    'weatherAgent': 'Weather Agent',
    'flightAgent': 'Flight Agent',
    'trainAgent': 'Train Agent',
    'hotelsAgent': 'Hotels Agent',
    'newsAgent': 'News Agent',
    'budgetAgent': 'Budget Agent',
    'eventsAgent': 'Events Agent',
    'itineraryAgent': 'Itinerary Agent',
    'mapsAgent': 'Maps Agent',
    'Orchestrator': 'Orchestrator'
  };
  return names[agentName] || agentName;
}

// Agent metadata for UI
export const AGENT_METADATA = {
  weatherAgent: {
    name: 'Weather Agent',
    icon: '☁️',
    color: 'blue',
    description: 'Fetching weather forecasts'
  },
  flightAgent: {
    name: 'Flight Agent',
    icon: '✈️',
    color: 'purple',
    description: 'Searching for flights'
  },
  trainAgent: {
    name: 'Train Agent',
    icon: '🚂',
    color: 'indigo',
    description: 'Finding train routes'
  },
  hotelsAgent: {
    name: 'Hotels Agent',
    icon: '🏨',
    color: 'pink',
    description: 'Searching for hotels'
  },
  newsAgent: {
    name: 'News Agent',
    icon: '📰',
    color: 'orange',
    description: 'Fetching destination news'
  },
  budgetAgent: {
    name: 'Budget Agent',
    icon: '💰',
    color: 'green',
    description: 'Calculating budget'
  },
  eventsAgent: {
    name: 'Events Agent',
    icon: '🎉',
    color: 'yellow',
    description: 'Finding local events'
  },
  itineraryAgent: {
    name: 'Itinerary Agent',
    icon: '📅',
    color: 'teal',
    description: 'Generating itinerary'
  },
  mapsAgent: {
    name: 'Maps Agent',
    icon: '🗺️',
    color: 'cyan',
    description: 'Calculating routes'
  },
  Orchestrator: {
    name: 'Orchestrator',
    icon: '🎯',
    color: 'gray',
    description: 'Coordinating agents'
  }
};