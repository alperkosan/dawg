import React from 'react';
import { Rnd } from 'react-rnd';
import { useArrangementStore } from '@/store/useArrangementStore';

// GÜNCELLENDİ: onContextMenu prop'unu alıyor
export function Clip({ clip, barWidth, zoomX, track, trackIndex, onContextMenu }) {
    const { updateClip, patterns } = useArrangementStore();
    const pattern = patterns[clip.patternId];

    // Klip için doğru dikey pozisyonu hesapla
    // Eğer klip belirli bir kanala aitse (split sonrası), o kanalın pozisyonunu kullan.
    // Değilse (birleşik pattern klibi), en üstte (0) göster.
    const topPosition = trackIndex !== -1 ? (trackIndex * (track?.height || 60)) : 0;
    const clipHeight = track ? track.height - 8 : 52; // Birleşik kliplerin yüksekliği sabit

    const handleDragStop = (e, d) => {
        const newStartTime = Math.round(d.x / (barWidth * zoomX));
        // Sürüklenen klip bir kanala ait değilse (birleşik pattern ise)
        // en yakın kanala yerleştirmeyi deneyebiliriz (gelişmiş özellik).
        // Şimdilik sadece x pozisyonunu güncelliyoruz.
        updateClip(clip.id, { startTime: newStartTime });
    };

    const handleResizeStop = (e, direction, ref, delta, position) => {
        const newDuration = Math.round(parseInt(ref.style.width, 10) / (barWidth * zoomX));
        const newStartTime = Math.round(position.x / (barWidth * zoomX));
        updateClip(clip.id, { duration: newDuration, startTime: newStartTime });
    };

    // Klip rengini belirle
    const clipColor = track ? 'bg-cyan-600/80 border-cyan-400' : 'bg-amber-500/80 border-amber-400';

    return (
        <Rnd
            className={`rounded-md flex items-center p-2 box-border overflow-hidden ${clipColor}`}
            style={{ zIndex: 10 }}
            size={{
                width: clip.duration * barWidth * zoomX,
                height: clipHeight,
            }}
            position={{
                x: clip.startTime * barWidth * zoomX,
                y: topPosition + 4,
            }}
            onDragStop={handleDragStop}
            onResizeStop={handleResizeStop}
            dragGrid={[barWidth * zoomX, 1]}
            resizeGrid={[barWidth * zoomX, 1]}
            bounds="parent"
            // GÜNCELLENDİ: Sağ tık olayını Rnd bileşenine bağlıyoruz
            onContextMenu={onContextMenu}
        >
            <span className="text-white text-xs font-bold truncate pointer-events-none">
                {pattern?.name || 'Bilinmeyen Pattern'}
            </span>
        </Rnd>
    );
}