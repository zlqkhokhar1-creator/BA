// apps/web-portal/src/lib/performance/market-data-stream.ts

import {
  MarketDataSubscription,
  MarketDataTick,
  Quote,
  Trade,
  OrderBook,
  OrderBookLevel,
  ConnectionMetrics,
  PerformanceEvent,
  PerformanceError
} from '@/types/performance';
import { marketDataConfig, featureFlags } from '@/config/performance';
import {
  CircularBuffer,
  CompressionUtils,
  LatencyCalculator,
  ValidationUtils,
  ConnectionHealthChecker,
  throttle,
  performanceMeasurer
} from './utils';

export class MarketDataStreamHandler {
  private websocket: WebSocket | null = null;
  private subscriptions: Map<string, MarketDataSubscription> = new Map();
  private dataBuffer: CircularBuffer<MarketDataTick>;
  private orderBooks: Map<string, OrderBook> = new Map();
  private quotes: Map<string, Quote> = new Map();
  private trades: CircularBuffer<Trade>;
  private latencyCalculator: LatencyCalculator;
  private healthChecker: ConnectionHealthChecker | null = null;
  private eventListeners: Map<string, (event: PerformanceEvent) => void> = new Map();
  private performanceAlerts: CircularBuffer<PerformanceError>;
  private connectionMetrics: ConnectionMetrics;
  private lastSequence: number = 0;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private processedMessages: number = 0;
  private compressionStats = {
    totalMessages: 0,
    compressedMessages: 0,
    totalCompressionRatio: 0
  };

  // Throttled methods for performance
  private throttledEmitEvent: (type: string, data: any) => void;
  private throttledUpdateMetrics: () => void;

  constructor(private endpoints: string[] = marketDataConfig.endpoints) {
    this.dataBuffer = new CircularBuffer<MarketDataTick>(marketDataConfig.bufferSize);
    this.trades = new CircularBuffer<Trade>(marketDataConfig.cacheSize);
    this.latencyCalculator = new LatencyCalculator(1000);
    this.performanceAlerts = new CircularBuffer<PerformanceError>(100);
    
    this.connectionMetrics = {
      id: 'market_data',
      status: 'disconnected',
      uptime: 0,
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0,
      latency: {
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        p95: 0,
        p99: 0,
        stdDev: 0,
        count: 0
      }
    };

    // Create throttled methods
    this.throttledEmitEvent = throttle(this.emitEvent.bind(this), marketDataConfig.throttleMs);
    this.throttledUpdateMetrics = throttle(this.updateConnectionMetrics.bind(this), 1000);

    this.connect();
    this.startPerformanceMonitoring();
  }

  // Establish WebSocket connection with failover
  private async connect(): Promise<void> {
    if (this.websocket?.readyState === WebSocket.CONNECTING || 
        this.websocket?.readyState === WebSocket.OPEN) {
      return;
    }

    const endpoint = this.endpoints[this.reconnectAttempts % this.endpoints.length];
    
    try {
      performanceMeasurer.start('market_data_connection');
      
      this.websocket = new WebSocket(endpoint);
      
      // Binary protocol optimization
      if (featureFlags.enableBinaryProtocol) {
        this.websocket.binaryType = 'arraybuffer';
      }

      this.websocket.onopen = this.handleOpen.bind(this);
      this.websocket.onmessage = this.handleMessage.bind(this);
      this.websocket.onclose = this.handleClose.bind(this);
      this.websocket.onerror = this.handleError.bind(this);

    } catch (error) {
      this.recordError('connection_error', error);
      this.scheduleReconnect();
    }
  }

  private handleOpen(): void {
    const connectionTime = performanceMeasurer.end('market_data_connection');
    
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.connectionMetrics.status = 'connected';
    this.connectionMetrics.uptime = Date.now();
    
    console.log(`Market data connection established in ${connectionTime}ms`);
    
    // Start health monitoring
    if (this.websocket) {
      this.healthChecker = new ConnectionHealthChecker();
      this.healthChecker.startHealthCheck(
        this.websocket,
        (isHealthy) => this.handleHealthChange(isHealthy)
      );
    }

    // Resubscribe to all active subscriptions
    this.resubscribeAll();
    
    this.emitEvent('market_data_connected', { 
      endpoint: this.websocket?.url,
      connectionTime 
    });
  }

  // Ultra-fast message processing with microsecond precision
  private handleMessage(event: MessageEvent): void {
    const receiveTime = performance.now();
    performanceMeasurer.start('message_processing');
    
    try {
      let data: any;
      let compressionRatio = 1;

      // Handle binary protocol with compression
      if (featureFlags.enableBinaryProtocol && event.data instanceof ArrayBuffer) {
        const uint8Array = new Uint8Array(event.data);
        const originalSize = uint8Array.length;
        
        if (marketDataConfig.compressionEnabled) {
          data = CompressionUtils.decompress(uint8Array);
          const decompressedSize = JSON.stringify(data).length;
          compressionRatio = originalSize / decompressedSize;
          
          this.compressionStats.compressedMessages++;
        } else {
          data = JSON.parse(new TextDecoder().decode(uint8Array));
        }
        
        this.compressionStats.totalMessages++;
        this.compressionStats.totalCompressionRatio += compressionRatio;
      } else {
        // Standard JSON protocol
        data = JSON.parse(event.data);
      }

      // Validate data integrity
      if (marketDataConfig.integrityCheckEnabled) {
        const validation = ValidationUtils.validateMarketData(data);
        if (!validation.isValid) {
          this.recordError('invalid_market_data', validation.errors);
          return;
        }
      }

      // Check sequence number for message ordering
      if (data.sequence && data.sequence <= this.lastSequence) {
        this.recordAlert('out_of_sequence', `Received sequence ${data.sequence}, expected > ${this.lastSequence}`);
      }
      this.lastSequence = data.sequence || this.lastSequence + 1;

      // Process different message types
      this.processMarketData(data, receiveTime);
      
      this.connectionMetrics.messagesReceived++;
      this.processedMessages++;
      
      // Calculate processing latency
      const processingLatency = performance.now() - receiveTime;
      const networkLatency = data.timestamp ? receiveTime - data.timestamp : 0;
      const totalLatency = processingLatency + networkLatency;
      
      this.latencyCalculator.addSample(totalLatency);
      
      // Performance alerting
      if (processingLatency > 1) { // Alert if processing > 1ms
        this.recordAlert('slow_processing', `Processing took ${processingLatency.toFixed(3)}ms`);
      }

    } catch (error) {
      this.recordError('message_processing_error', error);
      this.connectionMetrics.errors++;
    } finally {
      const totalProcessingTime = performanceMeasurer.end('message_processing');
      this.throttledUpdateMetrics();
    }
  }

  // Process different types of market data with optimized performance
  private processMarketData(data: any, receiveTime: number): void {
    const tick: MarketDataTick = {
      symbol: data.symbol,
      type: data.type,
      data: data.data,
      timestamp: receiveTime,
      sequence: data.sequence || this.lastSequence
    };

    // Store in high-performance circular buffer
    this.dataBuffer.push(tick);

    switch (data.type) {
      case 'quote':
        this.processQuote(data.data as Quote);
        break;
      case 'trade':
        this.processTrade(data.data as Trade);
        break;
      case 'book':
        this.processOrderBook(data.data as OrderBook);
        break;
      default:
        console.warn(`Unknown market data type: ${data.type}`);
    }

    // Throttled event emission for performance
    this.throttledEmitEvent('market_data_update', tick);
  }

  // Optimized quote processing
  private processQuote(quote: Quote): void {
    this.quotes.set(quote.symbol, quote);
    
    // Emit real-time quote update
    this.emitEvent('quote_update', quote);
  }

  // High-frequency trade processing
  private processTrade(trade: Trade): void {
    this.trades.push(trade);
    
    // Update last trade price in quotes
    const existingQuote = this.quotes.get(trade.symbol);
    if (existingQuote) {
      // Update with trade information for more accurate pricing
      this.emitEvent('trade_update', trade);
    }
  }

  // Efficient order book processing with price level aggregation
  private processOrderBook(orderBook: OrderBook): void {
    const existing = this.orderBooks.get(orderBook.symbol);
    
    if (!existing || orderBook.sequence > existing.sequence) {
      // Aggregate price levels for efficiency
      const aggregatedBook = this.aggregatePriceLevels(orderBook);
      this.orderBooks.set(orderBook.symbol, aggregatedBook);
      
      this.emitEvent('orderbook_update', aggregatedBook);
    }
  }

  // Price level aggregation for order book optimization
  private aggregatePriceLevels(orderBook: OrderBook): OrderBook {
    const aggregateLevel = (levels: OrderBookLevel[]): OrderBookLevel[] => {
      const aggregated = new Map<number, OrderBookLevel>();
      
      for (const level of levels) {
        const existing = aggregated.get(level.price);
        if (existing) {
          existing.size += level.size;
          existing.orderCount += level.orderCount;
        } else {
          aggregated.set(level.price, { ...level });
        }
      }
      
      return Array.from(aggregated.values()).sort((a, b) => b.price - a.price);
    };

    return {
      ...orderBook,
      bids: aggregateLevel(orderBook.bids),
      asks: aggregateLevel(orderBook.asks)
    };
  }

  // Smart subscription management with automatic cleanup
  public subscribe(subscription: MarketDataSubscription): void {
    // Check subscription limit
    if (this.subscriptions.size >= marketDataConfig.subscriptionLimit) {
      throw new Error('Subscription limit exceeded');
    }

    this.subscriptions.set(subscription.id, subscription);
    
    if (this.isConnected && this.websocket) {
      this.sendSubscription(subscription);
    }

    this.emitEvent('subscription_added', subscription);
  }

  public unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return;
    }

    subscription.isActive = false;
    
    if (this.isConnected && this.websocket) {
      this.sendUnsubscription(subscription);
    }

    this.subscriptions.delete(subscriptionId);
    this.emitEvent('subscription_removed', { subscriptionId });
  }

  // Send subscription message
  private sendSubscription(subscription: MarketDataSubscription): void {
    const message = {
      type: 'subscribe',
      subscription: subscription,
      timestamp: Date.now()
    };

    this.sendMessage(message);
    this.connectionMetrics.messagesSent++;
  }

  private sendUnsubscription(subscription: MarketDataSubscription): void {
    const message = {
      type: 'unsubscribe',
      subscriptionId: subscription.id,
      timestamp: Date.now()
    };

    this.sendMessage(message);
    this.connectionMetrics.messagesSent++;
  }

  // Optimized message sending with compression
  private sendMessage(message: any): void {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      let payload: string | ArrayBuffer;

      if (featureFlags.enableBinaryProtocol && marketDataConfig.compressionEnabled) {
        const compressed = CompressionUtils.compress(message);
        payload = compressed.compressed.buffer;
      } else {
        payload = JSON.stringify(message);
      }

      this.websocket.send(payload);
    } catch (error) {
      this.recordError('send_error', error);
    }
  }

  // Resubscribe to all active subscriptions after reconnection
  private resubscribeAll(): void {
    for (const subscription of this.subscriptions.values()) {
      if (subscription.isActive) {
        this.sendSubscription(subscription);
      }
    }
  }

  private handleClose(event: CloseEvent): void {
    this.isConnected = false;
    this.connectionMetrics.status = 'disconnected';
    
    console.log('Market data connection closed:', event.reason);
    
    if (this.healthChecker) {
      this.healthChecker = null;
    }

    this.emitEvent('market_data_disconnected', { 
      code: event.code, 
      reason: event.reason 
    });

    this.scheduleReconnect();
  }

  private handleError(event: Event): void {
    this.connectionMetrics.errors++;
    this.recordError('websocket_error', event);
    
    console.error('Market data WebSocket error:', event);
  }

  private handleHealthChange(isHealthy: boolean): void {
    if (!isHealthy) {
      this.recordAlert('unhealthy_connection', 'Market data connection is unhealthy');
      this.scheduleReconnect();
    }
  }

  // Exponential backoff reconnection
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.recordError('max_reconnect_attempts', 'Maximum reconnection attempts exceeded');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  // Performance monitoring
  private startPerformanceMonitoring(): void {
    setInterval(() => {
      this.updateConnectionMetrics();
      this.checkPerformanceThresholds();
    }, 5000);
  }

  private updateConnectionMetrics(): void {
    this.connectionMetrics.latency = this.latencyCalculator.getMetrics();
    
    if (this.isConnected) {
      this.connectionMetrics.uptime = Date.now() - this.connectionMetrics.uptime;
    }

    this.emitEvent('metrics_update', {
      connectionMetrics: this.connectionMetrics,
      bufferUtilization: this.dataBuffer.getSize() / this.dataBuffer.getCapacity(),
      subscriptionCount: this.subscriptions.size,
      compressionRatio: this.compressionStats.totalMessages > 0 
        ? this.compressionStats.totalCompressionRatio / this.compressionStats.totalMessages 
        : 1
    });
  }

  private checkPerformanceThresholds(): void {
    const metrics = this.latencyCalculator.getMetrics();
    
    // Check latency thresholds
    if (metrics.p95 > 10) {
      this.recordAlert('high_latency', `95th percentile latency: ${metrics.p95.toFixed(2)}ms`);
    }

    // Check buffer utilization
    const bufferUtilization = this.dataBuffer.getSize() / this.dataBuffer.getCapacity();
    if (bufferUtilization > 0.8) {
      this.recordAlert('high_buffer_utilization', `Buffer utilization: ${(bufferUtilization * 100).toFixed(1)}%`);
    }

    // Check error rate
    const errorRate = this.connectionMetrics.errors / Math.max(this.connectionMetrics.messagesReceived, 1);
    if (errorRate > 0.01) {
      this.recordAlert('high_error_rate', `Error rate: ${(errorRate * 100).toFixed(2)}%`);
    }
  }

  // Public API methods
  public getLatestQuote(symbol: string): Quote | undefined {
    return this.quotes.get(symbol);
  }

  public getOrderBook(symbol: string): OrderBook | undefined {
    return this.orderBooks.get(symbol);
  }

  public getRecentTrades(symbol: string, count: number = 10): Trade[] {
    return this.trades.toArray()
      .filter(trade => trade.symbol === symbol)
      .slice(-count);
  }

  public getMarketDataHistory(symbol?: string, count: number = 100): MarketDataTick[] {
    const history = this.dataBuffer.toArray().slice(-count);
    
    if (symbol) {
      return history.filter(tick => tick.symbol === symbol);
    }
    
    return history;
  }

  public getSubscriptions(): MarketDataSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  public getConnectionStatus(): 'connected' | 'connecting' | 'disconnected' {
    if (!this.websocket) return 'disconnected';
    
    switch (this.websocket.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      default: return 'disconnected';
    }
  }

  public getMetrics(): any {
    return {
      connection: this.connectionMetrics,
      buffer: {
        size: this.dataBuffer.getSize(),
        capacity: this.dataBuffer.getCapacity(),
        utilization: this.dataBuffer.getSize() / this.dataBuffer.getCapacity()
      },
      subscriptions: this.subscriptions.size,
      compression: {
        ratio: this.compressionStats.totalMessages > 0 
          ? this.compressionStats.totalCompressionRatio / this.compressionStats.totalMessages 
          : 1,
        compressedMessages: this.compressionStats.compressedMessages,
        totalMessages: this.compressionStats.totalMessages
      },
      performance: {
        processedMessages: this.processedMessages,
        messagesPerSecond: this.processedMessages / Math.max((Date.now() - this.connectionMetrics.uptime) / 1000, 1)
      }
    };
  }

  // Event system
  private emitEvent(type: string, data: any): void {
    const event: PerformanceEvent = {
      type: type as any,
      data,
      timestamp: Date.now(),
      source: 'market_data'
    };

    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Event listener error:', error);
      }
    });
  }

  public addEventListener(id: string, listener: (event: PerformanceEvent) => void): void {
    this.eventListeners.set(id, listener);
  }

  public removeEventListener(id: string): void {
    this.eventListeners.delete(id);
  }

  // Error handling
  private recordError(code: string, error: any): void {
    const perfError: PerformanceError = {
      code,
      message: error instanceof Error ? error.message : String(error),
      timestamp: Date.now(),
      context: error,
      severity: 'medium'
    };
    
    this.performanceAlerts.push(perfError);
    console.error(`Market data error [${code}]:`, error);
  }

  private recordAlert(code: string, message: string, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): void {
    const alert: PerformanceError = {
      code,
      message,
      timestamp: Date.now(),
      severity
    };
    
    this.performanceAlerts.push(alert);
    console.warn(`Market data alert [${code}]: ${message}`);
  }

  // Memory management and cleanup
  public clearCache(): void {
    this.dataBuffer.clear();
    this.trades.clear();
    this.quotes.clear();
    this.orderBooks.clear();
    this.latencyCalculator.reset();
  }

  public shutdown(): void {
    // Unsubscribe from all subscriptions
    for (const [id] of this.subscriptions) {
      this.unsubscribe(id);
    }

    // Close WebSocket connection
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    // Clear all data
    this.clearCache();
    this.eventListeners.clear();
    
    console.log('Market data stream handler shutdown complete');
  }
}

// Singleton instance
let marketDataInstance: MarketDataStreamHandler | null = null;

export function getMarketDataStream(): MarketDataStreamHandler {
  if (!marketDataInstance) {
    marketDataInstance = new MarketDataStreamHandler();
  }
  return marketDataInstance;
}

export { MarketDataStreamHandler };