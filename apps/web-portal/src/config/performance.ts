// apps/web-portal/src/config/performance.ts

export interface PerformanceConfig {
  // Connection settings
  primaryEndpoint: string;
  fallbackEndpoints: string[];
  maxConnections: number;
  connectionTimeout: number;
  heartbeatInterval: number;

  // Batching settings
  batchingWindow: number;
  maxBatchSize: number;
  minBatchSize: number;

  // Latency settings
  targetLatency: number;
  maxLatency: number;
  latencyAlertThreshold: number;

  // Retry settings
  maxRetries: number;
  retryBaseDelay: number;
  retryMaxDelay: number;
  exponentialBackoffFactor: number;

  // Performance thresholds
  webVitals: {
    lcpThreshold: number;
    fidThreshold: number;
    clsThreshold: number;
    ttiThreshold: number;
  };

  // Market data settings
  marketData: {
    bufferSize: number;
    compressionEnabled: boolean;
    subscriptionLimit: number;
    tickProcessingInterval: number;
  };

  // Monitoring settings
  monitoring: {
    enabled: boolean;
    sampleRate: number;
    reportingInterval: number;
    metricsRetention: number;
  };
}

const defaultConfig: PerformanceConfig = {
  // Connection settings
  primaryEndpoint: 'wss://api.brokerage.com/ws/orders',
  fallbackEndpoints: [
    'wss://backup1.brokerage.com/ws/orders',
    'wss://backup2.brokerage.com/ws/orders'
  ],
  maxConnections: 4,
  connectionTimeout: 5000,
  heartbeatInterval: 30000,

  // Batching settings - 5ms window as per requirements
  batchingWindow: 5,
  maxBatchSize: 50,
  minBatchSize: 1,

  // Latency settings - sub-10ms target as per requirements
  targetLatency: 5,
  maxLatency: 10,
  latencyAlertThreshold: 8,

  // Retry settings
  maxRetries: 3,
  retryBaseDelay: 100,
  retryMaxDelay: 5000,
  exponentialBackoffFactor: 2,

  // Performance thresholds
  webVitals: {
    lcpThreshold: 2500, // LCP under 2.5s
    fidThreshold: 100,  // FID under 100ms
    clsThreshold: 0.1,  // CLS under 0.1
    ttiThreshold: 3500  // TTI under 3.5s
  },

  // Market data settings
  marketData: {
    bufferSize: 10000,
    compressionEnabled: true,
    subscriptionLimit: 100,
    tickProcessingInterval: 1
  },

  // Monitoring settings
  monitoring: {
    enabled: true,
    sampleRate: 1.0,
    reportingInterval: 1000,
    metricsRetention: 300000 // 5 minutes
  }
};

// Environment-specific configurations
const environmentConfigs: Record<string, Partial<PerformanceConfig>> = {
  development: {
    primaryEndpoint: 'ws://localhost:8080/ws/orders',
    fallbackEndpoints: ['ws://localhost:8081/ws/orders'],
    monitoring: {
      enabled: true,
      sampleRate: 1.0
    }
  },
  
  staging: {
    primaryEndpoint: 'wss://staging-api.brokerage.com/ws/orders',
    fallbackEndpoints: [
      'wss://staging-backup.brokerage.com/ws/orders'
    ],
    monitoring: {
      enabled: true,
      sampleRate: 0.5
    }
  },

  production: {
    primaryEndpoint: 'wss://api.brokerage.com/ws/orders',
    fallbackEndpoints: [
      'wss://us-east-api.brokerage.com/ws/orders',
      'wss://us-west-api.brokerage.com/ws/orders',
      'wss://eu-api.brokerage.com/ws/orders'
    ],
    maxConnections: 8,
    monitoring: {
      enabled: true,
      sampleRate: 0.1
    }
  }
};

// Get configuration based on environment
export function getPerformanceConfig(): PerformanceConfig {
  const env = process.env.NODE_ENV || 'development';
  const envConfig = environmentConfigs[env] || {};
  
  return {
    ...defaultConfig,
    ...envConfig,
    webVitals: {
      ...defaultConfig.webVitals,
      ...(envConfig.webVitals || {})
    },
    marketData: {
      ...defaultConfig.marketData,
      ...(envConfig.marketData || {})
    },
    monitoring: {
      ...defaultConfig.monitoring,
      ...(envConfig.monitoring || {})
    }
  };
}

// Performance constants
export const PERFORMANCE_CONSTANTS = {
  // Binary protocol identifiers
  PROTOCOL_VERSION: 1,
  MESSAGE_TYPES: {
    ORDER_REQUEST: 0x01,
    ORDER_RESPONSE: 0x02,
    MARKET_DATA: 0x03,
    HEARTBEAT: 0x04,
    ERROR: 0x05
  },
  
  // Order priorities
  ORDER_PRIORITIES: {
    MARKET: 0,    // Highest priority - direct execution bypass
    LIMIT: 1,     // Standard priority
    STOP: 2,      // Lower priority
    STOP_LIMIT: 3 // Lowest priority
  },

  // Connection states
  CONNECTION_STATES: {
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    RECONNECTING: 'reconnecting',
    FAILED: 'failed'
  },

  // Performance metrics
  METRICS: {
    LATENCY_P95: 'latency_p95',
    LATENCY_P99: 'latency_p99',
    THROUGHPUT: 'throughput',
    ERROR_RATE: 'error_rate',
    CONNECTION_UPTIME: 'connection_uptime'
  }
} as const;

export type MessageType = typeof PERFORMANCE_CONSTANTS.MESSAGE_TYPES[keyof typeof PERFORMANCE_CONSTANTS.MESSAGE_TYPES];
export type OrderPriority = typeof PERFORMANCE_CONSTANTS.ORDER_PRIORITIES[keyof typeof PERFORMANCE_CONSTANTS.ORDER_PRIORITIES];
export type ConnectionState = typeof PERFORMANCE_CONSTANTS.CONNECTION_STATES[keyof typeof PERFORMANCE_CONSTANTS.CONNECTION_STATES];