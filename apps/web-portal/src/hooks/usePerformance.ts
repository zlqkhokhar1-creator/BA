// apps/web-portal/src/hooks/usePerformance.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  UsePerformanceReturn,
  UseOrderExecutionReturn,
  UseMarketDataReturn,
  SystemMetrics,
  ConnectionMetrics,
  PerformanceError,
  PerformanceEvent,
  OrderRequest,
  OrderResponse,
  MarketDataSubscription,
  MarketDataTick
} from '@/types/performance';
import { getOrderExecutionSystem } from '@/lib/performance/order-execution';
import { getMarketDataStream } from '@/lib/performance/market-data-stream';
import { getWebVitalsOptimizer } from '@/lib/performance/web-vitals-optimizer';

// Main performance monitoring hook
export function usePerformance(): UsePerformanceReturn {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [connections, setConnections] = useState<ConnectionMetrics[]>([]);
  const [alerts, setAlerts] = useState<PerformanceError[]>([]);
  const [isHealthy, setIsHealthy] = useState(true);

  const orderExecutionSystem = useRef(getOrderExecutionSystem());
  const marketDataStream = useRef(getMarketDataStream());
  const webVitalsOptimizer = useRef(getWebVitalsOptimizer());

  useEffect(() => {
    const updateMetrics = () => {
      try {
        // Collect metrics from all performance systems
        const orderMetrics = orderExecutionSystem.current.getMetrics();
        const marketDataMetrics = marketDataStream.current.getMetrics();
        const webVitalsMetrics = webVitalsOptimizer.current.getMetrics();
        const webVitalsScore = webVitalsOptimizer.current.getPerformanceScore();

        const systemMetrics: SystemMetrics = {
          timestamp: Date.now(),
          orderExecution: {
            totalOrders: orderMetrics.connections.reduce((sum: number, conn: any) => 
              sum + (conn.messagesSent || 0), 0),
            successfulOrders: orderMetrics.connections.reduce((sum: number, conn: any) => 
              sum + (conn.messagesReceived || 0), 0),
            failedOrders: orderMetrics.connections.reduce((sum: number, conn: any) => 
              sum + (conn.errors || 0), 0),
            avgLatency: orderMetrics.latency?.mean || 0,
            p95Latency: orderMetrics.latency?.p95 || 0,
            throughput: 0 // Would calculate from time window
          },
          marketData: {
            subscriptions: marketDataMetrics.subscriptions || 0,
            messagesProcessed: marketDataMetrics.performance?.processedMessages || 0,
            compressionRatio: marketDataMetrics.compression?.ratio || 1,
            bufferUtilization: marketDataMetrics.buffer?.utilization || 0
          },
          system: {
            memoryUsage: 0, // Would get from performance.memory if available
            cpuUsage: 0,    // Not directly available in browser
            networkLatency: orderMetrics.latency?.mean || 0
          },
          webVitals: {
            lcp: webVitalsMetrics.lcp || 0,
            fid: webVitalsMetrics.fid || 0,
            cls: webVitalsMetrics.cls || 0,
            fcp: webVitalsMetrics.fcp || 0,
            ttfb: webVitalsMetrics.ttfb || 0
          }
        };

        setMetrics(systemMetrics);

        // Update connection metrics
        const connectionMetrics: ConnectionMetrics[] = [
          ...orderMetrics.connections.map((conn: any) => ({
            id: conn.id,
            status: conn.status as 'connected' | 'connecting' | 'disconnected' | 'error',
            uptime: 0,
            messagesSent: conn.messagesSent || 0,
            messagesReceived: conn.messagesReceived || 0,
            errors: conn.errors || 0,
            latency: orderMetrics.latency || {
              min: 0, max: 0, mean: 0, median: 0, p95: 0, p99: 0, stdDev: 0, count: 0
            }
          })),
          {
            id: 'market_data',
            status: marketDataStream.current.getConnectionStatus() as 'connected' | 'connecting' | 'disconnected' | 'error',
            uptime: marketDataMetrics.connection?.uptime || 0,
            messagesSent: marketDataMetrics.connection?.messagesSent || 0,
            messagesReceived: marketDataMetrics.connection?.messagesReceived || 0,
            errors: marketDataMetrics.connection?.errors || 0,
            latency: marketDataMetrics.connection?.latency || {
              min: 0, max: 0, mean: 0, median: 0, p95: 0, p99: 0, stdDev: 0, count: 0
            }
          }
        ];

        setConnections(connectionMetrics);

        // Collect alerts
        const allAlerts = [
          ...(orderMetrics.alerts || []),
          // Add market data and web vitals alerts if available
        ];
        setAlerts(allAlerts);

        // Determine overall health
        const hasConnectedSystems = connectionMetrics.some(conn => conn.status === 'connected');
        const hasHighLatency = connectionMetrics.some(conn => conn.latency.p95 > 50);
        const hasHighErrorRate = connectionMetrics.some(conn => 
          conn.errors > 0 && conn.messagesReceived > 0 && 
          (conn.errors / conn.messagesReceived) > 0.05
        );
        const hasGoodWebVitals = webVitalsScore > 75;

        setIsHealthy(hasConnectedSystems && !hasHighLatency && !hasHighErrorRate && hasGoodWebVitals);

      } catch (error) {
        console.error('Error updating performance metrics:', error);
      }
    };

    // Update metrics every 2 seconds
    const interval = setInterval(updateMetrics, 2000);
    
    // Initial update
    updateMetrics();

    return () => clearInterval(interval);
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  return {
    metrics,
    connections,
    isHealthy,
    alerts,
    clearAlerts
  };
}

// Order execution hook
export function useOrderExecution(): UseOrderExecutionReturn {
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastExecution, setLastExecution] = useState<any>(null);
  const [queueSize, setQueueSize] = useState(0);
  const [avgLatency, setAvgLatency] = useState(0);

  const orderExecutionSystem = useRef(getOrderExecutionSystem());

  useEffect(() => {
    const handleEvent = (event: PerformanceEvent) => {
      if (event.type === 'order_executed') {
        setLastExecution(event.data);
        setIsExecuting(false);
      } else if (event.type === 'metric_update') {
        setQueueSize(event.data.queueSize || 0);
        setAvgLatency(event.data.latency?.mean || 0);
      }
    };

    const listenerId = `order-execution-${Date.now()}`;
    orderExecutionSystem.current.addEventListener(listenerId, handleEvent);

    return () => {
      orderExecutionSystem.current.removeEventListener(listenerId);
    };
  }, []);

  const execute = useCallback(async (order: OrderRequest): Promise<OrderResponse> => {
    setIsExecuting(true);
    
    try {
      const response = await orderExecutionSystem.current.executeOrder(order);
      return response;
    } catch (error) {
      console.error('Order execution error:', error);
      throw error;
    } finally {
      setIsExecuting(false);
    }
  }, []);

  return {
    execute,
    isExecuting,
    lastExecution,
    queueSize,
    avgLatency
  };
}

// Market data hook
export function useMarketData(): UseMarketDataReturn {
  const [data, setData] = useState<Map<string, MarketDataTick>>(new Map());
  const [subscriptions, setSubscriptions] = useState<MarketDataSubscription[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');

  const marketDataStream = useRef(getMarketDataStream());
  const dataRef = useRef(new Map<string, MarketDataTick>());

  useEffect(() => {
    const handleEvent = (event: PerformanceEvent) => {
      if (event.type === 'market_data_update') {
        const tick = event.data as MarketDataTick;
        const key = `${tick.symbol}_${tick.type}`;
        
        dataRef.current.set(key, tick);
        setData(new Map(dataRef.current));
      } else if (event.type === 'market_data_connected') {
        setConnectionStatus('connected');
      } else if (event.type === 'market_data_disconnected') {
        setConnectionStatus('disconnected');
      }
    };

    const listenerId = `market-data-${Date.now()}`;
    marketDataStream.current.addEventListener(listenerId, handleEvent);

    // Initial status
    setConnectionStatus(marketDataStream.current.getConnectionStatus());
    setSubscriptions(marketDataStream.current.getSubscriptions());

    return () => {
      marketDataStream.current.removeEventListener(listenerId);
    };
  }, []);

  const subscribe = useCallback((subscription: MarketDataSubscription) => {
    marketDataStream.current.subscribe(subscription);
    setSubscriptions(prev => [...prev, subscription]);
  }, []);

  const unsubscribe = useCallback((subscriptionId: string) => {
    marketDataStream.current.unsubscribe(subscriptionId);
    setSubscriptions(prev => prev.filter(sub => sub.id !== subscriptionId));
  }, []);

  return {
    subscribe,
    unsubscribe,
    data,
    subscriptions,
    connectionStatus
  };
}

// Web Vitals monitoring hook
export function useWebVitals() {
  const [metrics, setMetrics] = useState({
    lcp: null as number | null,
    fid: null as number | null,
    cls: null as number | null,
    fcp: null as number | null,
    ttfb: null as number | null
  });
  const [score, setScore] = useState(0);
  const [alerts, setAlerts] = useState<PerformanceError[]>([]);

  const webVitalsOptimizer = useRef(getWebVitalsOptimizer());

  useEffect(() => {
    const handleEvent = (event: PerformanceEvent) => {
      if (event.type === 'metric_update') {
        setMetrics(event.data.metrics);
        setScore(event.data.score);
      } else if (event.type === 'performance_alert') {
        setAlerts(prev => [...prev, event.data]);
      }
    };

    const listenerId = `web-vitals-${Date.now()}`;
    webVitalsOptimizer.current.addEventListener(listenerId, handleEvent);

    // Initial metrics
    setMetrics(webVitalsOptimizer.current.getMetrics());
    setScore(webVitalsOptimizer.current.getPerformanceScore());

    return () => {
      webVitalsOptimizer.current.removeEventListener(listenerId);
    };
  }, []);

  const checkBudgets = useCallback(() => {
    return webVitalsOptimizer.current.checkPerformanceBudgets();
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  return {
    metrics,
    score,
    alerts,
    checkBudgets,
    clearAlerts
  };
}

// Real-time latency monitoring hook
export function useLatencyMonitoring(thresholdMs: number = 10) {
  const [currentLatency, setCurrentLatency] = useState(0);
  const [averageLatency, setAverageLatency] = useState(0);
  const [p95Latency, setP95Latency] = useState(0);
  const [isHighLatency, setIsHighLatency] = useState(false);
  const [alerts, setAlerts] = useState<PerformanceError[]>([]);

  const { metrics } = usePerformance();

  useEffect(() => {
    if (metrics) {
      const latency = metrics.orderExecution.avgLatency;
      const p95 = metrics.orderExecution.p95Latency;
      
      setCurrentLatency(latency);
      setAverageLatency(latency);
      setP95Latency(p95);
      setIsHighLatency(latency > thresholdMs);

      if (latency > thresholdMs) {
        const alert: PerformanceError = {
          code: 'high_latency',
          message: `Current latency ${latency.toFixed(2)}ms exceeds threshold ${thresholdMs}ms`,
          timestamp: Date.now(),
          severity: 'high'
        };
        
        setAlerts(prev => {
          // Avoid duplicate alerts within 5 seconds
          const recentAlert = prev.find(a => 
            a.code === alert.code && 
            Date.now() - a.timestamp < 5000
          );
          
          if (recentAlert) return prev;
          return [...prev, alert];
        });
      }
    }
  }, [metrics, thresholdMs]);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  return {
    currentLatency,
    averageLatency,
    p95Latency,
    isHighLatency,
    alerts,
    clearAlerts
  };
}

// Connection health monitoring hook
export function useConnectionHealth() {
  const [healthStatus, setHealthStatus] = useState<Record<string, {
    status: string;
    uptime: number;
    lastError?: string;
    latency: number;
  }>>({});

  const { connections } = usePerformance();

  useEffect(() => {
    const status: typeof healthStatus = {};
    
    connections.forEach(conn => {
      status[conn.id] = {
        status: conn.status,
        uptime: Date.now() - conn.uptime,
        lastError: conn.lastError,
        latency: conn.latency.mean
      };
    });

    setHealthStatus(status);
  }, [connections]);

  const isHealthy = Object.values(healthStatus).every(conn => 
    conn.status === 'connected' && conn.latency < 50
  );

  const getWorstConnection = useCallback(() => {
    return Object.entries(healthStatus).reduce((worst, [id, conn]) => {
      if (!worst || conn.latency > worst.latency) {
        return { id, ...conn };
      }
      return worst;
    }, null as any);
  }, [healthStatus]);

  return {
    healthStatus,
    isHealthy,
    getWorstConnection
  };
}

// Performance optimization suggestions hook
export function usePerformanceOptimizations() {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  const { metrics } = usePerformance();
  const { metrics: webVitals, checkBudgets } = useWebVitals();

  useEffect(() => {
    const newSuggestions: string[] = [];

    if (metrics) {
      // Order execution optimizations
      if (metrics.orderExecution.avgLatency > 5) {
        newSuggestions.push('Consider optimizing order validation or using binary protocol');
      }

      if (metrics.orderExecution.p95Latency > 10) {
        newSuggestions.push('95th percentile latency is high - check connection stability');
      }

      // Market data optimizations
      if (metrics.marketData.bufferUtilization > 0.8) {
        newSuggestions.push('Market data buffer utilization is high - consider increasing buffer size');
      }

      if (metrics.marketData.compressionRatio > 0.7) {
        newSuggestions.push('Enable better compression for market data to reduce bandwidth');
      }

      // Web Vitals optimizations
      if (webVitals.lcp && webVitals.lcp > 2500) {
        newSuggestions.push('LCP is slow - optimize critical resource loading and preload hero images');
      }

      if (webVitals.cls && webVitals.cls > 0.1) {
        newSuggestions.push('CLS is high - add size attributes to images and reserve space for dynamic content');
      }

      if (webVitals.fid && webVitals.fid > 100) {
        newSuggestions.push('FID is slow - optimize JavaScript execution and consider code splitting');
      }
    }

    setSuggestions(newSuggestions);
  }, [metrics, webVitals]);

  return { suggestions };
}

export default usePerformance;