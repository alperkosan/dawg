import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import './SampleChopEditor.css';

const SNAP_STEPS = {
  '1/4': 4,
  '1/8': 2,
  '1/16': 1,
  '1/32': 0.5,
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const ensurePatternStructure = (pattern) => {
  if (!pattern) {
    return {
      id: 'sample-chop-default',
      name: 'Init Chop',
      length: 16,
      snap: '1/16',
      tempo: 140,
      loopEnabled: false,
      slices: [],
    };
  }

  const length = Math.max(pattern.length ?? 16, 1);
  return {
    id: pattern.id || 'sample-chop-default',
    name: pattern.name || 'Init Chop',
    length: pattern.length ?? 16,
    snap: pattern.snap || '1/16',
    tempo: pattern.tempo ?? 140,
    loopEnabled: Boolean(pattern.loopEnabled),
    slices: Array.isArray(pattern.slices) ? pattern.slices.map((slice) => ({
      id: slice.id || `slice-${Math.random().toString(36).slice(2)}`,
      startStep: slice.startStep ?? 0,
      endStep: slice.endStep ?? (slice.startStep ?? 0) + 1,
      startOffset: clamp(
        slice.startOffset ?? ((slice.startStep ?? 0) / length),
        0,
        0.99
      ),
      endOffset: clamp(
        slice.endOffset ?? ((slice.endStep ?? (slice.startStep ?? 0)) / length),
        ((slice.startStep ?? 0) / length) + 0.01,
        1
      ),
      pitch: slice.pitch ?? 0,
      gain: clamp(slice.gain ?? 1, 0, 2),
      reverse: Boolean(slice.reverse),
      loop: Boolean(slice.loop),
      linkSample: slice.linkSample !== undefined ? slice.linkSample : true,
    })) : [],
  };
};

const createSlice = (startStep, endStep, patternLength = 16) => {
  const length = Math.max(patternLength, 1);
  const startRatio = clamp(startStep / length, 0, 0.99);
  const endRatio = clamp(endStep / length, startRatio + 0.01, 1);
  return {
    id: `slice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    startStep,
    endStep,
    startOffset: startRatio,
    endOffset: endRatio,
    pitch: 0,
    gain: 1,
    reverse: false,
    loop: false,
    linkSample: true,
  };
};

const SampleChopEditor = ({ pattern, onChange, waveform = null }) => {
  const ensuredPattern = useMemo(() => ensurePatternStructure(pattern), [pattern]);
  const slices = ensuredPattern.slices || [];

  const isPlaying = usePlaybackStore((state) => state.isPlaying);
  const currentStep = usePlaybackStore((state) => state.currentStep);
  const bpm = usePlaybackStore((state) => state.bpm);

  useEffect(() => {
    const init = usePlaybackStore.getState()._initController;
    if (typeof init === 'function') {
      init();
    }
  }, []);

  const snapSize = useMemo(() => SNAP_STEPS[ensuredPattern.snap] ?? 1, [ensuredPattern.snap]);
  const totalBars = useMemo(() => ensuredPattern.length / 16, [ensuredPattern.length]);

  const [selectedSliceId, setSelectedSliceId] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const skipNextGridClickRef = useRef(false);
  const isDraggingRef = useRef(false);
  const gridRef = useRef(null);

  useEffect(() => {
    if (!selectedSliceId) return;
    if (!slices.some((slice) => slice.id === selectedSliceId)) {
      setSelectedSliceId(null);
    }
  }, [slices, selectedSliceId]);

  const playheadStep = useMemo(() => {
    if (ensuredPattern.length === 0) return 0;
    const step = currentStep % ensuredPattern.length;
    return (step + ensuredPattern.length) % ensuredPattern.length;
  }, [currentStep, ensuredPattern.length]);

  const commitPattern = useCallback((nextPattern) => {
    if (typeof onChange === 'function') {
      onChange(nextPattern);
    }
  }, [onChange]);

  const handleLengthChange = useCallback((event) => {
    const length = Number(event.target.value);
    if (!Number.isFinite(length)) return;
    const clampedLength = Math.max(1, length);

    const adjustedSlices = slices.map((slice) => {
      const sliceLength = Math.max((slice.endStep ?? slice.startStep) - (slice.startStep ?? 0), snapSize);
      let startStep = clamp(slice.startStep ?? 0, 0, Math.max(0, clampedLength - snapSize));
      let endStep = startStep + sliceLength;
      if (endStep > clampedLength) {
        endStep = clampedLength;
        startStep = Math.max(0, endStep - sliceLength);
      }
      return {
        ...slice,
        startStep,
        endStep,
      };
    });

    commitPattern({
      ...ensuredPattern,
      length: clampedLength,
      slices: adjustedSlices,
    });
  }, [ensuredPattern, slices, snapSize, commitPattern]);

  const handleSnapChange = useCallback((event) => {
    const snap = event.target.value;
    commitPattern({
      ...ensuredPattern,
      snap,
    });
  }, [ensuredPattern, commitPattern]);

  const handleTempoChange = useCallback((event) => {
    const tempo = Number(event.target.value);
    if (!Number.isFinite(tempo)) return;
    commitPattern({
      ...ensuredPattern,
      tempo: clamp(tempo, 40, 300),
    });
  }, [ensuredPattern, commitPattern]);

  const handleLoopToggle = useCallback((event) => {
    const loopEnabled = event.target.checked;
    commitPattern({
      ...ensuredPattern,
      loopEnabled,
    });
  }, [ensuredPattern, commitPattern]);

  const handleAddSlice = useCallback((slice) => {
    const nextSlices = [...slices, slice].sort((a, b) => a.startStep - b.startStep);
    commitPattern({
      ...ensuredPattern,
      slices: nextSlices,
    });
    setSelectedSliceId(slice.id);
  }, [slices, ensuredPattern, commitPattern]);

  const handleUpdateSlice = useCallback((sliceId, updates) => {
    const nextSlices = slices.map((slice) => {
      if (slice.id !== sliceId) return slice;
      const next = typeof updates === 'function' ? updates(slice) : { ...slice, ...updates };
      const startStep = clamp(next.startStep ?? slice.startStep, 0, ensuredPattern.length);
      const endStep = clamp(next.endStep ?? slice.endStep, 0, ensuredPattern.length);
      const safeStart = Math.min(startStep, endStep - snapSize);
      const safeEnd = Math.max(endStep, safeStart + snapSize);
      const linkSample = next.linkSample !== undefined ? next.linkSample : slice.linkSample;
      let startOffset = clamp(next.startOffset ?? slice.startOffset ?? 0, 0, 0.99);
      let endOffset = clamp(next.endOffset ?? slice.endOffset ?? 1, 0.01, 1);
      if (linkSample !== false) {
        const length = Math.max(ensuredPattern.length, 1);
        startOffset = clamp(safeStart / length, 0, 0.99);
        endOffset = clamp(safeEnd / length, startOffset + 0.01, 1);
      }
      return {
        ...slice,
        ...next,
        startStep: clamp(safeStart, 0, ensuredPattern.length - snapSize),
        endStep: clamp(safeEnd, snapSize, ensuredPattern.length),
        startOffset,
        endOffset,
        gain: clamp(next.gain ?? slice.gain ?? 1, 0, 2),
        pitch: clamp(next.pitch ?? slice.pitch ?? 0, -24, 24),
        linkSample,
      };
    });

    commitPattern({
      ...ensuredPattern,
      slices: nextSlices,
    });
  }, [slices, ensuredPattern, snapSize, commitPattern]);

  const handleRemoveSlice = useCallback((sliceId) => {
    const nextSlices = slices.filter((slice) => slice.id !== sliceId);
    commitPattern({
      ...ensuredPattern,
      slices: nextSlices,
    });
    setSelectedSliceId((currentId) => (currentId === sliceId ? null : currentId));
  }, [slices, ensuredPattern, commitPattern]);

  const handleGridClick = useCallback((event) => {
    if (dragState) return;
    if (skipNextGridClickRef.current) {
      skipNextGridClickRef.current = false;
      return;
    }

    const bounding = event.currentTarget.getBoundingClientRect();
    if (!bounding.width) return;
    const relativeX = clamp(event.clientX - bounding.left, 0, bounding.width);
    const ratio = relativeX / bounding.width;
    const rawStep = ratio * ensuredPattern.length;
    const sliceSpan = snapSize || 1;
    const shouldSnap = snapEnabled && !event.altKey && snapSize > 0;
    const snappedStart = shouldSnap ? Math.round(rawStep / snapSize) * snapSize : rawStep;
    const startStep = clamp(snappedStart, 0, Math.max(0, ensuredPattern.length - sliceSpan));
    const endStep = clamp(startStep + sliceSpan, sliceSpan, ensuredPattern.length);

    const newSlice = createSlice(startStep, endStep, ensuredPattern.length);
    handleAddSlice(newSlice);
  }, [dragState, ensuredPattern.length, snapSize, handleAddSlice, snapEnabled]);

  const handleSelectSlice = useCallback((sliceId) => {
    setSelectedSliceId(sliceId);
  }, []);

  const handleUpdateSelectedSlice = useCallback((updates) => {
    if (!selectedSliceId) return;
    handleUpdateSlice(selectedSliceId, updates);
  }, [selectedSliceId, handleUpdateSlice]);

  const handleDeleteSelectedSlice = useCallback(() => {
    if (!selectedSliceId) return;
    handleRemoveSlice(selectedSliceId);
  }, [selectedSliceId, handleRemoveSlice]);

  const selectedSlice = useMemo(
    () => slices.find((slice) => slice.id === selectedSliceId) || null,
    [slices, selectedSliceId]
  );

  const handleDragStart = useCallback((params, event) => {
    if (!gridRef.current) return;
    isDraggingRef.current = false;
    setDragState({
      ...params,
      startClientX: event?.clientX ?? params.startClientX,
      gridRect: gridRef.current.getBoundingClientRect(),
      originalStart: params.slice.startStep,
      originalEnd: params.slice.endStep,
      snap: snapSize || 0.5,
      useSnap: snapEnabled && !(event?.altKey),
    });
  }, [snapSize, snapEnabled]);

  useEffect(() => {
    if (!dragState) return;

    const { sliceId, type, gridRect, originalStart, originalEnd, snap, useSnap } = dragState;

    if (!gridRect || gridRect.width <= 0) {
      setDragState(null);
      return;
    }

    const length = ensuredPattern.length || 0;
    if (!length) {
      setDragState(null);
      return;
    }

    const handleMouseMove = (event) => {
      const deltaPixels = event.clientX - dragState.startClientX;
      const ratio = deltaPixels / gridRect.width;
      const deltaSteps = ratio * length;
      const effectiveSnap = useSnap && snap > 0 ? snap : null;
      const snappedDelta = effectiveSnap ? Math.round(deltaSteps / effectiveSnap) * effectiveSnap : deltaSteps;

      let newStart = originalStart;
      let newEnd = originalEnd;
      const span = originalEnd - originalStart;

      if (type === 'move') {
        newStart = clamp(originalStart + snappedDelta, 0, Math.max(0, length - span));
        newEnd = clamp(newStart + span, span, length);
      } else if (type === 'resize-start') {
        const minSpan = effectiveSnap || 0.25;
        newStart = clamp(originalStart + snappedDelta, 0, originalEnd - minSpan);
        newEnd = originalEnd;
      } else if (type === 'resize-end') {
        const minSpan = effectiveSnap || 0.25;
        newEnd = clamp(originalEnd + snappedDelta, originalStart + minSpan, length);
        newStart = originalStart;
      }

      if (newStart !== originalStart || newEnd !== originalEnd) {
        isDraggingRef.current = true;
        handleUpdateSlice(sliceId, {
          startStep: newStart,
          endStep: newEnd,
        });
      }
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        skipNextGridClickRef.current = true;
      }
      isDraggingRef.current = false;
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, ensuredPattern.length, handleUpdateSlice]);

  const handleStartOffsetChange = useCallback((value) => {
    const offset = clamp(value, 0, selectedSlice?.endOffset ?? 1);
    handleUpdateSelectedSlice({
      startOffset: Math.min(offset, (selectedSlice?.endOffset ?? 1) - 0.01),
      linkSample: false,
    });
  }, [selectedSlice, handleUpdateSelectedSlice]);

  const handleEndOffsetChange = useCallback((value) => {
    const offset = clamp(value, selectedSlice?.startOffset ?? 0, 1);
    handleUpdateSelectedSlice({
      endOffset: Math.max(offset, (selectedSlice?.startOffset ?? 0) + 0.01),
      linkSample: false,
    });
  }, [selectedSlice, handleUpdateSelectedSlice]);

  const loopStatus = ensuredPattern.loopEnabled ? 'Loop On' : 'Loop Off';

  return (
    <div className="sample-chop-editor">
      <div className="sample-chop-editor__toolbar">
        <div className="sample-chop-editor__field">
          <label htmlFor="sample-chop-length">Length</label>
          <select
            id="sample-chop-length"
            value={ensuredPattern.length}
            onChange={handleLengthChange}
          >
            {[16, 32, 64, 128].map((len) => (
              <option key={len} value={len}>
                {len / 16} bar{len / 16 > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="sample-chop-editor__field">
          <label htmlFor="sample-chop-snap">Snap</label>
          <select
            id="sample-chop-snap"
            value={ensuredPattern.snap}
            onChange={handleSnapChange}
          >
            {Object.keys(SNAP_STEPS).map((snap) => (
              <option key={snap} value={snap}>
                {snap}
              </option>
            ))}
          </select>
        </div>
        <div className="sample-chop-editor__field">
          <label htmlFor="sample-chop-tempo">Tempo</label>
          <input
            id="sample-chop-tempo"
            type="number"
            min="40"
            max="300"
            value={Math.round(ensuredPattern.tempo)}
            onChange={handleTempoChange}
          />
        </div>
        <label className="sample-chop-editor__loop-toggle">
          <input
            type="checkbox"
            checked={ensuredPattern.loopEnabled}
            onChange={handleLoopToggle}
          />
          <span>{loopStatus}</span>
        </label>
        <label className="sample-chop-editor__toggle">
          <input
            type="checkbox"
            checked={snapEnabled}
            onChange={(event) => setSnapEnabled(event.target.checked)}
          />
          <span>Snap (hold Alt to free)</span>
        </label>
        <div className="sample-chop-editor__info">
          <span>{totalBars} bar{totalBars > 1 ? 's' : ''}</span>
          <span>{isPlaying ? 'Live' : 'Idle'}</span>
          <span>{bpm.toFixed(1)} BPM</span>
          <span>{slices.length} slice{slices.length === 1 ? '' : 's'}</span>
        </div>
      </div>

      <div className="sample-chop-editor__timeline">
        <div className="sample-chop-editor__header">
          {Array.from({ length: totalBars }).map((_, index) => (
            <div key={index} className="sample-chop-editor__bar-label">
              Bar {index + 1}
            </div>
          ))}
        </div>

        <div className="sample-chop-editor__grid-wrapper">
          <div
            ref={gridRef}
            className="sample-chop-editor__grid"
            onClick={handleGridClick}
            role="presentation"
          >
            {waveform && waveform.buckets?.length > 0 && (
              <WaveformOverlay waveform={waveform} />
            )}
            {Array.from({ length: ensuredPattern.length }).map((_, index) => (
              <div key={index} className="sample-chop-editor__grid-step" />
            ))}

            {slices.map((slice) => {
              const width = ((slice.endStep - slice.startStep) / ensuredPattern.length) * 100;
              const left = (slice.startStep / ensuredPattern.length) * 100;
              const isSelected = slice.id === selectedSliceId;
              return (
                <div
                  key={slice.id}
                  className={`sample-chop-editor__slice ${isSelected ? 'is-selected' : ''}`}
                  style={{ width: `${width}%`, left: `${left}%` }}
                  role="presentation"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleSelectSlice(slice.id);
                  }}
                >
                  <div
                    className="sample-chop-editor__slice-handle sample-chop-editor__slice-handle--start"
                    role="presentation"
                    onMouseDown={(event) => {
                      event.stopPropagation();
                      handleDragStart({
                        slice,
                        sliceId: slice.id,
                        type: 'resize-start',
                      }, event);
                    }}
                  />
                  <div
                    className="sample-chop-editor__slice-body"
                    role="presentation"
                    onMouseDown={(event) => {
                      event.stopPropagation();
                      handleSelectSlice(slice.id);
                      handleDragStart({
                        slice,
                        sliceId: slice.id,
                        type: 'move',
                      }, event);
                    }}
                  >
                    <span className="sample-chop-editor__slice-label">
                      {slice.id.replace('slice-', '')}
                    </span>
                  </div>
                  <div
                    className="sample-chop-editor__slice-handle sample-chop-editor__slice-handle--end"
                    role="presentation"
                    onMouseDown={(event) => {
                      event.stopPropagation();
                      handleDragStart({
                        slice,
                        sliceId: slice.id,
                        type: 'resize-end',
                      }, event);
                    }}
                  />
                </div>
              );
            })}

            {isPlaying && ensuredPattern.length > 0 && (
              <div
                className="sample-chop-editor__playhead"
                style={{ left: `${(playheadStep / ensuredPattern.length) * 100}%` }}
              />
            )}
          </div>
        </div>
      </div>

      {selectedSlice && (
        <div className="sample-chop-editor__inspector">
          <div className="sample-chop-editor__inspector-header">
            <span>Slice Parameters</span>
            <button type="button" onClick={handleDeleteSelectedSlice}>
              Delete Slice
            </button>
          </div>

          <div className="sample-chop-editor__inspector-grid">
            <div className="sample-chop-editor__inspector-field">
              <label htmlFor="slice-start-step">Start Step</label>
              <input
                id="slice-start-step"
                type="number"
                min="0"
                max={Math.max(selectedSlice.endStep - snapSize, 0)}
                step={snapSize}
                value={selectedSlice.startStep}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (!Number.isFinite(value)) return;
                  handleUpdateSelectedSlice({ startStep: value });
                }}
              />
            </div>

            <div className="sample-chop-editor__inspector-field">
              <label htmlFor="slice-end-step">End Step</label>
              <input
                id="slice-end-step"
                type="number"
                min={selectedSlice.startStep + snapSize}
                max={ensuredPattern.length}
                step={snapSize}
                value={selectedSlice.endStep}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (!Number.isFinite(value)) return;
                  handleUpdateSelectedSlice({ endStep: value });
                }}
              />
            </div>

            <div className="sample-chop-editor__inspector-field">
              <label htmlFor="slice-start-offset">Sample Start</label>
              <input
                id="slice-start-offset"
                type="range"
                min="0"
                max="0.99"
                step="0.01"
                value={selectedSlice.startOffset}
                onChange={(event) => handleStartOffsetChange(Number(event.target.value))}
              />
            </div>

            <div className="sample-chop-editor__inspector-field">
              <label htmlFor="slice-end-offset">Sample End</label>
              <input
                id="slice-end-offset"
                type="range"
                min="0.01"
                max="1"
                step="0.01"
                value={selectedSlice.endOffset}
                onChange={(event) => handleEndOffsetChange(Number(event.target.value))}
              />
            </div>

            <div className="sample-chop-editor__inspector-field">
              <label htmlFor="slice-gain">Gain</label>
              <input
                id="slice-gain"
                type="range"
                min="0"
                max="2"
                step="0.01"
                value={selectedSlice.gain}
                onChange={(event) => handleUpdateSelectedSlice({ gain: Number(event.target.value) })}
              />
              <span className="sample-chop-editor__inspector-value">{selectedSlice.gain.toFixed(2)}</span>
            </div>

            <div className="sample-chop-editor__inspector-field">
              <label htmlFor="slice-pitch">Pitch (st)</label>
              <input
                id="slice-pitch"
                type="range"
                min="-24"
                max="24"
                step="0.1"
                value={selectedSlice.pitch}
                onChange={(event) => handleUpdateSelectedSlice({ pitch: Number(event.target.value) })}
              />
              <span className="sample-chop-editor__inspector-value">{selectedSlice.pitch.toFixed(1)}</span>
            </div>

            <label className="sample-chop-editor__toggle">
              <input
                type="checkbox"
                checked={selectedSlice.reverse}
                onChange={(event) => handleUpdateSelectedSlice({ reverse: event.target.checked })}
              />
              Reverse
            </label>

            <label className="sample-chop-editor__toggle">
              <input
                type="checkbox"
                checked={selectedSlice.loop}
                onChange={(event) => handleUpdateSelectedSlice({ loop: event.target.checked })}
              />
              Loop Slice
            </label>

            <label className="sample-chop-editor__toggle">
              <input
                type="checkbox"
                checked={selectedSlice.linkSample !== false}
                onChange={(event) => {
                  const linkSample = event.target.checked;
                  handleUpdateSelectedSlice((slice) => ({
                    ...slice,
                    linkSample,
                  }));
                }}
              />
              Follow Waveform
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

const WaveformOverlay = ({ waveform }) => {
  const path = useMemo(() => {
    if (!waveform || !Array.isArray(waveform.buckets) || waveform.buckets.length === 0) {
      return null;
    }
    const buckets = waveform.buckets;
    const lastIndex = Math.max(1, buckets.length - 1);
    const topPoints = [];
    const bottomPoints = [];
    buckets.forEach((bucket, index) => {
      const x = (index / lastIndex) * 100;
      const max = Math.max(-1, Math.min(1, bucket.max ?? 0));
      const min = Math.max(-1, Math.min(1, bucket.min ?? 0));
      const topY = 50 - (max * 50);
      const bottomY = 50 - (min * 50);
      topPoints.push(`${x.toFixed(2)},${topY.toFixed(2)}`);
      bottomPoints.unshift(`${x.toFixed(2)},${bottomY.toFixed(2)}`);
    });
    return `M0,50 L${topPoints.join(' L ')} L${bottomPoints.join(' L ')} Z`;
  }, [waveform]);

  if (!path) return null;

  return (
    <svg className="sample-chop-editor__waveform" viewBox="0 0 100 100" preserveAspectRatio="none">
      <path d={path} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)" strokeWidth="0.3" />
    </svg>
  );
};

export default SampleChopEditor;
