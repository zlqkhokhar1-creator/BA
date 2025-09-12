'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  Volume2, 
  Clock, 
  Star,
  StarOff,
  ChevronUp,
  ChevronDown,
  RefreshCw
} from 'lucide-react';

interface MarketDataProps {
  symbols: string[];
  selectedSymbol: string;
  onSymbolSelect: (symbol: string) => void;
}

interface MarketDataItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  marketCap: number;
  pe: number;
  isWatched: boolean;
}

export function MarketData({ symbols, selectedSymbol, onSymbolSelect }: MarketDataProps) {
  const [marketData, setMarketData] = useState<Map<string, MarketDataItem>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Mock market data
  const generateMarketData = (symbol: string): MarketDataItem => {
    const basePrice = Math.random() * 500 + 50;
    const change = (Math.random() - 0.5) * 10;
    const changePercent = (change / basePrice) * 100;
    
    return {
      symbol,
      name: getCompanyName(symbol),
      price: basePrice,
      change,
      changePercent,
      volume: Math.floor(Math.random() * 10000000) + 1000000,
      high: basePrice + Math.random() * 5,
      low: basePrice - Math.random() * 5,
      open: basePrice + (Math.random() - 0.5) * 2,
      marketCap: Math.floor(Math.random() * 1000000000000) + 100000000000,
      pe: Math.random() * 50 + 10,
      isWatched: true
    };
  };

  const getCompanyName = (symbol: string): string => {
    const names: { [key: string]: string } = {
      'AAPL': 'Apple Inc.',
      'GOOGL': 'Alphabet Inc.',
      'MSFT': 'Microsoft Corporation',
      'TSLA': 'Tesla, Inc.',
      'AMZN': 'Amazon.com, Inc.',
      'NVDA': 'NVIDIA Corporation',
      'META': 'Meta Platforms, Inc.',
      'NFLX': 'Netflix, Inc.'
    };
    return names[symbol] || `${symbol} Corporation`;
  };

  useEffect(() => {
    // Initialize market data
    const initialData = new Map();
    symbols.forEach(symbol => {
      initialData.set(symbol, generateMarketData(symbol));
    });
    setMarketData(initialData);
    setIsLoading(false);

    // Simulate real-time updates
    const interval = setInterval(() => {
      setMarketData(prev => {
        const newData = new Map(prev);
        symbols.forEach(symbol => {
          const current = newData.get(symbol);
          if (current) {
            const change = (Math.random() - 0.5) * 2;
            const newPrice = Math.max(0.01, current.price + change);
            const newChange = newPrice - current.open;
            const newChangePercent = (newChange / current.open) * 100;
            
            newData.set(symbol, {
              ...current,
              price: newPrice,
              change: newChange,
              changePercent: newChangePercent,
              volume: current.volume + Math.floor(Math.random() * 1000),
              high: Math.max(current.high, newPrice),
              low: Math.min(current.low, newPrice)
            });
          }
        });
        return newData;
      });
      setLastUpdate(new Date());
    }, 2000);

    return () => clearInterval(interval);
  }, [symbols]);

  const selectedData = marketData.get(selectedSymbol);

  const formatPrice = (price: number) => {
    return price.toFixed(2);
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1e9) return `${(volume / 1e9).toFixed(1)}B`;
    if (volume >= 1e6) return `${(volume / 1e6).toFixed(1)}M`;
    if (volume >= 1e3) return `${(volume / 1e3).toFixed(1)}K`;
    return volume.toString();
  };

  const formatMarketCap = (marketCap: number) => {
    if (marketCap >= 1e12) return `$${(marketCap / 1e12).toFixed(2)}T`;
    if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(2)}B`;
    if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(2)}M`;
    return `$${marketCap.toLocaleString()}`;
  };

  if (isLoading) {
    return (
      <div className="trading-panel">
        <div className="trading-panel-header">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-dark-text-primary">
            Market Data
          </h3>
        </div>
        <div className="trading-panel-content">
          <div className="animate-pulse space-y-4">
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
    <div className="space-y-6">
      {/* Market Overview */}
      <div className="trading-panel">
        <div className="trading-panel-header">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-dark-text-primary">
              Market Overview
            </h3>
            <div className="flex items-center space-x-2">
              <button className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-dark-bg-tertiary transition-colors">
                <RefreshCw className="w-4 h-4 text-neutral-500" />
              </button>
              <span className="text-xs text-neutral-500 dark:text-dark-text-tertiary">
                Last update: {lastUpdate.toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
        
        <div className="trading-panel-content">
          <div className="space-y-3">
            {symbols.map((symbol) => {
              const data = marketData.get(symbol);
              if (!data) return null;
              
              const isSelected = selectedSymbol === symbol;
              const isPositive = data.change >= 0;
              
              return (
                <motion.div
                  key={symbol}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? 'border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-neutral-200 dark:border-dark-border hover:border-neutral-300 dark:hover:bg-dark-bg-tertiary'
                  }`}
                  onClick={() => onSymbolSelect(symbol)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <button className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-dark-bg-tertiary transition-colors">
                          {data.isWatched ? (
                            <Star className="w-4 h-4 text-warning-500 fill-current" />
                          ) : (
                            <StarOff className="w-4 h-4 text-neutral-400" />
                          )}
                        </button>
                        <div>
                          <p className="font-semibold text-neutral-900 dark:text-dark-text-primary">
                            {symbol}
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-dark-text-tertiary">
                            {data.name}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-6">
                      <div className="text-right">
                        <p className="font-semibold text-neutral-900 dark:text-dark-text-primary">
                          ${formatPrice(data.price)}
                        </p>
                        <div className={`flex items-center space-x-1 ${
                          isPositive ? 'text-success-600' : 'text-danger-600'
                        }`}>
                          {isPositive ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                          <span className="text-sm font-medium">
                            {isPositive ? '+' : ''}{data.changePercent.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-sm text-neutral-600 dark:text-dark-text-secondary">
                          Vol: {formatVolume(data.volume)}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-dark-text-tertiary">
                          Mkt Cap: {formatMarketCap(data.marketCap)}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Symbol Details */}
      {selectedData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="trading-panel"
        >
          <div className="trading-panel-header">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-dark-text-primary">
              {selectedSymbol} - {selectedData.name}
            </h3>
          </div>
          
          <div className="trading-panel-content">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-neutral-900 dark:text-dark-text-primary">
                  ${formatPrice(selectedData.price)}
                </p>
                <div className={`flex items-center justify-center space-x-1 mt-1 ${
                  selectedData.change >= 0 ? 'text-success-600' : 'text-danger-600'
                }`}>
                  {selectedData.change >= 0 ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  <span className="font-medium">
                    {selectedData.change >= 0 ? '+' : ''}${formatPrice(selectedData.change)} ({selectedData.change >= 0 ? '+' : ''}{selectedData.changePercent.toFixed(2)}%)
                  </span>
                </div>
              </div>
              
              <div className="text-center">
                <p className="text-sm text-neutral-600 dark:text-dark-text-secondary mb-1">High</p>
                <p className="text-lg font-semibold text-neutral-900 dark:text-dark-text-primary">
                  ${formatPrice(selectedData.high)}
                </p>
              </div>
              
              <div className="text-center">
                <p className="text-sm text-neutral-600 dark:text-dark-text-secondary mb-1">Low</p>
                <p className="text-lg font-semibold text-neutral-900 dark:text-dark-text-primary">
                  ${formatPrice(selectedData.low)}
                </p>
              </div>
              
              <div className="text-center">
                <p className="text-sm text-neutral-600 dark:text-dark-text-secondary mb-1">Volume</p>
                <p className="text-lg font-semibold text-neutral-900 dark:text-dark-text-primary">
                  {formatVolume(selectedData.volume)}
                </p>
              </div>
            </div>
            
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-neutral-50 dark:bg-dark-bg-tertiary rounded-lg">
                <p className="text-xs text-neutral-600 dark:text-dark-text-secondary mb-1">Open</p>
                <p className="font-semibold text-neutral-900 dark:text-dark-text-primary">
                  ${formatPrice(selectedData.open)}
                </p>
              </div>
              
              <div className="text-center p-3 bg-neutral-50 dark:bg-dark-bg-tertiary rounded-lg">
                <p className="text-xs text-neutral-600 dark:text-dark-text-secondary mb-1">Market Cap</p>
                <p className="font-semibold text-neutral-900 dark:text-dark-text-primary">
                  {formatMarketCap(selectedData.marketCap)}
                </p>
              </div>
              
              <div className="text-center p-3 bg-neutral-50 dark:bg-dark-bg-tertiary rounded-lg">
                <p className="text-xs text-neutral-600 dark:text-dark-text-secondary mb-1">P/E Ratio</p>
                <p className="font-semibold text-neutral-900 dark:text-dark-text-primary">
                  {selectedData.pe.toFixed(1)}
                </p>
              </div>
              
              <div className="text-center p-3 bg-neutral-50 dark:bg-dark-bg-tertiary rounded-lg">
                <p className="text-xs text-neutral-600 dark:text-dark-text-secondary mb-1">Last Update</p>
                <p className="font-semibold text-neutral-900 dark:text-dark-text-primary">
                  {lastUpdate.toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}