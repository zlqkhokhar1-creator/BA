'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  DollarSign,
  Activity,
  Filter,
  Download,
  Search,
  ChevronDown
} from 'lucide-react';

interface Trade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  total: number;
  commission: number;
  timestamp: Date;
  status: 'FILLED' | 'PARTIAL' | 'CANCELLED' | 'REJECTED';
  orderId: string;
}

export function TradeHistory() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Generate mock trade history
    const generateTrades = (): Trade[] => {
      const symbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'NVDA', 'META', 'NFLX'];
      const trades: Trade[] = [];

      for (let i = 0; i < 20; i++) {
        const symbol = symbols[Math.floor(Math.random() * symbols.length)];
        const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
        const quantity = Math.floor(Math.random() * 100) + 1;
        const price = 100 + Math.random() * 200;
        const total = quantity * price;
        const commission = total * 0.001; // 0.1% commission
        const timestamp = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000); // Last 7 days
        const status = Math.random() > 0.1 ? 'FILLED' : Math.random() > 0.5 ? 'PARTIAL' : 'CANCELLED';

        trades.push({
          id: `trade-${i}`,
          symbol,
          side,
          quantity,
          price,
          total,
          commission,
          timestamp,
          status,
          orderId: `ORD-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
        });
      }

      return trades.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    };

    const initialTrades = generateTrades();
    setTrades(initialTrades);

    // Add new trades periodically
    const interval = setInterval(() => {
      if (Math.random() > 0.7) { // 30% chance of new trade
        const symbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'NVDA', 'META', 'NFLX'];
        const symbol = symbols[Math.floor(Math.random() * symbols.length)];
        const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
        const quantity = Math.floor(Math.random() * 50) + 1;
        const price = 100 + Math.random() * 200;
        const total = quantity * price;
        const commission = total * 0.001;

        const newTrade: Trade = {
          id: `trade-${Date.now()}`,
          symbol,
          side,
          quantity,
          price,
          total,
          commission,
          timestamp: new Date(),
          status: 'FILLED',
          orderId: `ORD-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
        };

        setTrades(prev => [newTrade, ...prev].slice(0, 50)); // Keep only last 50 trades
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const filteredTrades = trades.filter(trade => {
    const matchesFilter = filter === 'ALL' || trade.side === filter;
    const matchesSearch = trade.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         trade.orderId.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const formatPrice = (price: number) => {
    return price.toFixed(2);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'FILLED':
        return 'text-success-600 bg-success-100 dark:bg-success-900/20';
      case 'PARTIAL':
        return 'text-warning-600 bg-warning-100 dark:bg-warning-900/20';
      case 'CANCELLED':
        return 'text-neutral-600 bg-neutral-100 dark:bg-neutral-900/20';
      case 'REJECTED':
        return 'text-danger-600 bg-danger-100 dark:bg-danger-900/20';
      default:
        return 'text-neutral-600 bg-neutral-100 dark:bg-neutral-900/20';
    }
  };

  if (isLoading) {
    return (
      <div className="trading-panel">
        <div className="trading-panel-header">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-dark-text-primary">
            Trade History
          </h3>
        </div>
        <div className="trading-panel-content">
          <div className="animate-pulse space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="w-16 h-4 bg-neutral-200 dark:bg-dark-bg-tertiary rounded"></div>
                <div className="flex-1 h-4 bg-neutral-200 dark:bg-dark-bg-tertiary rounded"></div>
                <div className="w-20 h-4 bg-neutral-200 dark:bg-dark-bg-tertiary rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="trading-panel">
      <div className="trading-panel-header">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-dark-text-primary">
            Trade History
          </h3>
          <div className="flex items-center space-x-2">
            <button className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-dark-bg-tertiary transition-colors">
              <Download className="w-4 h-4" />
            </button>
            <button className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-dark-bg-tertiary transition-colors">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="trading-panel-content">
        {/* Filters and Search */}
        <div className="mb-6 space-y-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setFilter('ALL')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  filter === 'ALL'
                    ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                    : 'text-neutral-600 dark:text-dark-text-secondary hover:bg-neutral-100 dark:hover:bg-dark-bg-tertiary'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('BUY')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  filter === 'BUY'
                    ? 'bg-success-100 dark:bg-success-900/20 text-success-700 dark:text-success-400'
                    : 'text-neutral-600 dark:text-dark-text-secondary hover:bg-neutral-100 dark:hover:bg-dark-bg-tertiary'
                }`}
              >
                Buys
              </button>
              <button
                onClick={() => setFilter('SELL')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  filter === 'SELL'
                    ? 'bg-danger-100 dark:bg-danger-900/20 text-danger-700 dark:text-danger-400'
                    : 'text-neutral-600 dark:text-dark-text-secondary hover:bg-neutral-100 dark:hover:bg-dark-bg-tertiary'
                }`}
              >
                Sells
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by symbol or order ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg-secondary text-neutral-900 dark:text-dark-text-primary placeholder-neutral-500 dark:placeholder-dark-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {/* Trades List */}
        <div className="space-y-2">
          {filteredTrades.map((trade, index) => (
            <motion.div
              key={trade.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-4 border border-neutral-200 dark:border-dark-border rounded-lg hover:bg-neutral-50 dark:hover:bg-dark-bg-tertiary transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    trade.side === 'BUY' 
                      ? 'bg-success-100 dark:bg-success-900/20' 
                      : 'bg-danger-100 dark:bg-danger-900/20'
                  }`}>
                    {trade.side === 'BUY' ? (
                      <TrendingUp className="w-5 h-5 text-success-600" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-danger-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-900 dark:text-dark-text-primary">
                      {trade.symbol}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-dark-text-tertiary">
                      {trade.orderId}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-lg font-bold text-neutral-900 dark:text-dark-text-primary">
                    {formatCurrency(trade.total)}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-dark-text-tertiary">
                    {formatTime(trade.timestamp)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-neutral-600 dark:text-dark-text-secondary mb-1">Quantity</p>
                  <p className="font-semibold text-neutral-900 dark:text-dark-text-primary">
                    {trade.quantity} shares
                  </p>
                </div>
                <div>
                  <p className="text-neutral-600 dark:text-dark-text-secondary mb-1">Price</p>
                  <p className="font-semibold text-neutral-900 dark:text-dark-text-primary">
                    {formatCurrency(trade.price)}
                  </p>
                </div>
                <div>
                  <p className="text-neutral-600 dark:text-dark-text-secondary mb-1">Commission</p>
                  <p className="font-semibold text-neutral-900 dark:text-dark-text-primary">
                    {formatCurrency(trade.commission)}
                  </p>
                </div>
                <div>
                  <p className="text-neutral-600 dark:text-dark-text-secondary mb-1">Status</p>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(trade.status)}`}>
                    {trade.status}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {filteredTrades.length === 0 && (
          <div className="text-center py-8">
            <Activity className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
            <p className="text-neutral-500 dark:text-dark-text-tertiary">
              No trades found
            </p>
            <p className="text-sm text-neutral-400 dark:text-dark-text-tertiary mt-1">
              {searchTerm ? 'Try adjusting your search terms' : 'Start trading to see your history here'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}