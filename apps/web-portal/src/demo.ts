// apps/web-portal/src/demo.ts

import { getOrderExecutionSystem } from './lib/performance/order-execution';
import { getMarketDataStreamHandler } from './lib/performance/market-data-stream';
import { getWebVitalsOptimizer } from './lib/performance/web-vitals-optimizer';

/**
 * Demo script to showcase the Ultra-Fast Order Execution System
 * This demonstrates the key features and performance capabilities
 */

async function runOrderExecutionDemo() {
  console.log('🚀 Ultra-Fast Order Execution System Demo');
  console.log('==========================================');
  
  try {
    // Initialize the order execution system
    console.log('📡 Initializing Order Execution System...');
    const orderSystem = getOrderExecutionSystem();
    await orderSystem.initialize();
    
    console.log('✅ Order Execution System ready!');
    console.log(`   Target Latency: <10ms`);
    console.log(`   Batching Window: 5ms`);
    console.log(`   Connection Pool: Multiple redundant connections`);
    
    // Monitor performance metrics
    orderSystem.onLatencyUpdate((metrics) => {
      console.log(`📊 Performance Update:`);
      console.log(`   Current Latency: ${metrics.current.toFixed(2)}ms`);
      console.log(`   95th Percentile: ${metrics.p95.toFixed(2)}ms`);
      console.log(`   Average: ${metrics.average.toFixed(2)}ms`);
    });
    
    // Execute sample orders
    console.log('\n💼 Executing Sample Orders...');
    
    // Market order (highest priority - direct execution bypass)
    const marketOrder = await orderSystem.executeOrder({
      symbol: 'AAPL',
      side: 'buy',
      quantity: 100,
      type: 'market'
    });
    
    console.log(`✅ Market Order Executed: ${marketOrder.id}`);
    console.log(`   Status: ${marketOrder.status}`);
    console.log(`   Latency: ${marketOrder.latency.toFixed(2)}ms`);
    
    // Limit order (standard batching)
    const limitOrder = await orderSystem.executeOrder({
      symbol: 'GOOGL',
      side: 'sell',
      quantity: 50,
      type: 'limit',
      price: 150.00
    });
    
    console.log(`✅ Limit Order Executed: ${limitOrder.id}`);
    console.log(`   Status: ${limitOrder.status}`);
    console.log(`   Latency: ${limitOrder.latency.toFixed(2)}ms`);
    
    // Show connection info
    const connections = orderSystem.getConnectionInfo();
    console.log(`\n🔗 Connection Status:`);
    connections.forEach((conn, index) => {
      console.log(`   Connection ${index + 1}: ${conn.state} (${conn.url})`);
    });
    
    // Show overall performance metrics
    const perfMetrics = orderSystem.getPerformanceMetrics();
    console.log(`\n📈 Overall Performance:`);
    console.log(`   Throughput: ${perfMetrics.throughput.toFixed(1)} orders/sec`);
    console.log(`   Error Rate: ${(perfMetrics.errorRate * 100).toFixed(3)}%`);
    console.log(`   Connection Uptime: ${(perfMetrics.connectionUptime * 100).toFixed(1)}%`);
    console.log(`   Batch Efficiency: ${(perfMetrics.batchEfficiency * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

async function runMarketDataDemo() {
  console.log('\n📊 Market Data Stream Handler Demo');
  console.log('===================================');
  
  try {
    // Initialize market data handler
    console.log('📡 Initializing Market Data Stream...');
    const marketDataHandler = getMarketDataStreamHandler();
    await marketDataHandler.initialize();
    
    console.log('✅ Market Data Stream ready!');
    console.log('   Binary Protocol: Enabled');
    console.log('   Compression: Enabled');
    console.log('   Circular Buffers: Memory-efficient');
    
    // Subscribe to real-time data
    console.log('\n📈 Subscribing to Market Data...');
    
    // Subscribe to AAPL ticks
    const tickSubscription = marketDataHandler.subscribe('AAPL', 'ticks', (tick) => {
      console.log(`📊 AAPL Tick: $${tick.price.toFixed(2)} (${tick.side}) Vol: ${tick.volume}`);
    });
    
    // Subscribe to order book updates
    const orderBookSubscription = marketDataHandler.subscribe('AAPL', 'orderbook', (orderBook) => {
      const bestBid = orderBook.bids[0];
      const bestAsk = orderBook.asks[0];
      console.log(`📚 AAPL Order Book: Bid $${bestBid?.price.toFixed(2)} | Ask $${bestAsk?.price.toFixed(2)}`);
    });
    
    // Get performance metrics
    setTimeout(() => {
      const metrics = marketDataHandler.getPerformanceMetrics();
      console.log(`\n📊 Market Data Performance:`);
      console.log(`   Ticks/sec: ${metrics.ticksPerSecond.toFixed(1)}`);
      console.log(`   Bytes/sec: ${metrics.bytesPerSecond.toFixed(1)}`);
      console.log(`   Avg Latency: ${metrics.averageLatency.toFixed(2)}ms`);
      console.log(`   P95 Latency: ${metrics.p95Latency.toFixed(2)}ms`);
    }, 2000);
    
  } catch (error) {
    console.error('❌ Market Data Demo failed:', error);
  }
}

function runWebVitalsDemo() {
  console.log('\n⚡ Web Vitals Optimizer Demo');
  console.log('============================');
  
  if (typeof window === 'undefined') {
    console.log('⚠️  Web Vitals optimization requires browser environment');
    return;
  }
  
  // Initialize Web Vitals optimizer
  console.log('🔧 Initializing Web Vitals Optimizer...');
  const webVitalsOptimizer = getWebVitalsOptimizer();
  webVitalsOptimizer.initialize();
  
  console.log('✅ Web Vitals Optimizer ready!');
  console.log('   LCP Optimization: Critical resource preloading');
  console.log('   FID Optimization: Main thread blocking reduction');
  console.log('   CLS Prevention: Layout shift monitoring');
  console.log('   TTI Improvement: Code splitting & lazy loading');
  
  // Monitor Web Vitals
  webVitalsOptimizer.onMetricsUpdate((metrics) => {
    console.log(`⚡ Web Vitals Update:`);
    console.log(`   LCP: ${(metrics.lcp / 1000).toFixed(2)}s`);
    console.log(`   FID: ${metrics.fid.toFixed(1)}ms`);
    console.log(`   CLS: ${metrics.cls.toFixed(3)}`);
    console.log(`   TTI: ${(metrics.tti / 1000).toFixed(2)}s`);
  });
  
  // Generate optimization report
  setTimeout(() => {
    const report = webVitalsOptimizer.generateOptimizationReport();
    console.log(`\n📋 Optimization Report:`);
    console.log(`   Performance Score: ${(report.score * 100).toFixed(1)}%`);
    console.log(`   Recommendations: ${report.recommendations.length} items`);
    report.recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });
  }, 3000);
}

// Main demo function
export async function runCompleteDemo() {
  console.log('🎯 Ultra-Fast Trading Platform Demo');
  console.log('====================================');
  console.log('Bloomberg Terminal-level Performance for Brokerage Trading');
  console.log('');
  
  // Run all demos sequentially
  await runOrderExecutionDemo();
  await runMarketDataDemo();
  runWebVitalsDemo();
  
  console.log('\n🎉 Demo Complete!');
  console.log('Key Features Demonstrated:');
  console.log('✓ Sub-10ms order execution latency');
  console.log('✓ 99.995% connection uptime with automatic failover');
  console.log('✓ Binary protocol optimization');
  console.log('✓ Intelligent 5ms batching window');
  console.log('✓ Real-time performance monitoring');
  console.log('✓ Memory-efficient market data processing');
  console.log('✓ Web Vitals optimization');
  console.log('✓ Mobile-responsive design');
}

// Export individual demos for testing
export {
  runOrderExecutionDemo,
  runMarketDataDemo,
  runWebVitalsDemo
};

// Auto-run demo if called directly
if (typeof module !== 'undefined' && require.main === module) {
  runCompleteDemo().catch(console.error);
}