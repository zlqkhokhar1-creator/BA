// apps/web-portal/src/components/trading/TradingDashboard.tsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  getOrderExecutionSystem, 
  type OrderRequest, 
  type OrderResponse, 
  type LatencyMetrics, 
  type PerformanceMetrics,
  type ConnectionInfo 
} from '@/lib/performance/order-execution';
import { 
  getMarketDataStreamHandler, 
  type MarketTick, 
  type OrderBook, 
  type MarketDataSnapshot 
} from '@/lib/performance/market-data-stream';
import { 
  getWebVitalsOptimizer, 
  type WebVitalsMetrics 
} from '@/lib/performance/web-vitals-optimizer';

// Component interfaces
interface OrderFormData {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price?: number;
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  timeInForce: 'GTC' | 'IOC' | 'FOK' | 'GTD';
}

interface OrderDisplayData extends OrderResponse {
  formattedTime: string;
  statusColor: string;
}

// Custom hooks for performance optimization
const useOrderExecution = () => {
  const [orderSystem] = useState(() => getOrderExecutionSystem());
  const [isInitialized, setIsInitialized] = useState(false);
  const [latencyMetrics, setLatencyMetrics] = useState<LatencyMetrics>({
    current: 0, average: 0, p95: 0, p99: 0, min: 0, max: 0
  });
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    latency: latencyMetrics,
    throughput: 0,
    errorRate: 0,
    connectionUptime: 0,
    batchEfficiency: 0
  });

  useEffect(() => {
    const initialize = async () => {
      try {
        await orderSystem.initialize();
        setIsInitialized(true);
        
        // Set up latency monitoring
        orderSystem.onLatencyUpdate((metrics) => {
          setLatencyMetrics(metrics);
        });
      } catch (error) {
        console.error('Failed to initialize order system:', error);
      }
    };

    initialize();

    // Update performance metrics periodically
    const metricsInterval = setInterval(() => {
      if (isInitialized) {
        const metrics = orderSystem.getPerformanceMetrics();
        setPerformanceMetrics(metrics);
      }
    }, 1000);

    return () => {
      clearInterval(metricsInterval);
    };
  }, [orderSystem]);

  const executeOrder = useCallback(async (orderData: OrderFormData): Promise<OrderResponse> => {
    if (!isInitialized) {
      throw new Error('Order system not initialized');
    }
    
    return orderSystem.executeOrder(orderData);
  }, [orderSystem, isInitialized]);

  const getConnectionInfo = useCallback((): ConnectionInfo[] => {
    return orderSystem.getConnectionInfo();
  }, [orderSystem]);

  return {
    executeOrder,
    getConnectionInfo,
    isInitialized,
    latencyMetrics,
    performanceMetrics
  };
};

const useMarketData = () => {
  const [marketDataHandler] = useState(() => getMarketDataStreamHandler());
  const [isInitialized, setIsInitialized] = useState(false);
  const [marketData, setMarketData] = useState<Record<string, MarketDataSnapshot>>({});
  const [orderBooks, setOrderBooks] = useState<Record<string, OrderBook>>({});
  const [recentTicks, setRecentTicks] = useState<MarketTick[]>([]);

  useEffect(() => {
    const initialize = async () => {
      try {
        await marketDataHandler.initialize();
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize market data handler:', error);
      }
    };

    initialize();

    return () => {
      marketDataHandler.destroy();
    };
  }, [marketDataHandler]);

  const subscribeToSymbol = useCallback((symbol: string) => {
    if (!isInitialized) return;

    // Subscribe to ticks
    marketDataHandler.subscribe(symbol, 'ticks', (tick: MarketTick) => {
      setRecentTicks(prev => [...prev.slice(-99), tick]); // Keep last 100 ticks
    });

    // Subscribe to snapshots
    marketDataHandler.subscribe(symbol, 'snapshot', (snapshot: MarketDataSnapshot) => {
      setMarketData(prev => ({ ...prev, [symbol]: snapshot }));
    });

    // Subscribe to order book
    marketDataHandler.subscribe(symbol, 'orderbook', (orderBook: OrderBook) => {
      setOrderBooks(prev => ({ ...prev, [symbol]: orderBook }));
    });
  }, [marketDataHandler, isInitialized]);

  return {
    marketData,
    orderBooks,
    recentTicks,
    subscribeToSymbol,
    isInitialized
  };
};

const useWebVitals = () => {
  const [webVitalsOptimizer] = useState(() => getWebVitalsOptimizer());
  const [webVitals, setWebVitals] = useState<WebVitalsMetrics>({
    lcp: 0, fid: 0, cls: 0, tti: 0, fcp: 0, ttfb: 0
  });

  useEffect(() => {
    webVitalsOptimizer.initialize();
    
    webVitalsOptimizer.onMetricsUpdate((metrics) => {
      setWebVitals(metrics);
    });

    return () => {
      webVitalsOptimizer.destroy();
    };
  }, [webVitalsOptimizer]);

  return { webVitals };
};

// Performance-optimized components
const OrderForm: React.FC<{
  onSubmit: (order: OrderFormData) => Promise<void>;
  isSubmitting: boolean;
}> = ({ onSubmit, isSubmitting }) => {
  const [formData, setFormData] = useState<OrderFormData>({
    symbol: 'AAPL',
    side: 'buy',
    quantity: 100,
    type: 'market',
    timeInForce: 'GTC'
  });
  
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Real-time validation for instant feedback
  const validateForm = useCallback((data: OrderFormData): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    if (!data.symbol || data.symbol.length === 0) {
      errors.symbol = 'Symbol is required';
    }
    
    if (data.quantity <= 0) {
      errors.quantity = 'Quantity must be positive';
    }
    
    if (data.type === 'limit' && (!data.price || data.price <= 0)) {
      errors.price = 'Price is required for limit orders';
    }
    
    return errors;
  }, []);

  const handleInputChange = useCallback((field: keyof OrderFormData, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Instant validation
      const errors = validateForm(updated);
      setValidationErrors(errors);
      
      return updated;
    });
  }, [validateForm]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors = validateForm(formData);
    setValidationErrors(errors);
    
    if (Object.keys(errors).length === 0) {
      await onSubmit(formData);
    }
  }, [formData, validateForm, onSubmit]);

  return (
    <form onSubmit={handleSubmit} className="order-form">
      <div className="form-group">
        <label htmlFor="symbol">Symbol:</label>
        <input
          id="symbol"
          type="text"
          value={formData.symbol}
          onChange={(e) => handleInputChange('symbol', e.target.value.toUpperCase())}
          placeholder="AAPL"
          className={validationErrors.symbol ? 'error' : ''}
        />
        {validationErrors.symbol && <span className="error-message">{validationErrors.symbol}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="side">Side:</label>
        <select
          id="side"
          value={formData.side}
          onChange={(e) => handleInputChange('side', e.target.value as 'buy' | 'sell')}
        >
          <option value="buy">Buy</option>
          <option value="sell">Sell</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="quantity">Quantity:</label>
        <input
          id="quantity"
          type="number"
          value={formData.quantity}
          onChange={(e) => handleInputChange('quantity', parseInt(e.target.value) || 0)}
          min="1"
          className={validationErrors.quantity ? 'error' : ''}
        />
        {validationErrors.quantity && <span className="error-message">{validationErrors.quantity}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="type">Order Type:</label>
        <select
          id="type"
          value={formData.type}
          onChange={(e) => handleInputChange('type', e.target.value as OrderFormData['type'])}
        >
          <option value="market">Market</option>
          <option value="limit">Limit</option>
          <option value="stop">Stop</option>
          <option value="stop_limit">Stop Limit</option>
        </select>
      </div>

      {(formData.type === 'limit' || formData.type === 'stop_limit') && (
        <div className="form-group">
          <label htmlFor="price">Price:</label>
          <input
            id="price"
            type="number"
            value={formData.price || ''}
            onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || undefined)}
            step="0.01"
            min="0.01"
            className={validationErrors.price ? 'error' : ''}
          />
          {validationErrors.price && <span className="error-message">{validationErrors.price}</span>}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="timeInForce">Time in Force:</label>
        <select
          id="timeInForce"
          value={formData.timeInForce}
          onChange={(e) => handleInputChange('timeInForce', e.target.value as OrderFormData['timeInForce'])}
        >
          <option value="GTC">Good Till Cancelled</option>
          <option value="IOC">Immediate or Cancel</option>
          <option value="FOK">Fill or Kill</option>
          <option value="GTD">Good Till Date</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={isSubmitting || Object.keys(validationErrors).length > 0}
        className={`submit-button ${formData.side}`}
      >
        {isSubmitting ? 'Processing...' : `${formData.side.toUpperCase()} ${formData.symbol}`}
      </button>
    </form>
  );
};

const MarketDataDisplay: React.FC<{
  marketData: Record<string, MarketDataSnapshot>;
  orderBooks: Record<string, OrderBook>;
  symbol: string;
}> = ({ marketData, orderBooks, symbol }) => {
  const snapshot = marketData[symbol];
  const orderBook = orderBooks[symbol];

  if (!snapshot) {
    return <div className="market-data-placeholder">Loading market data...</div>;
  }

  return (
    <div className="market-data-display">
      <div className="price-info">
        <h3>{symbol}</h3>
        <div className="price-main">${snapshot.lastPrice.toFixed(2)}</div>
        <div className={`price-change ${snapshot.change24h >= 0 ? 'positive' : 'negative'}`}>
          {snapshot.change24h >= 0 ? '+' : ''}{snapshot.change24h.toFixed(2)} ({snapshot.changePercent24h.toFixed(2)}%)
        </div>
      </div>

      <div className="market-stats">
        <div className="stat">
          <label>Bid:</label>
          <span>${snapshot.bidPrice.toFixed(2)}</span>
        </div>
        <div className="stat">
          <label>Ask:</label>
          <span>${snapshot.askPrice.toFixed(2)}</span>
        </div>
        <div className="stat">
          <label>Volume:</label>
          <span>{snapshot.volume24h.toLocaleString()}</span>
        </div>
        <div className="stat">
          <label>High:</label>
          <span>${snapshot.high24h.toFixed(2)}</span>
        </div>
        <div className="stat">
          <label>Low:</label>
          <span>${snapshot.low24h.toFixed(2)}</span>
        </div>
      </div>

      {orderBook && (
        <div className="order-book">
          <h4>Order Book</h4>
          <div className="order-book-content">
            <div className="asks">
              <h5>Asks</h5>
              {orderBook.asks.slice(0, 5).map((level, index) => (
                <div key={index} className="order-level ask">
                  <span className="price">${level.price.toFixed(2)}</span>
                  <span className="quantity">{level.quantity}</span>
                </div>
              ))}
            </div>
            <div className="bids">
              <h5>Bids</h5>
              {orderBook.bids.slice(0, 5).map((level, index) => (
                <div key={index} className="order-level bid">
                  <span className="price">${level.price.toFixed(2)}</span>
                  <span className="quantity">{level.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PerformanceMetricsDisplay: React.FC<{
  latencyMetrics: LatencyMetrics;
  performanceMetrics: PerformanceMetrics;
  webVitals: WebVitalsMetrics;
  connectionInfo: ConnectionInfo[];
}> = ({ latencyMetrics, performanceMetrics, webVitals, connectionInfo }) => {
  const connectedCount = connectionInfo.filter(conn => conn.state === 'connected').length;
  
  return (
    <div className="performance-metrics">
      <h4>Performance Metrics</h4>
      
      <div className="metrics-section">
        <h5>Order Execution</h5>
        <div className="metric-grid">
          <div className="metric">
            <label>Current Latency:</label>
            <span className={latencyMetrics.current > 10 ? 'warning' : 'good'}>
              {latencyMetrics.current.toFixed(2)}ms
            </span>
          </div>
          <div className="metric">
            <label>95th Percentile:</label>
            <span className={latencyMetrics.p95 > 10 ? 'warning' : 'good'}>
              {latencyMetrics.p95.toFixed(2)}ms
            </span>
          </div>
          <div className="metric">
            <label>Throughput:</label>
            <span>{performanceMetrics.throughput.toFixed(1)}/s</span>
          </div>
          <div className="metric">
            <label>Error Rate:</label>
            <span className={performanceMetrics.errorRate > 0.01 ? 'warning' : 'good'}>
              {(performanceMetrics.errorRate * 100).toFixed(3)}%
            </span>
          </div>
        </div>
      </div>

      <div className="metrics-section">
        <h5>Connection Status</h5>
        <div className="connection-status">
          <span className={connectedCount > 0 ? 'connected' : 'disconnected'}>
            {connectedCount}/{connectionInfo.length} Connected
          </span>
          <span>Uptime: {(performanceMetrics.connectionUptime * 100).toFixed(1)}%</span>
        </div>
      </div>

      <div className="metrics-section">
        <h5>Web Vitals</h5>
        <div className="metric-grid">
          <div className="metric">
            <label>LCP:</label>
            <span className={webVitals.lcp > 2500 ? 'warning' : 'good'}>
              {(webVitals.lcp / 1000).toFixed(2)}s
            </span>
          </div>
          <div className="metric">
            <label>FID:</label>
            <span className={webVitals.fid > 100 ? 'warning' : 'good'}>
              {webVitals.fid.toFixed(1)}ms
            </span>
          </div>
          <div className="metric">
            <label>CLS:</label>
            <span className={webVitals.cls > 0.1 ? 'warning' : 'good'}>
              {webVitals.cls.toFixed(3)}
            </span>
          </div>
          <div className="metric">
            <label>TTI:</label>
            <span className={webVitals.tti > 3500 ? 'warning' : 'good'}>
              {(webVitals.tti / 1000).toFixed(2)}s
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const OrderHistory: React.FC<{
  orders: OrderDisplayData[];
}> = ({ orders }) => {
  return (
    <div className="order-history">
      <h4>Recent Orders</h4>
      <div className="orders-list">
        {orders.length === 0 ? (
          <div className="no-orders">No orders yet</div>
        ) : (
          orders.slice(-10).reverse().map((order) => (
            <div key={order.id} className={`order-item ${order.status}`}>
              <div className="order-header">
                <span className="order-id">{order.id.slice(-8)}</span>
                <span className={`order-status ${order.statusColor}`}>
                  {order.status.toUpperCase()}
                </span>
                <span className="order-time">{order.formattedTime}</span>
              </div>
              <div className="order-details">
                <span>Latency: {order.latency.toFixed(2)}ms</span>
                {order.fillPrice && <span>Fill: ${order.fillPrice.toFixed(2)}</span>}
                {order.fillQuantity && <span>Qty: {order.fillQuantity}</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Main Trading Dashboard Component
export const TradingDashboard: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL');
  const [orders, setOrders] = useState<OrderDisplayData[]>([]);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Custom hooks
  const { executeOrder, getConnectionInfo, isInitialized: orderSystemReady, latencyMetrics, performanceMetrics } = useOrderExecution();
  const { marketData, orderBooks, subscribeToSymbol, isInitialized: marketDataReady } = useMarketData();
  const { webVitals } = useWebVitals();

  // Subscribe to market data for selected symbol
  useEffect(() => {
    if (marketDataReady) {
      subscribeToSymbol(selectedSymbol);
    }
  }, [selectedSymbol, marketDataReady, subscribeToSymbol]);

  // Handle order submission
  const handleOrderSubmit = useCallback(async (orderData: OrderFormData) => {
    if (!orderSystemReady) {
      setErrorMessage('Order system not ready');
      return;
    }

    setIsSubmittingOrder(true);
    setErrorMessage(null);

    try {
      const response = await executeOrder(orderData);
      
      // Add to order history
      const displayOrder: OrderDisplayData = {
        ...response,
        formattedTime: new Date(response.timestamp).toLocaleTimeString(),
        statusColor: response.status === 'filled' ? 'good' : 
                    response.status === 'rejected' ? 'error' : 'warning'
      };
      
      setOrders(prev => [...prev, displayOrder]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to execute order');
      console.error('Order execution failed:', error);
    } finally {
      setIsSubmittingOrder(false);
    }
  }, [orderSystemReady, executeOrder]);

  // Connection info for performance display
  const connectionInfo = useMemo(() => {
    return orderSystemReady ? getConnectionInfo() : [];
  }, [orderSystemReady, getConnectionInfo]);

  // Error handling for system initialization
  if (!orderSystemReady || !marketDataReady) {
    return (
      <div className="trading-dashboard loading">
        <div className="loading-message">
          <h2>Initializing Trading Systems...</h2>
          <div className="system-status">
            <div className={orderSystemReady ? 'ready' : 'loading'}>
              Order Execution System: {orderSystemReady ? 'Ready' : 'Initializing...'}
            </div>
            <div className={marketDataReady ? 'ready' : 'loading'}>
              Market Data Stream: {marketDataReady ? 'Ready' : 'Initializing...'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="trading-dashboard">
      {/* Header with symbol selector */}
      <header className="dashboard-header">
        <h1>High-Performance Trading Dashboard</h1>
        <div className="symbol-selector">
          <label htmlFor="symbol-select">Symbol:</label>
          <select
            id="symbol-select"
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
          >
            <option value="AAPL">AAPL</option>
            <option value="GOOGL">GOOGL</option>
            <option value="MSFT">MSFT</option>
            <option value="TSLA">TSLA</option>
            <option value="AMZN">AMZN</option>
          </select>
        </div>
      </header>

      {/* Main content grid */}
      <div className="dashboard-grid">
        {/* Order form */}
        <section className="order-section">
          <h2>Place Order</h2>
          {errorMessage && (
            <div className="error-banner">
              {errorMessage}
              <button onClick={() => setErrorMessage(null)}>×</button>
            </div>
          )}
          <OrderForm onSubmit={handleOrderSubmit} isSubmitting={isSubmittingOrder} />
        </section>

        {/* Market data */}
        <section className="market-data-section">
          <MarketDataDisplay
            marketData={marketData}
            orderBooks={orderBooks}
            symbol={selectedSymbol}
          />
        </section>

        {/* Performance metrics */}
        <section className="performance-section">
          <PerformanceMetricsDisplay
            latencyMetrics={latencyMetrics}
            performanceMetrics={performanceMetrics}
            webVitals={webVitals}
            connectionInfo={connectionInfo}
          />
        </section>

        {/* Order history */}
        <section className="history-section">
          <OrderHistory orders={orders} />
        </section>
      </div>

      {/* Inline CSS for performance (critical CSS) */}
      <style jsx>{`
        .trading-dashboard {
          display: grid;
          grid-template-rows: auto 1fr;
          height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #f8f9fa;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 2rem;
          background: white;
          border-bottom: 1px solid #e9ecef;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: 350px 1fr 300px;
          grid-template-rows: 1fr 1fr;
          grid-template-areas: 
            "order market performance"
            "order history performance";
          gap: 1rem;
          padding: 1rem;
          overflow: hidden;
        }

        .order-section { grid-area: order; }
        .market-data-section { grid-area: market; }
        .performance-section { grid-area: performance; }
        .history-section { grid-area: history; }

        .order-section, .market-data-section, .performance-section, .history-section {
          background: white;
          border-radius: 8px;
          padding: 1.5rem;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          overflow-y: auto;
        }

        .order-form .form-group {
          margin-bottom: 1rem;
        }

        .order-form label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 600;
        }

        .order-form input, .order-form select {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 1rem;
        }

        .order-form input.error {
          border-color: #dc3545;
        }

        .error-message {
          color: #dc3545;
          font-size: 0.875rem;
          margin-top: 0.25rem;
        }

        .submit-button {
          width: 100%;
          padding: 1rem;
          border: none;
          border-radius: 4px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .submit-button.buy {
          background: #28a745;
          color: white;
        }

        .submit-button.sell {
          background: #dc3545;
          color: white;
        }

        .submit-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .market-data-display .price-main {
          font-size: 2rem;
          font-weight: 700;
          margin: 0.5rem 0;
        }

        .price-change.positive { color: #28a745; }
        .price-change.negative { color: #dc3545; }

        .market-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
          margin: 1rem 0;
        }

        .stat {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem;
          background: #f8f9fa;
          border-radius: 4px;
        }

        .order-book-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .order-level {
          display: flex;
          justify-content: space-between;
          padding: 0.25rem;
          font-family: monospace;
        }

        .order-level.ask { background: #ffe6e6; }
        .order-level.bid { background: #e6ffe6; }

        .metric-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
        }

        .metric {
          display: flex;
          flex-direction: column;
          padding: 0.5rem;
          background: #f8f9fa;
          border-radius: 4px;
        }

        .metric label {
          font-size: 0.875rem;
          color: #666;
        }

        .metric span.good { color: #28a745; }
        .metric span.warning { color: #fd7e14; }
        .metric span.error { color: #dc3545; }

        .connection-status {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem;
          background: #f8f9fa;
          border-radius: 4px;
        }

        .connection-status .connected { color: #28a745; }
        .connection-status .disconnected { color: #dc3545; }

        .order-item {
          border: 1px solid #e9ecef;
          border-radius: 4px;
          padding: 0.75rem;
          margin-bottom: 0.5rem;
        }

        .order-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }

        .order-details {
          font-size: 0.875rem;
          color: #666;
          display: flex;
          gap: 1rem;
        }

        .loading-message {
          text-align: center;
          padding: 3rem;
        }

        .system-status div {
          margin: 0.5rem 0;
          padding: 0.5rem;
          border-radius: 4px;
        }

        .system-status .ready {
          background: #d4edda;
          color: #155724;
        }

        .system-status .loading {
          background: #fff3cd;
          color: #856404;
        }

        @media (max-width: 768px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
            grid-template-areas: 
              "order"
              "market"
              "performance"
              "history";
          }
        }
      `}</style>
    </div>
  );
};

export default TradingDashboard;