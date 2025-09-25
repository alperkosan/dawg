/**
 * @file performance.js
 * @description Performans optimizasyonu için yardımcı fonksiyonlar
 */

/**
 * Throttle function - belirtilen sürede maksimum bir kez çalışır
 */
export const throttle = (func, limit) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Debounce function - son çağrıdan sonra belirtilen süre bekler
 */
export const debounce = (func, delay) => {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
};

/**
 * RAF throttle - requestAnimationFrame ile throttle
 */
export const rafThrottle = (func) => {
  let rafId;
  let lastArgs;

  const throttled = (...args) => {
    lastArgs = args;
    if (!rafId) {
      rafId = requestAnimationFrame(() => {
        func.apply(this, lastArgs);
        rafId = null;
      });
    }
  };

  throttled.cancel = () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  return throttled;
};

/**
 * Viewport intersection checker - element görünür mü?
 */
export const isInViewport = (element, container, padding = 0) => {
  if (!element || !container) return false;

  const elementRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  return (
    elementRect.right >= containerRect.left - padding &&
    elementRect.left <= containerRect.right + padding &&
    elementRect.bottom >= containerRect.top - padding &&
    elementRect.top <= containerRect.bottom + padding
  );
};

/**
 * Rectangular intersection checker - iki dikdörtgen kesişiyor mu?
 */
export const rectsIntersect = (rect1, rect2, padding = 0) => {
  return (
    rect1.left <= rect2.right + padding &&
    rect1.right >= rect2.left - padding &&
    rect1.top <= rect2.bottom + padding &&
    rect1.bottom >= rect2.top - padding
  );
};

/**
 * Memory-efficient object pooling
 */
class ObjectPool {
  constructor(createFn, resetFn, maxSize = 100) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
    this.pool = [];
    this.activeCount = 0;
  }

  get() {
    if (this.pool.length > 0) {
      return this.pool.pop();
    }
    this.activeCount++;
    return this.createFn();
  }

  release(obj) {
    if (this.pool.length < this.maxSize) {
      this.resetFn(obj);
      this.pool.push(obj);
      this.activeCount--;
    }
  }

  clear() {
    this.pool = [];
    this.activeCount = 0;
  }
}

// Rectangle object pool
export const rectanglePool = new ObjectPool(
  () => ({ x: 0, y: 0, width: 0, height: 0 }),
  (rect) => {
    rect.x = 0;
    rect.y = 0;
    rect.width = 0;
    rect.height = 0;
  }
);

/**
 * Performance monitoring
 */
export class PerformanceMonitor {
  constructor(sampleSize = 60) {
    this.sampleSize = sampleSize;
    this.frameTimes = [];
    this.lastFrameTime = performance.now();
  }

  tick() {
    const now = performance.now();
    const frameTime = now - this.lastFrameTime;

    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > this.sampleSize) {
      this.frameTimes.shift();
    }

    this.lastFrameTime = now;
  }

  getAverageFPS() {
    if (this.frameTimes.length === 0) return 0;
    const avgFrameTime = this.frameTimes.reduce((a, b) => a + b) / this.frameTimes.length;
    return Math.round(1000 / avgFrameTime);
  }

  getFrameTime() {
    if (this.frameTimes.length === 0) return 0;
    return this.frameTimes[this.frameTimes.length - 1];
  }

  reset() {
    this.frameTimes = [];
    this.lastFrameTime = performance.now();
  }
}

/**
 * Memory usage monitoring
 */
export const getMemoryUsage = () => {
  if (performance.memory) {
    return {
      used: Math.round(performance.memory.usedJSHeapSize / 1048576), // MB
      total: Math.round(performance.memory.totalJSHeapSize / 1048576), // MB
      limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576), // MB
    };
  }
  return null;
};

/**
 * Scroll position utilities
 */
export const getScrollInfo = (element) => {
  if (!element) return null;

  return {
    scrollX: element.scrollLeft,
    scrollY: element.scrollTop,
    scrollWidth: element.scrollWidth,
    scrollHeight: element.scrollHeight,
    clientWidth: element.clientWidth,
    clientHeight: element.clientHeight,
    maxScrollX: element.scrollWidth - element.clientWidth,
    maxScrollY: element.scrollHeight - element.clientHeight,
  };
};

/**
 * Virtual range calculator
 */
export const calculateVirtualRange = (scrollPos, viewportSize, itemSize, padding = 0) => {
  const visibleStart = Math.floor(scrollPos / itemSize);
  const visibleEnd = Math.ceil((scrollPos + viewportSize) / itemSize);
  const paddingItems = Math.ceil(padding / itemSize);

  return {
    start: Math.max(0, visibleStart - paddingItems),
    end: visibleEnd + paddingItems,
    visibleStart,
    visibleEnd,
  };
};

/**
 * LOD hesaplayıcı
 */
export const calculateLOD = (zoom, distance = 0) => {
  // Zoom seviyesi ve uzaklık bazında LOD seviyesi hesapla
  const zoomFactor = Math.log2(zoom + 0.1);
  const distanceFactor = distance / 1000; // Normalize distance

  const lodScore = zoomFactor - distanceFactor;

  if (lodScore < -2) return 'ultra_simplified';
  if (lodScore < -0.5) return 'simplified';
  if (lodScore < 0.5) return 'normal';
  if (lodScore < 2) return 'detailed';
  return 'ultra_detailed';
};