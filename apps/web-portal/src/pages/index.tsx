// apps/web-portal/src/pages/index.tsx

import dynamic from 'next/dynamic';
import Head from 'next/head';

// Dynamic import for performance optimization
const TradingDashboard = dynamic(() => import('@/components/trading/TradingDashboard'), {
  ssr: false, // Disable SSR for dashboard due to WebSocket dependencies
  loading: () => (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    </div>
  )
});

export default function Home() {
  return (
    <>
      <Head>
        <title>Ultra-Fast Trading Platform</title>
        <meta name="description" content="High-performance trading platform with sub-10ms order execution" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        
        {/* Preload critical resources */}
        <link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/api/market-data" as="fetch" crossOrigin="anonymous" />
        
        {/* Performance hints */}
        <link rel="dns-prefetch" href="//api.trading.com" />
        <link rel="preconnect" href="//market-data.trading.com" />
        
        {/* Web app manifest for PWA capabilities */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1f2937" />
      </Head>
      
      <main>
        <TradingDashboard theme="dark" />
      </main>
    </>
  );
}