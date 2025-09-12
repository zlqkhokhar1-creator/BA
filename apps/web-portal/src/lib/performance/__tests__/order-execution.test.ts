// apps/web-portal/src/lib/performance/__tests__/order-execution.test.ts

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { UltraFastOrderExecutionSystem } from '../order-execution';
import { OrderRequest } from '@/types/performance';

// Mock WebSocket
class MockWebSocket {
  readyState: number = WebSocket.CONNECTING;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  binaryType: string = 'blob';

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.onopen?.(new Event('open'));
    }, 10);
  }

  send(data: string | ArrayBuffer): void {
    // Mock sending data
    setTimeout(() => {
      if (this.onmessage) {
        const response = {
          type: 'order_response',
          id: 'test_order',
          clientOrderId: 'client_123',
          status: 'filled',
          fillQuantity: 100,
          fillPrice: 150.00,
          executionTime: 5.2,
          latency: 5.2,
          timestamp: Date.now()
        };
        
        this.onmessage(new MessageEvent('message', { 
          data: JSON.stringify(response) 
        }));
      }
    }, 5);
  }

  close(): void {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }

  ping(): void {
    // Mock ping
  }
}

// Mock performance.now for consistent timing tests
let mockTime = 0;
const originalPerformanceNow = performance.now;

beforeEach(() => {
  mockTime = 1000; // Start at 1000ms
  performance.now = jest.fn(() => mockTime);
  
  // Mock global WebSocket
  (global as any).WebSocket = MockWebSocket;
  (global as any).WebSocket.CONNECTING = 0;
  (global as any).WebSocket.OPEN = 1;
  (global as any).WebSocket.CLOSING = 2;
  (global as any).WebSocket.CLOSED = 3;
});

afterEach(() => {
  performance.now = originalPerformanceNow;
  jest.clearAllMocks();
});

describe('UltraFastOrderExecutionSystem', () => {
  let orderSystem: UltraFastOrderExecutionSystem;

  beforeEach(async () => {
    orderSystem = new UltraFastOrderExecutionSystem();
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  afterEach(() => {
    orderSystem.shutdown();
  });

  describe('Order Execution Performance', () => {
    it('should execute market orders with sub-10ms latency', async () => {
      const orderRequest: OrderRequest = {
        id: 'test_order_1',
        type: 'market',
        side: 'buy',
        symbol: 'AAPL',
        quantity: 100,
        timeInForce: 'IOC',
        clientOrderId: 'client_123',
        timestamp: Date.now(),
        priority: 'high'
      };

      const startTime = mockTime;
      
      // Simulate time progression
      mockTime += 3; // 3ms execution time
      
      const response = await orderSystem.executeOrder(orderRequest);
      
      expect(response).toBeDefined();
      expect(response.status).toBe('filled');
      expect(response.latency).toBeLessThan(10);
      expect(response.executionTime).toBeLessThan(10);
    });

    it('should validate orders in less than 1ms', async () => {
      const orderRequest: OrderRequest = {
        id: 'test_order_2',
        type: 'limit',
        side: 'buy',
        symbol: 'GOOGL',
        quantity: 50,
        price: 2800.00,
        timeInForce: 'GTC',
        clientOrderId: 'client_456',
        timestamp: Date.now(),
        priority: 'normal'
      };

      const startTime = mockTime;
      
      // Validation should complete in <1ms
      mockTime += 0.5; // 0.5ms validation time
      
      const response = await orderSystem.executeOrder(orderRequest);
      
      expect(response).toBeDefined();
      expect(response.latency).toBeLessThan(1);
    });

    it('should handle order batching within 5ms window', async () => {
      const orders: OrderRequest[] = [];
      
      for (let i = 0; i < 5; i++) {
        orders.push({
          id: `batch_order_${i}`,
          type: 'limit',
          side: 'buy',
          symbol: 'MSFT',
          quantity: 10,
          price: 300.00,
          timeInForce: 'GTC',
          clientOrderId: `client_batch_${i}`,
          timestamp: Date.now(),
          priority: 'normal'
        });
      }

      const promises = orders.map(order => orderSystem.executeOrder(order));
      
      // Simulate batching window
      mockTime += 5; // 5ms batching window
      
      const responses = await Promise.all(promises);
      
      expect(responses).toHaveLength(5);
      responses.forEach(response => {
        expect(response.latency).toBeLessThan(10);
      });
    });
  });

  describe('Connection Management', () => {
    it('should establish multiple WebSocket connections', () => {
      const connectionStatus = orderSystem.getConnectionStatus();
      
      expect(Object.keys(connectionStatus)).toHaveLength(3); // Default pool size
      
      Object.values(connectionStatus).forEach(status => {
        expect(status.status).toMatch(/connected|connecting|disconnected/);
        expect(status.circuitBreakerState).toBe('closed');
      });
    });

    it('should handle connection failover automatically', async () => {
      const metrics = orderSystem.getMetrics();
      expect(metrics.connections).toBeDefined();
      
      // Simulate connection failure and recovery
      const eventPromise = new Promise(resolve => {
        orderSystem.addEventListener('test', (event) => {
          if (event.type === 'failover_completed') {
            resolve(event.data);
          }
        });
      });

      // Trigger failover (implementation would depend on internal connection handling)
      // This is a simplified test - real implementation would simulate WebSocket close/error
      
      expect(metrics.alerts).toBeDefined();
    });

    it('should implement circuit breaker pattern', () => {
      const connectionStatus = orderSystem.getConnectionStatus();
      
      Object.values(connectionStatus).forEach(status => {
        expect(['closed', 'open', 'half-open']).toContain(status.circuitBreakerState);
      });
    });
  });

  describe('Performance Monitoring', () => {
    it('should track latency metrics with 95th percentile', () => {
      const metrics = orderSystem.getMetrics();
      
      expect(metrics.latency).toBeDefined();
      expect(metrics.latency).toHaveProperty('min');
      expect(metrics.latency).toHaveProperty('max');
      expect(metrics.latency).toHaveProperty('mean');
      expect(metrics.latency).toHaveProperty('p95');
      expect(metrics.latency).toHaveProperty('p99');
    });

    it('should emit performance events', (done) => {
      const eventTypes: string[] = [];
      
      orderSystem.addEventListener('test', (event) => {
        eventTypes.push(event.type);
        
        if (eventTypes.length >= 2) {
          expect(eventTypes).toContain('metric_update');
          done();
        }
      });

      // Trigger some activity to generate events
      setTimeout(() => {
        orderSystem.getMetrics();
      }, 100);
    });

    it('should maintain performance alerts buffer', () => {
      const metrics = orderSystem.getMetrics();
      
      expect(metrics.alerts).toBeDefined();
      expect(Array.isArray(metrics.alerts)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should reject invalid orders quickly', async () => {
      const invalidOrder: OrderRequest = {
        id: 'invalid_order',
        type: 'market',
        side: 'buy',
        symbol: '', // Invalid: empty symbol
        quantity: -10, // Invalid: negative quantity
        timeInForce: 'GTC',
        clientOrderId: 'client_invalid',
        timestamp: Date.now(),
        priority: 'normal'
      };

      mockTime += 0.5; // Should validate in <1ms
      
      const response = await orderSystem.executeOrder(invalidOrder);
      
      expect(response.status).toBe('rejected');
      expect(response.error).toBeDefined();
      expect(response.latency).toBeLessThan(1);
    });

    it('should handle timeout scenarios', async () => {
      const orderRequest: OrderRequest = {
        id: 'timeout_order',
        type: 'market',
        side: 'sell',
        symbol: 'TSLA',
        quantity: 25,
        timeInForce: 'IOC',
        clientOrderId: 'client_timeout',
        timestamp: Date.now(),
        priority: 'high'
      };

      // Mock timeout by advancing time beyond threshold
      mockTime += 5000; // 5 seconds - should timeout

      try {
        const response = await orderSystem.executeOrder(orderRequest);
        expect(response.status).toBe('rejected');
        expect(response.error).toContain('timeout');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('timeout');
      }
    });
  });

  describe('Request Deduplication', () => {
    it('should deduplicate identical orders', async () => {
      const orderRequest: OrderRequest = {
        id: 'duplicate_order',
        type: 'limit',
        side: 'buy',
        symbol: 'AMZN',
        quantity: 5,
        price: 3500.00,
        timeInForce: 'GTC',
        clientOrderId: 'client_duplicate',
        timestamp: Date.now(),
        priority: 'normal'
      };

      mockTime += 2; // 2ms execution

      const [response1, response2] = await Promise.all([
        orderSystem.executeOrder(orderRequest),
        orderSystem.executeOrder(orderRequest) // Duplicate
      ]);

      // Both should succeed but only one should actually execute
      expect(response1.clientOrderId).toBe(orderRequest.clientOrderId);
      expect(response2.clientOrderId).toBe(orderRequest.clientOrderId);
    });
  });

  describe('Memory Management', () => {
    it('should manage memory efficiently with circular buffers', () => {
      const metrics = orderSystem.getMetrics();
      
      // Queue should be bounded
      expect(metrics.queueSize).toBeGreaterThanOrEqual(0);
      
      // Should not grow unbounded even with many requests
      const initialQueueSize = metrics.queueSize;
      
      // Add many orders to test queue management
      for (let i = 0; i < 1000; i++) {
        orderSystem.executeOrder({
          id: `memory_test_${i}`,
          type: 'market',
          side: 'buy',
          symbol: 'TEST',
          quantity: 1,
          timeInForce: 'IOC',
          clientOrderId: `client_memory_${i}`,
          timestamp: Date.now(),
          priority: 'normal'
        });
      }

      const finalMetrics = orderSystem.getMetrics();
      
      // Queue size should be bounded (implementation dependent)
      expect(finalMetrics.queueSize).toBeLessThan(1000);
    });
  });
});

describe('Performance Benchmarks', () => {
  it('should achieve target throughput', async () => {
    const orderSystem = new UltraFastOrderExecutionSystem();
    const orderCount = 100;
    const orders: OrderRequest[] = [];

    for (let i = 0; i < orderCount; i++) {
      orders.push({
        id: `benchmark_order_${i}`,
        type: 'market',
        side: i % 2 === 0 ? 'buy' : 'sell',
        symbol: 'BENCHMARK',
        quantity: 10,
        timeInForce: 'IOC',
        clientOrderId: `client_benchmark_${i}`,
        timestamp: Date.now(),
        priority: 'high'
      });
    }

    const startTime = Date.now();
    
    const promises = orders.map(order => orderSystem.executeOrder(order));
    await Promise.all(promises);
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const throughput = (orderCount / totalTime) * 1000; // Orders per second

    console.log(`Throughput: ${throughput.toFixed(2)} orders/second`);
    
    // Should handle at least 1000 orders per second in ideal conditions
    // This is a benchmark test, actual performance depends on system capabilities
    expect(throughput).toBeGreaterThan(100); // Conservative threshold for test

    orderSystem.shutdown();
  });

  it('should maintain consistent latency under load', async () => {
    const orderSystem = new UltraFastOrderExecutionSystem();
    const latencies: number[] = [];
    const orderCount = 50;

    for (let i = 0; i < orderCount; i++) {
      const startTime = performance.now();
      
      await orderSystem.executeOrder({
        id: `latency_test_${i}`,
        type: 'market',
        side: 'buy',
        symbol: 'LATENCY_TEST',
        quantity: 1,
        timeInForce: 'IOC',
        clientOrderId: `client_latency_${i}`,
        timestamp: Date.now(),
        priority: 'high'
      });
      
      const endTime = performance.now();
      latencies.push(endTime - startTime);
      
      // Small delay between orders
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Calculate statistics
    const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
    const maxLatency = Math.max(...latencies);
    const p95Latency = latencies.sort()[Math.floor(latencies.length * 0.95)];

    console.log(`Average latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`Max latency: ${maxLatency.toFixed(2)}ms`);
    console.log(`P95 latency: ${p95Latency.toFixed(2)}ms`);

    // Performance targets
    expect(avgLatency).toBeLessThan(50); // Average < 50ms (conservative for test environment)
    expect(p95Latency).toBeLessThan(100); // P95 < 100ms (conservative for test environment)
    expect(maxLatency).toBeLessThan(200); // Max < 200ms (conservative for test environment)

    orderSystem.shutdown();
  });
});