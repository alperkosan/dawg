import React from 'react';
import { usePianoRollStore, NOTES, SCALES } from '../../store/usePianoRollStore';
import { Pencil, Eraser, Scale, Eye, EyeOff, ZoomIn, ZoomOut, Brush, CircleDotDashed } from 'lucide-react'; // Yeni ikonlar

const ToolButton = ({ label, icon: Icon, toolId, activeTool, onClick }) => (
    <button onClick={onClick} title={label} className={`p-2 rounded-md transition-colors ${activeTool === toolId ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>
        <Icon size={16} />
    </button>
);

export function PianoRollToolbar() {
    const { scale, setScale, showScaleHighlighting, toggleScaleHighlighting, activeTool, setActiveTool, zoomIn, zoomOut } = usePianoRollStore();

    return (
        <div className="bg-gray-900/80 backdrop-blur-sm p-2 flex items-center justify-between border-b-2 border-gray-950 shrink-0">
            <div className="flex items-center gap-2">
                <ToolButton label="Kalem" icon={Pencil} toolId="pencil" activeTool={activeTool} onClick={() => setActiveTool('pencil')} />
                <ToolButton label="Silgi" icon={Eraser} toolId="eraser" activeTool={activeTool} onClick={() => setActiveTool('eraser')} />
                {/* YENİ ARAÇLAR (Henüz işlevsel değil) */}
                <ToolButton label="Fırça" icon={Brush} toolId="brush" activeTool={activeTool} onClick={() => setActiveTool('brush')} />
                <ToolButton label="Akor Aracı" icon={CircleDotDashed} toolId="chord" activeTool={activeTool} onClick={() => setActiveTool('chord')} />
            </div>

            <div className="flex items-center gap-3">
                 <Scale size={18} className="text-indigo-400" />
                 <select value={scale.root} onChange={(e) => setScale(e.target.value, scale.type)} className="bg-gray-700 rounded px-2 py-1 text-xs">
                     {NOTES.map(note => <option key={note} value={note}>{note}</option>)}
                 </select>
                 <select value={scale.type} onChange={(e) => setScale(scale.root, e.target.value)} className="bg-gray-700 rounded px-2 py-1 text-xs">
                     {Object.keys(SCALES).map(scaleName => <option key={scaleName} value={scaleName}>{scaleName}</option>)}
                 </select>
                 <button onClick={toggleScaleHighlighting} title="Gam Vurgulamasını Aç/Kapat" className="p-2 rounded-md bg-gray-700 hover:bg-gray-600">
                    {showScaleHighlighting ? <EyeOff size={16} /> : <Eye size={16} />}
                 </button>
            </div>

            <div className="flex items-center gap-2">
                 <button onClick={zoomOut} title="Uzaklaş" className="p-2 rounded-md bg-gray-700 hover:bg-gray-600"><ZoomOut size={16} /></button>
                 <button onClick={zoomIn} title="Yakınlaş" className="p-2 rounded-md bg-gray-700 hover:bg-gray-600"><ZoomIn size={16} /></button>
            </div>
        </div>
    );
}