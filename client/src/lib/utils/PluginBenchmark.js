/**
 * Plugin Performance Benchmark System
 *
 * Measures and tracks plugin performance metrics for optimization
 *
 * @version 1.0.0
 * @date 2025-10-09
 */

/**
 * Benchmark result for a single test
 */
class BenchmarkResult {
  constructor(name, samples = []) {
    this.name = name;
    this.samples = samples;
    this.timestamp = Date.now();
  }

  get count() {
    return this.samples.length;
  }

  get min() {
    return Math.min(...this.samples);
  }

  get max() {
    return Math.max(...this.samples);
  }

  get average() {
    return this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
  }

  get median() {
    const sorted = [...this.samples].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  get p95() {
    const sorted = [...this.samples].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * 0.95);
    return sorted[idx];
  }

  get p99() {
    const sorted = [...this.samples].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * 0.99);
    return sorted[idx];
  }

  get stdDev() {
    const avg = this.average;
    const squareDiffs = this.samples.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / this.samples.length;
    return Math.sqrt(avgSquareDiff);
  }

  toString() {
    return `
Benchmark: ${this.name}
Samples: ${this.count}
Min: ${this.min.toFixed(3)}ms
Max: ${this.max.toFixed(3)}ms
Avg: ${this.average.toFixed(3)}ms
Median: ${this.median.toFixed(3)}ms
P95: ${this.p95.toFixed(3)}ms
P99: ${this.p99.toFixed(3)}ms
StdDev: ${this.stdDev.toFixed(3)}ms
    `.trim();
  }

  toJSON() {
    return {
      name: this.name,
      timestamp: this.timestamp,
      count: this.count,
      min: this.min,
      max: this.max,
      average: this.average,
      median: this.median,
      p95: this.p95,
      p99: this.p99,
      stdDev: this.stdDev,
      samples: this.samples
    };
  }
}

/**
 * Plugin Performance Benchmark
 */
export class PluginBenchmark {
  constructor(pluginName) {
    this.pluginName = pluginName;
    this.results = new Map();
    this.running = new Map();
  }

  /**
   * Start timing a benchmark
   */
  start(testName) {
    this.running.set(testName, performance.now());
  }

  /**
   * End timing and record result
   */
  end(testName) {
    const startTime = this.running.get(testName);
    if (startTime === undefined) {
      console.warn(`PluginBenchmark: No start time for "${testName}"`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Get or create result entry
    let result = this.results.get(testName);
    if (!result) {
      result = new BenchmarkResult(testName, []);
      this.results.set(testName, result);
    }

    // Add sample
    result.samples.push(duration);
    this.running.delete(testName);

    return duration;
  }

  /**
   * Measure a function execution
   */
  measure(testName, fn) {
    this.start(testName);
    const result = fn();
    this.end(testName);
    return result;
  }

  /**
   * Measure an async function execution
   */
  async measureAsync(testName, fn) {
    this.start(testName);
    const result = await fn();
    this.end(testName);
    return result;
  }

  /**
   * Run a benchmark multiple times
   */
  run(testName, fn, iterations = 100) {
    console.log(`Running benchmark "${testName}" (${iterations} iterations)...`);

    for (let i = 0; i < iterations; i++) {
      this.measure(testName, fn);
    }

    const result = this.results.get(testName);
    console.log(result.toString());
    return result;
  }

  /**
   * Run an async benchmark multiple times
   */
  async runAsync(testName, fn, iterations = 100) {
    console.log(`Running async benchmark "${testName}" (${iterations} iterations)...`);

    for (let i = 0; i < iterations; i++) {
      await this.measureAsync(testName, fn);
    }

    const result = this.results.get(testName);
    console.log(result.toString());
    return result;
  }

  /**
   * Get result for a test
   */
  getResult(testName) {
    return this.results.get(testName) || null;
  }

  /**
   * Get all results
   */
  getAllResults() {
    return Array.from(this.results.values());
  }

  /**
   * Clear all results
   */
  clear() {
    this.results.clear();
    this.running.clear();
  }

  /**
   * Export results to JSON
   */
  export() {
    return {
      pluginName: this.pluginName,
      timestamp: Date.now(),
      results: Array.from(this.results.values()).map(r => r.toJSON())
    };
  }

  /**
   * Print summary report
   */
  report() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Plugin Benchmark Report: ${this.pluginName}`);
    console.log(`${'='.repeat(60)}\n`);

    const results = this.getAllResults();
    if (results.length === 0) {
      console.log('No benchmark results available.\n');
      return;
    }

    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.toString()}\n`);
    });

    console.log(`${'='.repeat(60)}\n`);
  }
}

/**
 * Benchmark presets for common plugin operations
 */
export class PluginBenchmarkPresets {
  /**
   * Benchmark BaseAudioPlugin creation
   */
  static benchmarkPluginCreation(trackId, effectId, iterations = 100) {
    const { BaseAudioPlugin } = require('../audio/BaseAudioPlugin');
    const benchmark = new PluginBenchmark('BaseAudioPlugin');

    benchmark.run('Plugin Creation', () => {
      const plugin = new BaseAudioPlugin(trackId, effectId);
      plugin.destroy();
    }, iterations);

    return benchmark;
  }

  /**
   * Benchmark audio data retrieval
   */
  static benchmarkAudioDataRetrieval(plugin, iterations = 1000) {
    const benchmark = new PluginBenchmark('Audio Data Retrieval');

    benchmark.run('getTimeDomainData', () => {
      plugin.getTimeDomainData();
    }, iterations);

    benchmark.run('getFrequencyData', () => {
      plugin.getFrequencyData();
    }, iterations);

    return benchmark;
  }

  /**
   * Benchmark metrics calculation
   */
  static benchmarkMetricsCalculation(plugin, iterations = 1000) {
    const benchmark = new PluginBenchmark('Metrics Calculation');

    benchmark.run('calculateMetrics (all)', () => {
      plugin.calculateMetrics();
    }, iterations);

    benchmark.run('calculateMetrics (RMS only)', () => {
      plugin.calculateMetrics({
        calculateRms: true,
        calculatePeak: false,
        calculatePeakHold: false,
        detectClipping: false
      });
    }, iterations);

    benchmark.run('amplitudeToDb', () => {
      plugin.amplitudeToDb(0.5);
    }, iterations);

    return benchmark;
  }

  /**
   * Benchmark canvas visualization
   */
  static benchmarkCanvasVisualization(drawCallback, width = 800, height = 200, iterations = 100) {
    const benchmark = new PluginBenchmark('Canvas Visualization');

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    benchmark.run('Canvas Draw', () => {
      drawCallback(ctx, width, height);
    }, iterations);

    return benchmark;
  }

  /**
   * Benchmark preset operations
   */
  static benchmarkPresetOperations(presetManager, testParams, iterations = 100) {
    const benchmark = new PluginBenchmark('Preset Operations');

    // Save preset
    let presetId;
    benchmark.run('saveUserPreset', () => {
      presetId = presetManager.saveUserPreset('Test Preset', testParams, {
        category: 'Test',
        description: 'Benchmark test'
      });
    }, iterations);

    // Get preset
    benchmark.run('getPreset', () => {
      presetManager.getPreset(presetId);
    }, iterations);

    // Get all presets
    benchmark.run('getAllPresets', () => {
      presetManager.getAllPresets();
    }, iterations);

    // Get by category
    benchmark.run('getPresetsByCategory', () => {
      presetManager.getPresetsByCategory();
    }, iterations);

    // Export preset
    benchmark.run('exportPreset', () => {
      presetManager.exportPreset(presetId);
    }, iterations);

    // Clean up
    presetManager.deleteUserPreset(presetId);

    return benchmark;
  }

  /**
   * Run all benchmark presets
   */
  static runAllBenchmarks(plugin, presetManager, testParams) {
    console.log('\n🚀 Running Plugin Performance Benchmarks\n');

    const results = {
      audioData: this.benchmarkAudioDataRetrieval(plugin),
      metrics: this.benchmarkMetricsCalculation(plugin),
      presets: this.benchmarkPresetOperations(presetManager, testParams)
    };

    console.log('\n📊 Benchmark Summary\n');
    Object.entries(results).forEach(([name, benchmark]) => {
      benchmark.report();
    });

    return results;
  }
}

/**
 * Global benchmark registry
 */
class BenchmarkRegistry {
  constructor() {
    this.benchmarks = new Map();
  }

  register(name, benchmark) {
    this.benchmarks.set(name, benchmark);
  }

  get(name) {
    return this.benchmarks.get(name);
  }

  getAll() {
    return Array.from(this.benchmarks.values());
  }

  clear() {
    this.benchmarks.clear();
  }

  exportAll() {
    return {
      timestamp: Date.now(),
      benchmarks: Array.from(this.benchmarks.entries()).map(([name, benchmark]) => ({
        name,
        data: benchmark.export()
      }))
    };
  }
}

export const benchmarkRegistry = new BenchmarkRegistry();

/**
 * Utility function to create and register a benchmark
 */
export function createBenchmark(pluginName) {
  const benchmark = new PluginBenchmark(pluginName);
  benchmarkRegistry.register(pluginName, benchmark);
  return benchmark;
}

/**
 * Decorator for benchmarking methods
 */
export function benchmark(testName) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args) {
      const benchmark = createBenchmark(target.constructor.name);
      return benchmark.measure(testName, () => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}
