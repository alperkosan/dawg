/**
 * CPU Monitor Component
 *
 * Displays real-time CPU usage from RealCPUMonitor (shared singleton).
 * Uses the same measurement system as PerformanceMonitor for consistency.
 */

import React, { useState, useEffect } from 'react';
import { Cpu } from 'lucide-react';
import { realCPUMonitor } from '@/lib/utils/RealCPUMonitor';
import './CPUMonitor.css';

export const CPUMonitor = () => {
  const [cpuUsage, setCpuUsage] = useState(0);
  const [isWarning, setIsWarning] = useState(false);
  const [isCritical, setIsCritical] = useState(false);

  useEffect(() => {
    // ✅ OPTIMIZATION: Use shared RealCPUMonitor instead of duplicate idle callback system
    // RealCPUMonitor is already updated every frame by UIUpdateManager
    // This eliminates redundant measurement overhead

    let updateIntervalId = null;
    let previousCpuUsage = 0;

    // Update CPU usage display every second
    updateIntervalId = setInterval(() => {
      const currentCpu = realCPUMonitor.getCPUUsage();

      // Apply smoothing to reduce jitter
      const alpha = 0.3;
      const smoothedUsage = Math.round(
        previousCpuUsage * (1 - alpha) + currentCpu * alpha
      );

      previousCpuUsage = smoothedUsage;
      setCpuUsage(smoothedUsage);
      setIsWarning(smoothedUsage > 60);
      setIsCritical(smoothedUsage > 85);
    }, 1000);

    return () => {
      if (updateIntervalId) {
        clearInterval(updateIntervalId);
      }
    };
  }, []);

  // Format CPU usage for display
  const displayValue = Math.round(cpuUsage);

  // Get color based on usage
  const getColor = () => {
    if (isCritical) return 'var(--zenith-danger)';
    if (isWarning) return 'var(--zenith-warning)';
    return 'var(--zenith-success)';
  };

  // Get status text
  const getStatusText = () => {
    if (isCritical) return 'Critical - High CPU load';
    if (isWarning) return 'Warning - Moderate CPU load';
    return 'Normal - Low CPU load';
  };

  return (
    <div
      className="cpu-monitor"
      title={`CPU Usage: ${displayValue}% - ${getStatusText()}\nMeasures UI rendering performance`}
    >
      <Cpu
        size={14}
        className="cpu-monitor__icon"
        style={{ color: getColor() }}
      />
      <div className="cpu-monitor__bar-container">
        <div
          className={`cpu-monitor__bar ${isWarning ? 'cpu-monitor__bar--warning' : ''} ${isCritical ? 'cpu-monitor__bar--critical' : ''}`}
          style={{ width: `${displayValue}%` }}
        />
      </div>
      <span
        className="cpu-monitor__value"
        style={{ color: getColor() }}
      >
        {displayValue}%
      </span>
    </div>
  );
};

export default CPUMonitor;
