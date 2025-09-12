// apps/web-portal/src/lib/performance/utils.ts

import * as msgpack from 'msgpack-lite';
import { LatencyMetrics, PerformanceMeasurement, CompressionResult, ValidationResult } from '@/types/performance';

// Performance measurement utilities
export class PerformanceMeasurer {
  private measurements: Map<string, PerformanceMeasurement> = new Map();
  
  start(name: string, metadata?: Record<string, any>): void {
    this.measurements.set(name, {
      name,
      startTime: performance.now(),
      metadata
    });
  }
  
  end(name: string): number {
    const measurement = this.measurements.get(name);
    if (!measurement) {
      console.warn(`No measurement started for: ${name}`);
      return 0;
    }
    
    const endTime = performance.now();
    const duration = endTime - measurement.startTime;
    
    measurement.endTime = endTime;
    measurement.duration = duration;
    
    return duration;
  }
  
  getMeasurement(name: string): PerformanceMeasurement | undefined {
    return this.measurements.get(name);
  }
  
  clear(): void {
    this.measurements.clear();
  }
  
  getAllMeasurements(): PerformanceMeasurement[] {
    return Array.from(this.measurements.values());
  }
}

// Latency calculation and statistics
export class LatencyCalculator {
  private samples: number[] = [];
  private maxSamples: number;
  
  constructor(maxSamples: number = 1000) {
    this.maxSamples = maxSamples;
  }
  
  addSample(latency: number): void {
    this.samples.push(latency);
    
    // Keep only the most recent samples
    if (this.samples.length > this.maxSamples) {
      this.samples = this.samples.slice(-this.maxSamples);
    }
  }
  
  getMetrics(): LatencyMetrics {
    if (this.samples.length === 0) {
      return {
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        p95: 0,
        p99: 0,
        stdDev: 0,
        count: 0
      };
    }
    
    const sorted = [...this.samples].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    const mean = sum / count;
    
    // Calculate standard deviation
    const variance = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count;
    const stdDev = Math.sqrt(variance);
    
    return {
      min: sorted[0],
      max: sorted[count - 1],
      mean,
      median: this.percentile(sorted, 50),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99),
      stdDev,
      count
    };
  }
  
  private percentile(sortedArray: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedArray.length - 1);
    
    if (Number.isInteger(index)) {
      return sortedArray[index];
    }
    
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }
  
  reset(): void {
    this.samples = [];
  }
}

// Memory usage monitoring
export class MemoryMonitor {
  private measurements: Array<{ timestamp: number; usage: number }> = [];
  private maxMeasurements: number;
  
  constructor(maxMeasurements: number = 100) {
    this.maxMeasurements = maxMeasurements;
  }
  
  measure(): number {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      const usage = memInfo.usedJSHeapSize / memInfo.totalJSHeapSize;
      
      this.measurements.push({
        timestamp: Date.now(),
        usage
      });
      
      // Keep only recent measurements
      if (this.measurements.length > this.maxMeasurements) {
        this.measurements = this.measurements.slice(-this.maxMeasurements);
      }
      
      return usage;
    }
    
    return 0;
  }
  
  getAverageUsage(timeWindowMs: number = 60000): number {
    const cutoffTime = Date.now() - timeWindowMs;
    const recentMeasurements = this.measurements.filter(m => m.timestamp > cutoffTime);
    
    if (recentMeasurements.length === 0) {
      return 0;
    }
    
    const sum = recentMeasurements.reduce((acc, m) => acc + m.usage, 0);
    return sum / recentMeasurements.length;
  }
  
  detectMemoryLeak(thresholdIncrease: number = 0.1): boolean {
    if (this.measurements.length < 10) {
      return false;
    }
    
    const recent = this.measurements.slice(-5);
    const older = this.measurements.slice(-10, -5);
    
    const recentAvg = recent.reduce((acc, m) => acc + m.usage, 0) / recent.length;
    const olderAvg = older.reduce((acc, m) => acc + m.usage, 0) / older.length;
    
    return (recentAvg - olderAvg) > thresholdIncrease;
  }
}

// Connection health monitoring
export class ConnectionHealthChecker {
  private lastPingTime: number = 0;
  private lastPongTime: number = 0;
  private pingInterval: number = 30000; // 30 seconds
  private timeoutThreshold: number = 60000; // 60 seconds
  
  startHealthCheck(websocket: WebSocket, onHealthChange?: (isHealthy: boolean) => void): () => void {
    const pingTimer = setInterval(() => {
      if (websocket.readyState === WebSocket.OPEN) {
        this.lastPingTime = Date.now();
        websocket.ping?.();
      }
    }, this.pingInterval);
    
    const pongHandler = () => {
      this.lastPongTime = Date.now();
    };
    
    websocket.addEventListener?.('pong', pongHandler);
    
    const healthTimer = setInterval(() => {
      const isHealthy = this.isConnectionHealthy();
      onHealthChange?.(isHealthy);
    }, 5000);
    
    return () => {
      clearInterval(pingTimer);
      clearInterval(healthTimer);
      websocket.removeEventListener?.('pong', pongHandler);
    };
  }
  
  isConnectionHealthy(): boolean {
    if (this.lastPingTime === 0) {
      return true; // No pings sent yet
    }
    
    if (this.lastPongTime === 0) {
      return Date.now() - this.lastPingTime < this.timeoutThreshold;
    }
    
    return this.lastPongTime >= this.lastPingTime;
  }
  
  getLatency(): number {
    if (this.lastPingTime === 0 || this.lastPongTime === 0) {
      return 0;
    }
    
    return Math.max(0, this.lastPongTime - this.lastPingTime);
  }
}

// Data compression utilities
export class CompressionUtils {
  static compress(data: any): CompressionResult {
    const originalData = JSON.stringify(data);
    const originalSize = new Blob([originalData]).size;
    
    try {
      const compressed = msgpack.encode(data);
      const compressedSize = compressed.length;
      
      return {
        compressed,
        originalSize,
        compressedSize,
        ratio: compressedSize / originalSize
      };
    } catch (error) {
      console.error('Compression failed:', error);
      const fallback = new TextEncoder().encode(originalData);
      return {
        compressed: fallback,
        originalSize,
        compressedSize: fallback.length,
        ratio: 1
      };
    }
  }
  
  static decompress(compressedData: Uint8Array): any {
    try {
      return msgpack.decode(compressedData);
    } catch (error) {
      console.error('Decompression failed:', error);
      // Fallback to JSON parsing
      const text = new TextDecoder().decode(compressedData);
      return JSON.parse(text);
    }
  }
}

// Data validation utilities
export class ValidationUtils {
  static validateOrderRequest(order: any): ValidationResult {
    const startTime = performance.now();
    const errors: string[] = [];
    
    // Basic validation rules
    if (!order.id || typeof order.id !== 'string') {
      errors.push('Order ID is required and must be a string');
    }
    
    if (!order.symbol || typeof order.symbol !== 'string') {
      errors.push('Symbol is required and must be a string');
    }
    
    if (!order.type || !['market', 'limit', 'stop', 'stop_limit'].includes(order.type)) {
      errors.push('Invalid order type');
    }
    
    if (!order.side || !['buy', 'sell'].includes(order.side)) {
      errors.push('Invalid order side');
    }
    
    if (typeof order.quantity !== 'number' || order.quantity <= 0) {
      errors.push('Quantity must be a positive number');
    }
    
    if (order.type === 'limit' && (typeof order.price !== 'number' || order.price <= 0)) {
      errors.push('Price is required for limit orders and must be positive');
    }
    
    const validationTime = performance.now() - startTime;
    
    return {
      isValid: errors.length === 0,
      errors,
      validationTime
    };
  }
  
  static validateMarketData(data: any): ValidationResult {
    const startTime = performance.now();
    const errors: string[] = [];
    
    if (!data.symbol || typeof data.symbol !== 'string') {
      errors.push('Symbol is required');
    }
    
    if (!data.timestamp || typeof data.timestamp !== 'number') {
      errors.push('Timestamp is required');
    }
    
    // Validate timestamp is not too old (within last 5 seconds)
    if (data.timestamp && Date.now() - data.timestamp > 5000) {
      errors.push('Market data is stale');
    }
    
    const validationTime = performance.now() - startTime;
    
    return {
      isValid: errors.length === 0,
      errors,
      validationTime
    };
  }
}

// Circular buffer implementation for high-performance data storage
export class CircularBuffer<T> {
  private buffer: Array<T | undefined>;
  private head: number = 0;
  private tail: number = 0;
  private size: number = 0;
  
  constructor(private capacity: number) {
    this.buffer = new Array(capacity);
  }
  
  push(item: T): void {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;
    
    if (this.size < this.capacity) {
      this.size++;
    } else {
      this.head = (this.head + 1) % this.capacity;
    }
  }
  
  pop(): T | undefined {
    if (this.size === 0) {
      return undefined;
    }
    
    const item = this.buffer[this.head];
    this.buffer[this.head] = undefined;
    this.head = (this.head + 1) % this.capacity;
    this.size--;
    
    return item;
  }
  
  peek(): T | undefined {
    if (this.size === 0) {
      return undefined;
    }
    
    return this.buffer[this.head];
  }
  
  getSize(): number {
    return this.size;
  }
  
  getCapacity(): number {
    return this.capacity;
  }
  
  isFull(): boolean {
    return this.size === this.capacity;
  }
  
  isEmpty(): boolean {
    return this.size === 0;
  }
  
  clear(): void {
    this.buffer.fill(undefined);
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }
  
  toArray(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.size; i++) {
      const index = (this.head + i) % this.capacity;
      const item = this.buffer[index];
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }
}

// Debounce utility for performance optimization
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate?: boolean
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    
    const callNow = immediate && !timeout;
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func(...args);
  };
}

// Throttle utility for performance optimization
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Request deduplication utility
export class RequestDeduplicator {
  private pendingRequests: Map<string, Promise<any>> = new Map();
  
  deduplicate<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key) as Promise<T>;
    }
    
    const promise = requestFn()
      .finally(() => {
        this.pendingRequests.delete(key);
      });
    
    this.pendingRequests.set(key, promise);
    return promise;
  }
  
  clear(): void {
    this.pendingRequests.clear();
  }
}

// Exponential backoff utility
export function exponentialBackoff(
  attempt: number,
  baseDelay: number = 100,
  maxDelay: number = 30000,
  jitter: boolean = true
): number {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  
  if (jitter) {
    return delay * (0.5 + Math.random() * 0.5);
  }
  
  return delay;
}

// Performance profiler
export class PerformanceProfiler {
  private profiles: Map<string, number[]> = new Map();
  
  profile<T>(name: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    
    if (!this.profiles.has(name)) {
      this.profiles.set(name, []);
    }
    
    this.profiles.get(name)!.push(duration);
    
    return result;
  }
  
  async profileAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    
    if (!this.profiles.has(name)) {
      this.profiles.set(name, []);
    }
    
    this.profiles.get(name)!.push(duration);
    
    return result;
  }
  
  getStats(name: string): LatencyMetrics | null {
    const samples = this.profiles.get(name);
    if (!samples || samples.length === 0) {
      return null;
    }
    
    const calculator = new LatencyCalculator();
    samples.forEach(sample => calculator.addSample(sample));
    return calculator.getMetrics();
  }
  
  getAllStats(): Record<string, LatencyMetrics> {
    const result: Record<string, LatencyMetrics> = {};
    
    for (const [name, samples] of this.profiles) {
      if (samples.length > 0) {
        const calculator = new LatencyCalculator();
        samples.forEach(sample => calculator.addSample(sample));
        result[name] = calculator.getMetrics();
      }
    }
    
    return result;
  }
  
  clear(name?: string): void {
    if (name) {
      this.profiles.delete(name);
    } else {
      this.profiles.clear();
    }
  }
}

// Global performance utilities instance
export const performanceMeasurer = new PerformanceMeasurer();
export const memoryMonitor = new MemoryMonitor();
export const requestDeduplicator = new RequestDeduplicator();
export const performanceProfiler = new PerformanceProfiler();

export default {
  PerformanceMeasurer,
  LatencyCalculator,
  MemoryMonitor,
  ConnectionHealthChecker,
  CompressionUtils,
  ValidationUtils,
  CircularBuffer,
  debounce,
  throttle,
  RequestDeduplicator,
  exponentialBackoff,
  PerformanceProfiler,
  performanceMeasurer,
  memoryMonitor,
  requestDeduplicator,
  performanceProfiler
};