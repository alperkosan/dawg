// src/features/channel_rack/StepGrid.jsx - OLMASI GEREKEN HALİ (ÖRNEK)
import React from 'react';
import './StepGrid.css';

const StepButton = ({ step, isActive, isBeat, isBarStart, onClick, theme }) => {
  const activeColor = theme.colors.primary;
  const beatColor = theme.colors.surface2;
  const defaultColor = theme.colors.surface;

  const style = {
    borderColor: theme.colors.border,
    backgroundColor: isActive ? activeColor : (isBeat ? beatColor : defaultColor),
    '--hover-bg': theme.colors.primary + '40',
    '--active-shadow': theme.colors.primary + '80',
  };

  return (
    <div
      className={`step-button ${isActive ? 'active' : ''} ${isBeat ? 'beat' : ''} ${isBarStart ? 'bar-start' : ''}`}
      style={style}
      onClick={onClick}
    />
  );
};


export default function StepGrid({ instrumentId, notes, totalSteps, onNoteToggle, theme }) {
  const noteSet = new Set(notes.map(n => n.time));

  return (
    <div className="step-grid">
        <div className="step-bar">
            {Array.from({ length: totalSteps }, (_, i) => (
                <StepButton
                    key={i}
                    step={i}
                    isActive={noteSet.has(i)}
                    isBeat={i % 4 === 0}
                    isBarStart={i % 16 === 0}
                    onClick={() => onNoteToggle(instrumentId, i)}
                    theme={theme}
                />
            ))}
        </div>
    </div>
  );
}