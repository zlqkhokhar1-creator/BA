'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Percent,
  BarChart3,
  Eye,
  EyeOff,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';

interface Position {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  realizedPnL: number;
  pnlPercent: number;
  dayChange: number;
  dayChangePercent: number;
  lastUpdated: Date;
}

export function PositionTracker() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPnL, setShowPnL] = useState(true);
  const [totalPnL, setTotalPnL] = useState(0);
  const [totalValue, setTotalValue] = useState(0);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Generate mock positions
    const generatePositions = (): Position[] => {
      const symbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'NVDA'];
      const names = [
        'Apple Inc.',
        'Alphabet Inc.',
        'Microsoft Corporation',
        'Tesla, Inc.',
        'Amazon.com, Inc.',
        'NVIDIA Corporation'
      ];

      return symbols.map((symbol, index) => {
        const quantity = Math.floor(Math.random() * 100) + 10;
        const avgPrice = 100 + Math.random() * 200;
        const currentPrice = avgPrice + (Math.random() - 0.5) * 20;
        const marketValue = quantity * currentPrice;
        const unrealizedPnL = quantity * (currentPrice - avgPrice);
        const pnlPercent = (unrealizedPnL / (quantity * avgPrice)) * 100;
        const dayChange = (Math.random() - 0.5) * 1000;
        const dayChangePercent = (dayChange / marketValue) * 100;

        return {
          id: `pos-${index}`,
          symbol,
          name: names[index],
          quantity,
          avgPrice,
          currentPrice,
          marketValue,
          unrealizedPnL,
          realizedPnL: 0,
          pnlPercent,
          dayChange,
          dayChangePercent,
          lastUpdated: new Date()
        };
      });
    };

    const initialPositions = generatePositions();
    setPositions(initialPositions);

    // Update positions periodically
    const interval = setInterval(() => {
      setPositions(prev => prev.map(pos => {
        const priceChange = (Math.random() - 0.5) * 2;
        const newPrice = Math.max(0.01, pos.currentPrice + priceChange);
        const newMarketValue = pos.quantity * newPrice;
        const newUnrealizedPnL = pos.quantity * (newPrice - pos.avgPrice);
        const newPnlPercent = (newUnrealizedPnL / (pos.quantity * pos.avgPrice)) * 100;
        const dayChange = (Math.random() - 0.5) * 1000;
        const dayChangePercent = (dayChange / newMarketValue) * 100;

        return {
          ...pos,
          currentPrice: newPrice,
          marketValue: newMarketValue,
          unrealizedPnL: newUnrealizedPnL,
          pnlPercent: newPnlPercent,
          dayChange,
          dayChangePercent,
          lastUpdated: new Date()
        };
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const total = positions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
    const value = positions.reduce((sum, pos) => sum + pos.marketValue, 0);
    setTotalPnL(total);
    setTotalValue(value);
  }, [positions]);

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

  const formatPercent = (percent: number) => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  if (isLoading) {
    return (
      <div className="trading-panel">
        <div className="trading-panel-header">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-dark-text-primary">
            Positions
          </h3>
        </div>
        <div className="trading-panel-content">
          <div className="animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => (
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
            Positions
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowPnL(!showPnL)}
              className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-dark-bg-tertiary transition-colors"
            >
              {showPnL ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <button className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-dark-bg-tertiary transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="trading-panel-content">
        {/* Summary */}
        <div className="mb-6 p-4 bg-neutral-50 dark:bg-dark-bg-tertiary rounded-lg">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-sm text-neutral-600 dark:text-dark-text-secondary mb-1">
                Total Value
              </p>
              <p className="text-xl font-bold text-neutral-900 dark:text-dark-text-primary">
                {formatCurrency(totalValue)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-neutral-600 dark:text-dark-text-secondary mb-1">
                Unrealized P&L
              </p>
              <p className={`text-xl font-bold ${totalPnL >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                {showPnL ? formatCurrency(totalPnL) : '••••••'}
              </p>
            </div>
          </div>
        </div>

        {/* Positions List */}
        <div className="space-y-3">
          {positions.map((position, index) => (
            <motion.div
              key={position.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="p-4 border border-neutral-200 dark:border-dark-border rounded-lg hover:bg-neutral-50 dark:hover:bg-dark-bg-tertiary transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/20 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-900 dark:text-dark-text-primary">
                      {position.symbol}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-dark-text-tertiary">
                      {position.name}
                    </p>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="text-lg font-bold text-neutral-900 dark:text-dark-text-primary">
                    {formatCurrency(position.marketValue)}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-dark-text-tertiary">
                    {position.quantity} shares
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-neutral-600 dark:text-dark-text-secondary mb-1">Avg Price</p>
                  <p className="font-semibold text-neutral-900 dark:text-dark-text-primary">
                    {formatCurrency(position.avgPrice)}
                  </p>
                </div>
                <div>
                  <p className="text-neutral-600 dark:text-dark-text-secondary mb-1">Current Price</p>
                  <p className="font-semibold text-neutral-900 dark:text-dark-text-primary">
                    {formatCurrency(position.currentPrice)}
                  </p>
                </div>
                <div>
                  <p className="text-neutral-600 dark:text-dark-text-secondary mb-1">Unrealized P&L</p>
                  <div className="flex items-center space-x-1">
                    {position.unrealizedPnL >= 0 ? (
                      <TrendingUp className="w-3 h-3 text-success-600" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-danger-600" />
                    )}
                    <p className={`font-semibold ${position.unrealizedPnL >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                      {showPnL ? formatCurrency(position.unrealizedPnL) : '••••••'}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-neutral-600 dark:text-dark-text-secondary mb-1">P&L %</p>
                  <p className={`font-semibold ${position.pnlPercent >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                    {showPnL ? formatPercent(position.pnlPercent) : '••••••'}
                  </p>
                </div>
              </div>

              {/* Day Change */}
              <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-dark-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-500 dark:text-dark-text-tertiary">
                    Day Change
                  </span>
                  <div className="flex items-center space-x-1">
                    {position.dayChange >= 0 ? (
                      <TrendingUp className="w-3 h-3 text-success-600" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-danger-600" />
                    )}
                    <span className={`text-sm font-medium ${position.dayChange >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                      {formatCurrency(position.dayChange)} ({formatPercent(position.dayChangePercent)})
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {positions.length === 0 && (
          <div className="text-center py-8">
            <BarChart3 className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
            <p className="text-neutral-500 dark:text-dark-text-tertiary">
              No positions found
            </p>
            <p className="text-sm text-neutral-400 dark:text-dark-text-tertiary mt-1">
              Start trading to see your positions here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}