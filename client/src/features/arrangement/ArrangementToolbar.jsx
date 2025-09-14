import React from 'react';
// HATA DÜZELTMESİ: 'Glue' ikonu 'Combine' olarak değiştirildi.
import { MousePointer, Scissors, Pencil, Combine, ZoomIn, ZoomOut, Grid } from 'lucide-react';
import { useArrangementStore } from '../../store/useArrangementStore';

const ToolButton = ({ label, icon: Icon, toolId, activeTool, onClick }) => (
    <button onClick={onClick} title={label} className={`p-2 rounded-md transition-colors ${activeTool === toolId ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>
        <Icon size={16} />
    </button>
);

export function ArrangementToolbar() {
    const { zoomX, setZoomX } = useArrangementStore();
    // Henüz araçlar için state eklemedik, şimdilik hepsi 'selection' olsun.
    const activeTool = 'selection'; 

    return (
        <div className="bg-gray-900/80 backdrop-blur-sm p-2 flex items-center justify-between border-b-2 border-gray-950 shrink-0">
            <div className="flex items-center gap-2">
                <ToolButton label="Seçim" icon={MousePointer} toolId="selection" activeTool={activeTool} />
                <ToolButton label="Kes" icon={Scissors} toolId="razor" activeTool={activeTool} />
                <ToolButton label="Kalem" icon={Pencil} toolId="pencil" activeTool={activeTool} />
                {/* HATA DÜZELTMESİ: 'Glue' yerine 'Combine' kullanılıyor */}
                <ToolButton label="Yapıştır" icon={Combine} toolId="glue" activeTool={activeTool} />
            </div>
            <div className="flex items-center gap-2">
                <Grid size={16} className="text-gray-400" />
                <span className="text-xs">Snap: 1 Bar</span>
            </div>
            <div className="flex items-center gap-2">
                 <button onClick={() => setZoomX(zoomX / 1.2)} title="Uzaklaş" className="p-2 rounded-md bg-[var(--color-surface2)] hover:bg-[var(--color-surface)]"><ZoomOut size={16} /></button>
                 <button onClick={() => setZoomX(zoomX * 1.2)} title="Yakınlaş" className="p-2 rounded-md bg-[var(--color-surface2)] hover:bg-[var(--color-surface)]"><ZoomIn size={16} /></button>
            </div>
        </div>
    );
}