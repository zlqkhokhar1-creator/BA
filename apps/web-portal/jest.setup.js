// apps/web-portal/jest.setup.js

import '@testing-library/jest-dom';

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}

  observe() {
    return null;
  }

  disconnect() {
    return null;
  }

  unobserve() {
    return null;
  }
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}

  observe() {
    return null;
  }

  disconnect() {
    return null;
  }

  unobserve() {
    return null;
  }
};

// Mock PerformanceObserver
global.PerformanceObserver = class PerformanceObserver {
  constructor() {}

  observe() {
    return null;
  }

  disconnect() {
    return null;
  }

  takeRecords() {
    return [];
  }
};

// Mock performance.memory
Object.defineProperty(global.performance, 'memory', {
  writable: true,
  value: {
    usedJSHeapSize: 1024 * 1024, // 1MB
    totalJSHeapSize: 2 * 1024 * 1024, // 2MB
    jsHeapSizeLimit: 4 * 1024 * 1024, // 4MB
  },
});

// Mock performance.getEntriesByType
if (!global.performance.getEntriesByType) {
  global.performance.getEntriesByType = jest.fn(() => []);
}

// Mock performance.getEntriesByName
if (!global.performance.getEntriesByName) {
  global.performance.getEntriesByName = jest.fn(() => []);
}

// Mock performance.mark
if (!global.performance.mark) {
  global.performance.mark = jest.fn();
}

// Mock performance.measure
if (!global.performance.measure) {
  global.performance.measure = jest.fn();
}

// Mock performance.clearMarks
if (!global.performance.clearMarks) {
  global.performance.clearMarks = jest.fn();
}

// Mock performance.clearMeasures
if (!global.performance.clearMeasures) {
  global.performance.clearMeasures = jest.fn();
}

// Mock console methods to reduce test noise
const originalError = console.error;
const originalWarn = console.warn;

beforeEach(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterEach(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Mock window.location
delete window.location;
window.location = {
  href: 'http://localhost:3000',
  origin: 'http://localhost:3000',
  protocol: 'http:',
  host: 'localhost:3000',
  hostname: 'localhost',
  port: '3000',
  pathname: '/',
  search: '',
  hash: '',
  assign: jest.fn(),
  reload: jest.fn(),
  replace: jest.fn(),
};

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback) => {
  return setTimeout(callback, 16); // ~60fps
};

global.cancelAnimationFrame = (id) => {
  clearTimeout(id);
};

// Mock MessageChannel for Web Workers
global.MessageChannel = class MessageChannel {
  port1 = {
    postMessage: jest.fn(),
    onmessage: null,
    close: jest.fn(),
  };
  
  port2 = {
    postMessage: jest.fn(),
    onmessage: null,
    close: jest.fn(),
  };
};

// Mock crypto for generating random IDs
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: jest.fn().mockReturnValue(new Uint32Array(10)),
  },
});

// Suppress specific warnings in tests
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Warning: ReactDOM.render is no longer supported')
  ) {
    return;
  }
  originalConsoleWarn(...args);
};