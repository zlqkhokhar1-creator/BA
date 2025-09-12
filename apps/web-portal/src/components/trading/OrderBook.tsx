'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Clock,
  DollarSign,
  BarChart3
} from 'lucide-react';

interface OrderBookProps {
  symbol: string;
}

interface OrderBookEntry {
  price: number;
  size: number;
  count: number;
  total: number;
}

interface OrderBookData {
  symbol: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  timestamp: Date;
  spread: number;
  midPrice: number;
}

export function OrderBook({ symbol }: OrderBookProps) {
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Generate mock order book data
    const generateOrderBook = () => {
      const basePrice = 150 + (Math.random() - 0.5) * 10;
      const bids: OrderBookEntry[] = [];
      const asks: OrderBookEntry[] = [];
      
      let bidTotal = 0;
      let askTotal = 0;
      
      // Generate bids (descending prices)
      for (let i = 0; i < 10; i++) {
        const price = basePrice - (i * 0.1) - Math.random() * 0.05;
        const size = Math.floor(Math.random() * 1000) + 100;
        const count = Math.floor(Math.random() * 20) + 1;
        bidTotal += size;
        
        bids.push({
          price,
          size,
          count,
          total: bidTotal
        });
      }
      
      // Generate asks (ascending prices)
      for (let i = 0; i < 10; i++) {
        const price = basePrice + (i * 0.1) + Math.random() * 0.05;
        const size = Math.floor(Math.random() * 1000) + 100;
        const count = Math.floor(Math.random() * 20) + 1;
        askTotal += size;
        
        asks.push({
          price,
          size,
          count,
          total: askTotal
        });
      }
      
      const bestBid = bids[0].price;
      const bestAsk = asks[0].price;
      const spread = bestAsk - bestBid;
      const midPrice = (bestBid + bestAsk) / 2;
      
      return {
        symbol,
        bids: bids.reverse(), // Show highest bid first
        asks,
        timestamp: new Date(),
        spread,
        midPrice
      };
    };

    const initialData = generateOrderBook();
    setOrderBook(initialData);

    // Update order book periodically
    const interval = setInterval(() => {
      setOrderBook(generateOrderBook());
    }, 2000);

    return () => clearInterval(interval);
  }, [symbol]);

  const formatPrice = (price: number) => {
    return price.toFixed(2);
  };

  const formatSize = (size: number) => {
    if (size >= 1000) {
      return `${(size / 1000).toFixed(1)}K`;
    }
    return size.toString();
  };

  const getSizeColor = (size: number, maxSize: number) => {
    const intensity = Math.min(size / maxSize, 1);
    return `rgba(34, 197, 94, ${intensity * 0.3})`;
  };

  if (isLoading) {
    return (
      <div className="trading-panel">
        <div className="trading-panel-header">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-dark-text-primary">
            Order Book - {symbol}
          </h3>
        </div>
        <div className="trading-panel-content">
          <div className="animate-pulse space-y-2">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="w-20 h-4 bg-neutral-200 dark:bg-dark-bg-tertiary rounded"></div>
                <div className="w-16 h-4 bg-neutral-200 dark:bg-dark-bg-tertiary rounded"></div>
                <div className="w-12 h-4 bg-neutral-200 dark:bg-dark-bg-tertiary rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!orderBook) return null;

  const maxBidSize = Math.max(...orderBook.bids.map(b => b.size));
  const maxAskSize = Math.max(...orderBook.asks.map(a => a.size));

  return (
    <div className="trading-panel">
      <div className="trading-panel-header">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-dark-text-primary">
            Order Book - {symbol}
          </h3>
          <div className="flex items-center space-x-2 text-xs text-neutral-500 dark:text-dark-text-tertiary">
            <Clock className="w-3 h-3" />
            <span>{orderBook.timestamp.toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      <div className="trading-panel-content">
        {/* Spread and Mid Price */}
        <div className="mb-4 p-3 bg-neutral-50 dark:bg-dark-bg-tertiary rounded-lg">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-neutral-500 dark:text-dark-text-tertiary mb-1">Best Bid</p>
              <p className="text-lg font-bold text-success-600">
                ${formatPrice(orderBook.bids[0]?.price || 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 dark:text-dark-text-tertiary mb-1">Spread</p>
              <p className="text-lg font-bold text-neutral-900 dark:text-dark-text-primary">
                ${formatPrice(orderBook.spread)}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 dark:text-dark-text-tertiary mb-1">Best Ask</p>
              <p className="text-lg font-bold text-danger-600">
                ${formatPrice(orderBook.asks[0]?.price || 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Order Book Table */}
        <div className="space-y-1">
          {/* Header */}
          <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-neutral-500 dark:text-dark-text-tertiary uppercase tracking-wider pb-2 border-b border-neutral-200 dark:border-dark-border">
            <div className="text-right">Price</div>
            <div className="text-right">Size</div>
            <div className="text-right">Count</div>
            <div className="text-right">Total</div>
          </div>

          {/* Asks (Sell Orders) - Red */}
          <div className="space-y-1">
            {orderBook.asks.slice(0, 8).map((ask, index) => (
              <motion.div
                key={`ask-${index}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.02 }}
                className="grid grid-cols-4 gap-2 text-sm hover:bg-neutral-50 dark:hover:bg-dark-bg-tertiary rounded px-2 py-1 cursor-pointer group"
                style={{
                  background: `linear-gradient(90deg, ${getSizeColor(ask.size, maxAskSize)} 0%, transparent 100%)`
                }}
              >
                <div className="text-right text-danger-600 font-mono">
                  ${formatPrice(ask.price)}
                </div>
                <div className="text-right text-neutral-900 dark:text-dark-text-primary font-mono">
                  {formatSize(ask.size)}
                </div>
                <div className="text-right text-neutral-600 dark:text-dark-text-secondary font-mono">
                  {ask.count}
                </div>
                <div className="text-right text-neutral-600 dark:text-dark-text-secondary font-mono">
                  {formatSize(ask.total)}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Mid Price Separator */}
          <div className="my-2 border-t border-neutral-300 dark:border-dark-border relative">
            <div className="absolute left-1/2 transform -translate-x-1/2 -top-2 bg-white dark:bg-dark-bg-secondary px-2">
              <span className="text-xs text-neutral-500 dark:text-dark-text-tertiary font-mono">
                ${formatPrice(orderBook.midPrice)}
              </span>
            </div>
          </div>

          {/* Bids (Buy Orders) - Green */}
          <div className="space-y-1">
            {orderBook.bids.slice(0, 8).map((bid, index) => (
              <motion.div
                key={`bid-${index}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.02 }}
                className="grid grid-cols-4 gap-2 text-sm hover:bg-neutral-50 dark:hover:bg-dark-bg-tertiary rounded px-2 py-1 cursor-pointer group"
                style={{
                  background: `linear-gradient(90deg, ${getSizeColor(bid.size, maxBidSize)} 0%, transparent 100%)`
                }}
              >
                <div className="text-right text-success-600 font-mono">
                  ${formatPrice(bid.price)}
                </div>
                <div className="text-right text-neutral-900 dark:text-dark-text-primary font-mono">
                  {formatSize(bid.size)}
                </div>
                <div className="text-right text-neutral-600 dark:text-dark-text-secondary font-mono">
                  {bid.count}
                </div>
                <div className="text-right text-neutral-600 dark:text-dark-text-secondary font-mono">
                  {formatSize(bid.total)}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Order Book Stats */}
        <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-dark-border">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="text-center">
              <p className="text-neutral-500 dark:text-dark-text-tertiary mb-1">Total Bids</p>
              <p className="font-semibold text-success-600">
                {formatSize(orderBook.bids.reduce((sum, bid) => sum + bid.size, 0))}
              </p>
            </div>
            <div className="text-center">
              <p className="text-neutral-500 dark:text-dark-text-tertiary mb-1">Total Asks</p>
              <p className="font-semibold text-danger-600">
                {formatSize(orderBook.asks.reduce((sum, ask) => sum + ask.size, 0))}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}