import React from 'react';
import { MousePointer, Scissors, Trash2, Crop } from 'lucide-react';

const ToolButton = ({ label, icon: Icon, isActive, onClick }) => (
  <button onClick={onClick} className={`workbench-tool ${isActive ? 'active' : ''}`} title={label}>
    <Icon size={16} />
    <span>{label}</span>
  </button>
);

export const WaveformToolbar = ({ activeTool, onToolChange, onAction }) => {
  return (
    <div className="waveform-toolbar">
      <div className="waveform-toolbar__group">
        <ToolButton label="Select" icon={MousePointer} isActive={activeTool === 'select'} onClick={() => onToolChange('select')} />
        <ToolButton label="Slice" icon={Scissors} isActive={activeTool === 'slice'} onClick={() => onToolChange('slice')} />
      </div>
      <div className="waveform-toolbar__group">
        <button className="workbench-action-btn" onClick={() => onAction('trim')} title="Seçili alanı kırp">
          <Crop size={16}/>
          <span>Trim</span>
        </button>
        <button className="workbench-action-btn" onClick={() => onAction('delete')} title="Seçili alanı sil">
          <Trash2 size={16}/>
          <span>Delete</span>
        </button>
      </div>
    </div>
  );
};