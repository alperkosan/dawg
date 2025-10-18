/**
 * CPU Monitor Component
 *
 * Displays real-time CPU usage for the audio engine and UI rendering.
 * Combines Web Audio API metrics with rendering performance.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Cpu } from 'lucide-react';
import { AudioContextService } from '@/lib/services/AudioContextService';
import './CPUMonitor.css';

export const CPUMonitor = () => {
  const [cpuUsage, setCpuUsage] = useState(0);
  const [isWarning, setIsWarning] = useState(false);
  const [isCritical, setIsCritical] = useState(false);

  const rafIdRef = useRef(null);

  useEffect(() => {
    // Most accurate approach: Measure idle time vs total time
    // requestIdleCallback tells us when the browser is idle
    // If we have lots of idle time = low CPU usage
    // If we have little idle time = high CPU usage

    let totalTime = 0;
    let idleTime = 0;
    let lastReset = performance.now();
    let idleCallbackId = null;
    let updateIntervalId = null;

    // Schedule idle callback continuously
    const scheduleIdleCheck = () => {
      if (typeof requestIdleCallback !== 'undefined') {
        idleCallbackId = requestIdleCallback((deadline) => {
          // We got idle time! Measure how much
          const remaining = deadline.timeRemaining();
          idleTime += remaining;

          // Schedule next check
          scheduleIdleCheck();
        }, { timeout: 1000 }); // Force callback within 1 second
      } else {
        // Fallback: Use RAF timing
        const rafStart = performance.now();
        rafIdRef.current = requestAnimationFrame(() => {
          const rafEnd = performance.now();
          const frameDuration = rafEnd - rafStart;

          // If frame was fast, we had idle time
          if (frameDuration < 16.67) {
            idleTime += (16.67 - frameDuration);
          }

          scheduleIdleCheck();
        });
      }
    };

    // Update CPU usage display every second
    updateIntervalId = setInterval(() => {
      const now = performance.now();
      const elapsed = now - lastReset;

      // Calculate CPU usage
      // More idle time = less CPU usage
      const idleRatio = idleTime / elapsed;
      let usage = Math.max(0, Math.min(100, (1 - idleRatio) * 100));

      // Apply smoothing
      const alpha = 0.3;
      const smoothedUsage = Math.round(
        cpuUsage * (1 - alpha) + usage * alpha
      );

      setCpuUsage(smoothedUsage);
      setIsWarning(smoothedUsage > 60);
      setIsCritical(smoothedUsage > 85);

      // Reset counters
      totalTime = 0;
      idleTime = 0;
      lastReset = now;
    }, 1000);

    // Start measurement
    scheduleIdleCheck();

    return () => {
      if (idleCallbackId && typeof cancelIdleCallback !== 'undefined') {
        cancelIdleCallback(idleCallbackId);
      }
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (updateIntervalId) {
        clearInterval(updateIntervalId);
      }
    };
  }, [cpuUsage]);

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
