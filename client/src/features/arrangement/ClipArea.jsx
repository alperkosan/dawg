import { useArrangementStore } from '../../store/useArrangementStore';
import { Clip } from './Clip';
import { usePlaybackAnimator } from '../../hooks/usePlaybackAnimator';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import ChannelContextMenu from '../../components/ChannelContextMenu'; // ContextMenu bileşenini import et
import { useState, useRef } from 'react';

export function ClipArea() {
    const { clips, tracks, zoomX, songLength, patterns, splitPatternClip } = useArrangementStore();
    const loopLength = useInstrumentsStore(state => state.loopLength); // 👈 DEĞİŞİKLİK

    const playheadRef = useRef(null);
    const containerRef = useRef(null);
    const [contextMenu, setContextMenu] = useState(null);

    const BAR_WIDTH = 80;
    // GÜNCELLENDİ: Toplam genişlik artık dinamik loopLength'e göre hesaplanıyor
    // Bir ölçü 16 adımdır, loopLength ise adım cinsindendir.
    const totalWidth = BAR_WIDTH * (loopLength / 4) * zoomX;

    // Hook'u kullanarak animasyonu bağlıyoruz (ofset yok)
    usePlaybackAnimator(playheadRef, { fullWidth: totalWidth, offset: 0 });
    
    const handleScroll = (e) => {
        setScrollLeft(e.target.scrollLeft);
    };

    const handleContextMenu = (event, clip) => {
        event.preventDefault();
        event.stopPropagation();
        
        const pattern = patterns[clip.patternId];
        // Pattern'de 1'den fazla enstrümanın notası varsa "Split" seçeneğini göster
        const canSplit = pattern && Object.values(pattern.data).filter(notes => notes.length > 0).length > 1;

        let options = [];
        if (canSplit) {
            options.push({
                label: 'Split by channel',
                action: () => splitPatternClip(clip.id)
            });
        }
        
        // Diğer seçenekleri buraya ekleyebilirsiniz (örn: Sil, Kopyala)
        
        if (options.length > 0) {
            setContextMenu({ x: event.clientX, y: event.clientY, options });
        }
    };

    return (
        <div 
            ref={containerRef}
            className="flex-grow min-h-0 overflow-x-auto overflow-y-hidden bg-gray-800"
            onScroll={handleScroll}
            onClick={() => setContextMenu(null)}
        >
            <div className="relative" style={{ width: totalWidth, height: '100%' }}>
                {/* Dikey Grid Çizgileri */}
                {Array.from({ length: loopLength / 4 }).map((_, i) => (
                    <div 
                        key={i}
                        className="absolute top-0 bottom-0"
                        style={{
                            left: i * BAR_WIDTH * zoomX,
                            width: '1px',
                            backgroundColor: i % 4 === 0 ? 'var(--color-muted)' : 'var(--color-border)',
                        }}
                    />
                ))}

                {clips.map(clip => (
                    <Clip 
                        key={clip.id}
                        clip={clip}
                        barWidth={BAR_WIDTH}
                        zoomX={zoomX}
                        track={tracks.find(t => t.id === clip.trackId)}
                        trackIndex={tracks.findIndex(t => t.id === clip.trackId)}
                        // YENİ: Sağ tık eylemini Clip bileşenine iletiyoruz
                        onContextMenu={(e) => handleContextMenu(e, clip)}
                    />
                ))}
                
                <div ref={playheadRef} className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 z-30 pointer-events-none" />
            </div>
            {/* YENİ: Context menu'yü render et */}
            {contextMenu && (
                <ChannelContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    options={contextMenu.options}
                    onClose={() => setContextMenu(null)}
                />
            )}
        </div>
    );
}