// src/features/piano_roll_v2/components/Toolbar.jsx
import React from 'react';
import { usePianoRollStoreV2 } from '../store/usePianoRollStoreV2';
import { Pencil, MousePointer, Eraser, Grid3x3, Magnet, ZoomIn, ZoomOut, AlignVerticalSpaceAround } from 'lucide-react'; // AlignVerticalSpaceAround import edildi

const ToolButton = ({ label, icon: Icon, isActive, onClick }) => (
    <button onClick={onClick} title={label} className={`prv2-toolbar-btn ${isActive ? 'prv2-toolbar-btn--active' : ''}`}>
        <Icon size={16} />
    </button>
);

const Select = ({ value, onChange, options }) => (
    <select value={value} onChange={onChange} className="prv2-toolbar-select">
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
);

const ToolGroup = ({ children }) => <div className="prv2-tool-group">{children}</div>;

export const Toolbar = () => {
    // Optimize state selectors - separate each selector for minimal re-renders
    const activeTool = usePianoRollStoreV2(state => state.activeTool);
    const setActiveTool = usePianoRollStoreV2(state => state.setActiveTool);
    const gridSnapValue = usePianoRollStoreV2(state => state.gridSnapValue);
    const setGridSnapValue = usePianoRollStoreV2(state => state.setGridSnapValue);
    const snapMode = usePianoRollStoreV2(state => state.snapMode);
    const toggleSnapMode = usePianoRollStoreV2(state => state.toggleSnapMode);
    const zoomX = usePianoRollStoreV2(state => state.zoomX);
    const zoomIn = usePianoRollStoreV2(state => state.zoomIn);
    const zoomOut = usePianoRollStoreV2(state => state.zoomOut);
    const showVelocityLane = usePianoRollStoreV2(state => state.showVelocityLane);
    const toggleVelocityLane = usePianoRollStoreV2(state => state.toggleVelocityLane);

    const snapOptions = [
        { value: '32n', label: '1/32' },
        { value: '16n', label: '1/16' },
        { value: '8n', label: '1/8' },
        { value: '4n', label: '1/4' }
    ];

    return (
        <div className="prv2-toolbar">
            <ToolGroup>
                <ToolButton label="Seçim (Q)" icon={MousePointer} isActive={activeTool === 'selection'} onClick={() => setActiveTool('selection')} />
                <ToolButton label="Kalem (W)" icon={Pencil} isActive={activeTool === 'pencil'} onClick={() => setActiveTool('pencil')} />
                {/* === YENİ: Silgi Aracı Butonu === */}
                <ToolButton label="Silgi (E)" icon={Eraser} isActive={activeTool === 'eraser'} onClick={() => setActiveTool('eraser')} />
            </ToolGroup>

            <ToolGroup>
                <Grid3x3 size={16} className="prv2-tool-group__icon" />
                <Select value={gridSnapValue} onChange={e => setGridSnapValue(e.target.value)} options={snapOptions} />
                {/* === GÜNCELLEME: Butonun aktif durumu artık snapMode'a bağlı === */}
                <ToolButton 
                  label={`Snap Modu: ${snapMode === 'hard' ? 'Açık (Sert)' : 'Kapalı (Yumuşak)'}`} 
                  icon={Magnet} 
                  isActive={snapMode === 'hard'} // Sadece 'hard' moddayken aktif (mavi) görünür
                  onClick={toggleSnapMode} // Tıklandığında modu değiştirir
                />
            </ToolGroup>
            
            <ToolGroup>
                <ToolButton label="Uzaklaş (-)" icon={ZoomOut} onClick={zoomOut} />
                <span className="prv2-toolbar-zoom-label">{Math.round(zoomX * 100)}%</span>
                <ToolButton label="Yakınlaş (+)" icon={ZoomIn} onClick={zoomIn} />
                <ToolButton 
                    label="Vurgu Alanı" 
                    icon={AlignVerticalSpaceAround} 
                    isActive={showVelocityLane} 
                    onClick={toggleVelocityLane} 
                />
            </ToolGroup>
        </div>
    );
}