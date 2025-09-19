import React from 'react';
import { usePianoRollStore, NOTES, SCALES } from '../store/usePianoRollStore';
import { Pencil, Eraser, MousePointer, Grid3x3, Scale, Eye, EyeOff, ZoomIn, ZoomOut, AlignVerticalSpaceAround, Magnet, Move3D } from 'lucide-react';

// Tekrar eden UI elemanları için küçük bileşenler
const ToolButton = ({ label, icon: Icon, isActive, onClick }) => (
    <button onClick={onClick} title={label} className={`toolbar-btn ${isActive ? 'toolbar-btn--active' : ''}`}>
        <Icon size={16} />
    </button>
);

const Select = ({ value, onChange, options }) => (
    <select value={value} onChange={onChange} className="toolbar-select">
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
);

const ToolGroup = ({ children }) => <div className="tool-group">{children}</div>;

export function PianoRollToolbar() {
    const {
        scale, setScale, showScaleHighlighting, toggleScaleHighlighting,
        activeTool, setActiveTool, gridSnapValue, setGridSnapValue,
        snapMode, toggleSnapMode, zoomX, zoomIn, zoomOut,
        velocityLaneHeight, toggleVelocityLane
    } = usePianoRollStore();

    const snapOptions = [{ value: '32n', label: '1/32' }, { value: '16n', label: '1/16' }, { value: '8n', label: '1/8' }, { value: '4n', label: '1/4' }];
    const scaleOptions = Object.keys(SCALES).map(s => ({ value: s, label: s }));
    const noteOptions = NOTES.map(n => ({ value: n, label: n }));

    return (
        <div className="piano-roll__toolbar">
            {/* Araçlar */}
            <ToolGroup>
                <ToolButton label="Seçim (Q)" icon={MousePointer} isActive={activeTool === 'selection'} onClick={() => setActiveTool('selection')} />
                <ToolButton label="Kalem (W)" icon={Pencil} isActive={activeTool === 'pencil'} onClick={() => setActiveTool('pencil')} />
                <ToolButton label="Silgi (E)" icon={Eraser} isActive={activeTool === 'eraser'} onClick={() => setActiveTool('eraser')} />
            </ToolGroup>

            {/* Snap Ayarları */}
            <ToolGroup>
                <Grid3x3 size={16} className="tool-group__icon" />
                <Select value={gridSnapValue} onChange={e => setGridSnapValue(e.target.value)} options={snapOptions} />
                <ToolButton label="Snap Modu" icon={snapMode === 'hard' ? Magnet : Move3D} isActive={snapMode === 'soft'} onClick={toggleSnapMode} />
            </ToolGroup>

            {/* Gam Ayarları */}
            <ToolGroup>
                <Scale size={16} className="tool-group__icon" />
                <Select value={scale.root} onChange={e => setScale(e.target.value, scale.type)} options={noteOptions} />
                <Select value={scale.type} onChange={e => setScale(scale.root, e.target.value)} options={scaleOptions} />
                <ToolButton label="Gamı Vurgula" icon={showScaleHighlighting ? Eye : EyeOff} isActive={showScaleHighlighting} onClick={toggleScaleHighlighting} />
            </ToolGroup>
            
            {/* Görünüm */}
            <ToolGroup>
                <ToolButton label="Uzaklaş" icon={ZoomOut} onClick={zoomOut} />
                <span className="toolbar-zoom-label">{Math.round(zoomX * 100)}%</span>
                <ToolButton label="Yakınlaş" icon={ZoomIn} onClick={zoomIn} />
                <ToolButton label="Velocity Alanı" icon={AlignVerticalSpaceAround} isActive={velocityLaneHeight > 0} onClick={toggleVelocityLane} />
            </ToolGroup>
        </div>
    );
}
