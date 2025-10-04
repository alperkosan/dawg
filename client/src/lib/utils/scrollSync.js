/**
 * @file scrollSync.js
 * @description Farklı DOM elemanları arasında scroll pozisyonunu senkronize etmek
 * ve mouse tekerleği olaylarını yönlendirmek için yardımcı fonksiyonlar.
 * Bu, Piano Roll gibi karmaşık arayüzlerde performansı yüksek tutmak için kritiktir.
 */

/**
 * Bir ana kaydırma alanının pozisyonunu, bir veya daha fazla hedef alana senkronize eder.
 * @param {React.RefObject} sourceRef - Ana kaydırılabilir alanın referansı.
 * @param {Array<{ref: React.RefObject, axis: 'x'|'y'|'both'}>} targets - Pozisyonları senkronize edilecek hedef alanlar.
 * @returns {function} Olay dinleyicilerini temizleyen bir cleanup fonksiyonu.
 */
/**
 * ✅ PERFORMANCE OPTIMIZED: High-performance scroll synchronizer with advanced optimization
 */
export const createScrollSynchronizer = (sourceRef, targets, onScrollChange, options = {}) => {
  const {
    throttleMs = 8, // ~120fps for ultra-smooth sync
    useTransform = true, // Use transform for better performance
    usePassive = true,
    debugMode = false
  } = options;

  let isSyncing = false;
  let rafId = null;
  let lastScrollTime = 0;
  let frameSkipCounter = 0;

  // ✅ PERFORMANCE: Pre-allocated arrays to avoid GC
  const targetCache = [];
  const scrollValues = { left: 0, top: 0 };

  const handleScroll = () => {
      if (!sourceRef.current || isSyncing) return;

      const now = performance.now();

      // ✅ PERFORMANCE: Adaptive throttling based on frame rate
      if (now - lastScrollTime < throttleMs) {
        frameSkipCounter++;
        return;
      }

      // Cancel previous frame
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      rafId = requestAnimationFrame(() => {
          try {
            isSyncing = true;
            const sourceElement = sourceRef.current;
            if (!sourceElement) return;

            // ✅ PERFORMANCE: Cache scroll values
            scrollValues.left = sourceElement.scrollLeft;
            scrollValues.top = sourceElement.scrollTop;

            // ✅ PERFORMANCE: Batch all DOM updates
            let batchedUpdates = 0;

            for (let i = 0; i < targets.length; i++) {
              const { ref, axis = 'both', method = 'transform' } = targets[i];

              if (!ref.current) continue;

              batchedUpdates++;

              if (method === 'scroll') {
                // Direct scroll property update (faster for some cases)
                if (axis === 'x' || axis === 'both') {
                  ref.current.scrollLeft = scrollValues.left;
                }
                if (axis === 'y' || axis === 'both') {
                  ref.current.scrollTop = scrollValues.top;
                }
              } else {
                // Transform-based sync (better performance for non-scrollable elements)
                let transformX = 0;
                let transformY = 0;

                if (axis === 'x' || axis === 'both') {
                    transformX = -scrollValues.left;
                }
                if (axis === 'y' || axis === 'both') {
                    transformY = -scrollValues.top;
                }

                // ✅ PERFORMANCE: GPU-accelerated transform
                ref.current.style.transform =
                    `translate3d(${transformX}px, ${transformY}px, 0)`;
              }
            }

            // Callback with performance info
            if (onScrollChange && typeof onScrollChange === 'function') {
                onScrollChange(scrollValues.left, scrollValues.top, {
                  batchedUpdates,
                  frameSkipCounter,
                  syncTime: performance.now() - now
                });
            }

            if (debugMode && frameSkipCounter > 0) {
              console.log(`🔄 ScrollSync: Processed ${batchedUpdates} updates, skipped ${frameSkipCounter} frames`);
            }

            frameSkipCounter = 0;
            lastScrollTime = now;
          } catch (error) {
            console.error('Scroll synchronization error:', error);
          } finally {
            isSyncing = false;
          }
      });
  };

  const sourceElement = sourceRef.current;
  if (sourceElement) {
      sourceElement.addEventListener('scroll', handleScroll, { passive: usePassive });
      // Initial sync
      handleScroll();

      if (debugMode) {
        console.log(`🔄 ScrollSync: Initialized with ${targets.length} targets, throttle: ${throttleMs}ms`);
      }
  }

  // ✅ PERFORMANCE: Enhanced cleanup
  return () => {
      if (sourceElement) {
          sourceElement.removeEventListener('scroll', handleScroll);
      }
      if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
      }

      // Clear cached values
      targetCache.length = 0;
      scrollValues.left = 0;
      scrollValues.top = 0;

      if (debugMode) {
        console.log('🔄 ScrollSync: Cleanup completed');
      }
  };
};

/**
 * Bir eleman üzerindeki mouse tekerleği olaylarını başka bir elemana yönlendirir.
 * Örn: Enstrüman listesi üzerinde tekerleği çevirince ana grid'i kaydırmak için.
 * @param {React.RefObject} sourceRef - Olayların yakalanacağı kaynak.
 * @param {React.RefObject} targetRef - Olayların yönlendirileceği hedef.
 * @param {'x' | 'y'} axis - Hangi eksendeki kaydırmanın yönlendirileceği.
 * @returns {function} Cleanup fonksiyonu.
 */
/**
 * ✅ PERFORMANCE OPTIMIZED: High-performance wheel forwarder with momentum and bounds checking
 */
export const createWheelForwarder = (sourceRef, targetRef, axis = 'y', options = {}) => {
  const {
    throttleMs = 8, // ~120fps for smooth wheel events
    enableMomentum = true,
    momentumDecay = 0.95,
    maxDelta = 100, // Prevent excessive scroll jumps
    debugMode = false
  } = options;

  let momentum = { x: 0, y: 0 };
  let lastWheelTime = 0;
  let rafId = null;
  let isScrolling = false;

  const applyMomentum = () => {
    if (!enableMomentum || (!momentum.x && !momentum.y)) return;

    const target = targetRef.current;
    if (!target) return;

    if (Math.abs(momentum.x) > 0.1 || Math.abs(momentum.y) > 0.1) {
      // Apply momentum scroll
      if (axis === 'x' || axis === 'both') {
        const currentScrollLeft = target.scrollLeft;
        const maxScrollLeft = target.scrollWidth - target.clientWidth;
        const newScrollLeft = Math.max(0, Math.min(maxScrollLeft, currentScrollLeft + momentum.x));
        target.scrollLeft = newScrollLeft;
      }

      if (axis === 'y' || axis === 'both') {
        const currentScrollTop = target.scrollTop;
        const maxScrollTop = target.scrollHeight - target.clientHeight;
        const newScrollTop = Math.max(0, Math.min(maxScrollTop, currentScrollTop + momentum.y));
        target.scrollTop = newScrollTop;
      }

      // Decay momentum
      momentum.x *= momentumDecay;
      momentum.y *= momentumDecay;

      rafId = requestAnimationFrame(applyMomentum);
    } else {
      momentum.x = 0;
      momentum.y = 0;
      isScrolling = false;
    }
  };

  const handleWheel = (e) => {
    try {
      const target = targetRef.current;
      if (!target) return;

      const now = performance.now();

      // ✅ PERFORMANCE: Throttle wheel events
      if (now - lastWheelTime < throttleMs) {
        return;
      }

      // Prevent default page scrolling
      e.preventDefault();

      // ✅ PERFORMANCE: Normalize and clamp wheel delta
      const deltaX = Math.max(-maxDelta, Math.min(maxDelta, e.deltaX || 0));
      const deltaY = Math.max(-maxDelta, Math.min(maxDelta, e.deltaY || 0));

      if (axis === 'y' || axis === 'both') {
        const currentScrollTop = target.scrollTop;
        const maxScrollTop = target.scrollHeight - target.clientHeight;
        const newScrollTop = Math.max(0, Math.min(maxScrollTop, currentScrollTop + deltaY));
        target.scrollTop = newScrollTop;

        if (enableMomentum) {
          momentum.y = deltaY * 0.3; // Momentum factor
        }
      }

      if (axis === 'x' || axis === 'both') {
        const currentScrollLeft = target.scrollLeft;
        const maxScrollLeft = target.scrollWidth - target.clientWidth;
        const newScrollLeft = Math.max(0, Math.min(maxScrollLeft, currentScrollLeft + deltaX));
        target.scrollLeft = newScrollLeft;

        if (enableMomentum) {
          momentum.x = deltaX * 0.3; // Momentum factor
        }
      }

      // Start momentum animation
      if (enableMomentum && !isScrolling) {
        isScrolling = true;
        rafId = requestAnimationFrame(applyMomentum);
      }

      lastWheelTime = now;

      if (debugMode) {
        console.log(`💲 WheelForward: Δx=${deltaX.toFixed(1)}, Δy=${deltaY.toFixed(1)}, momentum=${enableMomentum}`);
      }
    } catch (error) {
      console.error('Wheel forwarding error:', error);
    }
  };

  const sourceElement = sourceRef.current;
  if (sourceElement) {
    sourceElement.addEventListener('wheel', handleWheel, { passive: false });

    if (debugMode) {
      console.log(`💲 WheelForward: Initialized, axis=${axis}, throttle=${throttleMs}ms`);
    }
  }

  return () => {
    if (sourceElement) {
      sourceElement.removeEventListener('wheel', handleWheel);
    }
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    // Clear momentum
    momentum = { x: 0, y: 0 };
    isScrolling = false;

    if (debugMode) {
      console.log('💲 WheelForward: Cleanup completed');
    }
  };
};

/**
 * ✅ PERFORMANCE: Multi-target scroll synchronizer with priority-based updates
 */
export const createMultiScrollSync = (sourceRef, targetGroups, options = {}) => {
  const {
    throttleMs = 8,
    priorityLevels = true,
    debugMode = false
  } = options;

  const synchronizers = [];

  // Group targets by priority
  const highPriorityTargets = targetGroups.filter(t => t.priority === 'high');
  const normalPriorityTargets = targetGroups.filter(t => t.priority !== 'high');

  // High priority targets (e.g., timeline) - immediate sync
  if (highPriorityTargets.length > 0) {
    const highPrioritySync = createScrollSynchronizer(
      sourceRef,
      highPriorityTargets,
      null,
      { throttleMs: throttleMs / 2, debugMode } // Higher frequency for high priority
    );
    synchronizers.push(highPrioritySync);
  }

  // Normal priority targets - standard sync
  if (normalPriorityTargets.length > 0) {
    const normalPrioritySync = createScrollSynchronizer(
      sourceRef,
      normalPriorityTargets,
      null,
      { throttleMs, debugMode }
    );
    synchronizers.push(normalPrioritySync);
  }

  return () => {
    synchronizers.forEach(cleanup => cleanup());
    if (debugMode) {
      console.log('🔄 MultiScrollSync: All synchronizers cleaned up');
    }
  };
};
