// apps/web-portal/src/example-usage.tsx

import React from 'react';
import { TradingDashboard } from '@/components/trading/TradingDashboard';
import { initializeWebVitalsOptimization } from '@/lib/performance/web-vitals-optimizer';

/**
 * Example usage of the Ultra-Fast Order Execution System
 * This shows how to integrate the trading dashboard into a React application
 */

// Initialize Web Vitals optimization on app startup
initializeWebVitalsOptimization();

const App: React.FC = () => {
  return (
    <div className="app">
      <TradingDashboard />
    </div>
  );
};

// Performance monitoring setup
const setupPerformanceMonitoring = async () => {
  // Import systems dynamically to avoid blocking initial render
  const { getOrderExecutionSystem } = await import('@/lib/performance/order-execution');
  const { getMarketDataStreamHandler } = await import('@/lib/performance/market-data-stream');
  
  // Initialize systems
  const orderSystem = getOrderExecutionSystem();
  const marketDataHandler = getMarketDataStreamHandler();
  
  try {
    await Promise.all([
      orderSystem.initialize(),
      marketDataHandler.initialize()
    ]);
    
    console.log('✅ All trading systems initialized successfully');
    
    // Set up performance monitoring
    orderSystem.onLatencyUpdate((metrics) => {
      // Send metrics to analytics service
      if (metrics.p95 > 10) {
        console.warn(`High latency detected: P95 ${metrics.p95.toFixed(2)}ms`);
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to initialize trading systems:', error);
  }
};

// Initialize performance systems after React has rendered
setTimeout(setupPerformanceMonitoring, 100);

export default App;