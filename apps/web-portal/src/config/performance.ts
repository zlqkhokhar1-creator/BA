// apps/web-portal/src/config/performance.ts

import { PerformanceConfig } from '@/types/performance';

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Base configuration
const baseConfig: PerformanceConfig = {
  orderExecution: {
    endpoints: [
      process.env.NEXT_PUBLIC_ORDER_WS_URL || 'wss://api.trading.com/orders',
      process.env.NEXT_PUBLIC_ORDER_WS_URL_2 || 'wss://api2.trading.com/orders',
      process.env.NEXT_PUBLIC_ORDER_WS_URL_3 || 'wss://api3.trading.com/orders'
    ],
    fallbackEndpoints: [
      process.env.NEXT_PUBLIC_FALLBACK_WS_URL || 'wss://fallback.trading.com/orders',
      process.env.NEXT_PUBLIC_FALLBACK_WS_URL_2 || 'wss://fallback2.trading.com/orders'
    ],
    connectionPoolSize: 3,
    batchingWindow: 5, // 5ms batching window
    maxBatchSize: 10,
    timeoutMs: 3000,
    retryAttempts: 3,
    exponentialBackoffBase: 100,
    validationTimeout: 1, // <1ms validation target
    priorityBypass: true
  },
  marketData: {
    endpoints: [
      process.env.NEXT_PUBLIC_MARKET_DATA_WS_URL || 'wss://market-data.trading.com/stream',
      process.env.NEXT_PUBLIC_MARKET_DATA_WS_URL_2 || 'wss://market-data2.trading.com/stream'
    ],
    subscriptionLimit: 100,
    bufferSize: 10000, // Ring buffer size for tick data
    compressionEnabled: true,
    tickPrecision: 6, // Microsecond precision
    cacheSize: 1000,
    throttleMs: 1,
    integrityCheckEnabled: true
  },
  webVitals: {
    lcpThreshold: 2500, // <2.5s LCP target
    fidThreshold: 100, // <100ms FID target  
    clsThreshold: 0.1, // <0.1 CLS target
    preloadCriticalResources: true,
    enableCodeSplitting: true,
    memoryLeakDetection: true,
    performanceBufferSize: 1000
  },
  monitoring: {
    metricsCollectionInterval: 1000, // 1 second
    latencyPercentiles: [50, 75, 90, 95, 99, 99.9],
    alertThresholds: {
      latencyWarning: 5, // 5ms warning
      latencyError: 10, // 10ms error
      connectionDropWarning: 2,
      errorRateWarning: 0.01, // 1% error rate
      errorRateError: 0.05 // 5% error rate
    },
    enableLogging: true,
    logLevel: isDevelopment ? 'debug' : 'info'
  },
  circuitBreaker: {
    failureThreshold: 5,
    recoveryTimeout: 30000, // 30 seconds
    monitoringWindow: 60000 // 1 minute
  }
};

// Environment-specific configurations
const environmentConfigs: Record<string, Partial<PerformanceConfig>> = {
  development: {
    orderExecution: {
      endpoints: ['wss://localhost:8080/orders'],
      fallbackEndpoints: ['wss://localhost:8081/orders'],
      timeoutMs: 5000,
      validationTimeout: 5 // Relaxed for debugging
    },
    marketData: {
      endpoints: ['wss://localhost:8080/market-data'],
      compressionEnabled: false, // Disable for easier debugging
      bufferSize: 1000
    },
    webVitals: {
      lcpThreshold: 5000, // Relaxed for development
      memoryLeakDetection: true
    },
    monitoring: {
      logLevel: 'debug' as const,
      metricsCollectionInterval: 500
    }
  },
  staging: {
    orderExecution: {
      endpoints: [
        'wss://staging-api.trading.com/orders',
        'wss://staging-api2.trading.com/orders'
      ],
      timeoutMs: 2000
    },
    marketData: {
      endpoints: ['wss://staging-market-data.trading.com/stream'],
      bufferSize: 5000
    },
    monitoring: {
      logLevel: 'info' as const
    }
  },
  production: {
    orderExecution: {
      endpoints: [
        'wss://api.trading.com/orders',
        'wss://api-east.trading.com/orders',
        'wss://api-west.trading.com/orders'
      ],
      fallbackEndpoints: [
        'wss://fallback-east.trading.com/orders',
        'wss://fallback-west.trading.com/orders'
      ],
      timeoutMs: 1000, // Aggressive timeout for production
      validationTimeout: 0.5 // Ultra-fast validation
    },
    marketData: {
      endpoints: [
        'wss://market-data-east.trading.com/stream',
        'wss://market-data-west.trading.com/stream'
      ],
      bufferSize: 50000, // Large buffer for high volume
      compressionEnabled: true
    },
    webVitals: {
      lcpThreshold: 2000, // Aggressive LCP target
      memoryLeakDetection: true
    },
    monitoring: {
      logLevel: 'warn' as const,
      metricsCollectionInterval: 2000
    }
  }
};

// Feature flags for A/B testing
export const featureFlags = {
  enableBinaryProtocol: process.env.NEXT_PUBLIC_ENABLE_BINARY_PROTOCOL === 'true',
  enableCompressionOptimization: process.env.NEXT_PUBLIC_ENABLE_COMPRESSION === 'true',
  enableAdvancedCaching: process.env.NEXT_PUBLIC_ENABLE_ADVANCED_CACHING === 'true',
  enablePredictivePreloading: process.env.NEXT_PUBLIC_ENABLE_PREDICTIVE_PRELOAD === 'true',
  enableWebWorkers: process.env.NEXT_PUBLIC_ENABLE_WEB_WORKERS === 'true',
  enableServiceWorker: process.env.NEXT_PUBLIC_ENABLE_SERVICE_WORKER === 'true'
};

// Rate limiting configurations
export const rateLimitConfig = {
  orderExecution: {
    requestsPerSecond: isProduction ? 1000 : 100,
    burstLimit: isProduction ? 50 : 10,
    windowMs: 1000
  },
  marketData: {
    subscriptionsPerSecond: 10,
    messagesPerSecond: isProduction ? 10000 : 1000,
    windowMs: 1000
  }
};

// Cache configurations
export const cacheConfig = {
  marketData: {
    ttl: 5000, // 5 seconds
    maxSize: 10000,
    strategy: 'lru' as const
  },
  orderHistory: {
    ttl: 300000, // 5 minutes
    maxSize: 1000,
    strategy: 'lru' as const
  },
  staticData: {
    ttl: 3600000, // 1 hour
    maxSize: 100,
    strategy: 'lru' as const
  }
};

// Get environment-specific configuration
function getEnvironmentConfig(): PerformanceConfig {
  const environment = process.env.NODE_ENV || 'development';
  const envConfig = environmentConfigs[environment] || {};
  
  return mergeDeep(baseConfig, envConfig);
}

// Deep merge utility function
function mergeDeep(target: any, source: any): any {
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          output[key] = source[key];
        } else {
          output[key] = mergeDeep(target[key], source[key]);
        }
      } else {
        output[key] = source[key];
      }
    });
  }
  
  return output;
}

function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}

// Export the configuration
export const performanceConfig = getEnvironmentConfig();

// Export individual configurations for easier access
export const orderExecutionConfig = performanceConfig.orderExecution;
export const marketDataConfig = performanceConfig.marketData;
export const webVitalsConfig = performanceConfig.webVitals;
export const monitoringConfig = performanceConfig.monitoring;
export const circuitBreakerConfig = performanceConfig.circuitBreaker;

// Runtime configuration overrides
export function updateConfig(updates: Partial<PerformanceConfig>): void {
  Object.assign(performanceConfig, mergeDeep(performanceConfig, updates));
}

// Configuration validation
export function validateConfig(config: PerformanceConfig): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate order execution config
  if (!config.orderExecution.endpoints.length) {
    errors.push('At least one order execution endpoint must be configured');
  }
  
  if (config.orderExecution.batchingWindow < 1) {
    errors.push('Batching window must be at least 1ms');
  }
  
  if (config.orderExecution.validationTimeout > 5) {
    errors.push('Validation timeout should be less than 5ms for optimal performance');
  }
  
  // Validate market data config
  if (!config.marketData.endpoints.length) {
    errors.push('At least one market data endpoint must be configured');
  }
  
  if (config.marketData.bufferSize < 100) {
    errors.push('Buffer size should be at least 100 for efficient processing');
  }
  
  // Validate web vitals config
  if (config.webVitals.lcpThreshold > 4000) {
    errors.push('LCP threshold should be under 4000ms for good user experience');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Performance monitoring thresholds
export const performanceThresholds = {
  orderExecution: {
    excellent: 2, // <2ms
    good: 5, // <5ms  
    acceptable: 10, // <10ms
    poor: 20 // >20ms
  },
  marketData: {
    processingDelay: 1, // <1ms processing delay
    bufferUtilization: 0.8, // 80% buffer utilization warning
    compressionRatio: 0.3 // 30% compression ratio target
  },
  system: {
    memoryUsage: 0.85, // 85% memory usage warning
    cpuUsage: 0.8, // 80% CPU usage warning
    networkLatency: 50 // 50ms network latency warning
  }
};

export default performanceConfig;