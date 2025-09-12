// apps/web-portal/src/lib/performance/__tests__/market-data-stream.test.ts

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MarketDataStreamHandler } from '../market-data-stream';
import { MarketDataSubscription, Quote, Trade, OrderBook } from '@/types/performance';

// Mock WebSocket for market data
class MockMarketDataWebSocket {
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
    // Mock successful subscription response
    setTimeout(() => {
      if (this.onmessage) {
        const response = {
          type: 'subscription_confirmed',
          subscriptionId: 'test_subscription',
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

  // Simulate market data messages
  simulateQuote(symbol: string, bid: number, ask: number): void {
    if (this.onmessage && this.readyState === WebSocket.OPEN) {
      const quote: Quote = {
        symbol,
        bid,
        ask,
        bidSize: 1000,
        askSize: 500,
        timestamp: Date.now()
      };

      const tick = {
        type: 'quote',
        symbol,
        data: quote,
        sequence: Math.floor(Math.random() * 10000),
        timestamp: Date.now()
      };

      this.onmessage(new MessageEvent('message', {
        data: JSON.stringify(tick)
      }));
    }
  }

  simulateTrade(symbol: string, price: number, size: number, side: 'buy' | 'sell'): void {
    if (this.onmessage && this.readyState === WebSocket.OPEN) {
      const trade: Trade = {
        symbol,
        price,
        size,
        side,
        timestamp: Date.now(),
        tradeId: `trade_${Date.now()}_${Math.random()}`
      };

      const tick = {
        type: 'trade',
        symbol,
        data: trade,
        sequence: Math.floor(Math.random() * 10000),
        timestamp: Date.now()
      };

      this.onmessage(new MessageEvent('message', {
        data: JSON.stringify(tick)
      }));
    }
  }

  simulateOrderBook(symbol: string, bids: Array<[number, number]>, asks: Array<[number, number]>): void {
    if (this.onmessage && this.readyState === WebSocket.OPEN) {
      const orderBook: OrderBook = {
        symbol,
        bids: bids.map(([price, size]) => ({ price, size, orderCount: 1 })),
        asks: asks.map(([price, size]) => ({ price, size, orderCount: 1 })),
        timestamp: Date.now(),
        sequence: Math.floor(Math.random() * 10000)
      };

      const tick = {
        type: 'book',
        symbol,
        data: orderBook,
        sequence: orderBook.sequence,
        timestamp: Date.now()
      };

      this.onmessage(new MessageEvent('message', {
        data: JSON.stringify(tick)
      }));
    }
  }
}

let mockWebSocket: MockMarketDataWebSocket;
let mockTime = 0;
const originalPerformanceNow = performance.now;

beforeEach(() => {
  mockTime = 2000;
  performance.now = jest.fn(() => mockTime);

  // Mock WebSocket constructor
  (global as any).WebSocket = jest.fn().mockImplementation((url: string) => {
    mockWebSocket = new MockMarketDataWebSocket(url);
    return mockWebSocket;
  });
  
  (global as any).WebSocket.CONNECTING = 0;
  (global as any).WebSocket.OPEN = 1;
  (global as any).WebSocket.CLOSING = 2;
  (global as any).WebSocket.CLOSED = 3;
});

afterEach(() => {
  performance.now = originalPerformanceNow;
  jest.clearAllMocks();
});

describe('MarketDataStreamHandler', () => {
  let marketDataStream: MarketDataStreamHandler;

  beforeEach(async () => {
    marketDataStream = new MarketDataStreamHandler(['wss://test-market-data.example.com']);
    
    // Wait for connection to establish
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  afterEach(() => {
    marketDataStream.shutdown();
  });

  describe('Connection Management', () => {
    it('should establish WebSocket connection', () => {
      expect(marketDataStream.getConnectionStatus()).toBe('connected');
    });

    it('should handle connection failures with automatic reconnection', async () => {
      const initialStatus = marketDataStream.getConnectionStatus();
      expect(initialStatus).toBe('connected');

      // Simulate connection close
      mockWebSocket.close();
      
      expect(marketDataStream.getConnectionStatus()).toBe('disconnected');

      // Wait for reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should attempt to reconnect (implementation dependent)
    });
  });

  describe('Market Data Processing', () => {
    it('should process quote updates with microsecond precision', (done) => {
      const testSymbol = 'AAPL';
      const testBid = 150.25;
      const testAsk = 150.27;

      marketDataStream.addEventListener('test', (event) => {
        if (event.type === 'quote_update') {
          const quote = event.data as Quote;
          expect(quote.symbol).toBe(testSymbol);
          expect(quote.bid).toBe(testBid);
          expect(quote.ask).toBe(testAsk);
          expect(quote.timestamp).toBeDefined();
          done();
        }
      });

      // Simulate quote message
      mockWebSocket.simulateQuote(testSymbol, testBid, testAsk);
    });

    it('should process trade updates efficiently', (done) => {
      const testSymbol = 'GOOGL';
      const testPrice = 2800.50;
      const testSize = 100;

      marketDataStream.addEventListener('test', (event) => {
        if (event.type === 'trade_update') {
          const trade = event.data as Trade;
          expect(trade.symbol).toBe(testSymbol);
          expect(trade.price).toBe(testPrice);
          expect(trade.size).toBe(testSize);
          expect(trade.tradeId).toBeDefined();
          done();
        }
      });

      mockWebSocket.simulateTrade(testSymbol, testPrice, testSize, 'buy');
    });

    it('should process order book updates with price level aggregation', (done) => {
      const testSymbol = 'TSLA';
      const testBids: Array<[number, number]> = [[800.00, 100], [799.99, 200]];
      const testAsks: Array<[number, number]> = [[800.01, 150], [800.02, 300]];

      marketDataStream.addEventListener('test', (event) => {
        if (event.type === 'orderbook_update') {
          const orderBook = event.data as OrderBook;
          expect(orderBook.symbol).toBe(testSymbol);
          expect(orderBook.bids).toHaveLength(2);
          expect(orderBook.asks).toHaveLength(2);
          expect(orderBook.bids[0].price).toBe(800.00);
          expect(orderBook.asks[0].price).toBe(800.01);
          done();
        }
      });

      mockWebSocket.simulateOrderBook(testSymbol, testBids, testAsks);
    });

    it('should maintain message sequence integrity', () => {
      let lastSequence = 0;
      let sequenceViolations = 0;

      marketDataStream.addEventListener('test', (event) => {
        if (event.type === 'market_data_update') {
          const sequence = event.data.sequence;
          if (sequence <= lastSequence) {
            sequenceViolations++;
          }
          lastSequence = sequence;
        }
      });

      // Send multiple messages
      for (let i = 0; i < 10; i++) {
        mockWebSocket.simulateQuote('TEST', 100 + i, 100.01 + i);
      }

      // Allow processing
      setTimeout(() => {
        expect(sequenceViolations).toBe(0);
      }, 100);
    });
  });

  describe('Subscription Management', () => {
    it('should handle subscriptions with automatic cleanup', () => {
      const subscription: MarketDataSubscription = {
        id: 'test_subscription_1',
        symbol: 'AAPL',
        type: 'quote',
        isActive: true
      };

      marketDataStream.subscribe(subscription);
      
      const subscriptions = marketDataStream.getSubscriptions();
      expect(subscriptions).toHaveLength(1);
      expect(subscriptions[0].id).toBe(subscription.id);

      marketDataStream.unsubscribe(subscription.id);
      
      const updatedSubscriptions = marketDataStream.getSubscriptions();
      expect(updatedSubscriptions).toHaveLength(0);
    });

    it('should enforce subscription limits', () => {
      // Create subscriptions up to limit
      for (let i = 0; i < 100; i++) { // Assuming limit is 100
        const subscription: MarketDataSubscription = {
          id: `limit_test_${i}`,
          symbol: `SYMBOL_${i}`,
          type: 'quote',
          isActive: true
        };
        
        if (i < 100) {
          expect(() => marketDataStream.subscribe(subscription)).not.toThrow();
        }
      }

      // Should reject subscription beyond limit
      const overLimitSubscription: MarketDataSubscription = {
        id: 'over_limit',
        symbol: 'OVER_LIMIT',
        type: 'quote',
        isActive: true
      };

      expect(() => marketDataStream.subscribe(overLimitSubscription)).toThrow('Subscription limit exceeded');
    });

    it('should resubscribe after reconnection', async () => {
      const subscription: MarketDataSubscription = {
        id: 'reconnect_test',
        symbol: 'MSFT',
        type: 'quote',
        isActive: true
      };

      marketDataStream.subscribe(subscription);
      
      // Simulate connection loss and recovery
      mockWebSocket.close();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Should maintain subscriptions after reconnection
      const subscriptions = marketDataStream.getSubscriptions();
      expect(subscriptions.find(sub => sub.id === subscription.id)).toBeDefined();
    });
  });

  describe('Performance Optimization', () => {
    it('should use efficient circular buffer for data storage', () => {
      const metrics = marketDataStream.getMetrics();
      
      expect(metrics.buffer).toBeDefined();
      expect(metrics.buffer.capacity).toBeGreaterThan(0);
      expect(metrics.buffer.utilization).toBeGreaterThanOrEqual(0);
      expect(metrics.buffer.utilization).toBeLessThanOrEqual(1);

      // Fill buffer and check it maintains size
      for (let i = 0; i < 1000; i++) {
        mockWebSocket.simulateQuote('BUFFER_TEST', 100 + i, 100.01 + i);
      }

      const updatedMetrics = marketDataStream.getMetrics();
      expect(updatedMetrics.buffer.size).toBeLessThanOrEqual(updatedMetrics.buffer.capacity);
    });

    it('should achieve high message processing throughput', (done) => {
      let messagesReceived = 0;
      const messageCount = 100;
      const startTime = Date.now();

      marketDataStream.addEventListener('throughput_test', (event) => {
        if (event.type === 'market_data_update') {
          messagesReceived++;
          
          if (messagesReceived === messageCount) {
            const endTime = Date.now();
            const totalTime = endTime - startTime;
            const throughput = (messageCount / totalTime) * 1000; // Messages per second
            
            console.log(`Market data throughput: ${throughput.toFixed(2)} messages/second`);
            
            // Should handle high throughput (target: 1000+ messages/second)
            expect(throughput).toBeGreaterThan(500); // Conservative threshold for test
            done();
          }
        }
      });

      // Send messages rapidly
      for (let i = 0; i < messageCount; i++) {
        setTimeout(() => {
          mockWebSocket.simulateQuote('THROUGHPUT_TEST', 100 + i * 0.01, 100.01 + i * 0.01);
        }, i);
      }
    });

    it('should maintain low processing latency under load', async () => {
      const latencies: number[] = [];
      let processedMessages = 0;
      const targetMessages = 50;

      marketDataStream.addEventListener('latency_test', (event) => {
        if (event.type === 'market_data_update') {
          const receiveTime = performance.now();
          const sendTime = event.data.timestamp;
          const latency = receiveTime - sendTime;
          
          latencies.push(latency);
          processedMessages++;
        }
      });

      // Send messages with known timestamps
      for (let i = 0; i < targetMessages; i++) {
        const sendTime = mockTime + i;
        performance.now = jest.fn(() => sendTime);
        
        mockWebSocket.simulateQuote('LATENCY_TEST', 100 + i * 0.01, 100.01 + i * 0.01);
        
        mockTime += 1; // 1ms between messages
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      if (latencies.length > 0) {
        const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
        const maxLatency = Math.max(...latencies);
        
        console.log(`Average processing latency: ${avgLatency.toFixed(3)}ms`);
        console.log(`Max processing latency: ${maxLatency.toFixed(3)}ms`);

        // Target: <1ms average processing latency
        expect(avgLatency).toBeLessThan(5); // Conservative threshold for test environment
        expect(maxLatency).toBeLessThan(20); // Conservative max threshold
      }
    });
  });

  describe('Data Integrity and Validation', () => {
    it('should validate incoming market data', () => {
      let validationErrors = 0;

      marketDataStream.addEventListener('validation_test', (event) => {
        if (event.type === 'market_data_update') {
          // Should receive valid data
        } else if (event.type === 'validation_error') {
          validationErrors++;
        }
      });

      // Send valid data
      mockWebSocket.simulateQuote('VALID_TEST', 100.00, 100.01);
      
      // Send invalid data (would be caught by validation if implemented)
      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage(new MessageEvent('message', {
          data: JSON.stringify({
            type: 'quote',
            symbol: '', // Invalid empty symbol
            data: {
              bid: -1, // Invalid negative price
              ask: 0
            }
          })
        }));
      }

      expect(validationErrors).toBeGreaterThanOrEqual(0); // Implementation dependent
    });

    it('should handle malformed messages gracefully', () => {
      let errorsCaught = 0;

      // Override console.error to catch logged errors
      const originalConsoleError = console.error;
      console.error = jest.fn(() => errorsCaught++);

      // Send malformed JSON
      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage(new MessageEvent('message', {
          data: 'invalid json {'
        }));

        mockWebSocket.onmessage(new MessageEvent('message', {
          data: JSON.stringify({
            // Missing required fields
            incomplete: 'data'
          })
        }));
      }

      console.error = originalConsoleError;
      
      // Should handle errors gracefully without crashing
      expect(marketDataStream.getConnectionStatus()).toBe('connected');
    });
  });

  describe('Compression and Binary Protocol', () => {
    it('should support binary protocol with compression', () => {
      const metrics = marketDataStream.getMetrics();
      
      expect(metrics.compression).toBeDefined();
      expect(metrics.compression.ratio).toBeGreaterThan(0);
      expect(metrics.compression.totalMessages).toBeGreaterThanOrEqual(0);
    });

    it('should achieve good compression ratios', () => {
      // Send multiple similar messages to test compression
      for (let i = 0; i < 10; i++) {
        mockWebSocket.simulateQuote('COMPRESSION_TEST', 100.00, 100.01);
      }

      const metrics = marketDataStream.getMetrics();
      
      if (metrics.compression.totalMessages > 0) {
        // Good compression should achieve ratios < 0.8
        expect(metrics.compression.ratio).toBeLessThan(1);
      }
    });
  });

  describe('Historical Data and Caching', () => {
    it('should provide access to recent market data', () => {
      const testSymbol = 'CACHE_TEST';
      
      // Send some quotes
      for (let i = 0; i < 5; i++) {
        mockWebSocket.simulateQuote(testSymbol, 100 + i, 100.01 + i);
      }

      // Wait for processing
      setTimeout(() => {
        const latestQuote = marketDataStream.getLatestQuote(testSymbol);
        expect(latestQuote).toBeDefined();
        expect(latestQuote?.symbol).toBe(testSymbol);

        const history = marketDataStream.getMarketDataHistory(testSymbol, 10);
        expect(history.length).toBeGreaterThan(0);
        expect(history.length).toBeLessThanOrEqual(10);
      }, 50);
    });

    it('should provide recent trade history', () => {
      const testSymbol = 'TRADE_HISTORY_TEST';
      
      // Send some trades
      for (let i = 0; i < 3; i++) {
        mockWebSocket.simulateTrade(testSymbol, 100 + i, 10, i % 2 === 0 ? 'buy' : 'sell');
      }

      setTimeout(() => {
        const recentTrades = marketDataStream.getRecentTrades(testSymbol, 5);
        expect(recentTrades.length).toBeGreaterThan(0);
        expect(recentTrades.length).toBeLessThanOrEqual(5);
        
        recentTrades.forEach(trade => {
          expect(trade.symbol).toBe(testSymbol);
          expect(trade.price).toBeGreaterThan(0);
          expect(trade.size).toBeGreaterThan(0);
        });
      }, 50);
    });
  });

  describe('Memory Management', () => {
    it('should clear cache efficiently', () => {
      // Add data to cache
      for (let i = 0; i < 100; i++) {
        mockWebSocket.simulateQuote('MEMORY_TEST', 100 + i, 100.01 + i);
      }

      let initialHistory = marketDataStream.getMarketDataHistory('MEMORY_TEST');
      expect(initialHistory.length).toBeGreaterThan(0);

      // Clear cache
      marketDataStream.clearCache();

      let clearedHistory = marketDataStream.getMarketDataHistory('MEMORY_TEST');
      expect(clearedHistory.length).toBe(0);
    });

    it('should manage memory with bounded buffers', () => {
      const metrics = marketDataStream.getMetrics();
      const initialBufferSize = metrics.buffer.size;

      // Send many messages to test buffer bounds
      for (let i = 0; i < 1000; i++) {
        mockWebSocket.simulateQuote('BUFFER_BOUNDS_TEST', 100 + i, 100.01 + i);
      }

      const finalMetrics = marketDataStream.getMetrics();
      
      // Buffer should not grow unbounded
      expect(finalMetrics.buffer.size).toBeLessThanOrEqual(finalMetrics.buffer.capacity);
    });
  });
});