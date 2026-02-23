import { io, type Socket } from 'socket.io-client';
import { useState, useEffect, useRef } from 'react';
import { getAccessToken } from '@/lib/api';

// Module-level socket instance
let socket: Socket | null = null;

// Track last event timestamp for reconnection catch-up
let lastEventTimestamp: string | null = null;

/**
 * Connect to the Socket.IO server with JWT auth.
 * Uses same origin (nginx proxies /socket.io to server).
 */
export function connectSocket(): Socket {
  // Already connected -- return existing
  if (socket?.connected) return socket;

  // Disconnect stale instance if any
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  const token = getAccessToken();

  socket = io(window.location.origin, {
    auth: {
      token,
      ...(lastEventTimestamp ? { lastEventTimestamp } : {}),
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
  });

  // Update auth token on reconnect attempts (token may have refreshed)
  socket.on('connect', () => {
    // Reset reconnect auth with fresh token
    if (socket) {
      socket.auth = {
        token: getAccessToken(),
        ...(lastEventTimestamp ? { lastEventTimestamp } : {}),
      };
    }
  });

  return socket;
}

/**
 * Disconnect the socket and clean up.
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  lastEventTimestamp = null;
}

/**
 * Get the current socket instance (or null if not connected).
 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * Update the last event timestamp for reconnection catch-up.
 * Called internally when events are received.
 */
function updateLastEventTimestamp(timestamp: string): void {
  lastEventTimestamp = timestamp;
}

/**
 * Custom React hook to subscribe to Socket.IO events.
 *
 * @param events - Object mapping event names to handler functions.
 *                 Each handler receives the event payload.
 * @returns Object with isConnected boolean state.
 *
 * Usage:
 * ```tsx
 * const { isConnected } = useSocket({
 *   'request:created': (payload) => refresh(),
 *   'request:updated': (payload) => refresh(),
 * });
 * ```
 */
export function useSocket(
  events: Record<string, (payload: Record<string, unknown>) => void>,
): { isConnected: boolean } {
  const [isConnected, setIsConnected] = useState(socket?.connected ?? false);
  // Use ref to avoid re-registering on every render when handlers change identity
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    const s = socket;
    if (!s) {
      setIsConnected(false);
      return;
    }

    // Connection state handlers
    function handleConnect() {
      setIsConnected(true);
    }
    function handleDisconnect() {
      setIsConnected(false);
    }

    s.on('connect', handleConnect);
    s.on('disconnect', handleDisconnect);

    // Set initial state
    setIsConnected(s.connected);

    // Register event listeners with timestamp tracking
    const wrappedHandlers: Record<string, (payload: Record<string, unknown>) => void> = {};

    for (const eventName of Object.keys(eventsRef.current)) {
      const handler = (payload: Record<string, unknown>) => {
        // Update last event timestamp for reconnection catch-up
        if (payload && typeof payload.timestamp === 'string') {
          updateLastEventTimestamp(payload.timestamp);
        }
        eventsRef.current[eventName]?.(payload);
      };
      wrappedHandlers[eventName] = handler;
      s.on(eventName, handler as (...args: unknown[]) => void);
    }

    // Cleanup
    return () => {
      s.off('connect', handleConnect);
      s.off('disconnect', handleDisconnect);

      for (const [eventName, handler] of Object.entries(wrappedHandlers)) {
        s.off(eventName, handler as (...args: unknown[]) => void);
      }
    };
    // Re-register if socket instance changes (reconnect scenario)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  return { isConnected };
}
