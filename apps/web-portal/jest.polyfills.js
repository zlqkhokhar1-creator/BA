// apps/web-portal/jest.polyfills.js

// Polyfill for TextEncoder/TextDecoder
import { TextEncoder, TextDecoder } from 'util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Polyfill for fetch
import 'whatwg-fetch';

// Polyfill for ArrayBuffer if needed
if (typeof global.ArrayBuffer === 'undefined') {
  global.ArrayBuffer = ArrayBuffer;
}

// Polyfill for Uint8Array if needed
if (typeof global.Uint8Array === 'undefined') {
  global.Uint8Array = Uint8Array;
}

// Polyfill for performance.now if not available
if (typeof global.performance === 'undefined') {
  global.performance = {
    now: Date.now,
  };
}

// Polyfill for Event and CustomEvent
if (typeof global.Event === 'undefined') {
  global.Event = class Event {
    constructor(type, options = {}) {
      this.type = type;
      this.bubbles = options.bubbles || false;
      this.cancelable = options.cancelable || false;
      this.defaultPrevented = false;
    }

    preventDefault() {
      this.defaultPrevented = true;
    }

    stopPropagation() {}
    stopImmediatePropagation() {}
  };
}

if (typeof global.CustomEvent === 'undefined') {
  global.CustomEvent = class CustomEvent extends Event {
    constructor(type, options = {}) {
      super(type, options);
      this.detail = options.detail || null;
    }
  };
}

// Polyfill for MessageEvent
if (typeof global.MessageEvent === 'undefined') {
  global.MessageEvent = class MessageEvent extends Event {
    constructor(type, options = {}) {
      super(type, options);
      this.data = options.data || null;
      this.origin = options.origin || '';
      this.lastEventId = options.lastEventId || '';
      this.source = options.source || null;
      this.ports = options.ports || [];
    }
  };
}

// Polyfill for CloseEvent
if (typeof global.CloseEvent === 'undefined') {
  global.CloseEvent = class CloseEvent extends Event {
    constructor(type, options = {}) {
      super(type, options);
      this.code = options.code || 0;
      this.reason = options.reason || '';
      this.wasClean = options.wasClean || false;
    }
  };
}