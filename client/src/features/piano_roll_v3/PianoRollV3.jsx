/**
 * @file PianoRollV3.jsx
 * @description Infinite scroll + LOD destekli yeni nesil Piano Roll
 */
import React, { useRef, useMemo, memo } from 'react';
import { Music } from 'lucide-react';
import { useVirtualizedEngine } from './hooks/useVirtualizedEngine';
import { useScrollSync } from './hooks/useScrollSync';
import VirtualizedGrid from './components/VirtualizedGrid';
import VirtualizedTimeline from './components/VirtualizedTimeline';
import VirtualizedKeyboard from './components/VirtualizedKeyboard';
import { usePianoRollV3Store } from './store/usePianoRollV3Store';
import './styles/PianoRollV3.css';

const PianoRollV3 = memo(({ instrument, onNotePreview }) => {
  // DOM refs
  const mainContainerRef = useRef(null);
  const timelineContentRef = useRef(null);
  const keyboardContentRef = useRef(null);

  // Store state
  const ui = usePianoRollV3Store(state => state.ui);
  const performance = usePianoRollV3Store(state => state.performance);
  const getTotalGridSize = usePianoRollV3Store(state => state.getTotalGridSize);

  // Initialize virtualized engine
  const engine = useVirtualizedEngine(mainContainerRef);

  // Setup scroll synchronization
  const scrollSync = useScrollSync(mainContainerRef, [
    { ref: timelineContentRef, axis: 'x', transform: 'translate3d' },
    { ref: keyboardContentRef, axis: 'y', transform: 'translate3d' }
  ]);

  // Total grid size for virtual scrolling
  const totalSize = useMemo(() => getTotalGridSize(), [getTotalGridSize]);

  // Handle timeline seeking
  const handleTimelineSeek = React.useCallback((step) => {
    // Bu gerçek playback store integration ile implement edilecek
    console.log('Seek to step:', step);
    // setPlaybackStep(step);
  }, []);

  // Loading state
  if (!instrument) {
    return (
      <div className="piano-roll-v3 piano-roll-v3--loading">
        <div className="piano-roll-v3__placeholder">
          <Music size={48} className="piano-roll-v3__placeholder-icon" />
          <h3>Piano Roll V3</h3>
          <p>Infinite Scroll + LOD Enabled</p>
          <p>Select an instrument to start editing</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`piano-roll-v3 ${performance.isScrolling ? 'piano-roll-v3--scrolling' : ''}`}
      data-lod={performance.lodLevel}
    >
      {/* Layout Grid */}
      <div className="piano-roll-v3__layout">
        {/* Corner */}
        <div className="piano-roll-v3__corner" />

        {/* Timeline */}
        <div className="piano-roll-v3__timeline-container">
          <div
            ref={timelineContentRef}
            className="piano-roll-v3__timeline-content"
            style={{ width: totalSize.width }}
          >
            <VirtualizedTimeline
              engine={engine}
              onSeek={handleTimelineSeek}
            />
          </div>
        </div>

        {/* Keyboard */}
        <div className="piano-roll-v3__keyboard-container">
          <div
            ref={keyboardContentRef}
            className="piano-roll-v3__keyboard-content"
            style={{ height: totalSize.height }}
          >
            <VirtualizedKeyboard
              engine={engine}
              onNotePreview={onNotePreview}
              instrumentId={instrument.id}
            />
          </div>
        </div>

        {/* Main Grid Area */}
        <div
          ref={mainContainerRef}
          className="piano-roll-v3__main-container"
          style={{
            scrollbarGutter: 'stable',
          }}
        >
          {/* Virtual content area - defines total scrollable size */}
          <div
            className="piano-roll-v3__virtual-content"
            style={{
              width: totalSize.width,
              height: totalSize.height,
              position: 'relative',
            }}
          >
            {/* Grid */}
            <VirtualizedGrid engine={engine} />

            {/* Notes akan buraya gelecek - VirtualizedNotes component */}
            {/* <VirtualizedNotes
              engine={engine}
              notes={notes}
              selectedNotes={selectedNotes}
              onNoteInteraction={handleNoteInteraction}
            /> */}

            {/* Playhead akan buraya gelecek */}
            {/* <VirtualizedPlayhead engine={engine} /> */}

            {/* Selection rectangle akan buraya gelecek */}
            {/* <SelectionRectangle engine={engine} /> */}
          </div>
        </div>

        {/* Velocity Lane (optional) */}
        {ui.showVelocityLane && (
          <>
            <div className="piano-roll-v3__velocity-corner">
              <span>Vel</span>
            </div>
            <div className="piano-roll-v3__velocity-lane">
              {/* VelocityLane component akan buraya gelecek */}
            </div>
          </>
        )}
      </div>

      {/* Performance Debug Info (development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="piano-roll-v3__debug-info">
          <div>LOD: {performance.lodLevel}</div>
          <div>Render: {performance.renderVersion}</div>
          <div>Scrolling: {performance.isScrolling ? 'Yes' : 'No'}</div>
          <div>
            Viewport: {Math.round(engine.viewport.width)}×{Math.round(engine.viewport.height)}
          </div>
          <div>
            Zoom: {Math.round(engine.viewport.zoomX * 100)}%×{Math.round(engine.viewport.zoomY * 100)}%
          </div>
          <div>
            Visible: {engine.virtualization.visibleStartX}-{engine.virtualization.visibleEndX} × {' '}
            {engine.virtualization.visibleStartY}-{engine.virtualization.visibleEndY}
          </div>
        </div>
      )}
    </div>
  );
});

PianoRollV3.displayName = 'PianoRollV3';

export default PianoRollV3;