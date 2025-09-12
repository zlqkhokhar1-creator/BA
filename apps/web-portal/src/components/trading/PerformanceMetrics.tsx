'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Target,
  Award,
  Zap,
  Shield,
  Activity,
  DollarSign,
  Percent,
  Clock,
  AlertTriangle
} from 'lucide-react';

interface PerformanceMetrics {
  totalReturn: number;
  totalReturnPercent: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  avgTradeReturn: number;
  volatility: number;
  beta: number;
  alpha: number;
  var95: number;
  var99: number;
}

export function PerformanceMetrics() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL'>('1M');

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Generate mock performance metrics
    const generateMetrics = (): PerformanceMetrics => {
      const baseReturn = (Math.random() - 0.3) * 50; // Slightly bullish bias
      const volatility = 15 + Math.random() * 10; // 15-25% volatility
      
      return {
        totalReturn: baseReturn * 1000,
        totalReturnPercent: baseReturn,
        annualizedReturn: baseReturn * 1.2,
        sharpeRatio: 0.5 + Math.random() * 1.5,
        maxDrawdown: -(5 + Math.random() * 15),
        winRate: 45 + Math.random() * 20,
        profitFactor: 0.8 + Math.random() * 0.8,
        totalTrades: Math.floor(Math.random() * 200) + 50,
        avgTradeReturn: (Math.random() - 0.4) * 1000,
        volatility,
        beta: 0.8 + Math.random() * 0.4,
        alpha: (Math.random() - 0.5) * 10,
        var95: -(2 + Math.random() * 3),
        var99: -(3 + Math.random() * 4)
      };
    };

    const initialMetrics = generateMetrics();
    setMetrics(initialMetrics);

    // Update metrics periodically
    const interval = setInterval(() => {
      setMetrics(generateMetrics());
    }, 10000);

    return () => clearInterval(interval);
  }, [timeframe]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (percent: number) => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  const formatNumber = (num: number, decimals = 2) => {
    return num.toFixed(decimals);
  };

  const getPerformanceColor = (value: number, isPositive = true) => {
    if (isPositive) {
      return value >= 0 ? 'text-success-600' : 'text-danger-600';
    }
    return value >= 0 ? 'text-danger-600' : 'text-success-600';
  };

  const getPerformanceBgColor = (value: number, isPositive = true) => {
    if (isPositive) {
      return value >= 0 ? 'bg-success-50 dark:bg-success-900/20' : 'bg-danger-50 dark:bg-danger-900/20';
    }
    return value >= 0 ? 'bg-danger-50 dark:bg-danger-900/20' : 'bg-success-50 dark:bg-success-900/20';
  };

  if (isLoading) {
    return (
      <div className="trading-panel">
        <div className="trading-panel-header">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-dark-text-primary">
            Performance
          </h3>
        </div>
        <div className="trading-panel-content">
          <div className="animate-pulse space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="w-24 h-4 bg-neutral-200 dark:bg-dark-bg-tertiary rounded"></div>
                <div className="w-16 h-4 bg-neutral-200 dark:bg-dark-bg-tertiary rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="trading-panel">
      <div className="trading-panel-header">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-dark-text-primary">
            Performance Metrics
          </h3>
          <div className="flex items-center space-x-2">
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as any)}
              className="text-xs border border-neutral-300 dark:border-dark-border rounded px-2 py-1 bg-white dark:bg-dark-bg-secondary text-neutral-900 dark:text-dark-text-primary"
            >
              <option value="1D">1D</option>
              <option value="1W">1W</option>
              <option value="1M">1M</option>
              <option value="3M">3M</option>
              <option value="1Y">1Y</option>
              <option value="ALL">ALL</option>
            </select>
          </div>
        </div>
      </div>

      <div className="trading-panel-content">
        {/* Key Performance Indicators */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className={`p-4 rounded-lg ${getPerformanceBgColor(metrics.totalReturnPercent)}`}>
            <div className="flex items-center space-x-2 mb-2">
              <DollarSign className="w-4 h-4 text-neutral-600 dark:text-dark-text-secondary" />
              <span className="text-sm font-medium text-neutral-600 dark:text-dark-text-secondary">
                Total Return
              </span>
            </div>
            <p className={`text-xl font-bold ${getPerformanceColor(metrics.totalReturnPercent)}`}>
              {formatCurrency(metrics.totalReturn)}
            </p>
            <p className={`text-sm ${getPerformanceColor(metrics.totalReturnPercent)}`}>
              {formatPercent(metrics.totalReturnPercent)}
            </p>
          </div>

          <div className={`p-4 rounded-lg ${getPerformanceBgColor(metrics.annualizedReturn)}`}>
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="w-4 h-4 text-neutral-600 dark:text-dark-text-secondary" />
              <span className="text-sm font-medium text-neutral-600 dark:text-dark-text-secondary">
                Annualized
              </span>
            </div>
            <p className={`text-xl font-bold ${getPerformanceColor(metrics.annualizedReturn)}`}>
              {formatPercent(metrics.annualizedReturn)}
            </p>
            <p className="text-xs text-neutral-500 dark:text-dark-text-tertiary">
              Per year
            </p>
          </div>
        </div>

        {/* Risk Metrics */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-neutral-700 dark:text-dark-text-secondary flex items-center space-x-2">
            <Shield className="w-4 h-4" />
            <span>Risk Metrics</span>
          </h4>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-neutral-50 dark:bg-dark-bg-tertiary rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-neutral-600 dark:text-dark-text-secondary">
                  Sharpe Ratio
                </span>
                <Award className="w-3 h-3 text-neutral-400" />
              </div>
              <p className="text-lg font-bold text-neutral-900 dark:text-dark-text-primary">
                {formatNumber(metrics.sharpeRatio)}
              </p>
            </div>

            <div className="p-3 bg-neutral-50 dark:bg-dark-bg-tertiary rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-neutral-600 dark:text-dark-text-secondary">
                  Max Drawdown
                </span>
                <TrendingDown className="w-3 h-3 text-neutral-400" />
              </div>
              <p className={`text-lg font-bold ${getPerformanceColor(metrics.maxDrawdown, false)}`}>
                {formatPercent(metrics.maxDrawdown)}
              </p>
            </div>

            <div className="p-3 bg-neutral-50 dark:bg-dark-bg-tertiary rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-neutral-600 dark:text-dark-text-secondary">
                  Volatility
                </span>
                <Zap className="w-3 h-3 text-neutral-400" />
              </div>
              <p className="text-lg font-bold text-neutral-900 dark:text-dark-text-primary">
                {formatPercent(metrics.volatility)}
              </p>
            </div>

            <div className="p-3 bg-neutral-50 dark:bg-dark-bg-tertiary rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-neutral-600 dark:text-dark-text-secondary">
                  Beta
                </span>
                <BarChart3 className="w-3 h-3 text-neutral-400" />
              </div>
              <p className="text-lg font-bold text-neutral-900 dark:text-dark-text-primary">
                {formatNumber(metrics.beta)}
              </p>
            </div>
          </div>
        </div>

        {/* Trading Statistics */}
        <div className="mt-6 space-y-4">
          <h4 className="text-sm font-semibold text-neutral-700 dark:text-dark-text-secondary flex items-center space-x-2">
            <Activity className="w-4 h-4" />
            <span>Trading Statistics</span>
          </h4>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-neutral-50 dark:bg-dark-bg-tertiary rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-neutral-600 dark:text-dark-text-secondary">
                  Win Rate
                </span>
                <Target className="w-3 h-3 text-neutral-400" />
              </div>
              <p className="text-lg font-bold text-neutral-900 dark:text-dark-text-primary">
                {formatPercent(metrics.winRate)}
              </p>
            </div>

            <div className="p-3 bg-neutral-50 dark:bg-dark-bg-tertiary rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-neutral-600 dark:text-dark-text-secondary">
                  Total Trades
                </span>
                <Clock className="w-3 h-3 text-neutral-400" />
              </div>
              <p className="text-lg font-bold text-neutral-900 dark:text-dark-text-primary">
                {metrics.totalTrades}
              </p>
            </div>

            <div className="p-3 bg-neutral-50 dark:bg-dark-bg-tertiary rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-neutral-600 dark:text-dark-text-secondary">
                  Profit Factor
                </span>
                <Percent className="w-3 h-3 text-neutral-400" />
              </div>
              <p className="text-lg font-bold text-neutral-900 dark:text-dark-text-primary">
                {formatNumber(metrics.profitFactor)}
              </p>
            </div>

            <div className="p-3 bg-neutral-50 dark:bg-dark-bg-tertiary rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-neutral-600 dark:text-dark-text-secondary">
                  Avg Trade
                </span>
                <DollarSign className="w-3 h-3 text-neutral-400" />
              </div>
              <p className={`text-lg font-bold ${getPerformanceColor(metrics.avgTradeReturn)}`}>
                {formatCurrency(metrics.avgTradeReturn)}
              </p>
            </div>
          </div>
        </div>

        {/* Value at Risk */}
        <div className="mt-6 space-y-4">
          <h4 className="text-sm font-semibold text-neutral-700 dark:text-dark-text-secondary flex items-center space-x-2">
            <Shield className="w-4 h-4" />
            <span>Value at Risk</span>
          </h4>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-warning-50 dark:bg-warning-900/20 rounded-lg border border-warning-200 dark:border-warning-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-warning-700 dark:text-warning-300">
                  VaR 95%
                </span>
                <AlertTriangle className="w-3 h-3 text-warning-600" />
              </div>
              <p className="text-lg font-bold text-warning-800 dark:text-warning-200">
                {formatPercent(metrics.var95)}
              </p>
            </div>

            <div className="p-3 bg-danger-50 dark:bg-danger-900/20 rounded-lg border border-danger-200 dark:border-danger-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-danger-700 dark:text-danger-300">
                  VaR 99%
                </span>
                <AlertTriangle className="w-3 h-3 text-danger-600" />
              </div>
              <p className="text-lg font-bold text-danger-800 dark:text-danger-200">
                {formatPercent(metrics.var99)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}