// Performance testing utilities for mixer optimization

/**
 * Add multiple channels to test performance
 * Usage: In browser console, run:
 * import { addManyChannels } from '@/utils/performanceHelpers'
 * addManyChannels(50)
 */
export const addManyChannels = (count = 50) => {
  const { useMixerStore } = require('@/store/useMixerStore');
  const store = useMixerStore.getState();

  console.log(`🚀 Adding ${count} channels...`);
  const startTime = performance.now();

  for (let i = 0; i < count; i++) {
    store.addTrack('track');
  }

  const endTime = performance.now();
  console.log(`✅ Added ${count} channels in ${(endTime - startTime).toFixed(2)}ms`);
  console.log(`📊 Total tracks: ${useMixerStore.getState().mixerTracks.length}`);
};

/**
 * Measure render performance
 */
export const measureRenderPerformance = () => {
  let renderCount = 0;
  const startTime = performance.now();

  // Create a performance observer
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'measure') {
        console.log(`📊 ${entry.name}: ${entry.duration.toFixed(2)}ms`);
      }
    }
  });

  observer.observe({ entryTypes: ['measure'] });

  return {
    mark: (name) => performance.mark(name),
    measure: (name, startMark, endMark) => performance.measure(name, startMark, endMark),
    stop: () => observer.disconnect()
  };
};

/**
 * Count component re-renders (call from component)
 */
export const useRenderCounter = (componentName) => {
  const renderCount = React.useRef(0);
  renderCount.current++;

  React.useEffect(() => {
    console.log(`🔄 ${componentName} rendered ${renderCount.current} times`);
  });

  return renderCount.current;
};

/**
 * Monitor memory usage
 */
export const monitorMemory = () => {
  if (!performance.memory) {
    console.warn('⚠️ Memory monitoring not available in this browser');
    return null;
  }

  const formatBytes = (bytes) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  const logMemory = () => {
    console.log('💾 Memory Usage:', {
      used: formatBytes(performance.memory.usedJSHeapSize),
      total: formatBytes(performance.memory.totalJSHeapSize),
      limit: formatBytes(performance.memory.jsHeapSizeLimit)
    });
  };

  // Log initial
  logMemory();

  // Return function to log current memory
  return logMemory;
};

/**
 * FPS Monitor
 */
export class FPSMonitor {
  constructor() {
    this.fps = 0;
    this.frames = 0;
    this.lastTime = performance.now();
    this.running = false;
  }

  start() {
    this.running = true;
    this.loop();
  }

  loop = () => {
    if (!this.running) return;

    const currentTime = performance.now();
    this.frames++;

    if (currentTime >= this.lastTime + 1000) {
      this.fps = Math.round((this.frames * 1000) / (currentTime - this.lastTime));
      this.frames = 0;
      this.lastTime = currentTime;

      // Color code based on FPS
      const color = this.fps >= 55 ? '#4ade80' : this.fps >= 30 ? '#fbbf24' : '#ef4444';
      console.log(`%c🎯 FPS: ${this.fps}`, `color: ${color}; font-weight: bold; font-size: 14px`);
    }

    requestAnimationFrame(this.loop);
  };

  stop() {
    this.running = false;
  }

  getFPS() {
    return this.fps;
  }
}

/**
 * Performance test suite
 */
export const runPerformanceTest = async () => {
  console.log('🧪 Starting Performance Test Suite...\n');

  const memoryMonitor = monitorMemory();
  const fpsMonitor = new FPSMonitor();

  // Test 1: Initial state
  console.log('📋 Test 1: Initial State');
  memoryMonitor?.();

  // Test 2: Add 50 channels
  console.log('\n📋 Test 2: Adding 50 channels');
  addManyChannels(50);
  await new Promise(resolve => setTimeout(resolve, 1000));
  memoryMonitor?.();

  // Test 3: Start FPS monitoring
  console.log('\n📋 Test 3: FPS Monitoring (10 seconds)');
  fpsMonitor.start();

  // Test 4: Simulate fader movements
  setTimeout(() => {
    console.log('\n📋 Test 4: Simulating fader movements...');
    const { useMixerStore } = require('@/store/useMixerStore');
    const store = useMixerStore.getState();
    const tracks = store.mixerTracks;

    // Move 10 faders rapidly
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        const track = tracks[i % tracks.length];
        if (track) {
          store.handleMixerParamChange(track.id, 'volume', Math.random() * -60);
        }
      }, i * 100);
    }
  }, 2000);

  // Test 5: Stop and show results
  setTimeout(() => {
    fpsMonitor.stop();
    console.log('\n✅ Performance Test Complete!');
    console.log('\n📊 Final Stats:');
    memoryMonitor?.();
    console.log(`🎯 Final FPS: ${fpsMonitor.getFPS()}`);

    const { useMixerStore } = require('@/store/useMixerStore');
    console.log(`📊 Total tracks: ${useMixerStore.getState().mixerTracks.length}`);

    console.log('\n💡 Performance Tips:');
    console.log('  - Target FPS: 60 (green)');
    console.log('  - Acceptable FPS: 30-60 (yellow)');
    console.log('  - Poor FPS: <30 (red)');
    console.log('  - Memory: Should stay under 500MB for 100 channels');
  }, 12000);
};

// Expose to window for easy console access
if (typeof window !== 'undefined') {
  window.performanceHelpers = {
    addManyChannels,
    measureRenderPerformance,
    monitorMemory,
    FPSMonitor,
    runPerformanceTest
  };

  // ✅ DISABLED: Performance helper logs removed
  // Uncomment to enable:
  // console.log('💡 Performance helpers loaded! Available commands:');
  // console.log('  - window.performanceHelpers.addManyChannels(50)');
  // console.log('  - window.performanceHelpers.runPerformanceTest()');
  // console.log('  - window.performanceHelpers.monitorMemory()');
}
