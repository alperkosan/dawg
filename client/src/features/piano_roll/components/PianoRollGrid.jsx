import React, { useMemo } from 'react';
import * as Tone from 'tone';
import Note from './Note';
import { usePianoRollStore } from '../store/usePianoRollStore';

const PianoRollGrid = React.memo(({ notes, ghostNotes, selectedNotes, viewport, interaction }) => {
    const { showScaleHighlighting, showGhostNotes, scale } = usePianoRollStore();
    const scaleNoteSet = useMemo(() => {
        if (!showScaleHighlighting || !scale?.getScaleNotes) return new Set();
        return scale.getScaleNotes();
    }, [scale, showScaleHighlighting]);

    // Grid'i canvas ile çizmek için
    const drawGrid = (ctx) => {
        // ... (Bu kısım performans için canvas ile çizilebilir)
    };

    return (
        <div className="relative bg-gray-900" style={{ width: viewport.gridWidth, height: viewport.gridHeight }}>
            {/* Arka Plan Grid'i ve Vurgular */}
            {/* Bu kısım performans için canvas'a taşınabilir */}
            
            {/* Hayalet Notalar */}
            {showGhostNotes && ghostNotes.map(note => (
                <Note key={`ghost-${note.id}`} note={note} isGhost={true} ghostColor={note.color} viewport={viewport} />
            ))}

            {/* Ana Notalar */}
            {notes.map(note => (
                <Note key={note.id} note={note} isSelected={selectedNotes.has(note.id)} viewport={viewport} />
            ))}
            
            {/* Etkileşim Önizlemeleri (sürükleme, oluşturma vb.) */}
            {interaction?.previewNotes?.map(note => (
                <Note key={`preview-${note.id}`} note={note} isPreview={true} viewport={viewport}/>
            ))}
            {interaction?.type === 'create' && interaction.previewNote && (
                <Note key="preview-create" note={interaction.previewNote} isPreview={true} viewport={viewport} />
            )}

            {/* Seçim Dikdörtgeni */}
            {interaction?.type === 'marquee' && (
                <div className="absolute border-2 border-dashed border-cyan-400 bg-cyan-400/10 pointer-events-none z-40"
                    style={{
                        left: Math.min(interaction.startPos.x, interaction.currentPos.x),
                        top: Math.min(interaction.startPos.y, interaction.currentPos.y),
                        width: Math.abs(interaction.currentPos.x - interaction.startPos.x),
                        height: Math.abs(interaction.currentPos.y - interaction.startPos.y),
                    }}
                />
            )}
        </div>
    );
});

export default PianoRollGrid;
