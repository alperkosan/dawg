/**
 * CanvasWorkerBridge
 * ----------------------------------------
 * Shared infrastructure for OffscreenCanvas renderers.
 * Handles worker lifecycle, surface registration, and message dispatching.
 */

const SUPPORTS_OFFSCREEN = typeof window !== 'undefined'
  && 'HTMLCanvasElement' in window
  && HTMLCanvasElement.prototype.transferControlToOffscreen;

const SURFACE_SYMBOL = Symbol('CanvasWorkerSurfaceMeta');

class CanvasWorkerBridge {
  constructor() {
    this.worker = null;
    this.surfaces = new Map(); // surfaceId -> { renderer, canvasElement }
    this.surfaceElements = new WeakMap(); // canvasElement -> surfaceId
    this.messageQueue = [];
    this.isReady = false;
    this.surfaceCounter = 0;
    this.performanceListeners = new Set();
  }

  ensureWorker() {
    if (this.worker || !SUPPORTS_OFFSCREEN) return;

    this.worker = new Worker(new URL('./canvasRenderWorker.js', import.meta.url), {
      type: 'module'
    });
    this.worker.onmessage = (event) => this.handleWorkerMessage(event.data);
    this.worker.onerror = (err) => {
      console.error('CanvasWorkerBridge error:', err);
    };
  }

  handleWorkerMessage(message) {
    const { type } = message || {};
    switch (type) {
      case 'READY':
        this.isReady = true;
        this.flushQueue();
        break;
      case 'PERF':
        this.performanceListeners.forEach(listener => listener(message.payload));
        break;
      case 'ERROR':
        console.error('Canvas worker reported error:', message.payload);
        break;
      default:
        break;
    }
  }

  flushQueue() {
    if (!this.worker) return;
    while (this.messageQueue.length) {
      const { message, transferables } = this.messageQueue.shift();
      this.worker.postMessage(message, transferables || []);
    }
  }

  sendMessage(message, transferables = []) {
    if (!this.worker) {
      this.messageQueue.push({ message, transferables });
      return;
    }

    if (!this.isReady) {
      this.messageQueue.push({ message, transferables });
      return;
    }

    this.worker.postMessage(message, transferables);
  }

  registerSurface(canvasElement, renderer, initialState = {}) {
    if (!SUPPORTS_OFFSCREEN || !canvasElement) {
      return null;
    }

    if (import.meta.env?.DEV && window?.verboseLogging) {
      console.log('[CanvasWorkerBridge] registerSurface called', {
        renderer,
        hasSurfaceMeta: Boolean(canvasElement[SURFACE_SYMBOL]),
        weakMapMatch: this.surfaceElements.has(canvasElement)
      });
    }

    const existingSurfaceId =
      this.surfaceElements.get(canvasElement) ||
      canvasElement[SURFACE_SYMBOL]?.surfaceId;
    if (existingSurfaceId) {
      console.warn('[CanvasWorkerBridge] Surface already registered for canvas, reusing existing surfaceId.');
      return existingSurfaceId;
    }

    this.ensureWorker();

    const surfaceId = `surface_${++this.surfaceCounter}`;
    const offscreen = canvasElement.transferControlToOffscreen();

    this.surfaces.set(surfaceId, { renderer, canvasElement });
    this.surfaceElements.set(canvasElement, surfaceId);
    canvasElement[SURFACE_SYMBOL] = {
      surfaceId,
      transferred: true
    };

    this.sendMessage({
      type: 'REGISTER_SURFACE',
      payload: {
        surfaceId,
        renderer,
        state: initialState,
      }
    });

    this.sendMessage({
      type: 'INIT_SURFACE',
      payload: {
        surfaceId,
        canvas: offscreen,
      }
    }, [offscreen]);

    return surfaceId;
  }

  updateSurface(surfaceId, updatePayload) {
    if (!surfaceId) return;
    this.sendMessage({
      type: 'UPDATE_SURFACE',
      payload: {
        surfaceId,
        state: updatePayload,
      }
    });
  }

  destroySurface(surfaceId) {
    if (!surfaceId) return;
    const surface = this.surfaces.get(surfaceId);
    this.sendMessage({
      type: 'DESTROY_SURFACE',
      payload: { surfaceId }
    });
    if (surface?.canvasElement) {
      this.surfaceElements.delete(surface.canvasElement);
      if (surface.canvasElement[SURFACE_SYMBOL]?.surfaceId === surfaceId) {
        delete surface.canvasElement[SURFACE_SYMBOL];
      }
    }
    this.surfaces.delete(surfaceId);
  }

  onPerformance(listener) {
    this.performanceListeners.add(listener);
    return () => this.performanceListeners.delete(listener);
  }
}

export const canvasWorkerBridge = new CanvasWorkerBridge();
export const supportsOffscreenCanvas = SUPPORTS_OFFSCREEN;

