import React from 'react';
// CSS import'u kaldırıldı

const StepButton = ({ isActive, onClick }) => {
  const buttonClasses = `step-grid__button ${isActive ? 'step-grid__button--active' : ''}`;
  return (
    <div className={buttonClasses} onClick={onClick}>
      <div className="step-grid__button-indicator" />
    </div>
  );
};

export default function StepGrid({ instrumentId, notes, totalSteps, onNoteToggle }) {
  const noteSet = new Set(notes.map(n => n.time));
  const STEP_WIDTH = 16;

  // Arka plan beat/bar çizgilerini JSX ile oluştur
  const backgroundGrid = React.useMemo(() => {
    const bars = [];
    for (let i = 0; i < totalSteps; i += 16) {
      bars.push(
        <div key={`bar-${i}`} className="step-grid__bar-bg" style={{ width: `${16 * STEP_WIDTH}px` }}>
          <div className="step-grid__beat-bg" style={{ width: `${4 * STEP_WIDTH}px` }} />
          <div className="step-grid__beat-bg" style={{ width: `${4 * STEP_WIDTH}px` }} />
          <div className="step-grid__beat-bg" style={{ width: `${4 * STEP_WIDTH}px` }} />
          <div className="step-grid__beat-bg" style={{ width: `${4 * STEP_WIDTH}px` }} />
        </div>
      );
    }
    return bars;
  }, [totalSteps]);

  return (
    <div className="step-grid">
      <div className="step-grid__background">{backgroundGrid}</div>
      <div className="step-grid__buttons">
        {Array.from({ length: totalSteps }, (_, i) => (
          <StepButton
            key={i}
            isActive={noteSet.has(i)}
            onClick={() => onNoteToggle(instrumentId, i)}
          />
        ))}
      </div>
    </div>
  );
}
