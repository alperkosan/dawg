import React from 'react';

export const PianoRollToolbar = ({
  gridSnap,
  zoomLevel,
  isRecording,
  selectedNotesCount,
  onGridChange,
  onZoom,
  onRecord,
  onDelete,
  onQuantize,
  onDuplicate
}) => {
  const gridSizes = ['4n', '8n', '16n', '32n'];
  
  return (
    <div className="piano-roll-toolbar" style={{ 
      padding: '8px',
      background: '#2a2a2a',
      borderBottom: '1px solid #444',
      display: 'flex',
      gap: '16px',
      alignItems: 'center'
    }}>
      {/* Grid snap */}
      <div className="toolbar-group">
        <label style={{ color: '#ccc', marginRight: '8px' }}>Grid:</label>
        <select 
          value={gridSnap} 
          onChange={(e) => onGridChange(e.target.value)}
          style={{ background: '#333', color: '#ccc', border: '1px solid #555' }}
        >
          {gridSizes.map(size => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </div>

      {/* Zoom controls */}
      <div className="toolbar-group">
        <button 
          onClick={() => onZoom(0.8)}
          style={{ background: '#333', color: '#ccc', border: '1px solid #555', marginRight: '4px' }}
        >
          -
        </button>
        <span style={{ color: '#ccc', minWidth: '40px', textAlign: 'center' }}>
          {Math.round(zoomLevel * 100)}%
        </span>
        <button 
          onClick={() => onZoom(1.2)}
          style={{ background: '#333', color: '#ccc', border: '1px solid #555', marginLeft: '4px' }}
        >
          +
        </button>
      </div>

      {/* Recording */}
      <div className="toolbar-group">
        <button 
          onClick={onRecord}
          style={{ 
            background: isRecording ? '#ff4444' : '#333', 
            color: '#ccc', 
            border: '1px solid #555',
            fontWeight: isRecording ? 'bold' : 'normal'
          }}
        >
          {isRecording ? '⏹️ Stop' : '🔴 Rec'}
        </button>
      </div>

      {/* Note operations */}
      {selectedNotesCount > 0 && (
        <div className="toolbar-group">
          <span style={{ color: '#ccc', marginRight: '8px' }}>
            {selectedNotesCount} selected
          </span>
          <button 
            onClick={onDelete}
            style={{ background: '#333', color: '#ccc', border: '1px solid #555', marginRight: '4px' }}
          >
            Delete
          </button>
          <button 
            onClick={onQuantize}
            style={{ background: '#333', color: '#ccc', border: '1px solid #555', marginRight: '4px' }}
          >
            Quantize
          </button>
          <button 
            onClick={onDuplicate}
            style={{ background: '#333', color: '#ccc', border: '1px solid #555' }}
          >
            Duplicate
          </button>
        </div>
      )}
    </div>
  );
};

// ✅ Default export ekle
export default PianoRollToolbar;
