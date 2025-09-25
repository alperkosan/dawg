/**
 * @file usePianoRollV3Store.js
 * @description V3 için optimize edilmiş Zustand store - infinite scroll ve LOD destekli
 */
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// LOD seviyeleri - zoom seviyesine göre detay ayarı
export const LOD_LEVELS = {
  ULTRA_SIMPLIFIED: 'ultra_simplified', // < 0.1x zoom
  SIMPLIFIED: 'simplified',             // 0.1x - 0.4x zoom
  NORMAL: 'normal',                     // 0.4x - 1.0x zoom
  DETAILED: 'detailed',                 // 1.0x - 2.5x zoom
  ULTRA_DETAILED: 'ultra_detailed'      // > 2.5x zoom
};

// Viewport konfigürasyonu
export const VIEWPORT_CONFIG = {
  MIN_ZOOM_X: 0.05,
  MAX_ZOOM_X: 10.0,
  MIN_ZOOM_Y: 0.5,
  MAX_ZOOM_Y: 3.0,
  BASE_STEP_WIDTH: 32,    // 16th note genişliği (px)
  BASE_KEY_HEIGHT: 18,    // Tuş yüksekliği (px)
  VIRTUAL_PADDING: 200,   // Viewport dışında render edilecek alan (px)
  SCROLL_DEBOUNCE: 16,    // Scroll throttle (ms)
};

const getLODFromZoom = (zoomX) => {
  if (zoomX < 0.1) return LOD_LEVELS.ULTRA_SIMPLIFIED;
  if (zoomX < 0.4) return LOD_LEVELS.SIMPLIFIED;
  if (zoomX < 1.0) return LOD_LEVELS.NORMAL;
  if (zoomX < 2.5) return LOD_LEVELS.DETAILED;
  return LOD_LEVELS.ULTRA_DETAILED;
};

export const usePianoRollV3Store = create(
  subscribeWithSelector((set, get) => ({
    // === VIEWPORT STATE ===
    viewport: {
      width: 0,
      height: 0,
      scrollX: 0,
      scrollY: 0,
      zoomX: 1.0,
      zoomY: 1.0,
    },

    // === VIRTUALIZATION STATE ===
    virtualization: {
      visibleStartX: 0,
      visibleEndX: 1000,
      visibleStartY: 0,
      visibleEndY: 108, // 9 octaves * 12 keys
      renderPadding: VIEWPORT_CONFIG.VIRTUAL_PADDING,
    },

    // === GRID CONFIGURATION ===
    grid: {
      totalBars: 2000,       // Toplam bar sayısı
      totalKeys: 108,        // C0-B8 (9 octaves)
      stepWidth: VIEWPORT_CONFIG.BASE_STEP_WIDTH,
      keyHeight: VIEWPORT_CONFIG.BASE_KEY_HEIGHT,
      snapMode: 16,          // 1/16 note snap
    },

    // === UI STATE ===
    ui: {
      showVelocityLane: false,
      velocityLaneHeight: 120,
      selectedTool: 'select',
      isPlaying: false,
      currentStep: 0,
    },

    // === PERFORMANCE STATE ===
    performance: {
      lodLevel: LOD_LEVELS.NORMAL,
      renderVersion: 0,      // Force re-render trigger
      isScrolling: false,
      lastScrollTime: 0,
    },

    // === ACTIONS ===

    // Viewport güncellemeleri
    setViewportSize: (width, height) => {
      set(state => ({
        viewport: { ...state.viewport, width, height }
      }));
      get().updateVirtualization();
    },

    setScroll: (scrollX, scrollY) => {
      const now = performance.now();
      set(state => ({
        viewport: { ...state.viewport, scrollX, scrollY },
        performance: {
          ...state.performance,
          isScrolling: true,
          lastScrollTime: now,
        }
      }));
      get().updateVirtualization();

      // Scroll bittiğinde isScrolling'i false yap
      setTimeout(() => {
        const currentTime = performance.now();
        if (currentTime - get().performance.lastScrollTime >= 150) {
          set(state => ({
            performance: { ...state.performance, isScrolling: false }
          }));
        }
      }, 150);
    },

    setZoom: (zoomX, zoomY = null) => {
      const clampedZoomX = Math.max(
        VIEWPORT_CONFIG.MIN_ZOOM_X,
        Math.min(VIEWPORT_CONFIG.MAX_ZOOM_X, zoomX)
      );

      let clampedZoomY = get().viewport.zoomY;
      if (zoomY !== null) {
        clampedZoomY = Math.max(
          VIEWPORT_CONFIG.MIN_ZOOM_Y,
          Math.min(VIEWPORT_CONFIG.MAX_ZOOM_Y, zoomY)
        );
      }

      const newLOD = getLODFromZoom(clampedZoomX);
      const stepWidth = VIEWPORT_CONFIG.BASE_STEP_WIDTH * clampedZoomX;
      const keyHeight = VIEWPORT_CONFIG.BASE_KEY_HEIGHT * clampedZoomY;

      set(state => ({
        viewport: {
          ...state.viewport,
          zoomX: clampedZoomX,
          zoomY: clampedZoomY,
        },
        grid: {
          ...state.grid,
          stepWidth,
          keyHeight,
        },
        performance: {
          ...state.performance,
          lodLevel: newLOD,
          renderVersion: state.performance.renderVersion + 1,
        }
      }));

      get().updateVirtualization();
    },

    // Virtualization hesaplamaları
    updateVirtualization: () => {
      const { viewport, grid, virtualization } = get();

      const startX = Math.floor(viewport.scrollX / grid.stepWidth) -
                     Math.ceil(virtualization.renderPadding / grid.stepWidth);
      const endX = Math.ceil((viewport.scrollX + viewport.width) / grid.stepWidth) +
                   Math.ceil(virtualization.renderPadding / grid.stepWidth);

      const startY = Math.floor(viewport.scrollY / grid.keyHeight) -
                     Math.ceil(virtualization.renderPadding / grid.keyHeight);
      const endY = Math.ceil((viewport.scrollY + viewport.height) / grid.keyHeight) +
                   Math.ceil(virtualization.renderPadding / grid.keyHeight);

      set(state => ({
        virtualization: {
          ...state.virtualization,
          visibleStartX: Math.max(0, startX),
          visibleEndX: Math.min(grid.totalBars * 16, endX), // 16 steps per bar
          visibleStartY: Math.max(0, startY),
          visibleEndY: Math.min(grid.totalKeys, endY),
        }
      }));
    },

    // Zoom yardımcıları
    zoomIn: () => {
      const currentZoom = get().viewport.zoomX;
      get().setZoom(currentZoom * 1.25);
    },

    zoomOut: () => {
      const currentZoom = get().viewport.zoomX;
      get().setZoom(currentZoom / 1.25);
    },

    // UI güncellemeleri
    setTool: (tool) => {
      set(state => ({
        ui: { ...state.ui, selectedTool: tool }
      }));
    },

    toggleVelocityLane: () => {
      set(state => ({
        ui: { ...state.ui, showVelocityLane: !state.ui.showVelocityLane }
      }));
    },

    setVelocityLaneHeight: (height) => {
      set(state => ({
        ui: { ...state.ui, velocityLaneHeight: height }
      }));
    },

    // Force re-render
    forceRender: () => {
      set(state => ({
        performance: {
          ...state.performance,
          renderVersion: state.performance.renderVersion + 1,
        }
      }));
    },

    // Getter'lar
    getVisibleRange: () => {
      const { virtualization } = get();
      return {
        startX: virtualization.visibleStartX,
        endX: virtualization.visibleEndX,
        startY: virtualization.visibleStartY,
        endY: virtualization.visibleEndY,
      };
    },

    getCurrentLOD: () => get().performance.lodLevel,

    getTotalGridSize: () => {
      const { grid } = get();
      return {
        width: grid.totalBars * 16 * grid.stepWidth,  // Total steps * step width
        height: grid.totalKeys * grid.keyHeight,
      };
    },
  }))
);