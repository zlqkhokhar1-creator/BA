// apps/web-portal/src/lib/performance/market-data-stream.ts

import { getPerformanceConfig, PERFORMANCE_CONSTANTS, type PerformanceConfig } from '@/config/performance';

// Market data types
export interface MarketTick {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
  side: 'bid' | 'ask' | 'trade';
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
  orderCount: number;
}

export interface OrderBook {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: number;
}

export interface MarketDataSnapshot {
  symbol: string;
  lastPrice: number;
  bidPrice: number;
  askPrice: number;
  volume24h: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  timestamp: number;
}

export interface Subscription {
  id: string;
  symbol: string;
  type: 'ticks' | 'orderbook' | 'snapshot';
  callback: (data: any) => void;
  isActive: boolean;
}

// Circular buffer for memory-efficient data storage
class CircularBuffer<T> {
  private buffer: T[];
  private size: number;
  private head: number = 0;
  private count: number = 0;

  constructor(size: number) {
    this.size = size;
    this.buffer = new Array(size);
  }

  public push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.size;
    
    if (this.count < this.size) {
      this.count++;
    }
  }

  public getRecent(count: number): T[] {
    const result: T[] = [];
    let index = (this.head - 1 + this.size) % this.size;
    
    for (let i = 0; i < Math.min(count, this.count); i++) {
      result.unshift(this.buffer[index]);
      index = (index - 1 + this.size) % this.size;
    }
    
    return result;
  }

  public getAll(): T[] {
    return this.getRecent(this.count);
  }

  public clear(): void {
    this.head = 0;
    this.count = 0;
  }
}

// Compression handler for efficient data transfer
class CompressionHandler {
  public static compressMarketData(data: MarketTick[]): ArrayBuffer {
    // Simplified compression - in production use proper compression library
    const jsonString = JSON.stringify(data);
    const encoder = new TextEncoder();
    return encoder.encode(jsonString).buffer;
  }

  public static decompressMarketData(buffer: ArrayBuffer): MarketTick[] {
    // Simplified decompression
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(buffer);
    return JSON.parse(jsonString) as MarketTick[];
  }

  public static compressBinary(ticks: MarketTick[]): ArrayBuffer {
    // Binary compression for maximum efficiency
    const buffer = new ArrayBuffer(ticks.length * 32); // 32 bytes per tick
    const view = new DataView(buffer);
    let offset = 0;

    for (const tick of ticks) {
      // Symbol hash (4 bytes)
      const symbolHash = this.hashSymbol(tick.symbol);
      view.setUint32(offset, symbolHash);
      offset += 4;

      // Price (8 bytes)
      view.setFloat64(offset, tick.price);
      offset += 8;

      // Volume (8 bytes)
      view.setFloat64(offset, tick.volume);
      offset += 8;

      // Timestamp (8 bytes)
      view.setBigUint64(offset, BigInt(tick.timestamp));
      offset += 8;

      // Side (1 byte) + padding (3 bytes)
      const sideMap = { bid: 0, ask: 1, trade: 2 };
      view.setUint8(offset, sideMap[tick.side]);
      offset += 4; // Include padding
    }

    return buffer.slice(0, offset);
  }

  public static decompressBinary(buffer: ArrayBuffer, symbolMap: Map<number, string>): MarketTick[] {
    const view = new DataView(buffer);
    const ticks: MarketTick[] = [];
    let offset = 0;

    while (offset < buffer.byteLength) {
      // Symbol hash
      const symbolHash = view.getUint32(offset);
      const symbol = symbolMap.get(symbolHash) || 'UNKNOWN';
      offset += 4;

      // Price
      const price = view.getFloat64(offset);
      offset += 8;

      // Volume
      const volume = view.getFloat64(offset);
      offset += 8;

      // Timestamp
      const timestamp = Number(view.getBigUint64(offset));
      offset += 8;

      // Side
      const sideMap = ['bid', 'ask', 'trade'];
      const side = sideMap[view.getUint8(offset)] as MarketTick['side'];
      offset += 4; // Include padding

      ticks.push({ symbol, price, volume, timestamp, side });
    }

    return ticks;
  }

  private static hashSymbol(symbol: string): number {
    let hash = 0;
    for (let i = 0; i < symbol.length; i++) {
      const char = symbol.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

// Price level aggregator for order book
class PriceLevelAggregator {
  private levels: Map<number, OrderBookLevel> = new Map();
  private tickSize: number;

  constructor(tickSize: number = 0.01) {
    this.tickSize = tickSize;
  }

  public addLevel(price: number, quantity: number, orderCount: number = 1): void {
    const normalizedPrice = this.normalizePrice(price);
    const existing = this.levels.get(normalizedPrice);

    if (existing) {
      existing.quantity += quantity;
      existing.orderCount += orderCount;
    } else {
      this.levels.set(normalizedPrice, {
        price: normalizedPrice,
        quantity,
        orderCount
      });
    }
  }

  public removeLevel(price: number, quantity: number): void {
    const normalizedPrice = this.normalizePrice(price);
    const existing = this.levels.get(normalizedPrice);

    if (existing) {
      existing.quantity -= quantity;
      existing.orderCount = Math.max(0, existing.orderCount - 1);

      if (existing.quantity <= 0) {
        this.levels.delete(normalizedPrice);
      }
    }
  }

  public getLevels(maxCount: number = 50): OrderBookLevel[] {
    return Array.from(this.levels.values())
      .sort((a, b) => b.price - a.price)
      .slice(0, maxCount);
  }

  public clear(): void {
    this.levels.clear();
  }

  private normalizePrice(price: number): number {
    return Math.round(price / this.tickSize) * this.tickSize;
  }
}

// Performance monitor for market data stream
class MarketDataPerformanceMonitor {
  private ticksProcessed: number = 0;
  private bytesReceived: number = 0;
  private startTime: number = Date.now();
  private latencyMeasurements: number[] = [];
  private config: PerformanceConfig;

  constructor(config: PerformanceConfig) {
    this.config = config;
  }

  public recordTick(tick: MarketTick, receiveTime: number): void {
    this.ticksProcessed++;
    const latency = receiveTime - tick.timestamp;
    this.latencyMeasurements.push(latency);

    // Keep measurements bounded
    if (this.latencyMeasurements.length > 1000) {
      this.latencyMeasurements = this.latencyMeasurements.slice(-500);
    }
  }

  public recordBytesReceived(bytes: number): void {
    this.bytesReceived += bytes;
  }

  public getMetrics(): {
    ticksPerSecond: number;
    bytesPerSecond: number;
    averageLatency: number;
    p95Latency: number;
    totalTicks: number;
    uptime: number;
  } {
    const uptimeSeconds = (Date.now() - this.startTime) / 1000;
    const sortedLatencies = [...this.latencyMeasurements].sort((a, b) => a - b);

    return {
      ticksPerSecond: this.ticksProcessed / Math.max(uptimeSeconds, 1),
      bytesPerSecond: this.bytesReceived / Math.max(uptimeSeconds, 1),
      averageLatency: this.latencyMeasurements.reduce((sum, l) => sum + l, 0) / Math.max(this.latencyMeasurements.length, 1),
      p95Latency: sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0,
      totalTicks: this.ticksProcessed,
      uptime: uptimeSeconds
    };
  }

  public reset(): void {
    this.ticksProcessed = 0;
    this.bytesReceived = 0;
    this.startTime = Date.now();
    this.latencyMeasurements = [];
  }
}

// Main Market Data Stream Handler
export class MarketDataStreamHandler {
  private config: PerformanceConfig;
  private connections: Map<string, WebSocket> = new Map();
  private subscriptions: Map<string, Subscription> = new Map();
  private tickBuffers: Map<string, CircularBuffer<MarketTick>> = new Map();
  private orderBooks: Map<string, { bids: PriceLevelAggregator; asks: PriceLevelAggregator }> = new Map();
  private snapshots: Map<string, MarketDataSnapshot> = new Map();
  private performanceMonitor: MarketDataPerformanceMonitor;
  private symbolMap: Map<number, string> = new Map();
  private processingInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor() {
    this.config = getPerformanceConfig();
    this.performanceMonitor = new MarketDataPerformanceMonitor(this.config);
    this.startTickProcessing();
  }

  public async initialize(): Promise<void> {
    try {
      await this.createConnections();
      this.isInitialized = true;
      console.log('Market Data Stream Handler initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Market Data Stream Handler:', error);
      throw error;
    }
  }

  private async createConnections(): Promise<void> {
    const endpoints = [
      'wss://api.brokerage.com/ws/market-data',
      'wss://backup-api.brokerage.com/ws/market-data'
    ];

    const promises = endpoints.map(endpoint => this.createConnection(endpoint));
    await Promise.all(promises);
  }

  private async createConnection(endpoint: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(endpoint);
      const timeout = setTimeout(() => {
        reject(new Error(`Connection timeout for ${endpoint}`));
      }, this.config.connectionTimeout);

      ws.onopen = () => {
        clearTimeout(timeout);
        this.connections.set(endpoint, ws);
        this.setupMessageHandler(ws);
        resolve();
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error(`Failed to connect to ${endpoint}`));
      };

      ws.onclose = () => {
        this.connections.delete(endpoint);
        this.handleConnectionClose(endpoint);
      };
    });
  }

  private setupMessageHandler(ws: WebSocket): void {
    ws.onmessage = (event: MessageEvent) => {
      this.handleMarketDataMessage(event);
    };
  }

  private handleMarketDataMessage(event: MessageEvent): void {
    const receiveTime = Date.now();

    try {
      let ticks: MarketTick[] = [];

      if (event.data instanceof ArrayBuffer) {
        // Binary protocol
        this.performanceMonitor.recordBytesReceived(event.data.byteLength);
        
        if (this.config.marketData.compressionEnabled) {
          ticks = CompressionHandler.decompressBinary(event.data, this.symbolMap);
        } else {
          ticks = this.parseBinaryMarketData(event.data);
        }
      } else {
        // JSON fallback
        const data = JSON.parse(event.data);
        ticks = Array.isArray(data) ? data : [data];
        this.performanceMonitor.recordBytesReceived(event.data.length);
      }

      // Process each tick
      for (const tick of ticks) {
        this.processTick(tick, receiveTime);
      }
    } catch (error) {
      console.error('Failed to handle market data message:', error);
    }
  }

  private parseBinaryMarketData(buffer: ArrayBuffer): MarketTick[] {
    // Parse raw binary market data
    const view = new DataView(buffer);
    const ticks: MarketTick[] = [];
    let offset = 0;

    // Check protocol version and message type
    const version = view.getUint8(offset);
    offset += 1;
    const messageType = view.getUint8(offset);
    offset += 1;

    if (messageType !== PERFORMANCE_CONSTANTS.MESSAGE_TYPES.MARKET_DATA) {
      return ticks;
    }

    // Number of ticks
    const tickCount = view.getUint32(offset);
    offset += 4;

    for (let i = 0; i < tickCount; i++) {
      // Symbol (8 bytes, null-padded)
      const symbolBytes = new Uint8Array(buffer, offset, 8);
      const symbol = new TextDecoder().decode(symbolBytes).replace(/\0/g, '');
      offset += 8;

      // Price (8 bytes)
      const price = view.getFloat64(offset);
      offset += 8;

      // Volume (8 bytes)
      const volume = view.getFloat64(offset);
      offset += 8;

      // Timestamp (8 bytes)
      const timestamp = Number(view.getBigUint64(offset));
      offset += 8;

      // Side (1 byte)
      const sideMap = ['bid', 'ask', 'trade'];
      const side = sideMap[view.getUint8(offset)] as MarketTick['side'];
      offset += 1;

      ticks.push({ symbol, price, volume, timestamp, side });
    }

    return ticks;
  }

  private processTick(tick: MarketTick, receiveTime: number): void {
    // Record performance metrics
    this.performanceMonitor.recordTick(tick, receiveTime);

    // Store in circular buffer
    if (!this.tickBuffers.has(tick.symbol)) {
      this.tickBuffers.set(tick.symbol, new CircularBuffer<MarketTick>(this.config.marketData.bufferSize));
    }
    this.tickBuffers.get(tick.symbol)!.push(tick);

    // Update order book if bid/ask
    if (tick.side === 'bid' || tick.side === 'ask') {
      this.updateOrderBook(tick);
    }

    // Update snapshot
    this.updateSnapshot(tick);

    // Notify subscribers
    this.notifySubscribers(tick);
  }

  private updateOrderBook(tick: MarketTick): void {
    if (!this.orderBooks.has(tick.symbol)) {
      this.orderBooks.set(tick.symbol, {
        bids: new PriceLevelAggregator(),
        asks: new PriceLevelAggregator()
      });
    }

    const book = this.orderBooks.get(tick.symbol)!;
    
    if (tick.side === 'bid') {
      book.bids.addLevel(tick.price, tick.volume);
    } else if (tick.side === 'ask') {
      book.asks.addLevel(tick.price, tick.volume);
    }
  }

  private updateSnapshot(tick: MarketTick): void {
    const existing = this.snapshots.get(tick.symbol);
    const snapshot: MarketDataSnapshot = {
      symbol: tick.symbol,
      lastPrice: tick.side === 'trade' ? tick.price : existing?.lastPrice || tick.price,
      bidPrice: tick.side === 'bid' ? tick.price : existing?.bidPrice || 0,
      askPrice: tick.side === 'ask' ? tick.price : existing?.askPrice || 0,
      volume24h: (existing?.volume24h || 0) + (tick.side === 'trade' ? tick.volume : 0),
      change24h: existing?.change24h || 0,
      changePercent24h: existing?.changePercent24h || 0,
      high24h: Math.max(existing?.high24h || 0, tick.price),
      low24h: Math.min(existing?.low24h || Infinity, tick.price),
      timestamp: tick.timestamp
    };

    this.snapshots.set(tick.symbol, snapshot);
  }

  private notifySubscribers(tick: MarketTick): void {
    for (const subscription of this.subscriptions.values()) {
      if (subscription.isActive && subscription.symbol === tick.symbol) {
        try {
          if (subscription.type === 'ticks') {
            subscription.callback(tick);
          } else if (subscription.type === 'orderbook') {
            const orderBook = this.getOrderBook(tick.symbol);
            if (orderBook) {
              subscription.callback(orderBook);
            }
          } else if (subscription.type === 'snapshot') {
            const snapshot = this.snapshots.get(tick.symbol);
            if (snapshot) {
              subscription.callback(snapshot);
            }
          }
        } catch (error) {
          console.error(`Error in subscription callback for ${subscription.id}:`, error);
        }
      }
    }
  }

  private handleConnectionClose(endpoint: string): void {
    console.log(`Market data connection closed: ${endpoint}`);
    
    // Attempt reconnection after delay
    setTimeout(async () => {
      try {
        await this.createConnection(endpoint);
        console.log(`Reconnected to ${endpoint}`);
      } catch (error) {
        console.error(`Failed to reconnect to ${endpoint}:`, error);
      }
    }, 5000);
  }

  private startTickProcessing(): void {
    this.processingInterval = setInterval(() => {
      // Process any queued operations
      this.performBatchUpdates();
    }, this.config.marketData.tickProcessingInterval);
  }

  private performBatchUpdates(): void {
    // Batch process order book updates for efficiency
    // This could include consolidating multiple updates for the same price level
    // For now, this is a placeholder for future optimizations
  }

  // Public API methods
  public subscribe(symbol: string, type: Subscription['type'], callback: (data: any) => void): string {
    if (!this.isInitialized) {
      throw new Error('Market Data Stream Handler not initialized');
    }

    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const subscription: Subscription = {
      id: subscriptionId,
      symbol: symbol.toUpperCase(),
      type,
      callback,
      isActive: true
    };

    this.subscriptions.set(subscriptionId, subscription);

    // Send subscription request to server
    this.sendSubscriptionRequest(subscription);

    return subscriptionId;
  }

  public unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.isActive = false;
      this.subscriptions.delete(subscriptionId);
      
      // Send unsubscription request to server
      this.sendUnsubscriptionRequest(subscription);
    }
  }

  private sendSubscriptionRequest(subscription: Subscription): void {
    const request = {
      type: 'subscribe',
      symbol: subscription.symbol,
      dataType: subscription.type
    };

    // Send to all active connections
    for (const connection of this.connections.values()) {
      if (connection.readyState === WebSocket.OPEN) {
        connection.send(JSON.stringify(request));
      }
    }
  }

  private sendUnsubscriptionRequest(subscription: Subscription): void {
    const request = {
      type: 'unsubscribe',
      symbol: subscription.symbol,
      dataType: subscription.type
    };

    // Send to all active connections
    for (const connection of this.connections.values()) {
      if (connection.readyState === WebSocket.OPEN) {
        connection.send(JSON.stringify(request));
      }
    }
  }

  public getRecentTicks(symbol: string, count: number = 100): MarketTick[] {
    const buffer = this.tickBuffers.get(symbol.toUpperCase());
    return buffer ? buffer.getRecent(count) : [];
  }

  public getOrderBook(symbol: string): OrderBook | null {
    const book = this.orderBooks.get(symbol.toUpperCase());
    if (!book) return null;

    return {
      symbol: symbol.toUpperCase(),
      bids: book.bids.getLevels(50),
      asks: book.asks.getLevels(50),
      timestamp: Date.now()
    };
  }

  public getSnapshot(symbol: string): MarketDataSnapshot | null {
    return this.snapshots.get(symbol.toUpperCase()) || null;
  }

  public getPerformanceMetrics(): ReturnType<MarketDataPerformanceMonitor['getMetrics']> {
    return this.performanceMonitor.getMetrics();
  }

  public clearBuffers(): void {
    for (const buffer of this.tickBuffers.values()) {
      buffer.clear();
    }
    
    for (const book of this.orderBooks.values()) {
      book.bids.clear();
      book.asks.clear();
    }
    
    this.snapshots.clear();
  }

  public destroy(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    // Close all connections
    for (const connection of this.connections.values()) {
      if (connection.readyState === WebSocket.OPEN) {
        connection.close();
      }
    }

    // Clear all data
    this.clearBuffers();
    this.subscriptions.clear();
    this.connections.clear();
    
    this.isInitialized = false;
  }
}

// Singleton instance for global access
let globalMarketDataHandler: MarketDataStreamHandler | null = null;

export function getMarketDataStreamHandler(): MarketDataStreamHandler {
  if (!globalMarketDataHandler) {
    globalMarketDataHandler = new MarketDataStreamHandler();
  }
  return globalMarketDataHandler;
}