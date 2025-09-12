// apps/web-portal/src/lib/performance/order-execution.ts

import { getPerformanceConfig, PERFORMANCE_CONSTANTS, type PerformanceConfig, type ConnectionState, type OrderPriority } from '@/config/performance';

// Types and interfaces
export interface OrderRequest {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price?: number;
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  timeInForce?: 'GTC' | 'IOC' | 'FOK' | 'GTD';
  timestamp: number;
  priority: OrderPriority;
}

export interface OrderResponse {
  id: string;
  orderId: string;
  status: 'pending' | 'filled' | 'partial' | 'rejected' | 'cancelled';
  fillPrice?: number;
  fillQuantity?: number;
  timestamp: number;
  latency: number;
  error?: string;
}

export interface LatencyMetrics {
  current: number;
  average: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
}

export interface ConnectionInfo {
  id: string;
  url: string;
  state: ConnectionState;
  latency: number;
  lastHeartbeat: number;
  errorCount: number;
}

export interface PerformanceMetrics {
  latency: LatencyMetrics;
  throughput: number;
  errorRate: number;
  connectionUptime: number;
  batchEfficiency: number;
}

// Connection pool for redundant connections
class ConnectionPool {
  private connections: Map<string, WebSocket> = new Map();
  private connectionInfo: Map<string, ConnectionInfo> = new Map();
  private activeConnection: string | null = null;
  private config: PerformanceConfig;

  constructor(config: PerformanceConfig) {
    this.config = config;
  }

  public async initialize(): Promise<void> {
    const endpoints = [this.config.primaryEndpoint, ...this.config.fallbackEndpoints];
    const promises = endpoints.slice(0, this.config.maxConnections).map(url => this.createConnection(url));
    
    await Promise.all(promises);
    this.selectActiveConnection();
  }

  private async createConnection(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const ws = new WebSocket(url);
      
      const timeout = setTimeout(() => {
        reject(new Error(`Connection timeout for ${url}`));
      }, this.config.connectionTimeout);

      ws.onopen = () => {
        clearTimeout(timeout);
        this.connections.set(connectionId, ws);
        this.connectionInfo.set(connectionId, {
          id: connectionId,
          url,
          state: 'connected',
          latency: 0,
          lastHeartbeat: Date.now(),
          errorCount: 0
        });
        resolve();
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error(`Failed to connect to ${url}`));
      };

      ws.onclose = () => {
        this.handleConnectionClose(connectionId);
      };
    });
  }

  private selectActiveConnection(): void {
    // Select connection with lowest latency
    let bestConnection: string | null = null;
    let bestLatency = Infinity;

    for (const [id, info] of this.connectionInfo.entries()) {
      if (info.state === 'connected' && info.latency < bestLatency) {
        bestLatency = info.latency;
        bestConnection = id;
      }
    }

    this.activeConnection = bestConnection;
  }

  private handleConnectionClose(connectionId: string): void {
    const info = this.connectionInfo.get(connectionId);
    if (info) {
      info.state = 'disconnected';
      if (connectionId === this.activeConnection) {
        this.selectActiveConnection();
      }
    }
  }

  public getActiveConnection(): WebSocket | null {
    if (!this.activeConnection) return null;
    return this.connections.get(this.activeConnection) || null;
  }

  public getAllConnections(): WebSocket[] {
    return Array.from(this.connections.values());
  }

  public getConnectionInfo(): ConnectionInfo[] {
    return Array.from(this.connectionInfo.values());
  }
}

// Binary protocol handler for minimal serialization overhead
class BinaryProtocolHandler {
  public static serializeOrder(order: OrderRequest): ArrayBuffer {
    const buffer = new ArrayBuffer(128); // Fixed size for predictable performance
    const view = new DataView(buffer);
    let offset = 0;

    // Protocol version
    view.setUint8(offset, PERFORMANCE_CONSTANTS.PROTOCOL_VERSION);
    offset += 1;

    // Message type
    view.setUint8(offset, PERFORMANCE_CONSTANTS.MESSAGE_TYPES.ORDER_REQUEST);
    offset += 1;

    // Order ID (first 16 chars, padded with nulls)
    const idBytes = new TextEncoder().encode(order.id.substring(0, 16));
    for (let i = 0; i < 16; i++) {
      view.setUint8(offset + i, idBytes[i] || 0);
    }
    offset += 16;

    // Symbol (first 8 chars, padded with nulls)
    const symbolBytes = new TextEncoder().encode(order.symbol.substring(0, 8));
    for (let i = 0; i < 8; i++) {
      view.setUint8(offset + i, symbolBytes[i] || 0);
    }
    offset += 8;

    // Side (0 = buy, 1 = sell)
    view.setUint8(offset, order.side === 'buy' ? 0 : 1);
    offset += 1;

    // Quantity (double)
    view.setFloat64(offset, order.quantity);
    offset += 8;

    // Price (double, 0 if market order)
    view.setFloat64(offset, order.price || 0);
    offset += 8;

    // Order type
    const typeMap = { market: 0, limit: 1, stop: 2, stop_limit: 3 };
    view.setUint8(offset, typeMap[order.type]);
    offset += 1;

    // Timestamp
    view.setBigUint64(offset, BigInt(order.timestamp));
    offset += 8;

    // Priority
    view.setUint8(offset, order.priority);
    offset += 1;

    return buffer.slice(0, offset);
  }

  public static deserializeResponse(buffer: ArrayBuffer): OrderResponse {
    const view = new DataView(buffer);
    let offset = 0;

    // Skip protocol version and message type
    offset += 2;

    // Order ID
    const idBytes = new Uint8Array(buffer, offset, 16);
    const id = new TextDecoder().decode(idBytes).replace(/\0/g, '');
    offset += 16;

    // Response order ID
    const orderIdBytes = new Uint8Array(buffer, offset, 16);
    const orderId = new TextDecoder().decode(orderIdBytes).replace(/\0/g, '');
    offset += 16;

    // Status
    const statusMap = ['pending', 'filled', 'partial', 'rejected', 'cancelled'];
    const status = statusMap[view.getUint8(offset)] as OrderResponse['status'];
    offset += 1;

    // Fill price and quantity
    const fillPrice = view.getFloat64(offset);
    offset += 8;
    const fillQuantity = view.getFloat64(offset);
    offset += 8;

    // Timestamp
    const timestamp = Number(view.getBigUint64(offset));
    offset += 8;

    // Latency
    const latency = view.getFloat64(offset);

    return {
      id,
      orderId,
      status,
      fillPrice: fillPrice || undefined,
      fillQuantity: fillQuantity || undefined,
      timestamp,
      latency
    };
  }
}

// Intelligent request batching with 5ms window
class RequestBatcher {
  private queue: OrderRequest[] = [];
  private timer: NodeJS.Timeout | null = null;
  private config: PerformanceConfig;
  private onBatch: (orders: OrderRequest[]) => void;

  constructor(config: PerformanceConfig, onBatch: (orders: OrderRequest[]) => void) {
    this.config = config;
    this.onBatch = onBatch;
  }

  public addRequest(order: OrderRequest): void {
    // Market orders get direct execution bypass for sub-millisecond latency
    if (order.priority === PERFORMANCE_CONSTANTS.ORDER_PRIORITIES.MARKET) {
      this.onBatch([order]);
      return;
    }

    this.queue.push(order);

    // Start timer for batching window if not already running
    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.flush();
      }, this.config.batchingWindow);
    }

    // Flush immediately if batch size reached
    if (this.queue.length >= this.config.maxBatchSize) {
      this.flush();
    }
  }

  private flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.queue.length > 0) {
      // Sort by priority for optimal execution order
      this.queue.sort((a, b) => a.priority - b.priority);
      this.onBatch([...this.queue]);
      this.queue = [];
    }
  }

  public forceFlush(): void {
    this.flush();
  }
}

// Real-time latency monitoring with 95th percentile tracking
class LatencyMonitor {
  private measurements: number[] = [];
  private config: PerformanceConfig;
  private listeners: Array<(metrics: LatencyMetrics) => void> = [];

  constructor(config: PerformanceConfig) {
    this.config = config;
    this.startReporting();
  }

  public recordLatency(latency: number): void {
    this.measurements.push(latency);
    
    // Keep only recent measurements for memory efficiency
    const maxMeasurements = 1000;
    if (this.measurements.length > maxMeasurements) {
      this.measurements = this.measurements.slice(-maxMeasurements);
    }

    // Alert if latency exceeds threshold
    if (latency > this.config.latencyAlertThreshold) {
      console.warn(`High latency detected: ${latency}ms (threshold: ${this.config.latencyAlertThreshold}ms)`);
    }
  }

  public getMetrics(): LatencyMetrics {
    if (this.measurements.length === 0) {
      return { current: 0, average: 0, p95: 0, p99: 0, min: 0, max: 0 };
    }

    const sorted = [...this.measurements].sort((a, b) => a - b);
    const len = sorted.length;

    return {
      current: this.measurements[this.measurements.length - 1],
      average: this.measurements.reduce((sum, val) => sum + val, 0) / len,
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.floor(len * 0.99)],
      min: sorted[0],
      max: sorted[len - 1]
    };
  }

  public onMetricsUpdate(listener: (metrics: LatencyMetrics) => void): void {
    this.listeners.push(listener);
  }

  private startReporting(): void {
    setInterval(() => {
      const metrics = this.getMetrics();
      this.listeners.forEach(listener => listener(metrics));
    }, this.config.monitoring.reportingInterval);
  }
}

// Main Ultra-Fast Order Execution System
export class OrderExecutionSystem {
  private config: PerformanceConfig;
  private connectionPool: ConnectionPool;
  private batcher: RequestBatcher;
  private latencyMonitor: LatencyMonitor;
  private cache: Map<string, OrderResponse> = new Map();
  private pendingRequests: Map<string, { resolve: (response: OrderResponse) => void; reject: (error: Error) => void; timestamp: number }> = new Map();
  private isInitialized = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.config = getPerformanceConfig();
    this.connectionPool = new ConnectionPool(this.config);
    this.batcher = new RequestBatcher(this.config, this.processBatch.bind(this));
    this.latencyMonitor = new LatencyMonitor(this.config);
    
    this.setupHeartbeat();
  }

  public async initialize(): Promise<void> {
    try {
      await this.connectionPool.initialize();
      this.setupMessageHandlers();
      this.isInitialized = true;
      console.log('Order Execution System initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Order Execution System:', error);
      throw error;
    }
  }

  public async executeOrder(order: Omit<OrderRequest, 'id' | 'timestamp' | 'priority'>): Promise<OrderResponse> {
    if (!this.isInitialized) {
      throw new Error('Order Execution System not initialized');
    }

    // Client-side validation for sub-millisecond response
    this.validateOrder(order);

    const orderRequest: OrderRequest = {
      ...order,
      id: this.generateOrderId(),
      timestamp: Date.now(),
      priority: this.getOrderPriority(order.type)
    };

    // Check cache first for duplicate prevention
    const cacheKey = this.getCacheKey(orderRequest);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(orderRequest.id, { 
        resolve, 
        reject, 
        timestamp: orderRequest.timestamp 
      });

      // Add to batcher for intelligent processing
      this.batcher.addRequest(orderRequest);

      // Set timeout for order
      setTimeout(() => {
        if (this.pendingRequests.has(orderRequest.id)) {
          this.pendingRequests.delete(orderRequest.id);
          reject(new Error('Order execution timeout'));
        }
      }, this.config.maxLatency * 10); // 10x max latency for timeout
    });
  }

  private validateOrder(order: Omit<OrderRequest, 'id' | 'timestamp' | 'priority'>): void {
    if (!order.symbol || order.symbol.length === 0) {
      throw new Error('Symbol is required');
    }
    if (order.quantity <= 0) {
      throw new Error('Quantity must be positive');
    }
    if (order.type === 'limit' && (!order.price || order.price <= 0)) {
      throw new Error('Price is required for limit orders');
    }
  }

  private getOrderPriority(type: string): OrderPriority {
    switch (type) {
      case 'market': return PERFORMANCE_CONSTANTS.ORDER_PRIORITIES.MARKET;
      case 'limit': return PERFORMANCE_CONSTANTS.ORDER_PRIORITIES.LIMIT;
      case 'stop': return PERFORMANCE_CONSTANTS.ORDER_PRIORITIES.STOP;
      case 'stop_limit': return PERFORMANCE_CONSTANTS.ORDER_PRIORITIES.STOP_LIMIT;
      default: return PERFORMANCE_CONSTANTS.ORDER_PRIORITIES.LIMIT;
    }
  }

  private generateOrderId(): string {
    return `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getCacheKey(order: OrderRequest): string {
    return `${order.symbol}_${order.side}_${order.quantity}_${order.price || 'market'}`;
  }

  private async processBatch(orders: OrderRequest[]): Promise<void> {
    const connection = this.connectionPool.getActiveConnection();
    if (!connection || connection.readyState !== WebSocket.OPEN) {
      // Attempt reconnection with exponential backoff
      await this.handleConnectionFailure();
      return;
    }

    try {
      // Serialize orders using binary protocol
      const serializedOrders = orders.map(order => BinaryProtocolHandler.serializeOrder(order));
      
      // Send batch
      const batchBuffer = this.combineBinaryMessages(serializedOrders);
      connection.send(batchBuffer);
      
      console.log(`Sent batch of ${orders.length} orders`);
    } catch (error) {
      console.error('Failed to process batch:', error);
      // Reject all pending orders in this batch
      orders.forEach(order => {
        const pending = this.pendingRequests.get(order.id);
        if (pending) {
          pending.reject(new Error('Batch processing failed'));
          this.pendingRequests.delete(order.id);
        }
      });
    }
  }

  private combineBinaryMessages(messages: ArrayBuffer[]): ArrayBuffer {
    const totalLength = messages.reduce((sum, msg) => sum + msg.byteLength, 0);
    const combined = new ArrayBuffer(totalLength + 4); // +4 for message count
    const view = new DataView(combined);
    
    // Write message count
    view.setUint32(0, messages.length);
    
    let offset = 4;
    messages.forEach(message => {
      const msgView = new Uint8Array(message);
      const combinedView = new Uint8Array(combined);
      combinedView.set(msgView, offset);
      offset += message.byteLength;
    });
    
    return combined;
  }

  private setupMessageHandlers(): void {
    const connections = this.connectionPool.getAllConnections();
    
    connections.forEach(connection => {
      connection.onmessage = (event: MessageEvent) => {
        this.handleMessage(event);
      };
    });
  }

  private handleMessage(event: MessageEvent): void {
    try {
      let response: OrderResponse;
      
      if (event.data instanceof ArrayBuffer) {
        // Binary protocol response
        response = BinaryProtocolHandler.deserializeResponse(event.data);
      } else {
        // Fallback to JSON (for compatibility)
        const data = JSON.parse(event.data);
        response = data as OrderResponse;
        response.latency = Date.now() - response.timestamp;
      }

      // Record latency
      this.latencyMonitor.recordLatency(response.latency);

      // Resolve pending request
      const pending = this.pendingRequests.get(response.id);
      if (pending) {
        const totalLatency = Date.now() - pending.timestamp;
        response.latency = totalLatency;
        
        // Cache successful responses
        if (response.status === 'filled' || response.status === 'partial') {
          const cacheKey = `${response.id}_${response.status}`;
          this.cache.set(cacheKey, response);
          
          // Cache cleanup after retention period
          setTimeout(() => {
            this.cache.delete(cacheKey);
          }, this.config.monitoring.metricsRetention);
        }

        pending.resolve(response);
        this.pendingRequests.delete(response.id);
      }
    } catch (error) {
      console.error('Failed to handle message:', error);
    }
  }

  private async handleConnectionFailure(): Promise<void> {
    console.log('Handling connection failure, attempting reconnection...');
    
    let retryCount = 0;
    const maxRetries = this.config.maxRetries;
    
    while (retryCount < maxRetries) {
      try {
        await this.connectionPool.initialize();
        this.setupMessageHandlers();
        console.log('Reconnection successful');
        return;
      } catch (error) {
        retryCount++;
        const delay = Math.min(
          this.config.retryBaseDelay * Math.pow(this.config.exponentialBackoffFactor, retryCount),
          this.config.retryMaxDelay
        );
        
        console.log(`Reconnection attempt ${retryCount} failed, retrying in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error('Maximum reconnection attempts exceeded');
  }

  private setupHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const connections = this.connectionPool.getAllConnections();
      
      connections.forEach(connection => {
        if (connection.readyState === WebSocket.OPEN) {
          // Send heartbeat
          const heartbeat = new ArrayBuffer(2);
          const view = new DataView(heartbeat);
          view.setUint8(0, PERFORMANCE_CONSTANTS.PROTOCOL_VERSION);
          view.setUint8(1, PERFORMANCE_CONSTANTS.MESSAGE_TYPES.HEARTBEAT);
          connection.send(heartbeat);
        }
      });
    }, this.config.heartbeatInterval);
  }

  // Public methods for monitoring and control
  public getLatencyMetrics(): LatencyMetrics {
    return this.latencyMonitor.getMetrics();
  }

  public getConnectionInfo(): ConnectionInfo[] {
    return this.connectionPool.getConnectionInfo();
  }

  public getPerformanceMetrics(): PerformanceMetrics {
    const latency = this.getLatencyMetrics();
    const connections = this.getConnectionInfo();
    const connectedCount = connections.filter(c => c.state === 'connected').length;
    
    return {
      latency,
      throughput: this.calculateThroughput(),
      errorRate: this.calculateErrorRate(),
      connectionUptime: connectedCount / connections.length,
      batchEfficiency: this.calculateBatchEfficiency()
    };
  }

  private calculateThroughput(): number {
    // Calculate orders per second based on recent activity
    const recentWindow = 60000; // 1 minute
    const now = Date.now();
    const recentOrders = Array.from(this.pendingRequests.values())
      .filter(req => now - req.timestamp < recentWindow);
    
    return (recentOrders.length / recentWindow) * 1000;
  }

  private calculateErrorRate(): number {
    // This would be calculated based on actual error tracking
    // For now, return a placeholder
    return 0.001; // 0.1% error rate
  }

  private calculateBatchEfficiency(): number {
    // This would track actual batching efficiency
    // For now, return a placeholder
    return 0.85; // 85% efficiency
  }

  public onLatencyUpdate(callback: (metrics: LatencyMetrics) => void): void {
    this.latencyMonitor.onMetricsUpdate(callback);
  }

  public forceFlushBatch(): void {
    this.batcher.forceFlush();
  }

  public destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Close all connections
    const connections = this.connectionPool.getAllConnections();
    connections.forEach(connection => {
      if (connection.readyState === WebSocket.OPEN) {
        connection.close();
      }
    });
    
    // Reject all pending requests
    this.pendingRequests.forEach(pending => {
      pending.reject(new Error('System shutting down'));
    });
    this.pendingRequests.clear();
    
    this.isInitialized = false;
  }
}

// Singleton instance for global access
let globalOrderExecutionSystem: OrderExecutionSystem | null = null;

export function getOrderExecutionSystem(): OrderExecutionSystem {
  if (!globalOrderExecutionSystem) {
    globalOrderExecutionSystem = new OrderExecutionSystem();
  }
  return globalOrderExecutionSystem;
}