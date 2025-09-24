import React, { useState, useRef, useEffect } from 'react';
import { PianoRollCanvas } from './PianoRollCanvas';
import { PianoRollToolbar } from './PianoRollToolbar';
import { PianoKeys } from './PianoKeys';
import { usePianoRoll } from '../../hooks/usePianoRoll';

export const PianoRoll = ({ instrumentId, className = '' }) => {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ 
    width: 800, 
    height: 400,
    keyboardWidth: 100
  });
  
  const {
    isRecording,
    gridSnap,
    zoomLevel,
    selectedNotes,
    viewPort,
    setGridSize,
    zoom,
    scrollTo,
    startRecording,
    stopRecording,
    deleteSelectedNotes,
    quantizeSelectedNotes,
    duplicateSelectedNotes,
    previewNote
  } = usePianoRoll(instrumentId);

  // Responsive dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: Math.max(800, rect.width - 120), // Reserve space for keyboard
          height: Math.max(400, rect.height - 60), // Reserve space for toolbar
          keyboardWidth: 100
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const handleWheel = (e) => {
    e.preventDefault();
    
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const rect = e.currentTarget.getBoundingClientRect();
      const centerX = e.clientX - rect.left;
      const centerY = e.clientY - rect.top;
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      zoom(zoomFactor, centerX, centerY);
    } else if (e.shiftKey) {
      // Horizontal scroll
      const newScrollX = Math.max(0, viewPort.scrollX + e.deltaY);
      scrollTo(newScrollX, viewPort.scrollY);
    } else {
      // Vertical scroll
      const newScrollY = Math.max(0, viewPort.scrollY + e.deltaY);
      scrollTo(viewPort.scrollX, newScrollY);
    }
  };

  const pianoRollStyles = {
    container: {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      backgroundColor: '#1a1a1a',
      border: '1px solid #333',
      fontFamily: 'Arial, sans-serif'
    },
    mainContent: {
      display: 'flex',
      flex: 1,
      overflow: 'hidden'
    },
    canvasArea: {
      flex: 1,
      position: 'relative',
      overflow: 'hidden'
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`piano-roll ${className}`}
      style={pianoRollStyles.container}
    >
      {/* Toolbar */}
      <PianoRollToolbar
        gridSnap={gridSnap}
        zoomLevel={zoomLevel}
        isRecording={isRecording}
        selectedNotesCount={selectedNotes.size}
        onGridChange={setGridSize}
        onZoom={(factor) => zoom(factor, dimensions.width / 2, dimensions.height / 2)}
        onRecord={isRecording ? stopRecording : startRecording}
        onDelete={deleteSelectedNotes}
        onQuantize={quantizeSelectedNotes}
        onDuplicate={duplicateSelectedNotes}
      />

      {/* Main editing area */}
      <div style={pianoRollStyles.mainContent}>
        {/* Piano keys */}
        <PianoKeys 
          width={dimensions.keyboardWidth}
          height={dimensions.height}
          onNotePreview={previewNote}
          viewPort={viewPort}
        />

        {/* Canvas area */}
        <div 
          style={pianoRollStyles.canvasArea}
          onWheel={handleWheel}
        >
          <PianoRollCanvas
            instrumentId={instrumentId}
            width={dimensions.width - dimensions.keyboardWidth}
            height={dimensions.height}
          />
        </div>
      </div>
    </div>
  );
};

export default PianoRoll;