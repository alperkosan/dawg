import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ImageOff, RotateCcw, Waves, ArrowLeftRight, RefreshCcw } from 'lucide-react';
import { WaveformV3 } from './WaveformV3';
import { WaveformToolbar } from './WaveformToolbar';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';

const clamp01 = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const MIN_WINDOW = 0.002;
const defaultRegion = { start: 0, end: 1, loopStart: 0, loopEnd: 1, loopEnabled: false };

const normalizeRegion = (state, changedKeys = []) => {
  const next = {
    ...defaultRegion,
    ...state
  };
  next.start = clamp01(next.start);
  next.end = clamp01(next.end);
  if (next.end - next.start < MIN_WINDOW) {
    if (changedKeys.includes('start') && !changedKeys.includes('end')) {
      next.end = clamp01(next.start + MIN_WINDOW);
    } else {
      next.start = clamp01(next.end - MIN_WINDOW);
    }
  }

  next.loopStart = clamp01(Math.max(next.start, next.loopStart));
  next.loopEnd = clamp01(Math.min(next.end, next.loopEnd));
  if (next.loopEnd - next.loopStart < MIN_WINDOW) {
    if (changedKeys.includes('loopStart') && !changedKeys.includes('loopEnd')) {
      next.loopEnd = clamp01(next.loopStart + MIN_WINDOW);
    } else {
      next.loopStart = clamp01(next.loopEnd - MIN_WINDOW);
    }
  }

  next.loopEnabled = !!next.loopEnabled;
  return next;
};

const formatSeconds = (seconds) => {
  if (!Number.isFinite(seconds)) return '0.00s';
  if (seconds >= 1) return `${seconds.toFixed(2)}s`;
  return `${Math.round(seconds * 1000)}ms`;
};

const formatPercent = (ratio) => `${(ratio * 100).toFixed(1)}%`;

const buildRegionFromInstrument = (instrument) => ({
  start: instrument?.sampleStart ?? 0,
  end: instrument?.sampleEnd ?? 1,
  loopStart: instrument?.loopStart ?? (instrument?.sampleStart ?? 0),
  loopEnd: instrument?.loopEnd ?? (instrument?.sampleEnd ?? 1),
  loopEnabled: !!instrument?.loop
});

const clampRegionValue = (value, fallback = 0) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.min(1, Math.max(0, value));
};

const instrumentRegionToDisplay = (region, reverse) => {
  if (!reverse) return region;
  const start = clampRegionValue(region.start, 0);
  const end = clampRegionValue(region.end, 1);
  const loopStart = clampRegionValue(region.loopStart, start);
  const loopEnd = clampRegionValue(region.loopEnd, end);
  const toDisplayRange = (a, b) => {
    let startVal = clampRegionValue(1 - b, 0);
    let endVal = clampRegionValue(1 - a, 1);
    if (endVal < startVal) [startVal, endVal] = [endVal, startVal];
    return [startVal, endVal];
  };
  const [displayStart, displayEnd] = toDisplayRange(start, end);
  const [displayLoopStart, displayLoopEnd] = toDisplayRange(loopStart, loopEnd);
  return {
    start: displayStart,
    end: displayEnd,
    loopStart: displayLoopStart,
    loopEnd: displayLoopEnd,
    loopEnabled: region.loopEnabled
  };
};

const displayRegionToInstrument = (region, reverse) => {
  if (!reverse) {
    return {
      sampleStart: clampRegionValue(region.start, 0),
      sampleEnd: clampRegionValue(region.end, 1),
      loopStart: clampRegionValue(region.loopStart, region.start ?? 0),
      loopEnd: clampRegionValue(region.loopEnd, region.end ?? 1),
      loopEnabled: region.loopEnabled
    };
  }
  const start = clampRegionValue(region.start, 0);
  const end = clampRegionValue(region.end, 1);
  const loopStart = clampRegionValue(region.loopStart, start);
  const loopEnd = clampRegionValue(region.loopEnd, end);

  const toInstrumentRange = (a, b) => {
    let newStart = clampRegionValue(1 - b, 0);
    let newEnd = clampRegionValue(1 - a, 1);
    if (newEnd < newStart) [newStart, newEnd] = [newEnd, newStart];
    return [newStart, newEnd];
  };

  const [sampleStart, sampleEnd] = toInstrumentRange(start, end);
  const [loopStartConverted, loopEndConverted] = toInstrumentRange(loopStart, loopEnd);

  return {
    sampleStart,
    sampleEnd,
    loopStart: loopStartConverted,
    loopEnd: loopEndConverted,
    loopEnabled: region.loopEnabled
  };
};

// Dikey araç çubuğu için buton bileşeni
const WorkbenchAction = ({ label, icon: Icon, isActive, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`workbench-action ${isActive ? 'workbench-action--active' : ''}`}
    title={label}
  >
    <Icon size={20} />
    <span>{label}</span>
  </button>
);

const RegionValue = ({ label, value, detail }) => (
  <div className="region-value">
    <span className="region-value__label">{label}</span>
    <span className="region-value__primary">{value}</span>
    <span className="region-value__secondary">{detail}</span>
  </div>
);

export const WaveformWorkbench = ({ instrument, buffer, readOnly = false, onInstrumentChange }) => {
  const [activeTool, setActiveTool] = useState('select');
  const [selection, setSelection] = useState(null);
  const waveformReadOnly = readOnly || !instrument;

  const precomputed = instrument?.precomputed || {};
  const { updateInstrument } = useInstrumentsStore.getState();
  const applyInstrumentChange = useCallback(
    (updates, options = {}) => {
      if (!updates || waveformReadOnly) return;
      if (typeof onInstrumentChange === 'function') {
        onInstrumentChange(updates, options);
      } else if (instrument?.id) {
        updateInstrument(instrument.id, updates, options.serialize ?? false);
      }
    },
    [instrument?.id, onInstrumentChange, updateInstrument, waveformReadOnly]
  );

  const reverse = !!instrument?.reverse;
  const [regionState, setRegionState] = useState(() => {
    const baseRegion = instrument ? buildRegionFromInstrument(instrument) : defaultRegion;
    return normalizeRegion(instrumentRegionToDisplay(baseRegion, reverse));
  });

  useEffect(() => {
    const baseRegion = instrument ? buildRegionFromInstrument(instrument) : defaultRegion;
    setRegionState(normalizeRegion(instrumentRegionToDisplay(baseRegion, reverse)));
  }, [
    instrument?.id,
    instrument?.sampleStart,
    instrument?.sampleEnd,
    instrument?.loopStart,
    instrument?.loopEnd,
    instrument?.loop,
    instrument?.reverse,
    reverse
  ]);

  const processedBuffer = useMemo(() => {
    const precomputedFlags = instrument?.precomputed || {};
    if (!buffer) return buffer;
    const rawBuffer = buffer.get ? buffer.get() : buffer;
    if (
      typeof AudioBuffer === 'undefined' ||
      !(rawBuffer instanceof AudioBuffer)
    ) {
      return buffer;
    }

    const { reverse, normalize, reversePolarity } = precomputedFlags;
    if (!reverse && !normalize && !reversePolarity) {
      return buffer;
    }

    try {
      const clone = new AudioBuffer({
        length: rawBuffer.length,
        numberOfChannels: rawBuffer.numberOfChannels,
        sampleRate: rawBuffer.sampleRate
      });

      let peak = 0;
      for (let channel = 0; channel < rawBuffer.numberOfChannels; channel++) {
        const source = rawBuffer.getChannelData(channel);
        const target = clone.getChannelData(channel);
        const lastIndex = source.length - 1;

        if (reverse) {
          for (let i = 0; i < source.length; i++) {
            let sample = source[i];
            if (reversePolarity) sample = -sample;
            const writeIndex = lastIndex - i;
            target[writeIndex] = sample;
            const abs = Math.abs(sample);
            if (abs > peak) peak = abs;
          }
        } else {
          for (let i = 0; i < source.length; i++) {
            let sample = source[i];
            if (reversePolarity) sample = -sample;
            target[i] = sample;
            const abs = Math.abs(sample);
            if (abs > peak) peak = abs;
          }
        }
      }

      if (normalize && peak > 0) {
        const gain = 1 / peak;
        for (let channel = 0; channel < clone.numberOfChannels; channel++) {
          const target = clone.getChannelData(channel);
          for (let i = 0; i < target.length; i++) {
            target[i] *= gain;
          }
        }
      }

      return clone;
    } catch (error) {
      console.warn('[WaveformWorkbench] Buffer processing failed', error);
      return buffer;
    }
  }, [buffer, instrument?.precomputed]);

  const displayBuffer = processedBuffer || buffer;

  const bufferDuration = useMemo(() => {
    if (!displayBuffer) return 0;
    if (typeof displayBuffer.duration === 'number') return displayBuffer.duration;
    if (typeof displayBuffer.get === 'function') {
      const audioBuffer = displayBuffer.get();
      if (audioBuffer) return audioBuffer.duration;
    }
    return 0;
  }, [displayBuffer]);

  const selectionNormalized = useMemo(() => {
    if (!selection) return null;
    const start = clamp01(Math.min(selection.start, selection.end));
    const end = clamp01(Math.max(selection.start, selection.end));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < MIN_WINDOW / 2) {
      return null;
    }
    return { start, end, type: selection.type };
  }, [selection]);

  const selectionDuration = selectionNormalized
    ? (selectionNormalized.end - selectionNormalized.start) * bufferDuration
    : 0;
  const trimDuration = (regionState.end - regionState.start) * bufferDuration;
  const loopDuration = (regionState.loopEnd - regionState.loopStart) * bufferDuration;

  const onPrecomputedChange = (param, value) => {
    if (waveformReadOnly) return;
    const newPrecomputed = { ...(instrument?.precomputed || {}), [param]: value };
    applyInstrumentChange({ precomputed: newPrecomputed }, { serialize: true });
  };

  const handleRegionChange = useCallback(
    (updates) => {
      const changedKeys = Object.keys(updates || {});
      setRegionState((prev) => {
        const next = normalizeRegion({ ...prev, ...updates }, changedKeys);
        const numericKeys = ['start', 'end', 'loopStart', 'loopEnd'];
        const hasNumericDiff = numericKeys.some(
          (key) => Math.abs(next[key] - prev[key]) > 0.0005
        );
        const loopToggleChanged = next.loopEnabled !== prev.loopEnabled;

        if ((hasNumericDiff || loopToggleChanged) && !waveformReadOnly) {
          const instrumentValues = displayRegionToInstrument(next, reverse);
          applyInstrumentChange({
            sampleStart: instrumentValues.sampleStart,
            sampleEnd: instrumentValues.sampleEnd,
            loopStart: instrumentValues.loopStart,
            loopEnd: instrumentValues.loopEnd,
            loop: instrumentValues.loopEnabled
          });
        }

        return next;
      });
    },
    [applyInstrumentChange, waveformReadOnly, reverse]
  );

  const handleSelectionChange = useCallback((region) => {
    setSelection(region);
  }, []);

  const handleApplySelectionToTrim = useCallback(() => {
    if (!selectionNormalized || waveformReadOnly) return;
    handleRegionChange({
      start: selectionNormalized.start,
      end: selectionNormalized.end
    });
  }, [handleRegionChange, selectionNormalized, waveformReadOnly]);

  const handleApplySelectionToLoop = useCallback(() => {
    if (!selectionNormalized || waveformReadOnly) return;
    handleRegionChange({
      loopStart: selectionNormalized.start,
      loopEnd: selectionNormalized.end,
      loopEnabled: true
    });
  }, [handleRegionChange, selectionNormalized, waveformReadOnly]);

  const handleResetTrim = () => {
    if (waveformReadOnly) return;
    handleRegionChange({ start: 0, end: 1 });
  };

  const handleResetLoop = () => {
    if (waveformReadOnly) return;
    handleRegionChange({
      loopStart: regionState.start,
      loopEnd: regionState.end
    });
  };

  const handleToolbarAction = (action) => {
    if (action === 'trim') {
      handleApplySelectionToTrim();
    } else if (action === 'delete') {
      setSelection(null);
    }
  };

  const handleLoopToggle = () => {
    if (waveformReadOnly) return;
    handleRegionChange({ loopEnabled: !regionState.loopEnabled });
  };

  const tools = {
    select: activeTool === 'select',
    slice: activeTool === 'slice',
    loop: activeTool === 'loop'
  };

  return (
    <div className="waveform-workbench">
      {/* SOL DİKEY ARAÇ ÇUBUĞU */}
      <div className="waveform-workbench__toolbar">
        <WorkbenchAction
          label="Reverse"
          icon={RotateCcw}
          isActive={!!precomputed.reverse}
          onClick={() => onPrecomputedChange('reverse', !precomputed.reverse)}
          disabled={waveformReadOnly}
        />
        <WorkbenchAction
          label="Normalize"
          icon={Waves}
          isActive={!!precomputed.normalize}
          onClick={() => onPrecomputedChange('normalize', !precomputed.normalize)}
          disabled={waveformReadOnly}
        />
        <WorkbenchAction
          label="Invert"
          icon={ArrowLeftRight}
          isActive={!!precomputed.reversePolarity}
          onClick={() => onPrecomputedChange('reversePolarity', !precomputed.reversePolarity)}
          disabled={waveformReadOnly}
        />
      </div>

      {/* SAĞ ANA BÖLÜM (YATAY TOOLBAR + WAVEFORM) */}
      <div className="waveform-workbench__main">
        <WaveformToolbar activeTool={activeTool} onToolChange={setActiveTool} onAction={handleToolbarAction} />

        {selectionNormalized && (
          <div className="selection-hint">
            <div>
              <span className="selection-hint__label">Selection</span>
              <span className="selection-hint__value">{formatSeconds(selectionDuration)}</span>
              <span className="selection-hint__meta">{formatPercent(selectionNormalized.end - selectionNormalized.start)}</span>
            </div>
            <div className="selection-hint__actions">
              <button onClick={handleApplySelectionToTrim} disabled={waveformReadOnly}>
                Set Start / End
              </button>
              <button onClick={handleApplySelectionToLoop} disabled={waveformReadOnly}>
                Set Loop
              </button>
            </div>
          </div>
        )}

        <div className="waveform-region-panel">
          <section className="region-card">
            <header className="region-card__header">
              <div>
                <span className="region-card__title">Playback Window</span>
                <span className="region-card__subtitle">Adjust sample start & end</span>
              </div>
              <button className="region-card__icon-btn" onClick={handleResetTrim} disabled={waveformReadOnly}>
                <RefreshCcw size={14} />
                Reset
              </button>
            </header>
            <div className="region-card__grid">
              <RegionValue
                label="Start"
                value={formatPercent(regionState.start)}
                detail={formatSeconds(regionState.start * bufferDuration)}
              />
              <RegionValue
                label="End"
                value={formatPercent(regionState.end)}
                detail={formatSeconds(regionState.end * bufferDuration)}
              />
              <RegionValue label="Length" value={formatSeconds(trimDuration)} detail={`${formatPercent(regionState.end - regionState.start)}`} />
            </div>
            <div className="region-card__actions">
              <button onClick={handleApplySelectionToTrim} disabled={!selectionNormalized || waveformReadOnly}>
                Apply Selection
              </button>
            </div>
          </section>

          <section className="region-card">
            <header className="region-card__header">
              <div>
                <span className="region-card__title">Loop Region</span>
                <span className="region-card__subtitle">Define sustain window</span>
              </div>
              <div className="region-card__toggle-group">
                <button
                  className={`pill-toggle ${regionState.loopEnabled ? 'pill-toggle--active' : ''}`}
                  onClick={handleLoopToggle}
                  disabled={waveformReadOnly}
                >
                  {regionState.loopEnabled ? 'Loop Enabled' : 'Loop Disabled'}
                </button>
                <button className="region-card__icon-btn" onClick={handleResetLoop} disabled={waveformReadOnly}>
                  <RefreshCcw size={14} />
                  Snap to Window
                </button>
              </div>
            </header>
            <div className="region-card__grid">
              <RegionValue
                label="Loop In"
                value={formatPercent(regionState.loopStart)}
                detail={formatSeconds(regionState.loopStart * bufferDuration)}
              />
              <RegionValue
                label="Loop Out"
                value={formatPercent(regionState.loopEnd)}
                detail={formatSeconds(regionState.loopEnd * bufferDuration)}
              />
              <RegionValue label="Length" value={formatSeconds(loopDuration)} detail={`${formatPercent(regionState.loopEnd - regionState.loopStart)}`} />
            </div>
            <div className="region-card__actions">
              <button onClick={handleApplySelectionToLoop} disabled={!selectionNormalized || waveformReadOnly}>
                Use Selection
              </button>
            </div>
          </section>
        </div>

        <div className="waveform-workbench__canvas">
          {displayBuffer ? (
            <WaveformV3
              buffer={displayBuffer}
              tools={tools}
              onSelectionChange={handleSelectionChange}
              onRegionChange={handleRegionChange}
              regionControls={regionState}
              selectedRegion={selection}
              isReadOnly={waveformReadOnly}
            />
          ) : (
            <div className="waveform-workbench__placeholder">
              <ImageOff size={48} />
              <p>Ses Verisi Görüntülenemiyor</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};