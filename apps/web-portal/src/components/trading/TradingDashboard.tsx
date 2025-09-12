'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { OrderForm } from './OrderForm';
import { OrderBook } from './OrderBook';
import { PositionTracker } from './PositionTracker';
import { TradeHistory } from './TradeHistory';
import { MarketData } from './MarketData';
import { PerformanceMetrics } from './PerformanceMetrics';
import { ConnectionStatus } from './ConnectionStatus';
import { Notifications } from './Notifications';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocket } from '@/hooks/useWebSocket';

interface TradingDashboardProps {
  className?: string;
}

export function TradingDashboard({ className = '' }: TradingDashboardProps) {
  const { user, isAuthenticated } = useAuth();
  const { isConnected } = useWebSocket();
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL');
  const [watchlist, setWatchlist] = useState(['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN']);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading delay
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Please log in to access the trading platform
          </h2>
          <button 
            onClick={() => window.location.href = '/login'}
            className="btn-primary"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="loading-spinner w-12 h-12 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading trading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 ${className}`}>
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Trading Dashboard
              </h1>
              <ConnectionStatus />
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Welcome, {user?.firstName} {user?.lastName}
              </div>
              <button
                onClick={() => {/* Open user menu */}}
                className="btn-ghost p-2"
              >
                <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-6 space-y-6">
        {/* Top Row - Market Data & Performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          <div className="lg:col-span-2">
            <MarketData 
              symbols={watchlist}
              selectedSymbol={selectedSymbol}
              onSymbolSelect={setSelectedSymbol}
            />
          </div>
          <div>
            <PerformanceMetrics />
          </div>
        </motion.div>

        {/* Middle Row - Order Management */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          <div>
            <OrderForm 
              symbol={selectedSymbol}
              onSymbolChange={setSelectedSymbol}
            />
          </div>
          <div>
            <OrderBook symbol={selectedSymbol} />
          </div>
          <div>
            <PositionTracker />
          </div>
        </motion.div>

        {/* Bottom Row - Trade History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <TradeHistory />
        </motion.div>
      </div>

      {/* Notifications */}
      <Notifications />

      {/* Mobile Menu Toggle (if needed) */}
      <div className="lg:hidden fixed bottom-4 right-4 z-50">
        <button className="btn-primary rounded-full p-3 shadow-lg">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Keyboard shortcuts overlay (hidden by default) */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40 hidden" id="shortcuts-overlay">
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Keyboard Shortcuts</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Buy Order</span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Ctrl + B</kbd>
              </div>
              <div className="flex justify-between">
                <span>Sell Order</span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Ctrl + S</kbd>
              </div>
              <div className="flex justify-between">
                <span>Cancel All Orders</span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Ctrl + X</kbd>
              </div>
              <div className="flex justify-between">
                <span>Focus Symbol Search</span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">/</kbd>
              </div>
              <div className="flex justify-between">
                <span>Show Shortcuts</span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">?</kbd>
              </div>
            </div>
            <button
              onClick={() => document.getElementById('shortcuts-overlay')?.classList.add('hidden')}
              className="btn-primary w-full mt-4"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        /* Global keyboard shortcuts */
        body {
          /* Prevent default browser shortcuts from interfering */
          user-select: none;
        }
        
        /* Trading-specific styles */
        .trading-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
        }
        
        .price-flash-up {
          animation: flash-green 0.5s ease-out;
        }
        
        .price-flash-down {
          animation: flash-red 0.5s ease-out;
        }
        
        @keyframes flash-green {
          0% { background-color: rgba(34, 197, 94, 0.2); }
          100% { background-color: transparent; }
        }
        
        @keyframes flash-red {
          0% { background-color: rgba(239, 68, 68, 0.2); }
          100% { background-color: transparent; }
        }
        
        /* High-frequency data updates optimization */
        .market-data-table {
          contain: layout style;
          will-change: contents;
        }
        
        .order-book-table {
          contain: layout style;
          will-change: contents;
        }
      `}</style>
    </div>
  );
}

// Keyboard shortcuts handler
if (typeof window !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    // Only handle shortcuts when not in an input field
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch (e.key) {
      case '?':
        e.preventDefault();
        document.getElementById('shortcuts-overlay')?.classList.remove('hidden');
        break;
      case 'Escape':
        document.getElementById('shortcuts-overlay')?.classList.add('hidden');
        break;
      case '/':
        e.preventDefault();
        // Focus symbol search input
        const symbolInput = document.querySelector('input[placeholder*="symbol"]') as HTMLInputElement;
        symbolInput?.focus();
        break;
    }

    // Handle Ctrl+ shortcuts
    if (e.ctrlKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          // Trigger buy order form
          console.log('Buy order shortcut');
          break;
        case 's':
          e.preventDefault();
          // Trigger sell order form
          console.log('Sell order shortcut');
          break;
        case 'x':
          e.preventDefault();
          // Cancel all orders
          console.log('Cancel all orders shortcut');
          break;
      }
    }
  });
}