import React, { useEffect, useState } from 'react';
import { visualizationEngine } from '@/features/visualization/engine/VisualizationEngine';
import './VisualizationDebugMonitor.css';

/**
 * Debug monitor for VisualizationEngine
 * Shows real-time performance stats
 */
export const VisualizationDebugMonitor = () => {
  const [stats, setStats] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      const currentStats = visualizationEngine.getStats();
      setStats(currentStats);
    }, 100); // Update 10x per second

    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) {
    return (
      <button
        className="viz-debug-toggle"
        onClick={() => setIsVisible(true)}
        title="Show Visualization Debug"
      >
        📊
      </button>
    );
  }

  if (!stats) return null;

  const getUtilizationColor = (util) => {
    if (util < 50) return '#27ae60';
    if (util < 75) return '#f39c12';
    return '#e74c3c';
  };

  const getFPSColor = (fps) => {
    if (fps >= 55) return '#27ae60';
    if (fps >= 30) return '#f39c12';
    return '#e74c3c';
  };

  return (
    <div className="viz-debug-monitor">
      <div className="viz-debug-header">
        <h3>🎨 Visualization Engine</h3>
        <button onClick={() => setIsVisible(false)}>×</button>
      </div>

      <div className="viz-debug-content">
        {/* Performance */}
        <div className="viz-debug-section">
          <h4>Performance</h4>
          <div className="viz-stat">
            <span>FPS:</span>
            <span style={{ color: getFPSColor(stats.fps) }}>
              {stats.fps}
            </span>
          </div>
          <div className="viz-stat">
            <span>Frame Time:</span>
            <span>{stats.frameTime}ms</span>
          </div>
          <div className="viz-stat">
            <span>Budget:</span>
            <span>{stats.budget}ms</span>
          </div>
          <div className="viz-stat">
            <span>Utilization:</span>
            <span style={{ color: getUtilizationColor(parseFloat(stats.utilization)) }}>
              {stats.utilization}%
            </span>
          </div>
          <div className="viz-stat">
            <span>Skipped Frames:</span>
            <span style={{ color: stats.skipFrames > 0 ? '#e74c3c' : '#27ae60' }}>
              {stats.skipFrames}
            </span>
          </div>
        </div>

        {/* Visualizers */}
        <div className="viz-debug-section">
          <h4>Visualizers</h4>
          <div className="viz-stat">
            <span>Total:</span>
            <span>{stats.visualizers}</span>
          </div>
          <div className="viz-stat">
            <span>Critical Queue:</span>
            <span style={{ color: '#e74c3c' }}>{stats.queues.critical}</span>
          </div>
          <div className="viz-stat">
            <span>Normal Queue:</span>
            <span style={{ color: '#f39c12' }}>{stats.queues.normal}</span>
          </div>
          <div className="viz-stat">
            <span>Low Queue:</span>
            <span style={{ color: '#95a5a6' }}>{stats.queues.low}</span>
          </div>
        </div>

        {/* Memory */}
        <div className="viz-debug-section">
          <h4>Memory</h4>
          <div className="viz-stat">
            <span>Canvas:</span>
            <span>{stats.canvasMemory}MB</span>
          </div>
          <div className="viz-stat">
            <span>Buffers:</span>
            <span>{stats.bufferMemory}MB</span>
          </div>
          <div className="viz-stat">
            <span>Total:</span>
            <span style={{
              color: parseFloat(stats.totalMemory) > 30 ? '#e74c3c' : '#27ae60'
            }}>
              {stats.totalMemory}MB
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
