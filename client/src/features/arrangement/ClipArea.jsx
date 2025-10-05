import { useArrangementStore } from '@/store/useArrangementStore';
import { Clip } from './Clip';
// KALDIRILDI: Artık bu store'a ihtiyacımız yok.
// import { useInstrumentsStore } from '@/store/useInstrumentsStore';
import ChannelContextMenu from '@/components/ChannelContextMenu';
import { useState, useRef } from 'react';
// GÜNCELLENDİ: Playback modunu ve loopLength'i okumak için store'u import ediyoruz
import { usePlaybackStore } from '@/store/usePlaybackStore';

export function ClipArea() {
    const { clips, tracks, zoomX, songLength, patterns, splitPatternClip } = useArrangementStore();
    // GÜNCELLENDİ: loopLength artık doğru store'dan, yani usePlaybackStore'dan geliyor.
    const loopLength = usePlaybackStore(state => state.loopLength);
    const playbackMode = usePlaybackStore(state => state.playbackMode);

    const playheadRef = useRef(null);
    const containerRef = useRef(null);
    const [contextMenu, setContextMenu] = useState(null);

    const BAR_WIDTH = 80;
    const stepWidth = BAR_WIDTH * zoomX;
    // DÜZELTME: `loopLength` tanımsız ise varsayılan değere (64) düşmesini sağlıyoruz.
    const totalWidth = BAR_WIDTH * ((loopLength || 64) / 4) * zoomX;

    // usePlaybackAnimator hook'u artık kaldırıldı.
    // Bu işlevsellik TimeManager ve playheadRef ile sağlanacak.

    const handleScroll = (e) => {
        // Bu fonksiyon şimdilik boş kalabilir, ileride kullanacağız.
    };

    const handleContextMenu = (event, clip) => {
        event.preventDefault();
        event.stopPropagation();
        
        const pattern = patterns[clip.patternId];
        const canSplit = pattern && Object.values(pattern.data).filter(notes => notes && notes.length > 0).length > 1;

        let options = [];
        if (canSplit) {
            options.push({
                label: 'Split by channel',
                action: () => splitPatternClip(clip.id)
            });
        }
        
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
                {Array.from({ length: (loopLength || 64) / 4 }).map((_, i) => (
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
                        onContextMenu={(e) => handleContextMenu(e, clip)}
                    />
                ))}
                
                {playbackMode === 'song' && (
                    <div ref={playheadRef} className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 z-30 pointer-events-none" />
                )}
            </div>
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