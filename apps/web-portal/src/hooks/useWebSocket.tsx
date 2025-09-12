'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
  useRef,
} from 'react';
import { io, Socket } from 'socket.io-client';
import {
  WebSocketMessage,
  MarketDataUpdate,
  OrderUpdate,
  PortfolioUpdate,
  Portfolio,
  ConnectionStatus,
} from '@/types';

interface WebSocketContextType {
  socket: Socket | null;
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
  subscribe: (channel: string, callback: (data: any) => void) => void;
  unsubscribe: (channel: string) => void;
  emit: (event: string, data: any) => void;
  subscribeToSymbol: (symbol: string) => void;
  unsubscribeFromSymbol: (symbol: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(
  undefined
);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    marketData: 'DISCONNECTED',
    trading: 'DISCONNECTED',
    portfolio: 'DISCONNECTED',
    lastUpdate: new Date(),
  });
  
  const reconnectTimeouts = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const subscriptions = useRef<Map<string, (data: any) => void>>(new Map());

  useEffect(() => {
    const initializeSocket = () => {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const newSocket = io(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000', {
        auth: {
          token,
        },
        transports: ['websocket'],
        upgrade: false,
        rememberUpgrade: false,
      });

      // Connection event handlers
      newSocket.on('connect', () => {
        console.log('WebSocket connected');
        setConnectionStatus(prev => ({
          ...prev,
          marketData: 'CONNECTED',
          trading: 'CONNECTED',
          portfolio: 'CONNECTED',
          lastUpdate: new Date(),
        }));
        
        // Re-establish subscriptions
        subscriptions.current.forEach((callback, channel) => {
          newSocket.emit('subscribe', { channel });
        });
      });

      newSocket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        setConnectionStatus(prev => ({
          ...prev,
          marketData: 'DISCONNECTED',
          trading: 'DISCONNECTED',
          portfolio: 'DISCONNECTED',
          lastUpdate: new Date(),
        }));

        // Attempt to reconnect if not manually disconnected
        if (reason !== 'io client disconnect') {
          handleReconnection();
        }
      });

      newSocket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        setConnectionStatus(prev => ({
          ...prev,
          marketData: 'RECONNECTING',
          trading: 'RECONNECTING',
          portfolio: 'RECONNECTING',
          lastUpdate: new Date(),
        }));
        
        handleReconnection();
      });

      // Market data events
      newSocket.on('market_data', (data: MarketDataUpdate) => {
        const callback = subscriptions.current.get('market_data');
        if (callback) {
          callback(data);
        }
      });

      // Order update events
      newSocket.on('order_update', (data: OrderUpdate) => {
        const callback = subscriptions.current.get('order_update');
        if (callback) {
          callback(data);
        }
      });

      // Portfolio update events
      newSocket.on('portfolio_update', (data: PortfolioUpdate) => {
        const callback = subscriptions.current.get('portfolio_update');
        if (callback) {
          callback(data);
        }
      });

      // Generic message handler
      newSocket.onAny((event: string, data: WebSocketMessage) => {
        const callback = subscriptions.current.get(event);
        if (callback) {
          callback(data);
        }
      });

      setSocket(newSocket);
    };

    const handleReconnection = () => {
      // Clear existing timeout
      Object.values(reconnectTimeouts.current).forEach(clearTimeout);
      
      // Set up exponential backoff reconnection
      let retryCount = 0;
      const maxRetries = 5;
      const baseDelay = 1000;

      const reconnect = () => {
        if (retryCount >= maxRetries) {
          console.error('Max reconnection attempts reached');
          return;
        }

        const delay = baseDelay * Math.pow(2, retryCount);
        retryCount++;

        console.log(`Reconnection attempt ${retryCount} in ${delay}ms`);
        
        reconnectTimeouts.current.reconnect = setTimeout(() => {
          initializeSocket();
        }, delay);
      };

      reconnect();
    };

    initializeSocket();

    // Cleanup function
    return () => {
      if (socket) {
        socket.disconnect();
      }
      Object.values(reconnectTimeouts.current).forEach(clearTimeout);
      reconnectTimeouts.current = {};
    };
  }, []);

  const subscribe = useCallback(
    (channel: string, callback: (data: any) => void) => {
      subscriptions.current.set(channel, callback);
      
      if (socket?.connected) {
        socket.emit('subscribe', { channel });
      }
    },
    [socket]
  );

  const unsubscribe = useCallback(
    (channel: string) => {
      subscriptions.current.delete(channel);
      
      if (socket?.connected) {
        socket.emit('unsubscribe', { channel });
      }
    },
    [socket]
  );

  const emit = useCallback(
    (event: string, data: any) => {
      if (socket?.connected) {
        socket.emit(event, data);
      }
    },
    [socket]
  );

  const subscribeToSymbol = useCallback(
    (symbol: string) => {
      if (socket?.connected) {
        socket.emit('subscribe_symbol', { symbol });
      }
    },
    [socket]
  );

  const unsubscribeFromSymbol = useCallback(
    (symbol: string) => {
      if (socket?.connected) {
        socket.emit('unsubscribe_symbol', { symbol });
      }
    },
    [socket]
  );

  const value: WebSocketContextType = {
    socket,
    connectionStatus,
    isConnected: socket?.connected || false,
    subscribe,
    unsubscribe,
    emit,
    subscribeToSymbol,
    unsubscribeFromSymbol,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}

// Hook for subscribing to market data
export function useMarketData(symbols: string[]) {
  const { subscribe, unsubscribe, subscribeToSymbol, unsubscribeFromSymbol } = useWebSocket();
  const [marketData, setMarketData] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    // Subscribe to market data updates
    const handleMarketData = (data: MarketDataUpdate) => {
      setMarketData(prev => new Map(prev.set(data.data.symbol, data.data)));
    };

    subscribe('market_data', handleMarketData);

    // Subscribe to specific symbols
    symbols.forEach(symbol => {
      subscribeToSymbol(symbol);
    });

    return () => {
      unsubscribe('market_data');
      symbols.forEach(symbol => {
        unsubscribeFromSymbol(symbol);
      });
    };
  }, [symbols, subscribe, unsubscribe, subscribeToSymbol, unsubscribeFromSymbol]);

  return marketData;
}

// Hook for order updates
export function useOrderUpdates() {
  const { subscribe, unsubscribe } = useWebSocket();
  const [orders, setOrders] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    const handleOrderUpdate = (data: OrderUpdate) => {
      setOrders(prev => new Map(prev.set(data.data.id, data.data)));
    };

    subscribe('order_update', handleOrderUpdate);

    return () => {
      unsubscribe('order_update');
    };
  }, [subscribe, unsubscribe]);

  return orders;
}

// Hook for portfolio updates
export function usePortfolioUpdates() {
  const { subscribe, unsubscribe } = useWebSocket();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);

  useEffect(() => {
    const handlePortfolioUpdate = (data: PortfolioUpdate) => {
      setPortfolio(data.data);
    };

    subscribe('portfolio_update', handlePortfolioUpdate);

    return () => {
      unsubscribe('portfolio_update');
    };
  }, [subscribe, unsubscribe]);

  return portfolio;
}