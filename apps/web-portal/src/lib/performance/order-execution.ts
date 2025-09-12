// apps/web-portal/src/lib/performance/order-execution.ts

import { 
  OrderRequest, 
  OrderResponse, 
  OrderExecution, 
  WebSocketConnection,
  ConnectionPool,
  PerformanceEvent,
  CircuitBreakerState,
  PerformanceError
} from '@/types/performance';
import { orderExecutionConfig, circuitBreakerConfig, featureFlags } from '@/config/performance';
import { 
  LatencyCalculator, 
  ValidationUtils, 
  CompressionUtils, 
  CircularBuffer,
  exponentialBackoff,
  RequestDeduplicator,
  ConnectionHealthChecker,
  performanceMeasurer
} from './utils';

export class UltraFastOrderExecutionSystem {
  private connectionPool: ConnectionPool;
  private requestQueue: CircularBuffer<OrderExecution>;
  private batchTimer: NodeJS.Timeout | null = null;
  private latencyCalculator: LatencyCalculator;
  private circuitBreaker: Map<string, CircuitBreakerState> = new Map();
  private requestDeduplicator: RequestDeduplicator;
  private healthCheckers: Map<string, () => void> = new Map();
  private eventListeners: Map<string, (event: PerformanceEvent) => void> = new Map();
  private performanceAlerts: CircularBuffer<PerformanceError>;
  private isActive: boolean = true;
  
  constructor() {
    this.connectionPool = {
      connections: new Map(),
      roundRobinIndex: 0
    };
    
    this.requestQueue = new CircularBuffer<OrderExecution>(1000);
    this.latencyCalculator = new LatencyCalculator(5000);
    this.requestDeduplicator = new RequestDeduplicator();
    this.performanceAlerts = new CircularBuffer<PerformanceError>(100);
    
    this.initializeConnections();
    this.startBatchProcessor();
    this.startMetricsCollection();
  }

  // Initialize WebSocket connection pool with redundancy
  private async initializeConnections(): Promise<void> {
    const endpoints = [...orderExecutionConfig.endpoints, ...orderExecutionConfig.fallbackEndpoints];
    
    for (let i = 0; i < Math.min(endpoints.length, orderExecutionConfig.connectionPoolSize); i++) {
      const endpoint = endpoints[i];
      const connectionId = `conn_${i}`;
      
      await this.createConnection(connectionId, endpoint, i < orderExecutionConfig.endpoints.length ? 1 : 0);
    }
    
    // Set active connection to the first available
    const firstConnection = Array.from(this.connectionPool.connections.values())
      .find(conn => conn.status === 'connected');
    
    if (firstConnection) {
      this.connectionPool.activeConnection = firstConnection.id;
    }
  }

  // Create individual WebSocket connection with enhanced features
  private async createConnection(id: string, url: string, priority: number): Promise<void> {
    const connection: WebSocketConnection = {
      id,
      url,
      status: 'connecting',
      messageQueue: [],
      priority,
      retryCount: 0
    };

    try {
      connection.socket = new WebSocket(url);
      
      // Binary protocol optimization
      if (featureFlags.enableBinaryProtocol) {
        connection.socket.binaryType = 'arraybuffer';
      }

      connection.socket.onopen = () => {
        connection.status = 'connected';
        connection.retryCount = 0;
        this.resetCircuitBreaker(id);
        
        // Start health monitoring
        const healthChecker = new ConnectionHealthChecker();
        const cleanup = healthChecker.startHealthCheck(
          connection.socket!,
          (isHealthy) => this.handleConnectionHealth(id, isHealthy)
        );
        this.healthCheckers.set(id, cleanup);
        
        this.emitEvent('connection_established', { connectionId: id });
        console.log(`Connection ${id} established`);
      };

      connection.socket.onmessage = (event) => {
        this.handleMessage(id, event);
      };

      connection.socket.onclose = () => {
        connection.status = 'disconnected';
        this.handleConnectionClose(id);
      };

      connection.socket.onerror = (error) => {
        connection.status = 'error';
        this.handleConnectionError(id, error);
      };

      this.connectionPool.connections.set(id, connection);
      
    } catch (error) {
      connection.status = 'error';
      this.connectionPool.connections.set(id, connection);
      console.error(`Failed to create connection ${id}:`, error);
    }
  }

  // Enhanced message handling with binary protocol support
  private handleMessage(connectionId: string, event: MessageEvent): void {
    performanceMeasurer.start(`message_processing_${connectionId}`);
    
    try {
      let data: any;
      
      if (featureFlags.enableBinaryProtocol && event.data instanceof ArrayBuffer) {
        // Binary protocol handling
        const uint8Array = new Uint8Array(event.data);
        data = CompressionUtils.decompress(uint8Array);
      } else {
        // Standard JSON protocol
        data = JSON.parse(event.data);
      }

      if (data.type === 'order_response') {
        this.handleOrderResponse(data);
      } else if (data.type === 'ping') {
        this.handlePing(connectionId);
      }
      
    } catch (error) {
      console.error('Message processing error:', error);
      this.recordError('message_processing_error', error);
    } finally {
      const processingTime = performanceMeasurer.end(`message_processing_${connectionId}`);
      if (processingTime > 1) { // Alert if processing takes more than 1ms
        this.recordAlert('slow_message_processing', `Message processing took ${processingTime}ms`);
      }
    }
  }

  // Ultra-fast order execution with <1ms validation
  public async executeOrder(orderRequest: OrderRequest): Promise<OrderResponse> {
    const execution: OrderExecution = {
      request: orderRequest,
      startTime: performance.now(),
      retryCount: 0,
      connectionId: ''
    };

    try {
      // <1ms client-side validation
      performanceMeasurer.start('order_validation');
      const validation = ValidationUtils.validateOrderRequest(orderRequest);
      const validationTime = performanceMeasurer.end('order_validation');
      
      if (validationTime > orderExecutionConfig.validationTimeout) {
        this.recordAlert('validation_timeout', `Validation took ${validationTime}ms`);
      }

      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Check for request deduplication
      const requestKey = `${orderRequest.symbol}_${orderRequest.clientOrderId}`;
      
      return await this.requestDeduplicator.deduplicate(requestKey, async () => {
        // Market order priority - bypass queue for immediate execution
        if (orderRequest.type === 'market' && orderExecutionConfig.priorityBypass) {
          return await this.executeOrderImmediately(execution);
        }

        // Add to intelligent batching queue
        return await this.addToQueue(execution);
      });

    } catch (error) {
      execution.endTime = performance.now();
      execution.response = {
        id: orderRequest.id,
        clientOrderId: orderRequest.clientOrderId,
        status: 'rejected',
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: execution.endTime - execution.startTime,
        latency: execution.endTime - execution.startTime,
        timestamp: Date.now()
      };
      
      this.recordError('order_execution_error', error);
      return execution.response;
    }
  }

  // Immediate execution for market orders
  private async executeOrderImmediately(execution: OrderExecution): Promise<OrderResponse> {
    const connection = this.getOptimalConnection();
    if (!connection) {
      throw new Error('No available connections');
    }

    execution.connectionId = connection.id;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Order execution timeout'));
      }, orderExecutionConfig.timeoutMs);

      const messageHandler = (response: OrderResponse) => {
        if (response.clientOrderId === execution.request.clientOrderId) {
          clearTimeout(timeout);
          execution.endTime = performance.now();
          execution.response = response;
          
          const latency = execution.endTime - execution.startTime;
          this.latencyCalculator.addSample(latency);
          
          resolve(response);
        }
      };

      // Send order immediately
      this.sendOrderToConnection(connection, execution.request, messageHandler);
    });
  }

  // Intelligent batching with 5ms window
  private async addToQueue(execution: OrderExecution): Promise<OrderResponse> {
    this.requestQueue.push(execution);

    // Start batch timer if not already running
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.processBatch();
      }, orderExecutionConfig.batchingWindow);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Order execution timeout'));
      }, orderExecutionConfig.timeoutMs);

      (execution.request as any).resolve = (response: OrderResponse) => {
        clearTimeout(timeout);
        resolve(response);
      };

      (execution.request as any).reject = (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });
  }

  // Process batched orders
  private processBatch(): void {
    this.batchTimer = null;
    
    if (this.requestQueue.isEmpty()) {
      return;
    }

    const batchSize = Math.min(orderExecutionConfig.maxBatchSize, this.requestQueue.getSize());
    const batch: OrderExecution[] = [];
    
    for (let i = 0; i < batchSize; i++) {
      const execution = this.requestQueue.pop();
      if (execution) {
        batch.push(execution);
      }
    }

    if (batch.length > 0) {
      this.sendBatch(batch);
    }

    // Continue processing if more items in queue
    if (!this.requestQueue.isEmpty()) {
      this.batchTimer = setTimeout(() => {
        this.processBatch();
      }, orderExecutionConfig.batchingWindow);
    }
  }

  // Send batch to optimal connection
  private sendBatch(batch: OrderExecution[]): void {
    const connection = this.getOptimalConnection();
    if (!connection) {
      batch.forEach(execution => {
        (execution.request as any).reject?.(new Error('No available connections'));
      });
      return;
    }

    const batchRequest = {
      type: 'batch_order',
      orders: batch.map(exec => exec.request),
      timestamp: Date.now()
    };

    try {
      let message: string | ArrayBuffer;
      
      if (featureFlags.enableBinaryProtocol && connection.socket?.binaryType === 'arraybuffer') {
        const compressed = CompressionUtils.compress(batchRequest);
        message = compressed.compressed.buffer;
      } else {
        message = JSON.stringify(batchRequest);
      }

      connection.socket?.send(message);
      
      batch.forEach(execution => {
        execution.connectionId = connection.id;
      });

    } catch (error) {
      console.error('Failed to send batch:', error);
      batch.forEach(execution => {
        (execution.request as any).reject?.(new Error('Failed to send order'));
      });
    }
  }

  // Get optimal connection based on load balancing and health
  private getOptimalConnection(): WebSocketConnection | null {
    const availableConnections = Array.from(this.connectionPool.connections.values())
      .filter(conn => conn.status === 'connected' && !this.isCircuitBreakerOpen(conn.id))
      .sort((a, b) => b.priority - a.priority);

    if (availableConnections.length === 0) {
      return null;
    }

    // Round-robin among connections with same priority
    const topPriorityConnections = availableConnections.filter(
      conn => conn.priority === availableConnections[0].priority
    );

    if (topPriorityConnections.length === 1) {
      return topPriorityConnections[0];
    }

    // Round-robin selection
    this.connectionPool.roundRobinIndex = 
      (this.connectionPool.roundRobinIndex + 1) % topPriorityConnections.length;
    
    return topPriorityConnections[this.connectionPool.roundRobinIndex];
  }

  // Circuit breaker implementation
  private isCircuitBreakerOpen(connectionId: string): boolean {
    const state = this.circuitBreaker.get(connectionId);
    if (!state) {
      return false;
    }

    if (state.state === 'open') {
      if (Date.now() > state.nextAttemptTime!) {
        state.state = 'half-open';
        return false;
      }
      return true;
    }

    return false;
  }

  private recordCircuitBreakerFailure(connectionId: string): void {
    let state = this.circuitBreaker.get(connectionId);
    if (!state) {
      state = {
        state: 'closed',
        failureCount: 0,
        successCount: 0
      };
      this.circuitBreaker.set(connectionId, state);
    }

    state.failureCount++;
    state.lastFailureTime = Date.now();

    if (state.failureCount >= circuitBreakerConfig.failureThreshold) {
      state.state = 'open';
      state.nextAttemptTime = Date.now() + circuitBreakerConfig.recoveryTimeout;
      this.emitEvent('circuit_breaker_opened', { connectionId });
    }
  }

  private resetCircuitBreaker(connectionId: string): void {
    const state = this.circuitBreaker.get(connectionId);
    if (state) {
      state.state = 'closed';
      state.failureCount = 0;
      state.successCount = 0;
    }
  }

  // Connection health monitoring
  private handleConnectionHealth(connectionId: string, isHealthy: boolean): void {
    if (!isHealthy) {
      this.recordCircuitBreakerFailure(connectionId);
      this.handleConnectionFailover(connectionId);
    }
  }

  // Automatic failover with exponential backoff
  private handleConnectionClose(connectionId: string): void {
    const connection = this.connectionPool.connections.get(connectionId);
    if (!connection || !this.isActive) {
      return;
    }

    this.emitEvent('connection_lost', { connectionId });
    
    // Clean up health checker
    const cleanup = this.healthCheckers.get(connectionId);
    if (cleanup) {
      cleanup();
      this.healthCheckers.delete(connectionId);
    }

    // Attempt reconnection with exponential backoff
    const delay = exponentialBackoff(connection.retryCount, orderExecutionConfig.exponentialBackoffBase);
    connection.retryCount++;

    setTimeout(() => {
      if (this.isActive && connection.retryCount <= orderExecutionConfig.retryAttempts) {
        this.createConnection(connectionId, connection.url, connection.priority);
      }
    }, delay);
  }

  private handleConnectionError(connectionId: string, error: Event): void {
    this.recordError('connection_error', error);
    this.recordCircuitBreakerFailure(connectionId);
    this.handleConnectionFailover(connectionId);
  }

  private handleConnectionFailover(connectionId: string): void {
    if (this.connectionPool.activeConnection === connectionId) {
      // Switch to next available connection
      const nextConnection = this.getOptimalConnection();
      if (nextConnection) {
        this.connectionPool.activeConnection = nextConnection.id;
        this.emitEvent('failover_completed', { 
          fromConnection: connectionId, 
          toConnection: nextConnection.id 
        });
      }
    }
  }

  // Handle order responses
  private handleOrderResponse(response: OrderResponse): void {
    const latency = Date.now() - response.timestamp;
    this.latencyCalculator.addSample(latency);

    if (latency > orderExecutionConfig.timeoutMs * 0.8) {
      this.recordAlert('high_latency', `Order response latency: ${latency}ms`);
    }

    // Find and resolve pending order
    // Implementation depends on how responses are matched to requests
    this.emitEvent('order_executed', response);
  }

  // Send individual order to specific connection
  private sendOrderToConnection(
    connection: WebSocketConnection, 
    order: OrderRequest, 
    messageHandler: (response: OrderResponse) => void
  ): void {
    // Implementation for sending individual orders
    // This would include the message handler registration logic
    const message = JSON.stringify({
      type: 'order_request',
      order: order,
      timestamp: Date.now()
    });
    
    connection.socket?.send(message);
  }

  private handlePing(connectionId: string): void {
    const connection = this.connectionPool.connections.get(connectionId);
    if (connection?.socket) {
      connection.socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
    }
  }

  // Performance monitoring and alerting
  private startBatchProcessor(): void {
    // Batch processor is event-driven, no continuous loop needed
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      this.collectMetrics();
    }, 1000); // Collect metrics every second
  }

  private collectMetrics(): void {
    const metrics = {
      timestamp: Date.now(),
      connections: Array.from(this.connectionPool.connections.values()).map(conn => ({
        id: conn.id,
        status: conn.status,
        messagesSent: 0, // Would track in real implementation
        messagesReceived: 0,
        errors: 0
      })),
      latency: this.latencyCalculator.getMetrics(),
      queueSize: this.requestQueue.getSize(),
      circuitBreakers: Object.fromEntries(this.circuitBreaker)
    };

    this.emitEvent('metric_update', metrics);
  }

  // Event system
  private emitEvent(type: string, data: any): void {
    const event: PerformanceEvent = {
      type: type as any,
      data,
      timestamp: Date.now(),
      source: 'order_execution'
    };

    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Event listener error:', error);
      }
    });
  }

  // Public API methods
  public addEventListener(id: string, listener: (event: PerformanceEvent) => void): void {
    this.eventListeners.set(id, listener);
  }

  public removeEventListener(id: string): void {
    this.eventListeners.delete(id);
  }

  public getMetrics(): any {
    return {
      latency: this.latencyCalculator.getMetrics(),
      queueSize: this.requestQueue.getSize(),
      connections: Array.from(this.connectionPool.connections.values()).map(conn => ({
        id: conn.id,
        status: conn.status,
        retryCount: conn.retryCount
      })),
      alerts: this.performanceAlerts.toArray()
    };
  }

  public getConnectionStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    
    this.connectionPool.connections.forEach((conn, id) => {
      status[id] = {
        status: conn.status,
        retryCount: conn.retryCount,
        circuitBreakerState: this.circuitBreaker.get(id)?.state || 'closed'
      };
    });
    
    return status;
  }

  private recordError(code: string, error: any): void {
    const perfError: PerformanceError = {
      code,
      message: error instanceof Error ? error.message : String(error),
      timestamp: Date.now(),
      context: error,
      severity: 'medium'
    };
    
    this.performanceAlerts.push(perfError);
  }

  private recordAlert(code: string, message: string, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): void {
    const alert: PerformanceError = {
      code,
      message,
      timestamp: Date.now(),
      severity
    };
    
    this.performanceAlerts.push(alert);
  }

  // Cleanup and shutdown
  public shutdown(): void {
    this.isActive = false;
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    this.healthCheckers.forEach(cleanup => cleanup());
    this.healthCheckers.clear();

    this.connectionPool.connections.forEach(conn => {
      if (conn.socket) {
        conn.socket.close();
      }
    });

    this.connectionPool.connections.clear();
    this.eventListeners.clear();
  }
}

// Singleton instance for application-wide use
let orderExecutionInstance: UltraFastOrderExecutionSystem | null = null;

export function getOrderExecutionSystem(): UltraFastOrderExecutionSystem {
  if (!orderExecutionInstance) {
    orderExecutionInstance = new UltraFastOrderExecutionSystem();
  }
  return orderExecutionInstance;
}

export { UltraFastOrderExecutionSystem };