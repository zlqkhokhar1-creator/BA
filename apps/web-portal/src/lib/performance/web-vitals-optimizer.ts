// apps/web-portal/src/lib/performance/web-vitals-optimizer.ts

import { webVitalsConfig } from '@/config/performance';
import { PerformanceEvent, PerformanceError } from '@/types/performance';
import { CircularBuffer, MemoryMonitor, performanceMeasurer, debounce } from './utils';

interface WebVitalsMetrics {
  lcp: number | null;
  fid: number | null;
  cls: number | null;
  fcp: number | null;
  ttfb: number | null;
  inp: number | null; // Interaction to Next Paint
}

interface ResourceTiming {
  name: string;
  startTime: number;
  duration: number;
  transferSize: number;
  renderBlockingStatus?: string;
}

interface LayoutShiftEntry {
  value: number;
  sources: any[];
  hadRecentInput: boolean;
  startTime: number;
}

export class WebVitalsOptimizer {
  private metrics: WebVitalsMetrics = {
    lcp: null,
    fid: null,
    cls: null,
    fcp: null,
    ttfb: null,
    inp: null
  };

  private observer: PerformanceObserver | null = null;
  private memoryMonitor: MemoryMonitor;
  private performanceBuffer: CircularBuffer<any>;
  private eventListeners: Map<string, (event: PerformanceEvent) => void> = new Map();
  private performanceAlerts: CircularBuffer<PerformanceError>;
  private layoutShifts: LayoutShiftEntry[] = [];
  private clsValue = 0;
  private sessionId = Math.random().toString(36).substr(2, 9);
  private isMonitoring = false;
  private resourceMap = new Map<string, ResourceTiming>();
  
  // Preload management
  private preloadedResources = new Set<string>();
  private criticalResources = new Set<string>();
  
  // Code splitting optimization
  private loadedChunks = new Set<string>();
  private pendingChunks = new Map<string, Promise<any>>();

  // Performance budgets
  private performanceBudgets = {
    lcp: webVitalsConfig.lcpThreshold,
    fid: webVitalsConfig.fidThreshold,
    cls: webVitalsConfig.clsThreshold,
    fcp: 1800, // 1.8 seconds
    ttfb: 600,  // 600ms
    totalBlockingTime: 200,
    speedIndex: 3000
  };

  // Debounced methods
  private debouncedEmitMetrics: () => void;
  private debouncedOptimizeResources: () => void;

  constructor() {
    this.memoryMonitor = new MemoryMonitor();
    this.performanceBuffer = new CircularBuffer<any>(webVitalsConfig.performanceBufferSize);
    this.performanceAlerts = new CircularBuffer<PerformanceError>(100);

    // Create debounced methods for performance
    this.debouncedEmitMetrics = debounce(this.emitMetricsUpdate.bind(this), 1000);
    this.debouncedOptimizeResources = debounce(this.optimizeResourceLoading.bind(this), 500);

    this.initialize();
  }

  private initialize(): void {
    if (typeof window === 'undefined') {
      return; // Server-side rendering
    }

    this.measureTTFB();
    this.observeWebVitals();
    this.optimizeResourceLoading();
    this.enableCodeSplittingOptimization();
    this.startMemoryLeakDetection();
    this.preloadCriticalResources();
    
    // Start monitoring
    this.isMonitoring = true;
    
    // Initial metrics collection
    setTimeout(() => {
      this.collectInitialMetrics();
    }, 1000);

    console.log('Web Vitals Optimizer initialized');
  }

  // Largest Contentful Paint (LCP) optimization
  private observeLCP(): void {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1] as PerformanceEntry & {
        renderTime?: number;
        loadTime?: number;
        element?: Element;
      };

      if (lastEntry) {
        const lcpValue = lastEntry.renderTime || lastEntry.loadTime || lastEntry.startTime;
        this.metrics.lcp = lcpValue;
        
        this.performanceBuffer.push({
          type: 'lcp',
          value: lcpValue,
          timestamp: Date.now(),
          element: lastEntry.element?.tagName || 'unknown'
        });

        // LCP optimization alerts
        if (lcpValue > this.performanceBudgets.lcp) {
          this.recordAlert('lcp_threshold_exceeded', 
            `LCP: ${lcpValue.toFixed(2)}ms exceeds threshold of ${this.performanceBudgets.lcp}ms`, 
            'high');
          
          // Trigger LCP optimization
          this.optimizeLCP(lastEntry.element);
        }

        this.debouncedEmitMetrics();
      }
    });

    observer.observe({ type: 'largest-contentful-paint', buffered: true });
  }

  // First Input Delay (FID) and Interaction to Next Paint (INP) optimization
  private observeFID(): void {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      
      entries.forEach(entry => {
        if (entry.entryType === 'first-input') {
          const fidEntry = entry as PerformanceEntry & { processingStart: number };
          const fidValue = fidEntry.processingStart - fidEntry.startTime;
          this.metrics.fid = fidValue;
          
          this.performanceBuffer.push({
            type: 'fid',
            value: fidValue,
            timestamp: Date.now()
          });

          if (fidValue > this.performanceBudgets.fid) {
            this.recordAlert('fid_threshold_exceeded', 
              `FID: ${fidValue.toFixed(2)}ms exceeds threshold of ${this.performanceBudgets.fid}ms`, 
              'high');
          }
        }

        // Also track INP (Interaction to Next Paint)
        if (entry.entryType === 'event') {
          const eventEntry = entry as PerformanceEntry & { 
            processingStart: number; 
            processingEnd: number; 
          };
          const inpValue = eventEntry.processingEnd - eventEntry.startTime;
          this.metrics.inp = Math.max(this.metrics.inp || 0, inpValue);
        }
      });

      this.debouncedEmitMetrics();
    });

    observer.observe({ type: 'first-input', buffered: true });
    
    // Also observe event timing for INP
    try {
      observer.observe({ type: 'event', buffered: true });
    } catch (e) {
      // Event timing not supported in all browsers
    }
  }

  // Cumulative Layout Shift (CLS) optimization with session-based measurement
  private observeCLS(): void {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries() as (PerformanceEntry & LayoutShiftEntry)[];
      
      entries.forEach(entry => {
        // Only count layout shifts without recent user input
        if (!entry.hadRecentInput) {
          this.layoutShifts.push(entry);
          this.clsValue += entry.value;
          
          this.performanceBuffer.push({
            type: 'cls',
            value: entry.value,
            cumulativeValue: this.clsValue,
            timestamp: Date.now(),
            sources: entry.sources
          });

          // Identify problematic elements
          if (entry.value > 0.1) {
            this.recordAlert('large_layout_shift', 
              `Large layout shift detected: ${entry.value.toFixed(4)}`, 
              'medium');
            
            this.optimizeCLS(entry);
          }
        }
      });

      this.metrics.cls = this.clsValue;
      
      if (this.clsValue > this.performanceBudgets.cls) {
        this.recordAlert('cls_threshold_exceeded', 
          `CLS: ${this.clsValue.toFixed(4)} exceeds threshold of ${this.performanceBudgets.cls}`, 
          'high');
      }

      this.debouncedEmitMetrics();
    });

    observer.observe({ type: 'layout-shift', buffered: true });
  }

  // First Contentful Paint (FCP) monitoring
  private observeFCP(): void {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
      
      if (fcpEntry) {
        this.metrics.fcp = fcpEntry.startTime;
        
        this.performanceBuffer.push({
          type: 'fcp',
          value: fcpEntry.startTime,
          timestamp: Date.now()
        });

        if (fcpEntry.startTime > this.performanceBudgets.fcp) {
          this.recordAlert('fcp_threshold_exceeded', 
            `FCP: ${fcpEntry.startTime.toFixed(2)}ms exceeds threshold of ${this.performanceBudgets.fcp}ms`, 
            'medium');
        }
      }
    });

    observer.observe({ type: 'paint', buffered: true });
  }

  // Time to First Byte (TTFB) measurement
  private measureTTFB(): void {
    if (typeof window === 'undefined') return;

    const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navEntry) {
      const ttfb = navEntry.responseStart - navEntry.fetchStart;
      this.metrics.ttfb = ttfb;
      
      if (ttfb > this.performanceBudgets.ttfb) {
        this.recordAlert('ttfb_threshold_exceeded', 
          `TTFB: ${ttfb.toFixed(2)}ms exceeds threshold of ${this.performanceBudgets.ttfb}ms`, 
          'medium');
      }
    }
  }

  // Comprehensive Web Vitals observation
  private observeWebVitals(): void {
    this.observeLCP();
    this.observeFID();
    this.observeCLS();
    this.observeFCP();
    this.observeResourceTiming();
  }

  // Resource timing optimization
  private observeResourceTiming(): void {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries() as PerformanceResourceTiming[];
      
      entries.forEach(entry => {
        const resource: ResourceTiming = {
          name: entry.name,
          startTime: entry.startTime,
          duration: entry.duration,
          transferSize: entry.transferSize || 0,
          renderBlockingStatus: (entry as any).renderBlockingStatus
        };

        this.resourceMap.set(entry.name, resource);
        
        // Identify slow resources
        if (entry.duration > 1000) { // > 1 second
          this.recordAlert('slow_resource', 
            `Slow resource: ${entry.name} (${entry.duration.toFixed(2)}ms)`, 
            'medium');
        }

        // Identify large resources
        if (entry.transferSize > 1024 * 1024) { // > 1MB
          this.recordAlert('large_resource', 
            `Large resource: ${entry.name} (${(entry.transferSize / 1024 / 1024).toFixed(2)}MB)`, 
            'medium');
        }
      });

      this.debouncedOptimizeResources();
    });

    observer.observe({ type: 'resource', buffered: true });
  }

  // LCP-specific optimizations
  private optimizeLCP(element?: Element): void {
    if (!element) return;

    // Preload LCP resource if it's an image
    if (element.tagName === 'IMG') {
      const img = element as HTMLImageElement;
      this.preloadResource(img.src, 'image');
    }

    // Add performance hints for LCP elements
    if (element.tagName === 'IMG' || element.tagName === 'VIDEO') {
      const mediaElement = element as HTMLImageElement | HTMLVideoElement;
      
      // Add priority hint if supported
      if ('loading' in mediaElement) {
        mediaElement.loading = 'eager';
      }
      
      // Add fetchpriority if supported
      if ('fetchPriority' in mediaElement) {
        (mediaElement as any).fetchPriority = 'high';
      }
    }
  }

  // CLS optimization
  private optimizeCLS(layoutShift: LayoutShiftEntry): void {
    // Add size attributes to images without dimensions
    document.querySelectorAll('img:not([width]):not([height])').forEach(img => {
      const imageElement = img as HTMLImageElement;
      if (imageElement.naturalWidth && imageElement.naturalHeight) {
        imageElement.width = imageElement.naturalWidth;
        imageElement.height = imageElement.naturalHeight;
      }
    });

    // Reserve space for dynamic content
    layoutShift.sources?.forEach((source: any) => {
      if (source.node) {
        const element = source.node;
        if (!element.style.minHeight && element.scrollHeight > 0) {
          element.style.minHeight = `${element.scrollHeight}px`;
        }
      }
    });
  }

  // Resource loading optimization
  private optimizeResourceLoading(): void {
    // Preload critical resources
    this.preloadCriticalResources();
    
    // Optimize font loading
    this.optimizeFontLoading();
    
    // Optimize image loading
    this.optimizeImageLoading();
    
    // Optimize JavaScript loading
    this.optimizeJavaScriptLoading();
  }

  // Critical resource preloading
  private preloadCriticalResources(): void {
    if (!webVitalsConfig.preloadCriticalResources) return;

    const criticalResources = [
      // Critical CSS
      ...Array.from(document.querySelectorAll('link[rel="stylesheet"]')).slice(0, 2),
      // Critical fonts
      ...Array.from(document.querySelectorAll('link[rel="preload"][as="font"]')),
      // Hero images
      ...Array.from(document.querySelectorAll('img[data-priority="high"]'))
    ];

    criticalResources.forEach(resource => {
      const element = resource as HTMLLinkElement | HTMLImageElement;
      let href = '';
      
      if ('href' in element) {
        href = element.href;
      } else if ('src' in element) {
        href = element.src;
      }
      
      if (href && !this.preloadedResources.has(href)) {
        this.preloadResource(href, this.getResourceType(element));
      }
    });
  }

  // Resource preloading
  private preloadResource(href: string, type: string): void {
    if (this.preloadedResources.has(href)) return;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = href;
    link.as = type;
    
    if (type === 'font') {
      link.crossOrigin = 'anonymous';
    }
    
    document.head.appendChild(link);
    this.preloadedResources.add(href);
  }

  private getResourceType(element: Element): string {
    if (element.tagName === 'LINK') {
      const link = element as HTMLLinkElement;
      if (link.rel === 'stylesheet') return 'style';
      if (link.as) return link.as;
    }
    
    if (element.tagName === 'IMG') return 'image';
    if (element.tagName === 'SCRIPT') return 'script';
    
    return 'fetch';
  }

  // Font loading optimization
  private optimizeFontLoading(): void {
    // Add font-display: swap to improve CLS
    const fontFaces = document.fonts;
    if (fontFaces) {
      fontFaces.forEach((font: FontFace) => {
        if (!font.display) {
          (font as any).display = 'swap';
        }
      });
    }

    // Preload critical fonts
    document.querySelectorAll('link[rel="preload"][as="font"]').forEach(link => {
      const fontLink = link as HTMLLinkElement;
      if (!fontLink.crossOrigin) {
        fontLink.crossOrigin = 'anonymous';
      }
    });
  }

  // Image loading optimization
  private optimizeImageLoading(): void {
    // Add lazy loading to off-screen images
    const images = document.querySelectorAll('img:not([loading])');
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          if (!img.loading) {
            img.loading = 'lazy';
          }
          imageObserver.unobserve(img);
        }
      });
    }, {
      rootMargin: '50px'
    });

    images.forEach(img => {
      const rect = img.getBoundingClientRect();
      if (rect.top > window.innerHeight) {
        imageObserver.observe(img);
      }
    });

    // Add size attributes to prevent CLS
    document.querySelectorAll('img:not([width]):not([height])').forEach(img => {
      const imageElement = img as HTMLImageElement;
      imageElement.addEventListener('load', () => {
        if (!imageElement.width && !imageElement.height) {
          imageElement.width = imageElement.naturalWidth;
          imageElement.height = imageElement.naturalHeight;
        }
      });
    });
  }

  // JavaScript loading optimization
  private optimizeJavaScriptLoading(): void {
    // Add async/defer to non-critical scripts
    document.querySelectorAll('script[src]:not([async]):not([defer])').forEach(script => {
      const scriptElement = script as HTMLScriptElement;
      if (!scriptElement.src.includes('critical')) {
        scriptElement.defer = true;
      }
    });
  }

  // Code splitting optimization
  private enableCodeSplittingOptimization(): void {
    if (!webVitalsConfig.enableCodeSplitting) return;

    // Implement intelligent code splitting
    this.implementIntelligentCodeSplitting();
    
    // Prefetch likely-needed chunks
    this.prefetchLikelyChunks();
  }

  private implementIntelligentCodeSplitting(): void {
    // Monitor route changes for chunk loading patterns
    if (typeof window !== 'undefined' && 'navigation' in window) {
      // Modern navigation API
      // Implementation would depend on routing library
    }
  }

  private prefetchLikelyChunks(): void {
    // Prefetch chunks based on user behavior
    const commonRoutes = ['/dashboard', '/orders', '/portfolio'];
    
    commonRoutes.forEach(route => {
      const chunkName = route.substring(1) || 'home';
      if (!this.loadedChunks.has(chunkName)) {
        this.prefetchChunk(chunkName);
      }
    });
  }

  private prefetchChunk(chunkName: string): void {
    if (this.pendingChunks.has(chunkName)) return;

    const prefetchPromise = new Promise((resolve) => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = `/chunks/${chunkName}.js`;
      link.onload = () => resolve(true);
      link.onerror = () => resolve(false);
      document.head.appendChild(link);
    });

    this.pendingChunks.set(chunkName, prefetchPromise);
  }

  // Memory leak detection
  private startMemoryLeakDetection(): void {
    if (!webVitalsConfig.memoryLeakDetection) return;

    setInterval(() => {
      const memoryUsage = this.memoryMonitor.measure();
      const isLeaking = this.memoryMonitor.detectMemoryLeak(0.1);
      
      if (isLeaking) {
        this.recordAlert('memory_leak_detected', 
          `Potential memory leak detected. Current usage: ${(memoryUsage * 100).toFixed(1)}%`, 
          'high');
        
        // Trigger garbage collection if available
        if ('gc' in window) {
          (window as any).gc();
        }
      }
    }, 30000); // Check every 30 seconds
  }

  // Collect initial metrics
  private collectInitialMetrics(): void {
    const paintEntries = performance.getEntriesByType('paint');
    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    // Collect paint metrics
    paintEntries.forEach(entry => {
      if (entry.name === 'first-contentful-paint' && !this.metrics.fcp) {
        this.metrics.fcp = entry.startTime;
      }
    });

    // Collect navigation metrics
    if (navigationEntry && !this.metrics.ttfb) {
      this.metrics.ttfb = navigationEntry.responseStart - navigationEntry.fetchStart;
    }

    this.emitMetricsUpdate();
  }

  // Performance budget monitoring
  public checkPerformanceBudgets(): { passed: boolean; violations: string[] } {
    const violations: string[] = [];
    
    if (this.metrics.lcp && this.metrics.lcp > this.performanceBudgets.lcp) {
      violations.push(`LCP: ${this.metrics.lcp.toFixed(2)}ms > ${this.performanceBudgets.lcp}ms`);
    }
    
    if (this.metrics.fid && this.metrics.fid > this.performanceBudgets.fid) {
      violations.push(`FID: ${this.metrics.fid.toFixed(2)}ms > ${this.performanceBudgets.fid}ms`);
    }
    
    if (this.metrics.cls && this.metrics.cls > this.performanceBudgets.cls) {
      violations.push(`CLS: ${this.metrics.cls.toFixed(4)} > ${this.performanceBudgets.cls}`);
    }
    
    if (this.metrics.fcp && this.metrics.fcp > this.performanceBudgets.fcp) {
      violations.push(`FCP: ${this.metrics.fcp.toFixed(2)}ms > ${this.performanceBudgets.fcp}ms`);
    }
    
    if (this.metrics.ttfb && this.metrics.ttfb > this.performanceBudgets.ttfb) {
      violations.push(`TTFB: ${this.metrics.ttfb.toFixed(2)}ms > ${this.performanceBudgets.ttfb}ms`);
    }

    return {
      passed: violations.length === 0,
      violations
    };
  }

  // Public API methods
  public getMetrics(): WebVitalsMetrics {
    return { ...this.metrics };
  }

  public getPerformanceScore(): number {
    let score = 100;
    
    if (this.metrics.lcp) {
      score -= Math.max(0, (this.metrics.lcp - this.performanceBudgets.lcp) / 100);
    }
    
    if (this.metrics.fid) {
      score -= Math.max(0, (this.metrics.fid - this.performanceBudgets.fid) / 10);
    }
    
    if (this.metrics.cls) {
      score -= Math.max(0, (this.metrics.cls - this.performanceBudgets.cls) * 100);
    }
    
    return Math.max(0, Math.min(100, score));
  }

  public getResourceMetrics(): ResourceTiming[] {
    return Array.from(this.resourceMap.values());
  }

  public updatePerformanceBudgets(budgets: Partial<typeof this.performanceBudgets>): void {
    this.performanceBudgets = { ...this.performanceBudgets, ...budgets };
  }

  // Event system
  private emitMetricsUpdate(): void {
    const event: PerformanceEvent = {
      type: 'metric_update',
      data: {
        metrics: this.metrics,
        score: this.getPerformanceScore(),
        budgets: this.performanceBudgets,
        memoryUsage: this.memoryMonitor.getAverageUsage()
      },
      timestamp: Date.now(),
      source: 'web_vitals'
    };

    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Event listener error:', error);
      }
    });
  }

  public addEventListener(id: string, listener: (event: PerformanceEvent) => void): void {
    this.eventListeners.set(id, listener);
  }

  public removeEventListener(id: string): void {
    this.eventListeners.delete(id);
  }

  // Error handling
  private recordAlert(code: string, message: string, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): void {
    const alert: PerformanceError = {
      code,
      message,
      timestamp: Date.now(),
      severity
    };
    
    this.performanceAlerts.push(alert);
    
    // Emit alert event
    this.eventListeners.forEach(listener => {
      try {
        listener({
          type: 'performance_alert',
          data: alert,
          timestamp: Date.now(),
          source: 'web_vitals'
        });
      } catch (error) {
        console.error('Event listener error:', error);
      }
    });
  }

  // Cleanup
  public shutdown(): void {
    this.isMonitoring = false;
    
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    this.eventListeners.clear();
    this.performanceBuffer.clear();
    
    console.log('Web Vitals Optimizer shutdown complete');
  }
}

// Singleton instance
let webVitalsInstance: WebVitalsOptimizer | null = null;

export function getWebVitalsOptimizer(): WebVitalsOptimizer {
  if (!webVitalsInstance) {
    webVitalsInstance = new WebVitalsOptimizer();
  }
  return webVitalsInstance;
}

export { WebVitalsOptimizer };