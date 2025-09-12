'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  DollarSign, 
  BarChart3, 
  Settings, 
  Bell, 
  Search,
  Menu,
  X,
  ChevronDown,
  Plus,
  Minus,
  Eye,
  EyeOff,
  LogOut,
  User,
  Wallet,
  PieChart,
  Target,
  AlertCircle
} from 'lucide-react';
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
  const { user, isAuthenticated, logout } = useAuth();
  const { isConnected } = useWebSocket();
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL');
  const [watchlist, setWatchlist] = useState(['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'NVDA', 'META', 'NFLX']);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Mock portfolio data
  const portfolioData = {
    totalValue: 125430.50,
    dayChange: 2847.32,
    dayChangePercent: 2.32,
    cashBalance: 15430.50,
    buyingPower: 30861.00,
    positions: [
      { symbol: 'AAPL', quantity: 100, avgPrice: 150.25, currentPrice: 152.80, pnl: 255.00, pnlPercent: 1.70 },
      { symbol: 'GOOGL', quantity: 50, avgPrice: 2800.00, currentPrice: 2850.75, pnl: 2537.50, pnlPercent: 1.81 },
      { symbol: 'MSFT', quantity: 75, avgPrice: 320.00, currentPrice: 325.40, pnl: 405.00, pnlPercent: 1.69 }
    ]
  };

  useEffect(() => {
    // Simulate loading delay
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-dark-bg-primary">
        <div className="text-center">
          <div className="loading-spinner w-12 h-12 mx-auto mb-4"></div>
          <p className="text-neutral-600 dark:text-dark-text-secondary">Initializing trading platform...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-neutral-50 dark:bg-dark-bg-primary ${className}`}>
      {/* Top Navigation Bar */}
      <header className="bg-white dark:bg-dark-bg-secondary border-b border-neutral-200 dark:border-dark-border sticky top-0 z-40">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left Section */}
            <div className="flex items-center space-x-6">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-md hover:bg-neutral-100 dark:hover:bg-dark-bg-tertiary transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              
              <div className="flex items-center space-x-4">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-neutral-900 dark:text-dark-text-primary">
                    Trading Platform
                  </h1>
                  <p className="text-xs text-neutral-500 dark:text-dark-text-tertiary">
                    Professional Edition
                  </p>
                </div>
              </div>

              <ConnectionStatus />
            </div>

            {/* Center Section - Search */}
            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search symbols, news, or analysis..."
                  className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg-secondary text-neutral-900 dark:text-dark-text-primary placeholder-neutral-500 dark:placeholder-dark-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center space-x-4">
              <button className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-dark-bg-tertiary transition-colors relative">
                <Bell className="w-5 h-5 text-neutral-600 dark:text-dark-text-secondary" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-danger-500 rounded-full"></span>
              </button>

              <div className="flex items-center space-x-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-neutral-900 dark:text-dark-text-primary">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-dark-text-tertiary">
                    {user?.accountType}
                  </p>
                </div>
                
                <div className="relative">
                  <button className="flex items-center space-x-2 p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-dark-bg-tertiary transition-colors">
                    <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </div>
                    <ChevronDown className="w-4 h-4 text-neutral-500" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-y-0 left-0 z-50 w-80 bg-white dark:bg-dark-bg-secondary border-r border-neutral-200 dark:border-dark-border lg:hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-dark-border">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-dark-text-primary">
                  Navigation
                </h2>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-dark-bg-tertiary transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <nav className="p-6 space-y-2">
                {[
                  { id: 'overview', label: 'Overview', icon: BarChart3 },
                  { id: 'trading', label: 'Trading', icon: Activity },
                  { id: 'portfolio', label: 'Portfolio', icon: PieChart },
                  { id: 'orders', label: 'Orders', icon: Target },
                  { id: 'settings', label: 'Settings', icon: Settings },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                      activeTab === item.id
                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                        : 'text-neutral-700 dark:text-dark-text-secondary hover:bg-neutral-100 dark:hover:bg-dark-bg-tertiary'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                ))}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Portfolio Summary */}
          <div className="bg-white dark:bg-dark-bg-secondary border-b border-neutral-200 dark:border-dark-border">
            <div className="px-6 py-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-neutral-900 dark:text-dark-text-primary">
                  Portfolio Overview
                </h2>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowBalance(!showBalance)}
                    className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-dark-bg-tertiary transition-colors"
                  >
                    {showBalance ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Total Value */}
                <div className="trading-panel">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-neutral-600 dark:text-dark-text-secondary">
                        Total Value
                      </p>
                      <Wallet className="w-5 h-5 text-neutral-400" />
                    </div>
                    <p className="text-3xl font-bold text-neutral-900 dark:text-dark-text-primary">
                      {showBalance ? `$${portfolioData.totalValue.toLocaleString()}` : '••••••'}
                    </p>
                    <div className="flex items-center mt-2">
                      <TrendingUp className="w-4 h-4 text-success-600 mr-1" />
                      <span className="text-sm text-success-600 font-medium">
                        +${portfolioData.dayChange.toLocaleString()} (+{portfolioData.dayChangePercent}%)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cash Balance */}
                <div className="trading-panel">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-neutral-600 dark:text-dark-text-secondary">
                        Cash Balance
                      </p>
                      <DollarSign className="w-5 h-5 text-neutral-400" />
                    </div>
                    <p className="text-2xl font-bold text-neutral-900 dark:text-dark-text-primary">
                      {showBalance ? `$${portfolioData.cashBalance.toLocaleString()}` : '••••••'}
                    </p>
                    <p className="text-sm text-neutral-500 dark:text-dark-text-tertiary mt-1">
                      Available for trading
                    </p>
                  </div>
                </div>

                {/* Buying Power */}
                <div className="trading-panel">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-neutral-600 dark:text-dark-text-secondary">
                        Buying Power
                      </p>
                      <Activity className="w-5 h-5 text-neutral-400" />
                    </div>
                    <p className="text-2xl font-bold text-neutral-900 dark:text-dark-text-primary">
                      {showBalance ? `$${portfolioData.buyingPower.toLocaleString()}` : '••••••'}
                    </p>
                    <p className="text-sm text-neutral-500 dark:text-dark-text-tertiary mt-1">
                      With margin
                    </p>
                  </div>
                </div>

                {/* Day's P&L */}
                <div className="trading-panel">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-neutral-600 dark:text-dark-text-secondary">
                        Day's P&L
                      </p>
                      <TrendingUp className="w-5 h-5 text-success-600" />
                    </div>
                    <p className="text-2xl font-bold text-success-600">
                      +${portfolioData.dayChange.toLocaleString()}
                    </p>
                    <p className="text-sm text-success-600 mt-1">
                      +{portfolioData.dayChangePercent}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Trading Area */}
          <div className="flex-1 p-6">
            <div className="trading-grid-3">
              {/* Market Data & Charts */}
              <div className="lg:col-span-2 space-y-6">
                <MarketData 
                  symbols={watchlist}
                  selectedSymbol={selectedSymbol}
                  onSymbolSelect={setSelectedSymbol}
                />
                <PerformanceMetrics />
              </div>

              {/* Order Form */}
              <div>
                <OrderForm 
                  symbol={selectedSymbol}
                  onSymbolChange={setSelectedSymbol}
                />
              </div>
            </div>

            {/* Bottom Row */}
            <div className="mt-6 trading-grid-3">
              <OrderBook symbol={selectedSymbol} />
              <PositionTracker />
              <TradeHistory />
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <Notifications />

      {/* Overlay for mobile sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}