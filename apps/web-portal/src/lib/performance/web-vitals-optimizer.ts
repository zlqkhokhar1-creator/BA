// apps/web-portal/src/lib/performance/web-vitals-optimizer.ts

import { getPerformanceConfig, type PerformanceConfig } from '@/config/performance';

// Web Vitals interfaces
export interface WebVitalsMetrics {
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  tti: number; // Time to Interactive
  fcp: number; // First Contentful Paint
  ttfb: number; // Time to First Byte
}

export interface PerformanceEntry {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
  [key: string]: any;
}

export interface ResourceTiming {
  name: string;
  type: 'script' | 'stylesheet' | 'image' | 'font' | 'fetch' | 'other';
  size: number;
  loadTime: number;
  priority: 'high' | 'medium' | 'low';
}

export interface OptimizationReport {
  score: number;
  metrics: WebVitalsMetrics;
  recommendations: string[];
  resources: ResourceTiming[];
  timestamp: number;
}

// Performance observer for Core Web Vitals
class WebVitalsObserver {
  private metrics: Partial<WebVitalsMetrics> = {};
  private observers: PerformanceObserver[] = [];
  private listeners: Array<(metrics: WebVitalsMetrics) => void> = [];
  private config: PerformanceConfig;

  constructor(config: PerformanceConfig) {
    this.config = config;
    this.initializeObservers();
  }

  private initializeObservers(): void {
    // Largest Contentful Paint (LCP)
    if ('PerformanceObserver' in window && 'largest-contentful-paint' in PerformanceObserver.supportedEntryTypes) {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.metrics.lcp = lastEntry.startTime;
        this.notifyListeners();
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(lcpObserver);
    }

    // First Input Delay (FID)
    if ('PerformanceObserver' in window && 'first-input' in PerformanceObserver.supportedEntryTypes) {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          this.metrics.fid = entry.processingStart - entry.startTime;
          this.notifyListeners();
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
      this.observers.push(fidObserver);
    }

    // Cumulative Layout Shift (CLS)
    if ('PerformanceObserver' in window && 'layout-shift' in PerformanceObserver.supportedEntryTypes) {
      let clsValue = 0;
      let clsEntries: any[] = [];
      
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsEntries.push(entry);
            clsValue += entry.value;
          }
        });
        
        this.metrics.cls = this.calculateCLS(clsEntries);
        this.notifyListeners();
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(clsObserver);
    }

    // Navigation timing for other metrics
    this.observeNavigationTiming();
  }

  private observeNavigationTiming(): void {
    if ('performance' in window && 'getEntriesByType' in performance) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (entry.entryType === 'navigation') {
            this.metrics.fcp = entry.firstContentfulPaint || 0;
            this.metrics.ttfb = entry.responseStart - entry.requestStart;
            this.metrics.tti = this.calculateTTI(entry);
            this.notifyListeners();
          }
        });
      });
      
      observer.observe({ entryTypes: ['navigation'] });
      this.observers.push(observer);
    }
  }

  private calculateCLS(entries: any[]): number {
    // Calculate CLS based on session windows
    let maxSessionValue = 0;
    let currentSessionValue = 0;
    let lastEntryTime = 0;
    
    entries.forEach((entry) => {
      // Start new session if gap > 1s or entry > 5s after first entry in session
      if (entry.startTime - lastEntryTime > 1000 || entry.startTime - entries[0].startTime > 5000) {
        maxSessionValue = Math.max(maxSessionValue, currentSessionValue);
        currentSessionValue = 0;
      }
      
      currentSessionValue += entry.value;
      lastEntryTime = entry.startTime;
    });
    
    return Math.max(maxSessionValue, currentSessionValue);
  }

  private calculateTTI(navigationEntry: any): number {
    // Simplified TTI calculation - in production, use more sophisticated algorithm
    const domContentLoaded = navigationEntry.domContentLoadedEventEnd - navigationEntry.navigationStart;
    const loadComplete = navigationEntry.loadEventEnd - navigationEntry.navigationStart;
    
    // TTI is typically between DOMContentLoaded and load complete
    return domContentLoaded + (loadComplete - domContentLoaded) * 0.7;
  }

  public getMetrics(): WebVitalsMetrics {
    return {
      lcp: this.metrics.lcp || 0,
      fid: this.metrics.fid || 0,
      cls: this.metrics.cls || 0,
      tti: this.metrics.tti || 0,
      fcp: this.metrics.fcp || 0,
      ttfb: this.metrics.ttfb || 0
    };
  }

  public onMetricsUpdate(listener: (metrics: WebVitalsMetrics) => void): void {
    this.listeners.push(listener);
  }

  private notifyListeners(): void {
    const metrics = this.getMetrics();
    this.listeners.forEach(listener => listener(metrics));
  }

  public disconnect(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// Resource loading optimizer
class ResourceLoadingOptimizer {
  private config: PerformanceConfig;
  private priorityMap: Map<string, 'high' | 'medium' | 'low'> = new Map();
  
  constructor(config: PerformanceConfig) {
    this.config = config;
    this.initializePriorityMap();
  }

  private initializePriorityMap(): void {
    // Critical trading components get high priority
    this.priorityMap.set('trading', 'high');
    this.priorityMap.set('order-execution', 'high');
    this.priorityMap.set('market-data', 'high');
    
    // UI components get medium priority
    this.priorityMap.set('dashboard', 'medium');
    this.priorityMap.set('charts', 'medium');
    
    // Analytics and non-critical features get low priority
    this.priorityMap.set('analytics', 'low');
    this.priorityMap.set('reports', 'low');
  }

  public optimizeResourceLoading(): void {
    // Preload critical resources
    this.preloadCriticalResources();
    
    // Set up resource hints
    this.setupResourceHints();
    
    // Optimize font loading
    this.optimizeFontLoading();
    
    // Implement lazy loading for non-critical images
    this.setupLazyLoading();
  }

  private preloadCriticalResources(): void {
    const criticalResources = [
      { href: '/js/order-execution.js', as: 'script' },
      { href: '/js/market-data.js', as: 'script' },
      { href: '/css/trading-dashboard.css', as: 'style' },
      { href: '/fonts/roboto-bold.woff2', as: 'font', type: 'font/woff2', crossorigin: 'anonymous' }
    ];

    criticalResources.forEach(resource => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = resource.href;
      link.as = resource.as;
      
      if (resource.type) {
        link.type = resource.type;
      }
      
      if (resource.crossorigin) {
        link.crossOrigin = resource.crossorigin;
      }
      
      document.head.appendChild(link);
    });
  }

  private setupResourceHints(): void {
    // DNS prefetch for external domains
    const externalDomains = [
      'api.brokerage.com',
      'cdn.tradingcharts.com',
      'analytics.trading.com'
    ];

    externalDomains.forEach(domain => {
      const link = document.createElement('link');
      link.rel = 'dns-prefetch';
      link.href = `//${domain}`;
      document.head.appendChild(link);
    });

    // Preconnect to critical domains
    const criticalDomains = [
      'api.brokerage.com',
      'ws.brokerage.com'
    ];

    criticalDomains.forEach(domain => {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = `https://${domain}`;
      document.head.appendChild(link);
    });
  }

  private optimizeFontLoading(): void {
    // Use font-display: swap for better FCP
    const style = document.createElement('style');
    style.textContent = `
      @font-face {
        font-family: 'Trading-Font';
        src: url('/fonts/trading-font.woff2') format('woff2');
        font-display: swap;
      }
    `;
    document.head.appendChild(style);
  }

  private setupLazyLoading(): void {
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
              imageObserver.unobserve(img);
            }
          }
        });
      });

      // Observe all images with data-src attribute
      document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
      });
    }
  }

  public getResourceTiming(): ResourceTiming[] {
    if (!('performance' in window)) return [];

    const entries = performance.getEntriesByType('resource') as any[];
    
    return entries.map(entry => ({
      name: entry.name,
      type: this.getResourceType(entry.name),
      size: entry.transferSize || 0,
      loadTime: entry.responseEnd - entry.startTime,
      priority: this.getResourcePriority(entry.name)
    }));
  }

  private getResourceType(url: string): ResourceTiming['type'] {
    if (url.includes('.js')) return 'script';
    if (url.includes('.css')) return 'stylesheet';
    if (url.includes('.woff') || url.includes('.ttf')) return 'font';
    if (url.includes('.jpg') || url.includes('.png') || url.includes('.svg')) return 'image';
    if (url.includes('/api/') || url.includes('fetch')) return 'fetch';
    return 'other';
  }

  private getResourcePriority(url: string): ResourceTiming['priority'] {
    for (const [key, priority] of this.priorityMap.entries()) {
      if (url.includes(key)) {
        return priority;
      }
    }
    return 'medium';
  }
}

// Performance budget monitor
class PerformanceBudgetMonitor {
  private config: PerformanceConfig;
  private budgets = {
    totalJavaScript: 250 * 1024, // 250KB
    totalCSS: 50 * 1024, // 50KB
    totalImages: 500 * 1024, // 500KB
    totalFonts: 100 * 1024, // 100KB
    firstPartyScripts: 150 * 1024, // 150KB
    thirdPartyScripts: 100 * 1024 // 100KB
  };

  constructor(config: PerformanceConfig) {
    this.config = config;
  }

  public checkBudgets(): { passed: boolean; violations: string[]; usage: any } {
    const resources = this.getResourceSizes();
    const violations: string[] = [];
    let passed = true;

    // Check each budget
    if (resources.javascript > this.budgets.totalJavaScript) {
      violations.push(`JavaScript budget exceeded: ${(resources.javascript / 1024).toFixed(1)}KB > ${(this.budgets.totalJavaScript / 1024).toFixed(1)}KB`);
      passed = false;
    }

    if (resources.css > this.budgets.totalCSS) {
      violations.push(`CSS budget exceeded: ${(resources.css / 1024).toFixed(1)}KB > ${(this.budgets.totalCSS / 1024).toFixed(1)}KB`);
      passed = false;
    }

    if (resources.images > this.budgets.totalImages) {
      violations.push(`Images budget exceeded: ${(resources.images / 1024).toFixed(1)}KB > ${(this.budgets.totalImages / 1024).toFixed(1)}KB`);
      passed = false;
    }

    return {
      passed,
      violations,
      usage: {
        javascript: `${(resources.javascript / 1024).toFixed(1)}KB / ${(this.budgets.totalJavaScript / 1024).toFixed(1)}KB`,
        css: `${(resources.css / 1024).toFixed(1)}KB / ${(this.budgets.totalCSS / 1024).toFixed(1)}KB`,
        images: `${(resources.images / 1024).toFixed(1)}KB / ${(this.budgets.totalImages / 1024).toFixed(1)}KB`,
        fonts: `${(resources.fonts / 1024).toFixed(1)}KB / ${(this.budgets.totalFonts / 1024).toFixed(1)}KB`
      }
    };
  }

  private getResourceSizes(): { javascript: number; css: number; images: number; fonts: number } {
    if (!('performance' in window)) {
      return { javascript: 0, css: 0, images: 0, fonts: 0 };
    }

    const entries = performance.getEntriesByType('resource') as any[];
    const sizes = { javascript: 0, css: 0, images: 0, fonts: 0 };

    entries.forEach(entry => {
      const size = entry.transferSize || 0;
      const url = entry.name;

      if (url.includes('.js')) {
        sizes.javascript += size;
      } else if (url.includes('.css')) {
        sizes.css += size;
      } else if (url.match(/\.(jpg|jpeg|png|gif|svg|webp)$/)) {
        sizes.images += size;
      } else if (url.match(/\.(woff|woff2|ttf|otf)$/)) {
        sizes.fonts += size;
      }
    });

    return sizes;
  }
}

// Main Web Vitals Optimizer
export class WebVitalsOptimizer {
  private config: PerformanceConfig;
  private vitalsObserver: WebVitalsObserver;
  private resourceOptimizer: ResourceLoadingOptimizer;
  private budgetMonitor: PerformanceBudgetMonitor;
  private isInitialized = false;
  private reportingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.config = getPerformanceConfig();
    this.vitalsObserver = new WebVitalsObserver(this.config);
    this.resourceOptimizer = new ResourceLoadingOptimizer(this.config);
    this.budgetMonitor = new PerformanceBudgetMonitor(this.config);
  }

  public initialize(): void {
    if (typeof window === 'undefined') {
      console.warn('Web Vitals Optimizer can only run in browser environment');
      return;
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.initializeOptimizations();
      });
    } else {
      this.initializeOptimizations();
    }

    this.isInitialized = true;
  }

  private initializeOptimizations(): void {
    // Optimize resource loading
    this.resourceOptimizer.optimizeResourceLoading();

    // Optimize Critical Rendering Path
    this.optimizeCriticalRenderingPath();

    // Prevent layout shifts
    this.preventLayoutShifts();

    // Optimize Time to Interactive
    this.optimizeTimeToInteractive();

    // Start performance monitoring
    this.startPerformanceMonitoring();

    console.log('Web Vitals Optimizer initialized successfully');
  }

  private optimizeCriticalRenderingPath(): void {
    // Inline critical CSS
    this.inlineCriticalCSS();

    // Defer non-critical CSS
    this.deferNonCriticalCSS();

    // Optimize JavaScript loading
    this.optimizeJavaScriptLoading();
  }

  private inlineCriticalCSS(): void {
    // Critical CSS for trading dashboard (simplified example)
    const criticalCSS = `
      .trading-dashboard { 
        display: grid; 
        grid-template-columns: 1fr 300px; 
        height: 100vh; 
      }
      .order-form { 
        position: sticky; 
        top: 0; 
      }
      .market-data { 
        overflow-y: auto; 
      }
    `;

    const style = document.createElement('style');
    style.textContent = criticalCSS;
    document.head.appendChild(style);
  }

  private deferNonCriticalCSS(): void {
    // Load non-critical CSS asynchronously
    const nonCriticalCSS = [
      '/css/charts.css',
      '/css/analytics.css',
      '/css/reports.css'
    ];

    nonCriticalCSS.forEach(href => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'style';
      link.href = href;
      link.onload = () => {
        link.rel = 'stylesheet';
      };
      document.head.appendChild(link);
    });
  }

  private optimizeJavaScriptLoading(): void {
    // Use dynamic imports for non-critical JavaScript
    const loadNonCriticalJS = () => {
      // Use setTimeout to simulate dynamic loading
      // In a real implementation, these would be actual module imports
      setTimeout(() => {
        console.log('Loading non-critical JavaScript modules...');
      }, 100);
    };

    // Load after initial render
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(loadNonCriticalJS, { timeout: 3000 });
    } else {
      setTimeout(loadNonCriticalJS, 100);
    }
  }

  private preventLayoutShifts(): void {
    // Reserve space for dynamic content
    this.reserveSpaceForDynamicContent();

    // Ensure images and ads have dimensions
    this.ensureImageDimensions();

    // Avoid inserting content above existing content
    this.avoidContentInsertion();
  }

  private reserveSpaceForDynamicContent(): void {
    // Add CSS classes for consistent sizing
    const style = document.createElement('style');
    style.textContent = `
      .market-data-placeholder {
        min-height: 200px;
        background: #f5f5f5;
      }
      .chart-placeholder {
        width: 100%;
        height: 400px;
        background: #f0f0f0;
      }
    `;
    document.head.appendChild(style);
  }

  private ensureImageDimensions(): void {
    // Set explicit dimensions for images
    document.querySelectorAll('img:not([width]):not([height])').forEach(img => {
      const imgElement = img as HTMLImageElement;
      
      // Set placeholder dimensions
      imgElement.style.width = imgElement.style.width || '100%';
      imgElement.style.height = imgElement.style.height || 'auto';
      imgElement.style.aspectRatio = '16/9'; // Default aspect ratio
    });
  }

  private avoidContentInsertion(): void {
    // Use append instead of prepend for new content
    // Implement this in application logic, not here
  }

  private optimizeTimeToInteractive(): void {
    // Code splitting for faster TTI
    this.implementCodeSplitting();

    // Reduce main thread blocking time
    this.reduceMainThreadBlocking();

    // Optimize third-party scripts
    this.optimizeThirdPartyScripts();
  }

  private implementCodeSplitting(): void {
    // Code splitting for faster TTI
    // This would be handled at build time with webpack/rollup
    // Here we simulate by deferring non-critical functionality
    
    const deferredFeatures = [
      'advanced-charts',
      'portfolio-analytics',
      'trade-history',
      'settings-panel'
    ];

    deferredFeatures.forEach(feature => {
      // Load feature only when needed
      document.addEventListener(`load-${feature}`, () => {
        // Simulate module loading
        console.log(`Loading ${feature} module...`);
      });
    });
  }

  private reduceMainThreadBlocking(): void {
    // Use requestIdleCallback for non-critical work
    const performNonCriticalWork = () => {
      // Example: Update secondary metrics
      this.updateSecondaryMetrics();
    };

    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(performNonCriticalWork, { timeout: 5000 });
    } else {
      setTimeout(performNonCriticalWork, 100);
    }
  }

  private updateSecondaryMetrics(): void {
    // Placeholder for non-critical metric updates
    // This would include portfolio calculations, analytics, etc.
  }

  private optimizeThirdPartyScripts(): void {
    // Load third-party scripts asynchronously
    const thirdPartyScripts = [
      { src: 'https://www.googletagmanager.com/gtag/js?id=GA_TRACKING_ID', async: true },
      { src: 'https://connect.facebook.net/en_US/fbevents.js', defer: true }
    ];

    thirdPartyScripts.forEach(({ src, async, defer }) => {
      const script = document.createElement('script');
      script.src = src;
      
      if (async) script.async = true;
      if (defer) script.defer = true;
      
      document.head.appendChild(script);
    });
  }

  private startPerformanceMonitoring(): void {
    this.reportingInterval = setInterval(() => {
      const report = this.generateOptimizationReport();
      
      // Log performance alerts
      if (report.score < 0.75) {
        console.warn('Performance score below threshold:', report);
      }
      
      // Send to analytics (if configured)
      if (this.config.monitoring.enabled) {
        this.sendPerformanceReport(report);
      }
    }, this.config.monitoring.reportingInterval);
  }

  public generateOptimizationReport(): OptimizationReport {
    const metrics = this.vitalsObserver.getMetrics();
    const resources = this.resourceOptimizer.getResourceTiming();
    const budgetCheck = this.budgetMonitor.checkBudgets();
    
    // Calculate overall score
    const score = this.calculatePerformanceScore(metrics);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(metrics, budgetCheck);

    return {
      score,
      metrics,
      recommendations,
      resources,
      timestamp: Date.now()
    };
  }

  private calculatePerformanceScore(metrics: WebVitalsMetrics): number {
    const weights = { lcp: 0.25, fid: 0.25, cls: 0.25, tti: 0.25 };
    let score = 0;

    // LCP score (0-1)
    const lcpScore = metrics.lcp <= this.config.webVitals.lcpThreshold ? 1 : 
      Math.max(0, 1 - (metrics.lcp - this.config.webVitals.lcpThreshold) / 2500);
    score += lcpScore * weights.lcp;

    // FID score (0-1)
    const fidScore = metrics.fid <= this.config.webVitals.fidThreshold ? 1 : 
      Math.max(0, 1 - (metrics.fid - this.config.webVitals.fidThreshold) / 200);
    score += fidScore * weights.fid;

    // CLS score (0-1)
    const clsScore = metrics.cls <= this.config.webVitals.clsThreshold ? 1 : 
      Math.max(0, 1 - (metrics.cls - this.config.webVitals.clsThreshold) / 0.15);
    score += clsScore * weights.cls;

    // TTI score (0-1)
    const ttiScore = metrics.tti <= this.config.webVitals.ttiThreshold ? 1 : 
      Math.max(0, 1 - (metrics.tti - this.config.webVitals.ttiThreshold) / 3500);
    score += ttiScore * weights.tti;

    return Math.max(0, Math.min(1, score));
  }

  private generateRecommendations(metrics: WebVitalsMetrics, budgetCheck: any): string[] {
    const recommendations: string[] = [];

    if (metrics.lcp > this.config.webVitals.lcpThreshold) {
      recommendations.push('Optimize LCP by reducing server response time and optimizing above-the-fold content');
    }

    if (metrics.fid > this.config.webVitals.fidThreshold) {
      recommendations.push('Reduce FID by breaking up long-running JavaScript tasks');
    }

    if (metrics.cls > this.config.webVitals.clsThreshold) {
      recommendations.push('Prevent CLS by setting explicit dimensions for images and ads');
    }

    if (metrics.tti > this.config.webVitals.ttiThreshold) {
      recommendations.push('Improve TTI by reducing JavaScript execution time and deferring non-critical scripts');
    }

    // Add budget-related recommendations
    budgetCheck.violations.forEach((violation: string) => {
      recommendations.push(`Performance budget violation: ${violation}`);
    });

    return recommendations;
  }

  private sendPerformanceReport(report: OptimizationReport): void {
    // Send to analytics endpoint (placeholder)
    if (navigator.sendBeacon) {
      const data = JSON.stringify({
        type: 'performance-report',
        data: report
      });
      
      navigator.sendBeacon('/api/analytics/performance', data);
    }
  }

  public getMetrics(): WebVitalsMetrics {
    return this.vitalsObserver.getMetrics();
  }

  public onMetricsUpdate(callback: (metrics: WebVitalsMetrics) => void): void {
    this.vitalsObserver.onMetricsUpdate(callback);
  }

  public destroy(): void {
    if (this.reportingInterval) {
      clearInterval(this.reportingInterval);
    }
    
    this.vitalsObserver.disconnect();
    this.isInitialized = false;
  }
}

// Singleton instance for global access
let globalWebVitalsOptimizer: WebVitalsOptimizer | null = null;

export function getWebVitalsOptimizer(): WebVitalsOptimizer {
  if (!globalWebVitalsOptimizer) {
    globalWebVitalsOptimizer = new WebVitalsOptimizer();
  }
  return globalWebVitalsOptimizer;
}

// Helper function to initialize Web Vitals optimization
export function initializeWebVitalsOptimization(): void {
  const optimizer = getWebVitalsOptimizer();
  optimizer.initialize();
}