/**
 * useWebSocket Hook
 * Manages Socket.io client connection for real-time updates.
 *
 * Requirements: 7.4, 10.3, 5.3
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseWebSocketOptions {
  /** The user name to pass as a query param for identification */
  userName?: string;
  /** Whether to auto-connect on mount (default: true) */
  autoConnect?: boolean;
}

interface UseWebSocketReturn {
  /** Whether the socket is currently connected */
  isConnected: boolean;
  /** Emit an event to the server */
  emit: (event: string, data?: unknown) => void;
  /** Register a listener for a server event */
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  /** Remove a listener for a server event */
  off: (event: string, handler: (...args: unknown[]) => void) => void;
}

const SOCKET_URL = import.meta.env.VITE_WS_URL || '';

/**
 * Hook to manage a Socket.io connection to the backend.
 * Automatically connects on mount and disconnects on unmount.
 * Reconnects if userName changes.
 */
export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const { userName, autoConnect = true } = options;
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!autoConnect) return;

    const socket = io(SOCKET_URL, {
      query: userName ? { userName } : undefined,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [userName, autoConnect]);

  const emit = useCallback((event: string, data?: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    socketRef.current?.on(event, handler);
  }, []);

  const off = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    socketRef.current?.off(event, handler);
  }, []);

  return { isConnected, emit, on, off };
}
