/**
 * DAWG DEBUG LOGGER SYSTEM
 *
 * Centralized, categorized logging system with:
 * - Namespace-based filtering (playback, audio, ui, performance)
 * - Log level filtering (error, warn, info, debug, trace)
 * - Performance monitoring
 * - Production mode toggle
 * - Color-coded console output
 * - Automatic timestamp
 */

// Log levels
export const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
};

// Log namespaces (categories)
export const NAMESPACES = {
  PLAYBACK: 'playback',
  AUDIO: 'audio',
  UI: 'ui',
  PERFORMANCE: 'performance',
  PLUGIN: 'plugin',
  STORE: 'store',
  MIDI: 'midi',
  RENDER: 'render',
  EFFECT: 'effect',
  TRANSPORT: 'transport'
};

// Color palette for console output
const NAMESPACE_COLORS = {
  [NAMESPACES.PLAYBACK]: '#00A8E8',    // Blue
  [NAMESPACES.AUDIO]: '#FF6B35',       // Orange
  [NAMESPACES.UI]: '#9B59B6',          // Purple
  [NAMESPACES.PERFORMANCE]: '#2ECC71', // Green
  [NAMESPACES.PLUGIN]: '#E74C3C',      // Red
  [NAMESPACES.STORE]: '#F39C12',       // Yellow
  [NAMESPACES.MIDI]: '#1ABC9C',        // Turquoise
  [NAMESPACES.RENDER]: '#34495E',      // Dark Gray
  [NAMESPACES.EFFECT]: '#E91E63',      // Pink
  [NAMESPACES.TRANSPORT]: '#3498DB'    // Light Blue
};

// Emoji icons for log levels
const LEVEL_ICONS = {
  [LOG_LEVELS.ERROR]: '❌',
  [LOG_LEVELS.WARN]: '⚠️',
  [LOG_LEVELS.INFO]: 'ℹ️',
  [LOG_LEVELS.DEBUG]: '🔍',
  [LOG_LEVELS.TRACE]: '📍'
};

class DebugLogger {
  constructor() {
    // Global enable/disable
    this.enabled = process.env.NODE_ENV === 'development';

    // Current log level (only logs at or below this level will be shown)
    this.currentLevel = LOG_LEVELS.DEBUG;

    // Namespace filters (empty = show all, filled = show only these)
    this.enabledNamespaces = new Set();

    // Namespace blacklist (these will NOT be shown even if in enabledNamespaces)
    this.disabledNamespaces = new Set();

    // Performance tracking
    this.performanceMarks = new Map();
    this.performanceMeasures = [];

    // Log history (for debugging)
    this.history = [];
    this.maxHistorySize = 1000;

    // Statistics
    this.stats = {
      totalLogs: 0,
      byLevel: {},
      byNamespace: {}
    };

    // Initialize stats
    Object.values(LOG_LEVELS).forEach(level => {
      this.stats.byLevel[level] = 0;
    });
    Object.values(NAMESPACES).forEach(ns => {
      this.stats.byNamespace[ns] = 0;
    });

    console.log('🔧 DebugLogger initialized', {
      enabled: this.enabled,
      level: this.getLevelName(this.currentLevel),
      env: process.env.NODE_ENV
    });
  }

  // =================== CONFIGURATION ===================

  /**
   * Enable/disable logging globally
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    console.log(`🔧 DebugLogger ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set current log level
   */
  setLevel(level) {
    if (typeof level === 'string') {
      level = LOG_LEVELS[level.toUpperCase()];
    }
    this.currentLevel = level;
    console.log(`🔧 DebugLogger level set to: ${this.getLevelName(level)}`);
  }

  /**
   * Enable specific namespace(s)
   */
  enableNamespace(...namespaces) {
    namespaces.forEach(ns => this.enabledNamespaces.add(ns));
    console.log(`🔧 DebugLogger enabled namespaces:`, Array.from(this.enabledNamespaces));
  }

  /**
   * Disable specific namespace(s)
   */
  disableNamespace(...namespaces) {
    namespaces.forEach(ns => this.disabledNamespaces.add(ns));
    console.log(`🔧 DebugLogger disabled namespaces:`, Array.from(this.disabledNamespaces));
  }

  /**
   * Clear namespace filters (show all)
   */
  clearNamespaceFilters() {
    this.enabledNamespaces.clear();
    this.disabledNamespaces.clear();
    console.log('🔧 DebugLogger namespace filters cleared (showing all)');
  }

  // =================== LOGGING METHODS ===================

  /**
   * Generic log method
   */
  log(level, namespace, message, ...args) {
    // Early exit if disabled
    if (!this.enabled) return;

    // Check level filter
    if (level > this.currentLevel) return;

    // Check namespace filters
    if (this.disabledNamespaces.has(namespace)) return;
    if (this.enabledNamespaces.size > 0 && !this.enabledNamespaces.has(namespace)) return;

    // Update stats
    this.stats.totalLogs++;
    this.stats.byLevel[level]++;
    this.stats.byNamespace[namespace]++;

    // Format message
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const levelName = this.getLevelName(level).padEnd(5);
    const icon = LEVEL_ICONS[level];
    const color = NAMESPACE_COLORS[namespace] || '#888';

    // Console output with color
    const consoleMethod = this.getConsoleMethod(level);
    consoleMethod(
      `%c[${timestamp}] ${icon} ${levelName} %c[${namespace}]%c ${message}`,
      'color: #888; font-weight: normal',
      `color: ${color}; font-weight: bold`,
      'color: inherit; font-weight: normal',
      ...args
    );

    // Store in history
    this.addToHistory(level, namespace, message, args);
  }

  /**
   * Convenience methods for each log level
   */
  error(namespace, message, ...args) {
    this.log(LOG_LEVELS.ERROR, namespace, message, ...args);
  }

  warn(namespace, message, ...args) {
    this.log(LOG_LEVELS.WARN, namespace, message, ...args);
  }

  info(namespace, message, ...args) {
    this.log(LOG_LEVELS.INFO, namespace, message, ...args);
  }

  debug(namespace, message, ...args) {
    this.log(LOG_LEVELS.DEBUG, namespace, message, ...args);
  }

  trace(namespace, message, ...args) {
    this.log(LOG_LEVELS.TRACE, namespace, message, ...args);
  }

  // =================== PERFORMANCE MONITORING ===================

  /**
   * Start performance measurement
   */
  time(namespace, label) {
    if (!this.enabled) return;

    const key = `${namespace}:${label}`;
    this.performanceMarks.set(key, performance.now());
    this.debug(NAMESPACES.PERFORMANCE, `⏱️ Started: ${key}`);
  }

  /**
   * End performance measurement
   */
  timeEnd(namespace, label) {
    if (!this.enabled) return;

    const key = `${namespace}:${label}`;
    const startTime = this.performanceMarks.get(key);

    if (startTime === undefined) {
      this.warn(NAMESPACES.PERFORMANCE, `No start mark for: ${key}`);
      return;
    }

    const duration = performance.now() - startTime;
    this.performanceMarks.delete(key);

    // Store measurement
    this.performanceMeasures.push({
      namespace,
      label,
      duration,
      timestamp: Date.now()
    });

    // Log with color coding based on duration
    const color = duration < 1 ? 'green' : duration < 10 ? 'orange' : 'red';
    this.debug(
      NAMESPACES.PERFORMANCE,
      `⏱️ %c${key}: ${duration.toFixed(2)}ms`,
      `color: ${color}; font-weight: bold`
    );

    return duration;
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(namespace = null) {
    let measures = this.performanceMeasures;

    if (namespace) {
      measures = measures.filter(m => m.namespace === namespace);
    }

    if (measures.length === 0) return null;

    const durations = measures.map(m => m.duration);
    const sum = durations.reduce((a, b) => a + b, 0);

    return {
      count: measures.length,
      total: sum,
      average: sum / measures.length,
      min: Math.min(...durations),
      max: Math.max(...durations)
    };
  }

  // =================== UTILITIES ===================

  /**
   * Get level name from level number
   */
  getLevelName(level) {
    return Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level) || 'UNKNOWN';
  }

  /**
   * Get console method for level
   */
  getConsoleMethod(level) {
    switch (level) {
      case LOG_LEVELS.ERROR: return console.error;
      case LOG_LEVELS.WARN: return console.warn;
      case LOG_LEVELS.INFO: return console.info;
      default: return console.log;
    }
  }

  /**
   * Add log to history
   */
  addToHistory(level, namespace, message, args) {
    this.history.push({
      timestamp: Date.now(),
      level,
      namespace,
      message,
      args
    });

    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  /**
   * Get log statistics
   */
  getStats() {
    return {
      ...this.stats,
      historySize: this.history.length,
      performance: this.getPerformanceStats()
    };
  }

  /**
   * Print statistics
   */
  printStats() {
    console.group('📊 DebugLogger Statistics');
    console.table({
      'Total Logs': this.stats.totalLogs,
      'History Size': this.history.length,
      'Errors': this.stats.byLevel[LOG_LEVELS.ERROR],
      'Warnings': this.stats.byLevel[LOG_LEVELS.WARN],
      'Info': this.stats.byLevel[LOG_LEVELS.INFO],
      'Debug': this.stats.byLevel[LOG_LEVELS.DEBUG],
      'Trace': this.stats.byLevel[LOG_LEVELS.TRACE]
    });
    console.log('By Namespace:', this.stats.byNamespace);
    console.groupEnd();
  }

  /**
   * Clear history and stats
   */
  clear() {
    this.history = [];
    this.performanceMeasures = [];
    Object.keys(this.stats.byLevel).forEach(k => this.stats.byLevel[k] = 0);
    Object.keys(this.stats.byNamespace).forEach(k => this.stats.byNamespace[k] = 0);
    this.stats.totalLogs = 0;
    console.log('🔧 DebugLogger cleared');
  }

  /**
   * Export logs as JSON
   */
  export() {
    return {
      history: this.history,
      stats: this.stats,
      performance: this.performanceMeasures,
      config: {
        enabled: this.enabled,
        level: this.getLevelName(this.currentLevel),
        enabledNamespaces: Array.from(this.enabledNamespaces),
        disabledNamespaces: Array.from(this.disabledNamespaces)
      }
    };
  }
}

// =================== SINGLETON INSTANCE ===================

// Create singleton
export const logger = new DebugLogger();

// Convenience exports for namespaces
export const createLogger = (namespace) => ({
  error: (msg, ...args) => logger.error(namespace, msg, ...args),
  warn: (msg, ...args) => logger.warn(namespace, msg, ...args),
  info: (msg, ...args) => logger.info(namespace, msg, ...args),
  debug: (msg, ...args) => logger.debug(namespace, msg, ...args),
  trace: (msg, ...args) => logger.trace(namespace, msg, ...args),
  time: (label) => logger.time(namespace, label),
  timeEnd: (label) => logger.timeEnd(namespace, label)
});

// Global access for debugging
if (typeof window !== 'undefined') {
  window.DebugLogger = logger;
  window.logStats = () => logger.printStats();
  window.logExport = () => logger.export();
  window.logClear = () => logger.clear();

  // Quick namespace enable/disable
  window.logEnable = (...namespaces) => logger.enableNamespace(...namespaces);
  window.logDisable = (...namespaces) => logger.disableNamespace(...namespaces);
  window.logLevel = (level) => logger.setLevel(level);
}

export default logger;
