// apps/web-portal/src/components/trading/TradingDashboard.tsx

'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FixedSizeList as List } from 'react-window';
import { toast } from 'react-hot-toast';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import {
  OrderRequest,
  OrderResponse,
  Quote,
  Trade,
  OrderBook,
  MarketDataSubscription
} from '@/types/performance';
import {
  usePerformance,
  useOrderExecution,
  useMarketData,
  useWebVitals,
  useLatencyMonitoring,
  useConnectionHealth
} from '@/hooks/usePerformance';

interface TradingDashboardProps {
  className?: string;
  theme?: 'light' | 'dark';
}

interface Position {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  realizedPnL: number;
}

interface TradeHistoryItem {
  id: string;
  timestamp: number;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  status: string;
  latency: number;
}

const VIRTUAL_LIST_HEIGHT = 400;
const ITEM_HEIGHT = 40;

export const TradingDashboard: React.FC<TradingDashboardProps> = ({
  className = '',
  theme = 'dark'
}) => {
  // Performance monitoring hooks
  const { metrics, connections, isHealthy, alerts, clearAlerts } = usePerformance();
  const { execute, isExecuting, queueSize, avgLatency } = useOrderExecution();
  const { subscribe, unsubscribe, data, subscriptions, connectionStatus } = useMarketData();
  const { score: webVitalsScore } = useWebVitals();
  const { currentLatency, isHighLatency } = useLatencyMonitoring(10);
  const { healthStatus } = useConnectionHealth();

  // Trading state
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL');
  const [orderForm, setOrderForm] = useState({
    type: 'market' as 'market' | 'limit',
    side: 'buy' as 'buy' | 'sell',
    quantity: 100,
    price: 0,
    timeInForce: 'GTC' as 'GTC' | 'IOC' | 'FOK' | 'DAY'
  });
  const [positions, setPositions] = useState<Position[]>([]);
  const [tradeHistory, setTradeHistory] = useState<TradeHistoryItem[]>([]);
  const [watchlist, setWatchlist] = useState(['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN']);
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());

  // UI state
  const [activeTab, setActiveTab] = useState('orders');
  const [showPerformancePanel, setShowPerformancePanel] = useState(true);
  const [latencyHistory, setLatencyHistory] = useState<Array<{ time: number; latency: number }>>([]);

  // Refs for performance optimization
  const orderFormRef = useRef<HTMLFormElement>(null);
  const virtualListRef = useRef<List>(null);
  const latencyChartRef = useRef<any>(null);

  // Initialize market data subscriptions
  useEffect(() => {
    watchlist.forEach(symbol => {
      const subscription: MarketDataSubscription = {
        id: `quote_${symbol}`,
        symbol,
        type: 'quote',
        isActive: true
      };
      subscribe(subscription);
    });

    return () => {
      watchlist.forEach(symbol => {
        unsubscribe(`quote_${symbol}`);
      });
    };
  }, [watchlist, subscribe, unsubscribe]);

  // Update quotes from market data
  useEffect(() => {
    const newQuotes = new Map(quotes);
    
    data.forEach((tick, key) => {
      if (tick.type === 'quote') {
        const quote = tick.data as Quote;
        newQuotes.set(quote.symbol, quote);
      }
    });

    setQuotes(newQuotes);
  }, [data]);

  // Update latency history for performance chart
  useEffect(() => {
    if (currentLatency > 0) {
      setLatencyHistory(prev => {
        const newHistory = [...prev, { time: Date.now(), latency: currentLatency }];
        // Keep only last 100 points for performance
        return newHistory.slice(-100);
      });
    }
  }, [currentLatency]);

  // Form validation with <1ms target
  const validateOrderForm = useCallback((form: typeof orderForm): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (form.quantity <= 0) {
      errors.push('Quantity must be positive');
    }
    
    if (form.type === 'limit' && form.price <= 0) {
      errors.push('Price must be positive for limit orders');
    }
    
    if (form.quantity > 10000) {
      errors.push('Quantity exceeds maximum allowed');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }, []);

  // Ultra-fast order submission
  const handleOrderSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    const startTime = performance.now();
    const validation = validateOrderForm(orderForm);
    const validationTime = performance.now() - startTime;
    
    if (validationTime > 1) {
      console.warn(`Form validation took ${validationTime.toFixed(3)}ms`);
    }

    if (!validation.isValid) {
      validation.errors.forEach(error => toast.error(error));
      return;
    }

    const orderRequest: OrderRequest = {
      id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: orderForm.type,
      side: orderForm.side,
      symbol: selectedSymbol,
      quantity: orderForm.quantity,
      price: orderForm.type === 'limit' ? orderForm.price : undefined,
      timeInForce: orderForm.timeInForce,
      clientOrderId: `client_${Date.now()}`,
      timestamp: Date.now(),
      priority: orderForm.type === 'market' ? 'high' : 'normal'
    };

    try {
      const response = await execute(orderRequest);
      
      if (response.status === 'filled' || response.status === 'partial') {
        toast.success(`Order ${response.status}: ${response.fillQuantity}@${response.fillPrice}`);
        
        // Add to trade history
        const trade: TradeHistoryItem = {
          id: response.id,
          timestamp: response.timestamp,
          symbol: selectedSymbol,
          side: orderForm.side,
          quantity: response.fillQuantity || orderForm.quantity,
          price: response.fillPrice || orderForm.price || 0,
          status: response.status,
          latency: response.latency
        };
        
        setTradeHistory(prev => [trade, ...prev].slice(0, 1000)); // Keep last 1000 trades
        
        // Update positions
        updatePositions(trade);
        
      } else {
        toast.error(`Order ${response.status}: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      toast.error(`Order failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [orderForm, selectedSymbol, execute, validateOrderForm]);

  // Update positions efficiently
  const updatePositions = useCallback((trade: TradeHistoryItem) => {
    setPositions(prev => {
      const existingPosition = prev.find(p => p.symbol === trade.symbol);
      const quote = quotes.get(trade.symbol);
      const currentPrice = quote?.bid || trade.price;
      
      if (existingPosition) {
        const newQuantity = trade.side === 'buy' 
          ? existingPosition.quantity + trade.quantity
          : existingPosition.quantity - trade.quantity;
          
        const newAvgPrice = newQuantity !== 0
          ? ((existingPosition.avgPrice * existingPosition.quantity) + 
             (trade.price * (trade.side === 'buy' ? trade.quantity : -trade.quantity))) / newQuantity
          : 0;
          
        return prev.map(p => 
          p.symbol === trade.symbol
            ? {
                ...p,
                quantity: newQuantity,
                avgPrice: newAvgPrice,
                currentPrice,
                unrealizedPnL: (currentPrice - newAvgPrice) * newQuantity
              }
            : p
        );
      } else if (trade.quantity > 0) {
        const newPosition: Position = {
          symbol: trade.symbol,
          quantity: trade.side === 'buy' ? trade.quantity : -trade.quantity,
          avgPrice: trade.price,
          currentPrice,
          unrealizedPnL: (currentPrice - trade.price) * trade.quantity,
          realizedPnL: 0
        };
        
        return [...prev, newPosition];
      }
      
      return prev;
    });
  }, [quotes]);

  // Keyboard shortcuts for power users
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'Enter':
            e.preventDefault();
            if (orderFormRef.current) {
              orderFormRef.current.dispatchEvent(new Event('submit', { bubbles: true }));
            }
            break;
          case 'b':
            e.preventDefault();
            setOrderForm(prev => ({ ...prev, side: 'buy' }));
            break;
          case 's':
            e.preventDefault();
            setOrderForm(prev => ({ ...prev, side: 'sell' }));
            break;
          case 'm':
            e.preventDefault();
            setOrderForm(prev => ({ ...prev, type: 'market' }));
            break;
          case 'l':
            e.preventDefault();
            setOrderForm(prev => ({ ...prev, type: 'limit' }));
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Optimized trade history renderer for virtual scrolling
  const TradeHistoryRow = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const trade = tradeHistory[index];
    if (!trade) return null;

    const latencyColor = trade.latency < 5 ? 'text-green-400' : 
                        trade.latency < 10 ? 'text-yellow-400' : 'text-red-400';

    return (
      <div style={style} className="flex items-center px-4 border-b border-gray-700 hover:bg-gray-800 transition-colors duration-150">
        <div className="flex-1 text-sm">
          <span className="font-mono">{new Date(trade.timestamp).toLocaleTimeString()}</span>
        </div>
        <div className="flex-1 text-sm font-semibold">{trade.symbol}</div>
        <div className={`flex-1 text-sm ${trade.side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
          {trade.side.toUpperCase()}
        </div>
        <div className="flex-1 text-sm">{trade.quantity}</div>
        <div className="flex-1 text-sm">${trade.price.toFixed(2)}</div>
        <div className="flex-1 text-sm">
          <span className={`px-2 py-1 rounded text-xs ${
            trade.status === 'filled' ? 'bg-green-900 text-green-200' : 
            trade.status === 'partial' ? 'bg-yellow-900 text-yellow-200' : 
            'bg-red-900 text-red-200'
          }`}>
            {trade.status}
          </span>
        </div>
        <div className={`flex-1 text-sm ${latencyColor}`}>
          {trade.latency.toFixed(1)}ms
        </div>
      </div>
    );
  }, [tradeHistory]);

  // Memoized watchlist component for performance
  const WatchlistComponent = useMemo(() => (
    <div className="space-y-2">
      {watchlist.map(symbol => {
        const quote = quotes.get(symbol);
        const isSelected = symbol === selectedSymbol;
        
        return (
          <div
            key={symbol}
            className={`p-3 rounded cursor-pointer transition-colors duration-150 ${
              isSelected 
                ? 'bg-blue-900 border border-blue-600' 
                : 'bg-gray-800 hover:bg-gray-700 border border-gray-600'
            }`}
            onClick={() => setSelectedSymbol(symbol)}
          >
            <div className="flex justify-between items-center">
              <span className="font-semibold text-white">{symbol}</span>
              {quote && (
                <div className="text-right">
                  <div className="text-white font-mono">
                    ${quote.bid.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-400">
                    Spread: ${(quote.ask - quote.bid).toFixed(3)}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  ), [watchlist, quotes, selectedSymbol]);

  // Performance metrics panel
  const PerformancePanel = useMemo(() => (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">Performance Metrics</h3>
        <div className={`px-2 py-1 rounded text-sm ${
          isHealthy ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'
        }`}>
          {isHealthy ? 'Healthy' : 'Degraded'}
        </div>
      </div>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div className="bg-gray-800 p-3 rounded">
          <div className="text-xs text-gray-400">Avg Latency</div>
          <div className={`text-lg font-mono ${isHighLatency ? 'text-red-400' : 'text-green-400'}`}>
            {avgLatency.toFixed(1)}ms
          </div>
        </div>
        
        <div className="bg-gray-800 p-3 rounded">
          <div className="text-xs text-gray-400">Queue Size</div>
          <div className="text-lg font-mono text-white">{queueSize}</div>
        </div>
        
        <div className="bg-gray-800 p-3 rounded">
          <div className="text-xs text-gray-400">Web Vitals</div>
          <div className={`text-lg font-mono ${
            webVitalsScore > 75 ? 'text-green-400' : 
            webVitalsScore > 50 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {webVitalsScore.toFixed(0)}
          </div>
        </div>
        
        <div className="bg-gray-800 p-3 rounded">
          <div className="text-xs text-gray-400">Market Data</div>
          <div className={`text-lg font-mono ${
            connectionStatus === 'connected' ? 'text-green-400' : 'text-red-400'
          }`}>
            {connectionStatus}
          </div>
        </div>
      </div>

      {latencyHistory.length > 0 && (
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={latencyHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="time" 
                tickFormatter={(time) => new Date(time).toLocaleTimeString().split(':').slice(0, 2).join(':')}
                stroke="#9CA3AF"
                fontSize={10}
              />
              <YAxis stroke="#9CA3AF" fontSize={10} />
              <Tooltip 
                labelFormatter={(time) => new Date(time).toLocaleTimeString()}
                formatter={(value: number) => [`${value.toFixed(1)}ms`, 'Latency']}
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
              />
              <Line 
                type="monotone" 
                dataKey="latency" 
                stroke="#10B981" 
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  ), [isHealthy, avgLatency, isHighLatency, queueSize, webVitalsScore, connectionStatus, latencyHistory]);

  const themeClasses = theme === 'dark' 
    ? 'bg-gray-900 text-white border-gray-700' 
    : 'bg-white text-gray-900 border-gray-200';

  return (
    <div className={`min-h-screen ${themeClasses} ${className}`}>
      {/* Header with connection status */}
      <header className="border-b border-gray-700 p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Ultra-Fast Trading Dashboard</h1>
          
          <div className="flex items-center space-x-4">
            {/* Connection indicators */}
            <div className="flex space-x-2">
              {Object.entries(healthStatus).map(([id, status]) => (
                <div key={id} className="flex items-center space-x-1">
                  <div className={`w-2 h-2 rounded-full ${
                    status.status === 'connected' ? 'bg-green-400' : 'bg-red-400'
                  }`} />
                  <span className="text-xs text-gray-400">{id}</span>
                </div>
              ))}
            </div>
            
            {/* Performance toggle */}
            <button
              onClick={() => setShowPerformancePanel(!showPerformancePanel)}
              className="px-3 py-1 text-sm bg-gray-800 hover:bg-gray-700 rounded transition-colors duration-150"
            >
              Performance
            </button>
          </div>
        </div>
      </header>

      <div className="flex h-screen">
        {/* Sidebar - Watchlist */}
        <aside className="w-64 border-r border-gray-700 p-4">
          <h2 className="text-lg font-semibold mb-4">Watchlist</h2>
          {WatchlistComponent}
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col">
          {/* Performance panel */}
          {showPerformancePanel && (
            <div className="p-4 border-b border-gray-700">
              {PerformancePanel}
            </div>
          )}

          <div className="flex-1 flex">
            {/* Order form */}
            <section className="w-80 border-r border-gray-700 p-4">
              <h2 className="text-lg font-semibold mb-4">Quick Order - {selectedSymbol}</h2>
              
              <form ref={orderFormRef} onSubmit={handleOrderSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOrderForm(prev => ({ ...prev, side: 'buy' }))}
                    className={`py-2 px-4 rounded font-semibold transition-colors duration-150 ${
                      orderForm.side === 'buy' 
                        ? 'bg-green-600 text-white' 
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    BUY
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderForm(prev => ({ ...prev, side: 'sell' }))}
                    className={`py-2 px-4 rounded font-semibold transition-colors duration-150 ${
                      orderForm.side === 'sell' 
                        ? 'bg-red-600 text-white' 
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    SELL
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOrderForm(prev => ({ ...prev, type: 'market' }))}
                    className={`py-1 px-3 rounded text-sm transition-colors duration-150 ${
                      orderForm.type === 'market' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    Market
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderForm(prev => ({ ...prev, type: 'limit' }))}
                    className={`py-1 px-3 rounded text-sm transition-colors duration-150 ${
                      orderForm.type === 'limit' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    Limit
                  </button>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Quantity</label>
                  <input
                    type="number"
                    value={orderForm.quantity}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                    className="w-full p-2 bg-gray-800 border border-gray-600 rounded focus:border-blue-500 focus:outline-none font-mono"
                    min="1"
                    step="1"
                  />
                </div>

                {orderForm.type === 'limit' && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Price</label>
                    <input
                      type="number"
                      value={orderForm.price}
                      onChange={(e) => setOrderForm(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                      className="w-full p-2 bg-gray-800 border border-gray-600 rounded focus:border-blue-500 focus:outline-none font-mono"
                      min="0"
                      step="0.01"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isExecuting}
                  className={`w-full py-3 px-4 rounded font-semibold transition-colors duration-150 ${
                    isExecuting
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : orderForm.side === 'buy'
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  {isExecuting ? 'Executing...' : `${orderForm.side.toUpperCase()} ${selectedSymbol}`}
                </button>
              </form>

              <div className="mt-4 text-xs text-gray-400">
                <div>Shortcuts: Ctrl+Enter (Submit)</div>
                <div>Ctrl+B (Buy), Ctrl+S (Sell)</div>
                <div>Ctrl+M (Market), Ctrl+L (Limit)</div>
              </div>
            </section>

            {/* Trade history and positions */}
            <section className="flex-1 p-4">
              <div className="flex border-b border-gray-700 mb-4">
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`px-4 py-2 font-semibold transition-colors duration-150 ${
                    activeTab === 'orders' 
                      ? 'text-blue-400 border-b-2 border-blue-400' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Trade History ({tradeHistory.length})
                </button>
                <button
                  onClick={() => setActiveTab('positions')}
                  className={`px-4 py-2 font-semibold transition-colors duration-150 ${
                    activeTab === 'positions' 
                      ? 'text-blue-400 border-b-2 border-blue-400' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Positions ({positions.length})
                </button>
              </div>

              {activeTab === 'orders' && (
                <div>
                  {/* Trade history header */}
                  <div className="flex items-center px-4 py-2 bg-gray-800 border-b border-gray-700 text-sm text-gray-400 font-semibold">
                    <div className="flex-1">Time</div>
                    <div className="flex-1">Symbol</div>
                    <div className="flex-1">Side</div>
                    <div className="flex-1">Quantity</div>
                    <div className="flex-1">Price</div>
                    <div className="flex-1">Status</div>
                    <div className="flex-1">Latency</div>
                  </div>

                  {/* Virtual scrolling trade history */}
                  {tradeHistory.length > 0 ? (
                    <List
                      ref={virtualListRef}
                      height={VIRTUAL_LIST_HEIGHT}
                      width="100%"
                      itemCount={tradeHistory.length}
                      itemSize={ITEM_HEIGHT}
                      className="border border-gray-700 rounded"
                    >
                      {TradeHistoryRow}
                    </List>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No trades yet. Place your first order to get started.
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'positions' && (
                <div className="space-y-2">
                  {positions.length > 0 ? positions.map(position => (
                    <div key={position.symbol} className="p-4 bg-gray-800 border border-gray-600 rounded">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-semibold text-lg">{position.symbol}</span>
                          <div className="text-sm text-gray-400">
                            {position.quantity} shares @ ${position.avgPrice.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-lg">
                            ${position.currentPrice.toFixed(2)}
                          </div>
                          <div className={`text-sm ${
                            position.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {position.unrealizedPnL >= 0 ? '+' : ''}${position.unrealizedPnL.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-8 text-gray-500">
                      No open positions. Execute trades to build your portfolio.
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {alerts.slice(0, 3).map((alert, index) => (
            <div
              key={`${alert.code}_${alert.timestamp}`}
              className={`p-3 rounded shadow-lg max-w-sm ${
                alert.severity === 'critical' || alert.severity === 'high'
                  ? 'bg-red-900 border border-red-600 text-red-100'
                  : alert.severity === 'medium'
                  ? 'bg-yellow-900 border border-yellow-600 text-yellow-100'
                  : 'bg-blue-900 border border-blue-600 text-blue-100'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-sm">{alert.code}</div>
                  <div className="text-xs">{alert.message}</div>
                </div>
                <button
                  onClick={clearAlerts}
                  className="text-gray-400 hover:text-white ml-2"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TradingDashboard;