import React from 'react';
import { usePianoRollStore, NOTES, SCALES } from '../../store/usePianoRollStore';
// YENİ: Mıknatıs ikonu
import { Pencil, Eraser, MousePointer, Grid, Scale, EyeOff, ZoomIn, ZoomOut, AlignVerticalSpaceAround, Magnet } from 'lucide-react';

const ToolButton = ({ label, icon: Icon, toolId, activeTool, onClick }) => (
    <button onClick={onClick} title={label} className={`p-2 rounded-md transition-colors ${activeTool === toolId ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>
        <Icon size={16} />
    </button>
);

export function PianoRollToolbar() {
    const { 
        scale, setScale, showScaleHighlighting, toggleScaleHighlighting, 
        activeTool, setActiveTool, gridSnapValue, setGridSnapValue,
        // YENİ: snapMode ve toggleSnapMode'u store'dan alıyoruz
        snapMode, toggleSnapMode,
        zoomIn, zoomOut, velocityLaneHeight, toggleVelocityLane
    } = usePianoRollStore();

    const snapOptions = [
        { value: '32n', label: '1/32' }, { value: '16n', label: '1/16' },
        { value: '8n', label: '1/8' }, { value: '4n', label: '1/4' },
    ];

    return (
        <div className="bg-gray-900/80 backdrop-blur-sm p-2 flex items-center justify-between border-b-2 border-gray-950 shrink-0">
            <div className="flex items-center gap-2">
                <ToolButton label="Seçim" icon={MousePointer} toolId="selection" activeTool={activeTool} onClick={() => setActiveTool('selection')} />
                <ToolButton label="Kalem" icon={Pencil} toolId="pencil" activeTool={activeTool} onClick={() => setActiveTool('pencil')} />
                <ToolButton label="Silgi" icon={Eraser} toolId="eraser" activeTool={activeTool} onClick={() => setActiveTool('eraser')} />
            </div>

            <div className="flex items-center gap-2">
                <Grid size={16} className="text-gray-400" />
                <select value={gridSnapValue} onChange={(e) => setGridSnapValue(e.target.value)} className="bg-gray-700 rounded px-2 py-1 text-xs" title="Grid Yakalama Aralığı">
                    {snapOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
                
                {/* YENİ: Snap Modu Düğmesi */}
                <button 
                  onClick={toggleSnapMode} 
                  title={`Snap Modu: ${snapMode === 'hard' ? 'Sert' : 'Yumuşak'}`} 
                  className={`p-2 rounded-md transition-colors ${snapMode === 'soft' ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
                >
                    <Magnet size={16} />
                </button>

                <button onClick={toggleVelocityLane} title="Velocity Alanını Göster/Gizle" className={`p-2 rounded-md transition-colors ${velocityLaneHeight > 0 ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>
                    <AlignVerticalSpaceAround size={16} />
                </button>
            </div>

            {/* ... (geri kalan kod aynı) ... */}
            <div className="flex items-center gap-3">
                 <Scale size={18} className="text-indigo-400" />
                 <select value={scale.root} onChange={(e) => setScale(e.target.value, scale.type)} className="bg-gray-700 rounded px-2 py-1 text-xs">
                     {NOTES.map(note => <option key={note} value={note}>{note}</option>)}
                 </select>
                 <select value={scale.type} onChange={(e) => setScale(scale.root, e.target.value)} className="bg-gray-700 rounded px-2 py-1 text-xs">
                     {Object.keys(SCALES).map(scaleName => <option key={scaleName} value={scaleName}>{scaleName}</option>)}
                 </select>
                 <button onClick={toggleScaleHighlighting} title="Gam Vurgulamasını Aç/Kapat" className="p-2 rounded-md bg-gray-700 hover:bg-gray-600">
                    <EyeOff size={16} />
                 </button>
            </div>

            <div className="flex items-center gap-2">
                 <button onClick={zoomOut} title="Uzaklaş" className="p-2 rounded-md bg-[var(--color-surface2)] hover:bg-[var(--color-surface)]"><ZoomOut size={16} /></button>
                 <button onClick={zoomIn} title="Yakınlaş" className="p-2 rounded-md bg-[var(--color-surface2)] hover:bg-[var(--color-surface)]"><ZoomIn size={16} /></button>
            </div>
        </div>
    );
}