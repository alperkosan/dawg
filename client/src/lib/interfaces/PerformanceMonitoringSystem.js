// lib/core/interfaces/PerformanceMonitoringSystem.js
// DAWG - Performance Monitoring System - Real-time system stats

export class PerformanceMonitoringSystem {
  constructor(audioEngine, eventBus) {
    this.engine = audioEngine;
    this.eventBus = eventBus;
    
    // Monitoring state
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.updateInterval = 1000; // ms
    
    // Performance metrics
    this.metrics = {
      system: {
        cpuUsage: 0,
        memoryUsage: 0,
        memoryLimit: 0,
        heapUsed: 0,
        heapTotal: 0,
        timestamp: Date.now()
      },
      audio: {
        contextState: 'suspended',
        sampleRate: 0,
        baseLatency: 0,
        outputLatency: 0,
        totalLatency: 0,
        activeVoices: 0,
        workletNodes: 0,
        dropouts: 0
      },
      engine: {
        instrumentsLoaded: 0,
        patternsLoaded: 0,
        effectsActive: 0,
        mixerChannels: 0,
        scheduledEvents: 0
      },
      realtime: {
        renderTime: 0,
        bufferUtilization: 0,
        threadPressure: 0,
        glitchCount: 0,
        underruns: 0
      }
    };
    
    // Historical data (ring buffer)
    this.history = {
      maxEntries: 300, // 5 minutes at 1Hz
      entries: []
    };
    
    // Thresholds for alerts
    this.thresholds = {
      cpuUsage: 80,        // %
      memoryUsage: 85,     // %
      audioLatency: 50,    // ms
      dropouts: 5,         // per minute
      bufferUtilization: 90 // %
    };
    
    // Alert system
    this.alerts = [];
    this.alertCallbacks = new Set();
    
    console.log('Performance Monitoring System initialized');
    this.setupPerformanceObserver();
  }

  // =================== MONITORING CONTROL ===================

  /**
   * Start performance monitoring
   * @param {number} interval - Update interval in ms
   */
  startMonitoring(interval = 1000) {
    if (this.isMonitoring) {
      console.log('Performance monitoring already running');
      return;
    }
    
    this.updateInterval = Math.max(100, interval);
    this.isMonitoring = true;
    
    this.monitoringInterval = setInterval(() => {
      this.updateMetrics();
    }, this.updateInterval);
    
    console.log(`📊 Performance monitoring started (${this.updateInterval}ms interval)`);
    this.eventBus.emit('performanceMonitoringStart');
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    console.log('📊 Performance monitoring stopped');
    this.eventBus.emit('performanceMonitoringStop');
  }

  /**
   * Toggle monitoring state
   */
  toggleMonitoring() {
    if (this.isMonitoring) {
      this.stopMonitoring();
    } else {
      this.startMonitoring();
    }
  }

  // =================== METRICS COLLECTION ===================

  /**
   * Update all performance metrics
   */
  updateMetrics() {
    const timestamp = Date.now();
    
    try {
      // Update system metrics
      this.updateSystemMetrics();
      
      // Update audio metrics
      this.updateAudioMetrics();
      
      // Update engine metrics
      this.updateEngineMetrics();
      
      // Update real-time metrics
      this.updateRealtimeMetrics();
      
      // Store in history
      this.addHistoryEntry(timestamp);
      
      // Check thresholds
      this.checkThresholds();
      
      // Emit update event
      this.eventBus.emit('performanceUpdate', this.getMetrics());
      
    } catch (error) {
      console.error('Performance metrics update failed:', error);
    }
  }

  /**
   * Update system performance metrics
   */
  updateSystemMetrics() {
    // Memory metrics (if available)
    if (performance.memory) {
      const memory = performance.memory;
      this.metrics.system = {
        ...this.metrics.system,
        heapUsed: memory.usedJSHeapSize,
        heapTotal: memory.totalJSHeapSize,
        memoryLimit: memory.jsHeapSizeLimit,
        memoryUsage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
        timestamp: Date.now()
      };
    }

    // CPU usage estimation (basic)
    if (this.lastUpdateTime) {
      const timeDiff = Date.now() - this.lastUpdateTime;
      const expectedTime = this.updateInterval;
      const overhead = Math.max(0, timeDiff - expectedTime);
      this.metrics.system.cpuUsage = Math.min(100, (overhead / expectedTime) * 100);
    }
    this.lastUpdateTime = Date.now();
  }

  /**
   * Update audio context metrics
   */
  updateAudioMetrics() {
    const audioContext = this.engine?.audioContext;
    if (!audioContext) return;
    
    this.metrics.audio = {
      contextState: audioContext.state,
      sampleRate: audioContext.sampleRate,
      baseLatency: (audioContext.baseLatency || 0) * 1000, // Convert to ms
      outputLatency: (audioContext.outputLatency || 0) * 1000,
      totalLatency: ((audioContext.baseLatency || 0) + (audioContext.outputLatency || 0)) * 1000,
      activeVoices: this.countActiveVoices(),
      workletNodes: this.countWorkletNodes(),
      dropouts: this.metrics.audio.dropouts || 0
    };
  }

  /**
   * Update audio engine metrics
   */
  updateEngineMetrics() {
    if (!this.engine) return;
    
    this.metrics.engine = {
      instrumentsLoaded: this.engine.instruments?.size || 0,
      patternsLoaded: this.engine.patterns?.size || 0,
      effectsActive: this.countActiveEffects(),
      mixerChannels: this.engine.mixerChannels?.size || 0,
      scheduledEvents: this.engine.transport?.scheduledEvents?.size || 0
    };
  }

  /**
   * Update real-time performance metrics
   */
  updateRealtimeMetrics() {
    // Audio worklet performance (if available)
    const workletStats = this.getWorkletStats();
    
    this.metrics.realtime = {
      ...this.metrics.realtime,
      renderTime: workletStats.renderTime || 0,
      bufferUtilization: workletStats.bufferUtilization || 0,
      threadPressure: workletStats.threadPressure || 0,
      glitchCount: workletStats.glitchCount || 0,
      underruns: workletStats.underruns || 0
    };
  }

  // =================== PERFORMANCE OBSERVERS ===================

  /**
   * Setup performance observer for detailed metrics
   */
  setupPerformanceObserver() {
    if (!window.PerformanceObserver) return;
    
    try {
      // Observe long tasks
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) { // Tasks longer than 50ms
            this.recordPerformanceEvent('longTask', {
              duration: entry.duration,
              startTime: entry.startTime,
              type: entry.entryType
            });
          }
        }
      });
      
      longTaskObserver.observe({ entryTypes: ['longtask'] });
      
      // Observe layout shifts
      const layoutShiftObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordPerformanceEvent('layoutShift', {
            value: entry.value,
            startTime: entry.startTime
          });
        }
      });
      
      try {
        layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (e) {
        // Layout shift observer not supported
      }
      
    } catch (error) {
      console.warn('Performance observers setup failed:', error);
    }
  }

  /**
   * Record performance event
   */
  recordPerformanceEvent(type, data) {
    const event = {
      type,
      timestamp: Date.now(),
      data
    };
    
    // Store recent events (last 100)
    if (!this.performanceEvents) {
      this.performanceEvents = [];
    }
    
    this.performanceEvents.push(event);
    if (this.performanceEvents.length > 100) {
      this.performanceEvents.shift();
    }
    
    // Emit event
    this.eventBus.emit('performanceEvent', event);
  }

  // =================== METRICS CALCULATION ===================

  /**
   * Count active voices across all instruments
   */
  countActiveVoices() {
    let totalVoices = 0;
    
    if (this.engine?.instruments) {
      this.engine.instruments.forEach(instrument => {
        if (instrument.getActiveVoiceCount) {
          totalVoices += instrument.getActiveVoiceCount();
        }
      });
    }
    
    return totalVoices;
  }

  /**
   * Count active worklet nodes
   */
  countWorkletNodes() {
    return this.engine?.workletManager?.activeNodes?.size || 0;
  }

  /**
   * Count active effects across all channels
   */
  countActiveEffects() {
    let totalEffects = 0;
    
    if (this.engine?.mixerChannels) {
      this.engine.mixerChannels.forEach(channel => {
        if (channel.effects) {
          totalEffects += channel.effects.size;
        }
      });
    }
    
    return totalEffects;
  }

  /**
   * Get worklet performance statistics
   */
  getWorkletStats() {
    // This would typically come from audio worklet processor messages
    // For now, return default values
    return {
      renderTime: 0,
      bufferUtilization: 0,
      threadPressure: 0,
      glitchCount: 0,
      underruns: 0
    };
  }

  // =================== HISTORY MANAGEMENT ===================

  /**
   * Add entry to performance history
   */
  addHistoryEntry(timestamp) {
    const entry = {
      timestamp,
      metrics: JSON.parse(JSON.stringify(this.metrics))
    };
    
    this.history.entries.push(entry);
    
    // Maintain ring buffer
    if (this.history.entries.length > this.history.maxEntries) {
      this.history.entries.shift();
    }
  }

  /**
   * Get performance history
   * @param {number} duration - Duration in ms (default: all)
   * @returns {Array} - History entries
   */
  getHistory(duration = null) {
    if (!duration) {
      return [...this.history.entries];
    }
    
    const cutoffTime = Date.now() - duration;
    return this.history.entries.filter(entry => entry.timestamp >= cutoffTime);
  }

  /**
   * Clear performance history
   */
  clearHistory() {
    this.history.entries = [];
    console.log('📊 Performance history cleared');
  }

  // =================== THRESHOLD MONITORING ===================

  /**
   * Check performance thresholds and generate alerts
   */
  checkThresholds() {
    const newAlerts = [];
    
    // CPU usage threshold
    if (this.metrics.system.cpuUsage > this.thresholds.cpuUsage) {
      newAlerts.push({
        type: 'cpuUsage',
        severity: 'warning',
        message: `High CPU usage: ${this.metrics.system.cpuUsage.toFixed(1)}%`,
        value: this.metrics.system.cpuUsage,
        threshold: this.thresholds.cpuUsage
      });
    }
    
    // Memory usage threshold
    if (this.metrics.system.memoryUsage > this.thresholds.memoryUsage) {
      newAlerts.push({
        type: 'memoryUsage',
        severity: 'warning',
        message: `High memory usage: ${this.metrics.system.memoryUsage.toFixed(1)}%`,
        value: this.metrics.system.memoryUsage,
        threshold: this.thresholds.memoryUsage
      });
    }
    
    // Audio latency threshold
    if (this.metrics.audio.totalLatency > this.thresholds.audioLatency) {
      newAlerts.push({
        type: 'audioLatency',
        severity: 'warning',
        message: `High audio latency: ${this.metrics.audio.totalLatency.toFixed(1)}ms`,
        value: this.metrics.audio.totalLatency,
        threshold: this.thresholds.audioLatency
      });
    }
    
    // Buffer utilization threshold
    if (this.metrics.realtime.bufferUtilization > this.thresholds.bufferUtilization) {
      newAlerts.push({
        type: 'bufferUtilization',
        severity: 'critical',
        message: `Critical buffer utilization: ${this.metrics.realtime.bufferUtilization.toFixed(1)}%`,
        value: this.metrics.realtime.bufferUtilization,
        threshold: this.thresholds.bufferUtilization
      });
    }
    
    // Process new alerts
    newAlerts.forEach(alert => {
      this.processAlert(alert);
    });
  }

  /**
   * Process and store alert
   */
  processAlert(alert) {
    alert.id = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    alert.timestamp = Date.now();
    
    // Add to alerts array
    this.alerts.push(alert);
    
    // Maintain alert history (last 50 alerts)
    if (this.alerts.length > 50) {
      this.alerts.shift();
    }
    
    // Notify alert callbacks
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('Alert callback error:', error);
      }
    });
    
    // Emit alert event
    this.eventBus.emit('performanceAlert', alert);
    
    console.warn(`⚠️ Performance Alert: ${alert.message}`);
  }

  // =================== ALERT MANAGEMENT ===================

  /**
   * Subscribe to performance alerts
   * @param {Function} callback - Alert callback function
   */
  subscribeToAlerts(callback) {
    this.alertCallbacks.add(callback);
    
    return () => {
      this.alertCallbacks.delete(callback);
    };
  }

  /**
   * Get current alerts
   * @param {string} severity - Filter by severity (optional)
   */
  getAlerts(severity = null) {
    if (severity) {
      return this.alerts.filter(alert => alert.severity === severity);
    }
    return [...this.alerts];
  }

  /**
   * Clear alerts
   * @param {string} type - Clear specific type (optional)
   */
  clearAlerts(type = null) {
    if (type) {
      this.alerts = this.alerts.filter(alert => alert.type !== type);
    } else {
      this.alerts = [];
    }
    
    console.log(`🧹 Performance alerts cleared${type ? ` (${type})` : ''}`);
  }

  // =================== CONFIGURATION ===================

  /**
   * Update performance thresholds
   * @param {Object} thresholds - New threshold values
   */
  updateThresholds(thresholds) {
    this.thresholds = { ...this.thresholds, ...thresholds };
    console.log('⚙️ Performance thresholds updated:', thresholds);
  }

  /**
   * Update monitoring interval
   * @param {number} interval - New interval in ms
   */
  updateInterval(interval) {
    const newInterval = Math.max(100, interval);
    
    if (newInterval !== this.updateInterval) {
      this.updateInterval = newInterval;
      
      // Restart monitoring with new interval
      if (this.isMonitoring) {
        this.stopMonitoring();
        this.startMonitoring(newInterval);
      }
      
      console.log(`⏱️ Monitoring interval updated: ${newInterval}ms`);
    }
  }

  // =================== DATA ACCESS ===================

  /**
   * Get current performance metrics
   */
  getMetrics() {
    return JSON.parse(JSON.stringify(this.metrics));
  }

  /**
   * Get comprehensive performance report
   */
  getPerformanceReport() {
    const history = this.getHistory(60000); // Last minute
    
    const report = {
      current: this.getMetrics(),
      alerts: this.getAlerts(),
      history: {
        entries: history.length,
        timespan: history.length > 0 ? 
          Date.now() - history[0].timestamp : 0
      },
      statistics: this.calculateStatistics(history),
      recommendations: this.generateRecommendations()
    };
    
    return report;
  }

  /**
   * Calculate performance statistics from history
   */
  calculateStatistics(history) {
    if (history.length === 0) return {};
    
    const stats = {
      cpu: { min: 100, max: 0, avg: 0 },
      memory: { min: 100, max: 0, avg: 0 },
      latency: { min: 1000, max: 0, avg: 0 },
      voices: { min: 1000, max: 0, avg: 0 }
    };
    
    let cpuSum = 0, memSum = 0, latencySum = 0, voicesSum = 0;
    
    history.forEach(entry => {
      const cpu = entry.metrics.system.cpuUsage;
      const mem = entry.metrics.system.memoryUsage;
      const latency = entry.metrics.audio.totalLatency;
      const voices = entry.metrics.audio.activeVoices;
      
      // CPU stats
      stats.cpu.min = Math.min(stats.cpu.min, cpu);
      stats.cpu.max = Math.max(stats.cpu.max, cpu);
      cpuSum += cpu;
      
      // Memory stats
      stats.memory.min = Math.min(stats.memory.min, mem);
      stats.memory.max = Math.max(stats.memory.max, mem);
      memSum += mem;
      
      // Latency stats
      stats.latency.min = Math.min(stats.latency.min, latency);
      stats.latency.max = Math.max(stats.latency.max, latency);
      latencySum += latency;
      
      // Voice stats
      stats.voices.min = Math.min(stats.voices.min, voices);
      stats.voices.max = Math.max(stats.voices.max, voices);
      voicesSum += voices;
    });
    
    const count = history.length;
    stats.cpu.avg = cpuSum / count;
    stats.memory.avg = memSum / count;
    stats.latency.avg = latencySum / count;
    stats.voices.avg = voicesSum / count;
    
    return stats;
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    
    // High CPU usage
    if (this.metrics.system.cpuUsage > 70) {
      recommendations.push({
        type: 'optimization',
        priority: 'high',
        message: 'Consider reducing active effects or voices to lower CPU usage',
        actions: ['Reduce polyphony', 'Disable unnecessary effects', 'Increase buffer size']
      });
    }
    
    // High memory usage
    if (this.metrics.system.memoryUsage > 75) {
      recommendations.push({
        type: 'memory',
        priority: 'medium',
        message: 'Memory usage is high, consider optimizing sample usage',
        actions: ['Unload unused samples', 'Use shorter samples', 'Clear pattern history']
      });
    }
    
    // High latency
    if (this.metrics.audio.totalLatency > 30) {
      recommendations.push({
        type: 'latency',
        priority: 'medium',
        message: 'Audio latency is high, consider audio settings optimization',
        actions: ['Use ASIO drivers', 'Reduce buffer size', 'Close other audio applications']
      });
    }
    
    // Many active voices
    if (this.metrics.audio.activeVoices > 50) {
      recommendations.push({
        type: 'polyphony',
        priority: 'low',
        message: 'High voice count may impact performance',
        actions: ['Limit instrument polyphony', 'Use shorter release times']
      });
    }
    
    return recommendations;
  }

  // =================== CLEANUP ===================

  /**
   * Dispose performance monitoring system
   */
  dispose() {
    this.stopMonitoring();
    
    // Clear data
    this.clearHistory();
    this.clearAlerts();
    
    // Clear callbacks
    this.alertCallbacks.clear();
    
    // Clear performance events
    this.performanceEvents = [];
    
    console.log('🗑️ Performance Monitoring System disposed');
  }
}

export default PerformanceMonitoringSystem;