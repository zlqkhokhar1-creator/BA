// apps/web-portal/src/types/performance.ts

export interface PerformanceConfig {
  orderExecution: OrderExecutionConfig;
  marketData: MarketDataConfig;
  webVitals: WebVitalsConfig;
  monitoring: MonitoringConfig;
  circuitBreaker: CircuitBreakerConfig;
}

export interface OrderExecutionConfig {
  endpoints: string[];
  fallbackEndpoints: string[];
  connectionPoolSize: number;
  batchingWindow: number; // milliseconds
  maxBatchSize: number;
  timeoutMs: number;
  retryAttempts: number;
  exponentialBackoffBase: number;
  validationTimeout: number;
  priorityBypass: boolean;
}

export interface MarketDataConfig {
  endpoints: string[];
  subscriptionLimit: number;
  bufferSize: number;
  compressionEnabled: boolean;
  tickPrecision: number;
  cacheSize: number;
  throttleMs: number;
  integrityCheckEnabled: boolean;
}

export interface WebVitalsConfig {
  lcpThreshold: number; // milliseconds
  fidThreshold: number; // milliseconds
  clsThreshold: number;
  preloadCriticalResources: boolean;
  enableCodeSplitting: boolean;
  memoryLeakDetection: boolean;
  performanceBufferSize: number;
}

export interface MonitoringConfig {
  metricsCollectionInterval: number;
  latencyPercentiles: number[];
  alertThresholds: AlertThresholds;
  enableLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringWindow: number;
}

export interface AlertThresholds {
  latencyWarning: number;
  latencyError: number;
  connectionDropWarning: number;
  errorRateWarning: number;
  errorRateError: number;
}

// Order Execution Types
export interface OrderRequest {
  id: string;
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  side: 'buy' | 'sell';
  symbol: string;
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce: 'GTC' | 'IOC' | 'FOK' | 'DAY';
  clientOrderId: string;
  timestamp: number;
  priority: 'high' | 'normal' | 'low';
}

export interface OrderResponse {
  id: string;
  clientOrderId: string;
  status: 'pending' | 'filled' | 'partial' | 'cancelled' | 'rejected';
  fillQuantity?: number;
  fillPrice?: number;
  executionTime: number;
  latency: number;
  error?: string;
  timestamp: number;
}

export interface OrderExecution {
  request: OrderRequest;
  response?: OrderResponse;
  startTime: number;
  endTime?: number;
  latency?: number;
  retryCount: number;
  connectionId: string;
}

// Market Data Types
export interface MarketDataSubscription {
  id: string;
  symbol: string;
  type: 'quote' | 'trade' | 'book' | 'candle';
  depth?: number; // for order book
  interval?: string; // for candles
  isActive: boolean;
}

export interface Quote {
  symbol: string;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  timestamp: number;
}

export interface Trade {
  symbol: string;
  price: number;
  size: number;
  side: 'buy' | 'sell';
  timestamp: number;
  tradeId: string;
}

export interface OrderBookLevel {
  price: number;
  size: number;
  orderCount: number;
}

export interface OrderBook {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: number;
  sequence: number;
}

export interface MarketDataTick {
  symbol: string;
  type: 'quote' | 'trade' | 'book';
  data: Quote | Trade | OrderBook;
  timestamp: number;
  sequence: number;
}

// Performance Metrics Types
export interface LatencyMetrics {
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
  stdDev: number;
  count: number;
}

export interface ConnectionMetrics {
  id: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  uptime: number;
  messagesSent: number;
  messagesReceived: number;
  errors: number;
  lastError?: string;
  latency: LatencyMetrics;
}

export interface SystemMetrics {
  timestamp: number;
  orderExecution: {
    totalOrders: number;
    successfulOrders: number;
    failedOrders: number;
    avgLatency: number;
    p95Latency: number;
    throughput: number; // orders per second
  };
  marketData: {
    subscriptions: number;
    messagesProcessed: number;
    compressionRatio: number;
    bufferUtilization: number;
  };
  system: {
    memoryUsage: number;
    cpuUsage: number;
    networkLatency: number;
  };
  webVitals: {
    lcp: number;
    fid: number;
    cls: number;
    fcp: number;
    ttfb: number;
  };
}

// Circuit Breaker Types
export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime?: number;
  nextAttemptTime?: number;
  successCount: number;
}

// Connection Types
export interface WebSocketConnection {
  id: string;
  url: string;
  socket?: WebSocket;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastPingTime?: number;
  lastPongTime?: number;
  messageQueue: any[];
  priority: number;
  retryCount: number;
}

export interface ConnectionPool {
  connections: Map<string, WebSocketConnection>;
  activeConnection?: string;
  roundRobinIndex: number;
}

// Error Handling Types
export interface PerformanceError {
  code: string;
  message: string;
  timestamp: number;
  context?: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// Event Types
export interface PerformanceEvent {
  type: 'order_executed' | 'connection_lost' | 'latency_alert' | 'error' | 'metric_update' | 'performance_alert' | 'market_data_update' | 'quote_update' | 'trade_update' | 'orderbook_update' | 'market_data_connected' | 'market_data_disconnected' | 'connection_established' | 'circuit_breaker_opened' | 'failover_completed';
  data: any;
  timestamp: number;
  source: string;
}

// Hook Types
export interface UsePerformanceReturn {
  metrics: SystemMetrics | null;
  connections: ConnectionMetrics[];
  isHealthy: boolean;
  alerts: PerformanceError[];
  clearAlerts: () => void;
}

export interface UseOrderExecutionReturn {
  execute: (order: OrderRequest) => Promise<OrderResponse>;
  isExecuting: boolean;
  lastExecution: OrderExecution | null;
  queueSize: number;
  avgLatency: number;
}

export interface UseMarketDataReturn {
  subscribe: (subscription: MarketDataSubscription) => void;
  unsubscribe: (subscriptionId: string) => void;
  data: Map<string, MarketDataTick>;
  subscriptions: MarketDataSubscription[];
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
}

// Utility Types
export type PerformanceMeasurement = {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
};

export type CompressionResult = {
  compressed: Uint8Array;
  originalSize: number;
  compressedSize: number;
  ratio: number;
};

export type ValidationResult = {
  isValid: boolean;
  errors: string[];
  validationTime: number;
};