import React, { useState, useMemo } from 'react';

export const PianoKeys = ({ 
  width = 100, 
  height = 400, 
  onNotePreview,
  viewPort = { scrollY: 0 }
}) => {
  const [activeKey, setActiveKey] = useState(null);
  
  // Generate piano keys
  const keys = useMemo(() => {
    const keyList = [];
    const noteHeight = 12; // Height of each key
    
    // Generate 8 octaves (C0 to B7)
    for (let octave = 0; octave < 8; octave++) {
      const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      noteNames.forEach((name, index) => {
        const midi = octave * 12 + index;
        keyList.push({
          name: `${name}${octave}`,
          midi,
          octave,
          noteIndex: index,
          isBlack: name.includes('#'),
          y: (127 - midi) * noteHeight // Position from top (high notes at top)
        });
      });
    }
    
    return keyList;
  }, []);

  const handleKeyPress = (key) => {
    setActiveKey(key.midi);
    onNotePreview(key.name, 0.8);
    
    // Auto-release after 300ms
    setTimeout(() => setActiveKey(null), 300);
  };

  const keyboardStyles = {
    container: {
      width: width,
      height: height,
      backgroundColor: '#2a2a2a',
      borderRight: '1px solid #444',
      position: 'relative',
      overflow: 'hidden',
      userSelect: 'none'
    },
    key: (key, isActive) => ({
      position: 'absolute',
      left: key.isBlack ? '60%' : '0',
      top: `${key.y - viewPort.scrollY}px`,
      width: key.isBlack ? '40%' : '100%',
      height: '12px',
      backgroundColor: isActive 
        ? '#ff6b35' 
        : key.isBlack 
          ? '#333' 
          : '#666',
      border: '1px solid #444',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      paddingLeft: '4px',
      fontSize: '9px',
      fontWeight: 'normal',
      color: key.isBlack ? '#ccc' : '#000',
      zIndex: key.isBlack ? 2 : 1,
      transition: 'background-color 0.1s ease'
    }),
    keyName: {
      fontSize: '8px',
      fontWeight: '500',
      pointerEvents: 'none'
    }
  };

  // Only render visible keys for performance
  const visibleKeys = keys.filter(key => {
    const keyBottom = key.y + 12;
    const keyTop = key.y;
    const viewTop = viewPort.scrollY;
    const viewBottom = viewPort.scrollY + height;
    
    return keyBottom > viewTop && keyTop < viewBottom;
  });

  return (
    <div style={keyboardStyles.container}>
      {/* Background pattern for better visual */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, #333 0px, #333 12px, #2a2a2a 12px, #2a2a2a 24px)',
        opacity: 0.3
      }} />
      
      {/* Piano keys */}
      {visibleKeys.map(key => (
        <div
          key={key.midi}
          style={keyboardStyles.key(key, activeKey === key.midi)}
          onMouseDown={() => handleKeyPress(key)}
          onMouseEnter={(e) => {
            if (e.buttons === 1) { // If mouse is held down
              handleKeyPress(key);
            }
          }}
        >
          <span style={keyboardStyles.keyName}>
            {key.name}
          </span>
        </div>
      ))}
      
      {/* Octave markers */}
      {Array.from({ length: 8 }, (_, octave) => (
        <div
          key={`octave-${octave}`}
          style={{
            position: 'absolute',
            right: '2px',
            top: `${(127 - (octave * 12)) * 12 - viewPort.scrollY - 6}px`,
            fontSize: '10px',
            color: '#666',
            fontWeight: 'bold',
            pointerEvents: 'none'
          }}
        >
          {octave}
        </div>
      ))}
    </div>
  );
};

export default PianoKeys;
