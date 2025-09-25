/**
 * @file PianoRollV3.jsx
 * @description Enhanced Piano Roll with infinite scroll, LOD, and full interaction support
 */
import React, { useRef, useMemo, memo, useCallback } from 'react';
import { Music, MousePointer2, Pencil, Eraser, Split, Copy } from 'lucide-react';
import { useVirtualizedEngine } from './hooks/useVirtualizedEngine';
import { useScrollSync } from './hooks/useScrollSync';
import { usePianoRollInteractions } from './hooks/usePianoRollInteractions';
import VirtualizedGrid from './components/VirtualizedGrid';
import VirtualizedTimeline from './components/VirtualizedTimeline';
import VirtualizedKeyboard from './components/VirtualizedKeyboard';
import VirtualizedNotes from './components/VirtualizedNotes';
import { usePianoRollV3Store } from './store/usePianoRollV3Store';
import './styles/PianoRollV3.css';

// Tool palette component
const ToolPalette = memo(({ currentTool, onToolChange }) => {
  const tools = [
    { id: 'select', icon: MousePointer2, label: 'Select (1)' },
    { id: 'pencil', icon: Pencil, label: 'Draw (2)' },
    { id: 'eraser', icon: Eraser, label: 'Erase (3)' },
    { id: 'split', icon: Split, label: 'Split (4)' },
  ];

  return (
    <div className="piano-roll-v3__tool-palette">
      {tools.map(tool => {
        const Icon = tool.icon;
        return (
          <button
            key={tool.id}
            className={`piano-roll-v3__tool-button ${currentTool === tool.id ? 'active' : ''}`}
            onClick={() => onToolChange(tool.id)}
            title={tool.label}
          >
            <Icon size={16} />
          </button>
        );
      })}
    </div>
  );
});

ToolPalette.displayName = 'ToolPalette';

// Zoom controls component
const ZoomControls = memo(({ zoomLevel, onZoomIn, onZoomOut, onZoomReset }) => {
  return (
    <div className="piano-roll-v3__zoom-controls">
      <button onClick={onZoomOut} title="Zoom Out (Ctrl+-)">−</button>
      <span>{Math.round(zoomLevel * 100)}%</span>
      <button onClick={onZoomIn} title="Zoom In (Ctrl++)">+</button>
      <button onClick={onZoomReset} title="Reset Zoom (Ctrl+0)">⊙</button>
    </div>
  );
});

ZoomControls.displayName = 'ZoomControls';

// Status bar component
const StatusBar = memo(({ stats, currentTool, position }) => {
  return (
    <div className="piano-roll-v3__status-bar">
      <div className="piano-roll-v3__status-section">
        Tool: <strong>{currentTool}</strong>
      </div>
      <div className="piano-roll-v3__status-section">
        Position: <strong>{position.bar}:{position.beat}:{position.tick}</strong>
      </div>
      <div className="piano-roll-v3__status-section">
        Notes: <strong>{stats.visibleNotes}/{stats.totalNotes}</strong>
      </div>
      <div className="piano-roll-v3__status-section">
        Grid: <strong>{stats.gridLines} lines</strong>
      </div>
    </div>
  );
});

StatusBar.displayName = 'StatusBar';

// Main Piano Roll component
const PianoRollV3 = memo(({ instrument, onNotePreview }) => {
  // DOM refs
  const mainContainerRef = useRef(null);
  const timelineContentRef = useRef(null);
  const keyboardContentRef = useRef(null);

  // Store state
  const ui = usePianoRollV3Store(state => state.ui);
  const performance = usePianoRollV3Store(state => state.performance);
  const viewport = usePianoRollV3Store(state => state.viewport);
  const getTotalGridSize = usePianoRollV3Store(state => state.getTotalGridSize);
  const getPerformanceStats = usePianoRollV3Store(state => state.getPerformanceStats);
  const zoomIn = usePianoRollV3Store(state => state.zoomIn);
  const zoomOut = usePianoRollV3Store(state => state.zoomOut);
  const setZoom = usePianoRollV3Store(state => state.setZoom);

  // Initialize engines and hooks
  const engine = useVirtualizedEngine(mainContainerRef);
  
  // Pass store to engine for note access
  engine.store = usePianoRollV3Store.getState();

  // Setup scroll synchronization with proper axis configuration
  const scrollSync = useScrollSync(mainContainerRef, [
    { ref: timelineContentRef, axis: 'x' },  // Timeline scrolls horizontally
    { ref: keyboardContentRef, axis: 'y' }   // Keyboard scrolls vertically
  ]);

  // Setup user interactions
  const interactions = usePianoRollInteractions(mainContainerRef, engine);

  // Total grid size for virtual scrolling
  const totalSize = useMemo(() => getTotalGridSize(), [getTotalGridSize]);

  // Calculate current position
  const currentPosition = useMemo(() => {
    const totalSteps = Math.floor(viewport.scrollX / engine.grid.stepWidth);
    const bar = Math.floor(totalSteps / 64) + 1;
    const beat = Math.floor((totalSteps % 64) / 16) + 1;
    const tick = totalSteps % 16;
    return { bar, beat, tick };
  }, [viewport.scrollX, engine.grid.stepWidth]);

  // Handle timeline seeking
  const handleTimelineSeek = useCallback((step) => {
    const x = step * engine.grid.stepWidth;
    scrollSync.scrollTo(x, viewport.scrollY, true);
    console.log('Seek to step:', step);
  }, [engine.grid.stepWidth, viewport.scrollY, scrollSync]);

  // Handle note interactions from VirtualizedNotes
  const handleNoteClick = useCallback((note, e) => {
    console.log('Note clicked:', note);
  }, []);

  const handleNoteDoubleClick = useCallback((note, e) => {
    console.log('Note double-clicked:', note);
    // Could open a note properties dialog here
  }, []);

  const handleNoteDrag = useCallback((noteIds, stepDelta, keyDelta) => {
    noteIds.forEach(id => {
      const note = engine.store.notes.byId[id];
      if (note) {
        engine.store.updateNote(id, {
          step: Math.max(0, note.step + stepDelta),
          key: Math.max(0, Math.min(107, note.key + keyDelta)),
        });
      }
    });
  }, [engine.store]);

  const handleNoteResize = useCallback((noteId, startDelta, durationDelta) => {
    const note = engine.store.notes.byId[noteId];
    if (note) {
      engine.store.updateNote(noteId, {
        step: Math.max(0, note.step + startDelta),
        duration: Math.max(engine.grid.snapMode, note.duration + durationDelta),
      });
    }
  }, [engine.store, engine.grid.snapMode]);

  const handleSelectionBox = useCallback((box) => {
    // Selection box logic is handled in VirtualizedNotes
  }, []);

  // Loading state
  if (!instrument) {
    return (
      <div className="piano-roll-v3 piano-roll-v3--loading">
        <div className="piano-roll-v3__placeholder">
          <Music size={48} className="piano-roll-v3__placeholder-icon" />
          <h3>Piano Roll V3</h3>
          <p>Infinite Scroll + LOD + Full Interaction</p>
          <p>Select an instrument to start editing</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`piano-roll-v3 ${performance.isScrolling ? 'piano-roll-v3--scrolling' : ''}`}
      data-lod={performance.lodLevel}
      data-tool={ui.selectedTool}
    >
      {/* Top toolbar */}
      <div className="piano-roll-v3__toolbar">
        <ToolPalette 
          currentTool={ui.selectedTool}
          onToolChange={interactions.setCurrentTool}
        />
        <div className="piano-roll-v3__toolbar-spacer" />
        <ZoomControls
          zoomLevel={viewport.zoomX}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onZoomReset={() => setZoom(1.0)}
        />
      </div>

      {/* Main layout grid */}
      <div className="piano-roll-v3__layout">
        {/* Corner */}
        <div className="piano-roll-v3__corner">
          <button 
            className="piano-roll-v3__corner-button"
            onClick={() => scrollSync.scrollTo(0, 0, true)}
            title="Return to origin"
          >
            ⌂
          </button>
        </div>

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
            cursor: interactions.isPanning ? 'grabbing' : 
                   ui.selectedTool === 'pencil' ? 'crosshair' :
                   ui.selectedTool === 'eraser' ? 'not-allowed' :
                   'default',
          }}
        >
          {/* Virtual content area */}
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

            {/* Notes layer */}
            <VirtualizedNotes
              engine={engine}
              onNoteClick={handleNoteClick}
              onNoteDoubleClick={handleNoteDoubleClick}
              onNoteDrag={handleNoteDrag}
              onNoteResize={handleNoteResize}
              onSelectionBox={handleSelectionBox}
            />

            {/* Playhead (if playing) */}
            {ui.isPlaying && (
              <div
                className="piano-roll-v3__playhead"
                style={{
                  position: 'absolute',
                  left: ui.currentStep * engine.grid.stepWidth,
                  top: 0,
                  width: '2px',
                  height: totalSize.height,
                  backgroundColor: '#ff4444',
                  pointerEvents: 'none',
                  zIndex: 1000,
                }}
              />
            )}
          </div>
        </div>

        {/* Velocity Lane */}
        {ui.showVelocityLane && (
          <>
            <div className="piano-roll-v3__velocity-corner">
              <span>Vel</span>
            </div>
            <div className="piano-roll-v3__velocity-lane">
              {/* VelocityLane component will go here */}
              <div style={{ 
                padding: '10px', 
                color: 'rgba(255,255,255,0.6)',
                textAlign: 'center' 
              }}>
                Velocity editing coming soon
              </div>
            </div>
          </>
        )}
      </div>

      {/* Status bar */}
      <StatusBar
        stats={getPerformanceStats()}
        currentTool={ui.selectedTool}
        position={currentPosition}
      />

      {/* Performance Debug Info (development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="piano-roll-v3__debug-info">
          <div>LOD: {performance.lodLevel}</div>
          <div>FPS: ~60</div>
          <div>Scrolling: {performance.isScrolling ? 'Yes' : 'No'}</div>
          <div>
            Viewport: {Math.round(viewport.width)}×{Math.round(viewport.height)}
          </div>
          <div>
            Scroll: {Math.round(viewport.scrollX)},{Math.round(viewport.scrollY)}
          </div>
          <div>
            Zoom: {Math.round(viewport.zoomX * 100)}%
          </div>
          <div>
            Visible: {engine.virtualization.visibleStartX}-{engine.virtualization.visibleEndX} × {' '}
            {engine.virtualization.visibleStartY}-{engine.virtualization.visibleEndY}
          </div>
          <div>
            Grid: {engine.grid.dynamicBars} bars
          </div>
        </div>
      )}
    </div>
  );
});

PianoRollV3.displayName = 'PianoRollV3';

export default PianoRollV3;