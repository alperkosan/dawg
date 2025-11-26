/**
 * CHANNEL METER
 *
 * Real-time dB level meter with peak/RMS visualization
 * - Peak level (bright bar)
 * - RMS level (darker, average)
 * - Peak hold indicator (holds for 2 seconds)
 * - Ghost trail effect (fades over 300ms)
 * - Color coded: Green (-∞ to -18dB), Yellow (-18 to -6dB), Orange (-6 to 0dB), Red (0dB+)
 *
 * PERFORMANCE OPTIMIZATION:
 * - Uses centralized MeterService (single RAF loop for ALL meters)
 * - No per-component requestAnimationFrame
 * - Batch processing in service layer
 * - Memory pooling for analyzer buffers
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { meterService } from '@/lib/services/MeterService';
import './ChannelMeter.css';

export const ChannelMeter = ({ trackId, isVisible = true }) => {
  const [meterData, setMeterData] = useState({ peak: -60, rms: -60 });
  const [peakHold, setPeakHold] = useState(-60);
  const [ghostTrail, setGhostTrail] = useState(-60);

  const peakHoldTimeRef = useRef(0);
  const ghostTrailTimeRef = useRef(0);
  const uiUpdateTimerRef = useRef(null);

  // ✅ Use refs to avoid re-subscribing when peakHold/ghostTrail change
  const peakHoldRef = useRef(-60);
  const ghostTrailRef = useRef(-60);

  // Sync refs with state
  peakHoldRef.current = peakHold;
  ghostTrailRef.current = ghostTrail;

  useEffect(() => {
    if (!isVisible) return;

    const PEAK_HOLD_DURATION = 2000; // 2 seconds
    const GHOST_FADE_DURATION = 300;  // 300ms
    const UI_UPDATE_INTERVAL = 50;    // Update UI less frequently (20fps is enough for visual feedback)

    // ✅ Subscribe to centralized meter service
    const unsubscribe = meterService.subscribe(trackId, (levels) => {
      const timestamp = performance.now();

      // Throttle UI updates to reduce React overhead
      if (uiUpdateTimerRef.current) return;

      uiUpdateTimerRef.current = setTimeout(() => {
        uiUpdateTimerRef.current = null;

        // Update meter data (already smoothed by service)
        setMeterData(levels);

        // Peak hold logic (use ref to get latest value)
        if (levels.peak > peakHoldRef.current || timestamp - peakHoldTimeRef.current > PEAK_HOLD_DURATION) {
          setPeakHold(levels.peak);
          peakHoldTimeRef.current = timestamp;
        }

        // Ghost trail logic (use ref to get latest value)
        if (levels.peak > ghostTrailRef.current) {
          setGhostTrail(levels.peak);
          ghostTrailTimeRef.current = timestamp;
        } else if (timestamp - ghostTrailTimeRef.current > GHOST_FADE_DURATION) {
          const fadeProgress = (timestamp - ghostTrailTimeRef.current - GHOST_FADE_DURATION) / 200;
          setGhostTrail(Math.max(-60, ghostTrailRef.current - (fadeProgress * 60)));
        }
      }, UI_UPDATE_INTERVAL);
    });

    // Cleanup on unmount
    return () => {
      unsubscribe();
      if (uiUpdateTimerRef.current) {
        clearTimeout(uiUpdateTimerRef.current);
      }
    };
  }, [trackId, isVisible]); // ✅ Only re-subscribe if trackId or visibility changes

  // Convert dB to percentage (range: -60dB to +12dB → 0% to 100%)
  const dbToPercent = (db) => {
    const clampedDb = Math.max(-60, Math.min(12, db));
    return ((clampedDb + 60) / 72) * 100;
  };

  // Get color based on dB level
  const getColor = (db) => {
    if (db > 0) return '#ef4444';       // Red (clipping)
    if (db > -6) return '#f59e0b';      // Orange
    if (db > -18) return '#eab308';     // Yellow
    return '#22c55e';                    // Green (safe)
  };

  // ✅ useMemo for performance - only recalculate when values change
  const peakPercent = useMemo(() => dbToPercent(meterData.peak), [meterData.peak]);
  const rmsPercent = useMemo(() => dbToPercent(meterData.rms), [meterData.rms]);
  const peakHoldPercent = useMemo(() => dbToPercent(peakHold), [peakHold]);
  const ghostTrailPercent = useMemo(() => dbToPercent(ghostTrail), [ghostTrail]);

  const peakColor = useMemo(() => getColor(meterData.peak), [meterData.peak]);
  const rmsColor = useMemo(() => getColor(meterData.rms), [meterData.rms]);
  const peakHoldColor = useMemo(() => getColor(peakHold), [peakHold]);

  return (
    <div className="channel-meter">
      <div className="channel-meter__bar">
        {/* Ghost trail (fades over time) */}
        {ghostTrailPercent > 0 && (
          <div
            className="channel-meter__ghost"
            style={{
              height: `${ghostTrailPercent}%`,
              backgroundColor: peakColor,
              opacity: 0.15
            }}
          />
        )}

        {/* RMS level (background, darker) */}
        <div
          className="channel-meter__rms"
          style={{
            height: `${rmsPercent}%`,
            backgroundColor: rmsColor,
            opacity: 0.4
          }}
        />

        {/* Peak level (foreground, brighter) */}
        <div
          className="channel-meter__peak"
          style={{
            height: `${peakPercent}%`,
            backgroundColor: peakColor,
            boxShadow: `0 0 4px ${peakColor}`
          }}
        />

        {/* Peak hold indicator (thin line that stays for 2 seconds) */}
        {peakHoldPercent > 0 && (
          <div
            className="channel-meter__peak-hold"
            style={{
              bottom: `${peakHoldPercent}%`,
              backgroundColor: peakHoldColor,
              boxShadow: `0 0 3px ${peakHoldColor}`
            }}
          />
        )}
      </div>

      {/* dB scale markers (optional) */}
      <div className="channel-meter__scale">
        <div className="channel-meter__scale-mark" style={{ bottom: '100%' }}>
          <span>+12</span>
        </div>
        <div className="channel-meter__scale-mark" style={{ bottom: '83%' }}>
          <span>0</span>
        </div>
        <div className="channel-meter__scale-mark" style={{ bottom: '58%' }}>
          <span>-18</span>
        </div>
        <div className="channel-meter__scale-mark" style={{ bottom: '0%' }}>
          <span>-60</span>
        </div>
      </div>
    </div>
  );
};

// ✅ React.memo prevents unnecessary re-renders when parent component updates
// Only re-renders if trackId changes
export const ChannelMeterMemo = React.memo(ChannelMeter, (prevProps, nextProps) => {
  return prevProps.trackId === nextProps.trackId;
});

export default ChannelMeterMemo;
