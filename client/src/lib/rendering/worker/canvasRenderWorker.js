/**
 * Canvas Render Worker (module)
 */

const surfaces = new Map();
const renderers = new Map();
const scheduleFrame = typeof self.requestAnimationFrame === 'function'
  ? (cb) => self.requestAnimationFrame(cb)
  : (cb) => setTimeout(() => cb(performance.now()), 16);
const cancelFrame = typeof self.cancelAnimationFrame === 'function'
  ? (id) => self.cancelAnimationFrame(id)
  : (id) => clearTimeout(id);

self.onmessage = async (event) => {
  const { type, payload } = event.data || {};
  switch (type) {
    case 'REGISTER_SURFACE':
      registerSurface(payload);
      break;
    case 'INIT_SURFACE':
      initSurfaceCanvas(payload);
      break;
    case 'UPDATE_SURFACE':
      updateSurfaceState(payload);
      break;
    case 'DESTROY_SURFACE':
      destroySurface(payload);
      break;
    default:
      break;
  }
};

function registerSurface({ surfaceId, renderer, state }) {
  surfaces.set(surfaceId, {
    renderer,
    state: state || {},
    canvas: null,
    ctx: null,
    rafId: null,
    dirty: true,
    renderFn: null,
  });
}

function initSurfaceCanvas({ surfaceId, canvas }) {
  const surface = surfaces.get(surfaceId);
  if (!surface) return;
  surface.canvas = canvas;
  surface.ctx = canvas.getContext('2d');
  attachRenderer(surfaceId, surface.renderer);
}

function updateSurfaceState({ surfaceId, state }) {
  const surface = surfaces.get(surfaceId);
  if (!surface) return;
  surface.state = { ...surface.state, ...state };
  markSurfaceDirty(surfaceId);
}

function destroySurface({ surfaceId }) {
  const surface = surfaces.get(surfaceId);
  if (!surface) return;
  if (surface.rafId) cancelFrame(surface.rafId);
  surfaces.delete(surfaceId);
}

async function attachRenderer(surfaceId, rendererName) {
  if (!renderers.has(rendererName)) {
    await importRenderer(rendererName);
  }

  const renderer = renderers.get(rendererName);
  const surface = surfaces.get(surfaceId);
  if (!renderer || !surface) return;

  surface.renderFn = renderer.create(surface.state, {
    markDirty: () => markSurfaceDirty(surfaceId),
  });
  markSurfaceDirty(surfaceId);

  // ✅ FIX: Start render loop now that renderer is ready
  requestRenderLoop(surfaceId);
}

async function importRenderer(rendererName) {
  switch (rendererName) {
    case 'channelRackGrid': {
      if (!renderers.has(rendererName)) {
        const module = await import('./renderers/channelRackGridRenderer.js');
        renderers.set(rendererName, module.channelRackGridRenderer);
      }
      break;
    }
    default:
      throw new Error(`Unknown renderer "${rendererName}"`);
  }
}

function markSurfaceDirty(surfaceId) {
  const surface = surfaces.get(surfaceId);
  if (!surface || surface.dirty) return;
  surface.dirty = true;
  requestRenderLoop(surfaceId);
}

function requestRenderLoop(surfaceId) {
  const surface = surfaces.get(surfaceId);
  if (!surface || !surface.renderFn) return;

  const loop = (timestamp) => {
    if (surface.dirty) {
      surface.dirty = false;
      try {
        surface.renderFn(surface.canvas, surface.ctx, surface.state, timestamp);
      } catch (error) {
        surfaceError(surfaceId, error);
      }
    }
    surface.rafId = scheduleFrame(loop);
  };

  if (!surface.rafId) {
    surface.rafId = scheduleFrame(loop);
  }
}

function surfaceError(surfaceId, error) {
  surfaces.delete(surfaceId);
  self.postMessage({
    type: 'ERROR',
    payload: { surfaceId, message: error.message, stack: error.stack }
  });
}

self.postMessage({ type: 'READY' });

