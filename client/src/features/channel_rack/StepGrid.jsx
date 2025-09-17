import React from 'react';
import './StepGrid.css';

const StepButton = ({ isActive, onClick, theme }) => {
  const style = {
    '--active-color': theme.colors.primary,
    '--active-shadow': theme.colors.primary + '80',
    '--hover-bg': theme.colors.primary + '40',
  };

  return (
    <div
      className={`step-button-v2 ${isActive ? 'active' : ''}`}
      style={style}
      onClick={onClick}
    />
  );
};

export default function StepGrid({ instrumentId, notes, totalSteps, onNoteToggle, theme }) {
  const noteSet = new Set(notes.map(n => n.time));

  // Arka plan beat/bar çizgilerini oluştur
  const backgroundGrid = React.useMemo(() => {
    const bars = [];
    for (let i = 0; i < totalSteps; i += 16) {
      bars.push(
        <div key={`bar-${i}`} className="bar-background" style={{ left: `${i * 16}px` }}>
          <div className="beat-background" style={{ backgroundColor: theme.colors.surface2 }} />
          <div className="beat-background" />
          <div className="beat-background" style={{ backgroundColor: theme.colors.surface2 }} />
          <div className="beat-background" />
        </div>
      );
    }
    return bars;
  }, [totalSteps, theme.colors.surface2]);

  return (
    <div className="step-grid-v2" style={{ backgroundColor: theme.colors.background }}>
      <div className="background-grid-container">{backgroundGrid}</div>
      <div className="step-buttons-container">
        {Array.from({ length: totalSteps }, (_, i) => (
          <StepButton
            key={i}
            isActive={noteSet.has(i)}
            onClick={() => onNoteToggle(instrumentId, i)}
            theme={theme}
          />
        ))}
      </div>
    </div>
  );
}