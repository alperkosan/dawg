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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { meterService } from '@/lib/services/MeterService';
import { canvasWorkerBridge, supportsOffscreenCanvas } from '@/lib/rendering/worker/CanvasWorkerBridge';
import { useThemeStore } from '@/store/useThemeStore';
import './ChannelMeter.css';

const DEFAULT_WIDTH = 60;
const DEFAULT_HEIGHT = 180;
const UI_UPDATE_INTERVAL = 50;
const PEAK_HOLD_DURATION = 2000;
const SCALE_TICKS = [12, 6, 3, 0, -3, -6, -12, -18, -24, -30, -36, -42, -48, -54, -60];
const LABELED_SCALE_TICKS = new Set([12, 6, 3, 0, -3, -6, -12, -24, -36, -48, -60]);

const clampDb = (value) => Math.max(-60, Math.min(12, value));

const dbToPercent = (db) => {
  const clampedDb = clampDb(db);
  return ((clampedDb + 60) / 72) * 100;
};

const getColor = (db) => {
  if (db > 0) return '#ef4444';
  if (db > -6) return '#f59e0b';
  if (db > -18) return '#eab308';
  return '#22c55e';
};

const formatDb = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-∞';
  if (value <= -59.5) return '-∞';
  const rounded = value.toFixed(1);
  return value > 0 ? `+${rounded}` : rounded;
};

const readPaletteFromTheme = () => {
  if (typeof window === 'undefined') return null;
  const root = getComputedStyle(document.documentElement);
  const read = (token, fallback) => root.getPropertyValue(token)?.trim() || fallback;
  return {
    background: read('--zenith-bg-secondary', '#05080f'),
    rail: read('--zenith-bg-tertiary', '#0e141f'),
    grid: read('--zenith-border-subtle', 'rgba(255,255,255,0.1)'),
    safe: read('--zenith-success', '#22c55e'),
    warn: read('--zenith-warning', '#eab308'),
    hot: read('--zenith-accent-warm', '#f59e0b'),
    clip: read('--zenith-error', '#ef4444'),
    text: read('--zenith-text-secondary', 'rgba(255,255,255,0.65)')
  };
};

const ChannelMeterWorkerImpl = ({ trackId, isVisible, themeToken, className = '' }) => {
  const canvasRef = useRef(null);
  const surfaceIdRef = useRef(null);
  const unsubscribeRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const throttleRef = useRef(null);
  const lastLevelsRef = useRef({ peak: -60, rms: -60 });
  const cleanupTimerRef = useRef(null);
  const lastTrackIdRef = useRef(trackId);
  const clipPulseTimeoutRef = useRef(null);

  const [uiLevels, setUiLevels] = useState({
    peak: -60,
    rms: -60,
    clip: false,
    crest: 0
  });
  const [clipPulse, setClipPulse] = useState(false);

  useEffect(() => {
    if (isVisible) return;
    setUiLevels({ peak: -60, rms: -60, clip: false });
    setClipPulse(false);
  }, [isVisible]);

  useEffect(() => {
    return () => {
      if (clipPulseTimeoutRef.current) {
        clearTimeout(clipPulseTimeoutRef.current);
        clipPulseTimeoutRef.current = null;
      }
    };
  }, []);

  const triggerClipPulse = () => {
    if (clipPulseTimeoutRef.current) {
      clearTimeout(clipPulseTimeoutRef.current);
    }
    setClipPulse(true);
    clipPulseTimeoutRef.current = setTimeout(() => {
      setClipPulse(false);
      clipPulseTimeoutRef.current = null;
    }, 650);
  };

  const destroySurface = () => {
    if (surfaceIdRef.current) {
      canvasWorkerBridge.destroySurface(surfaceIdRef.current);
      surfaceIdRef.current = null;
    }
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
  };

  const scheduleDestroySurface = () => {
    if (cleanupTimerRef.current) {
      cancelAnimationFrame(cleanupTimerRef.current);
    }
    cleanupTimerRef.current = requestAnimationFrame(() => {
      cleanupTimerRef.current = null;
      destroySurface();
    });
  };

  const cancelScheduledDestroy = () => {
    if (cleanupTimerRef.current) {
      cancelAnimationFrame(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!supportsOffscreenCanvas || !isVisible) {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      scheduleDestroySurface();
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      return;
    }

    cancelScheduledDestroy();
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!surfaceIdRef.current) {
      const surfaceId = canvasWorkerBridge.registerSurface(canvas, 'mixerMeter', {
        width: canvas.clientWidth || DEFAULT_WIDTH,
        height: canvas.clientHeight || DEFAULT_HEIGHT,
        devicePixelRatio: window.devicePixelRatio || 1,
        palette: readPaletteFromTheme()
      });
      surfaceIdRef.current = surfaceId;

      const sendDimensions = () => {
        if (!surfaceIdRef.current) return;
        canvasWorkerBridge.updateSurface(surfaceIdRef.current, {
          width: canvas.clientWidth || DEFAULT_WIDTH,
          height: canvas.clientHeight || DEFAULT_HEIGHT,
          devicePixelRatio: window.devicePixelRatio || 1
        });
      };

      sendDimensions();

      const resizeObserver = new ResizeObserver(sendDimensions);
      resizeObserver.observe(canvas);
      resizeObserverRef.current = resizeObserver;
    }

    const pushLevels = () => {
      if (!surfaceIdRef.current) return;
      canvasWorkerBridge.updateSurface(surfaceIdRef.current, {
        levels: {
          peak: lastLevelsRef.current.peak,
          rms: lastLevelsRef.current.rms,
          timestamp: performance.now()
        }
      });
    };

    const handleLevels = (levels) => {
      lastLevelsRef.current = levels;
      if (throttleRef.current) return;

      throttleRef.current = setTimeout(() => {
        throttleRef.current = null;
        pushLevels();
        const peak = lastLevelsRef.current.peak;
        const rms = lastLevelsRef.current.rms;
        const crest = Math.max(0, Math.max(-60, peak) - Math.max(-60, rms));
        const clip = peak >= -0.1;
        setUiLevels({ peak, rms, clip, crest });
        if (clip) {
          triggerClipPulse();
        }
      }, UI_UPDATE_INTERVAL);
    };

    if (!unsubscribeRef.current || lastTrackIdRef.current !== trackId) {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      unsubscribeRef.current = meterService.subscribe(trackId, handleLevels);
      lastTrackIdRef.current = trackId;
    }

    return () => {
      if (throttleRef.current) {
        clearTimeout(throttleRef.current);
        throttleRef.current = null;
      }
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      scheduleDestroySurface();
    };
  }, [trackId, isVisible]);

  useEffect(() => {
    if (!supportsOffscreenCanvas) return;
    if (!surfaceIdRef.current) return;
    canvasWorkerBridge.updateSurface(surfaceIdRef.current, {
      palette: readPaletteFromTheme()
    });
  }, [themeToken]);

  const classes = ['channel-meter', 'channel-meter--worker', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <div className="channel-meter__frame">
        <canvas ref={canvasRef} className="channel-meter__canvas" />
        <div className="channel-meter__glass" />
        <div className={`channel-meter__clip-indicator ${clipPulse ? 'is-active' : ''}`}>
          CLIP
        </div>
      </div>
      <div className="channel-meter__telemetry-panel">
        <div className="channel-meter__telemetry-chip channel-meter__telemetry-chip--peak">
          <strong>{formatDb(uiLevels.peak).padStart(5, ' ')}</strong>
        </div>
        <div className="channel-meter__telemetry-chip channel-meter__telemetry-chip--rms">
          <strong>{formatDb(uiLevels.rms).padStart(5, ' ')}</strong>
        </div>
        <div className="channel-meter__telemetry-chip channel-meter__telemetry-chip--dyn">
          <strong>{uiLevels.crest.toFixed(1).padStart(5, ' ')}</strong>
        </div>
      </div>
    </div>
  );
};

const ChannelMeterLegacy = ({ trackId, isVisible = true, className = '' }) => {
  const [meterData, setMeterData] = useState({ peak: -60, rms: -60 });
  const [peakHold, setPeakHold] = useState(-60);
  const [ghostTrail, setGhostTrail] = useState(-60);
  const [clipPulse, setClipPulse] = useState(false);

  const peakHoldTimeRef = useRef(0);
  const ghostTrailTimeRef = useRef(0);
  const uiUpdateTimerRef = useRef(null);
  const clipTimerRef = useRef(null);

  const peakHoldRef = useRef(-60);
  const ghostTrailRef = useRef(-60);
  peakHoldRef.current = peakHold;
  ghostTrailRef.current = ghostTrail;

  useEffect(() => {
    if (!isVisible) return () => {};

    const PEAK_HOLD_DURATION = 2000;
    const GHOST_FADE_DURATION = 300;

    const unsubscribe = meterService.subscribe(trackId, (levels) => {
      const timestamp = performance.now();

      if (uiUpdateTimerRef.current) return;

      uiUpdateTimerRef.current = setTimeout(() => {
        uiUpdateTimerRef.current = null;
        setMeterData(levels);

        if (levels.peak > peakHoldRef.current || timestamp - peakHoldTimeRef.current > PEAK_HOLD_DURATION) {
          setPeakHold(levels.peak);
          peakHoldTimeRef.current = timestamp;
        }

        if (levels.peak > ghostTrailRef.current) {
          setGhostTrail(levels.peak);
          ghostTrailTimeRef.current = timestamp;
        } else if (timestamp - ghostTrailTimeRef.current > GHOST_FADE_DURATION) {
          const fadeProgress = (timestamp - ghostTrailTimeRef.current - GHOST_FADE_DURATION) / 200;
          setGhostTrail(Math.max(-60, ghostTrailRef.current - (fadeProgress * 60)));
        }

        if (levels.peak >= -0.1) {
          if (clipTimerRef.current) {
            clearTimeout(clipTimerRef.current);
          }
          setClipPulse(true);
          clipTimerRef.current = setTimeout(() => {
            setClipPulse(false);
            clipTimerRef.current = null;
          }, 650);
        }
      }, UI_UPDATE_INTERVAL);
    });

    return () => {
      unsubscribe();
      if (uiUpdateTimerRef.current) {
        clearTimeout(uiUpdateTimerRef.current);
      }
      if (clipTimerRef.current) {
        clearTimeout(clipTimerRef.current);
        clipTimerRef.current = null;
      }
    };
  }, [trackId, isVisible]);

  const peakPercent = useMemo(() => dbToPercent(meterData.peak), [meterData.peak]);
  const rmsPercent = useMemo(() => dbToPercent(meterData.rms), [meterData.rms]);
  const peakHoldPercent = useMemo(() => dbToPercent(peakHold), [peakHold]);
  const ghostTrailPercent = useMemo(() => dbToPercent(ghostTrail), [ghostTrail]);
  const crestValue = useMemo(() => Math.max(0, Math.max(-60, meterData.peak) - Math.max(-60, meterData.rms)), [meterData.peak, meterData.rms]);

  const peakColor = useMemo(() => getColor(meterData.peak), [meterData.peak]);
  const rmsColor = useMemo(() => getColor(meterData.rms), [meterData.rms]);
  const peakHoldColor = useMemo(() => getColor(peakHold), [peakHold]);

  const classes = ['channel-meter', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <div className="channel-meter__bar">
        <div className={`channel-meter__clip-indicator ${clipPulse ? 'is-active' : ''}`}>
          CLIP
        </div>
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
        <div
          className="channel-meter__rms"
          style={{
            height: `${rmsPercent}%`,
            backgroundColor: rmsColor,
            opacity: 0.4
          }}
        />
        <div
          className="channel-meter__peak"
          style={{
            height: `${peakPercent}%`,
            backgroundColor: peakColor,
            boxShadow: `0 0 4px ${peakColor}`
          }}
        />
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
      <div className="channel-meter__scale">
        {SCALE_TICKS.map((db) => {
          const percent = dbToPercent(db);
          const isLabeled = LABELED_SCALE_TICKS.has(db);
          return (
            <div
              key={`legacy-scale-${db}`}
              className={`channel-meter__scale-mark ${isLabeled ? 'channel-meter__scale-mark--label' : ''}`}
              style={{ bottom: `${percent}%` }}
            >
              {isLabeled && <span>{db > 0 ? `+${db}` : db}</span>}
            </div>
          );
        })}
      </div>
      <div className="channel-meter__telemetry-panel channel-meter__telemetry-panel--legacy">
        <div className="channel-meter__telemetry-chip channel-meter__telemetry-chip--peak">
          <strong>{formatDb(meterData.peak).padStart(5, ' ')}</strong>
        </div>
        <div className="channel-meter__telemetry-chip channel-meter__telemetry-chip--rms">
          <strong>{formatDb(meterData.rms).padStart(5, ' ')}</strong>
        </div>
        <div className="channel-meter__telemetry-chip channel-meter__telemetry-chip--dyn">
          <strong>{crestValue.toFixed(1).padStart(5, ' ')}</strong>
        </div>
      </div>
    </div>
  );
};

export const ChannelMiniMeter = ({ trackId, isVisible = true }) => {
  const [levels, setLevels] = useState({ peak: -60, rms: -60 });
  const [peakHold, setPeakHold] = useState(-60);
  const holdTimestampRef = useRef(0);
  const throttledRef = useRef(null);
  const tickPercents = useMemo(
    () => SCALE_TICKS.map(dbToPercent),
    []
  );

  useEffect(() => {
    if (!isVisible || !trackId) return () => {};

    const unsubscribe = meterService.subscribe(trackId, (nextLevels) => {
      if (throttledRef.current) return;

      throttledRef.current = setTimeout(() => {
        throttledRef.current = null;
        const timestamp = performance.now();
        setLevels(nextLevels);
        setPeakHold((prev) => {
          if (nextLevels.peak > prev || timestamp - holdTimestampRef.current > PEAK_HOLD_DURATION) {
            holdTimestampRef.current = timestamp;
            return nextLevels.peak;
          }
          return prev;
        });
      }, UI_UPDATE_INTERVAL);
    });

    return () => {
      unsubscribe();
      if (throttledRef.current) {
        clearTimeout(throttledRef.current);
        throttledRef.current = null;
      }
    };
  }, [trackId, isVisible]);

  const peakPercent = useMemo(() => dbToPercent(levels.peak), [levels.peak]);
  const rmsPercent = useMemo(() => dbToPercent(levels.rms), [levels.rms]);
  const holdPercent = useMemo(() => dbToPercent(peakHold), [peakHold]);
  const peakColor = useMemo(() => getColor(levels.peak), [levels.peak]);

  return (
    <div className="channel-mini-meter" data-track={trackId}>
      <div className="channel-mini-meter__grid">
        {tickPercents.map((percent, index) => (
          <div
            key={`${percent}-${index}`}
            className="channel-mini-meter__tick"
            style={{ bottom: `${percent}%` }}
          />
        ))}
      </div>
      <div className="channel-mini-meter__rail">
        <div
          className="channel-mini-meter__rms"
          style={{ height: `${rmsPercent}%` }}
        />
        <div
          className="channel-mini-meter__peak"
          style={{
            height: `${peakPercent}%`,
            backgroundColor: peakColor
          }}
        />
        <div
          className="channel-mini-meter__hold"
          style={{
            bottom: `${holdPercent}%`,
            backgroundColor: peakColor
          }}
        />
      </div>
    </div>
  );
};

const ChannelMeterComponent = ({ trackId, isVisible = true, className = '' }) => {
  const activeThemeId = useThemeStore(state => state.activeThemeId);

  if (supportsOffscreenCanvas) {
    return (
      <ChannelMeterWorkerImpl
        trackId={trackId}
        isVisible={isVisible}
        themeToken={activeThemeId}
        className={className}
      />
    );
  }

  return (
    <ChannelMeterLegacy
      trackId={trackId}
      isVisible={isVisible}
      className={className}
    />
  );
};

export const ChannelMeterMemo = React.memo(ChannelMeterComponent, (prevProps, nextProps) => {
  return (
    prevProps.trackId === nextProps.trackId &&
    prevProps.isVisible === nextProps.isVisible &&
    prevProps.className === nextProps.className
  );
});

export default ChannelMeterMemo;
export const ChannelMeter = ChannelMeterComponent;
