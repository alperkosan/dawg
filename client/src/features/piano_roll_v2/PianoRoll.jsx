// src/features/piano_roll_v2/PianoRoll.jsx
import React, { useRef, useEffect, useState } from 'react';
import { Music } from 'lucide-react';
import { usePianoRollEngineV2 } from './hooks/usePianoRollEngineV2';
import { useNoteInteractionsV2 } from './hooks/useNoteInteractionsV2';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { PrecisionGrid } from './components/PrecisionGrid';
import { EnhancedTimelineRuler } from './components/EnhancedTimelineRuler';
import { PianoKeyboard } from './components/PianoKeyboard';
import { VirtualNotesRenderer } from './components/VirtualNotesRenderer';
import { PlayheadOptimized } from './components/PlayheadOptimized';
import { Toolbar } from './components/Toolbar';
import { VelocityLane } from './components/VelocityLane';
import { usePianoRollStoreV2, LOD_LEVELS } from './store/usePianoRollStoreV2';
import { createWheelZoomHandler } from '../../lib/utils/zoomHandler';
import { createScrollSynchronizer } from '../../lib/utils/scrollSync'; // YENİ
import './styles/PianoRoll.css';
import './styles/enhanced-timeline.css';
import './styles/composite-optimizations.css';

function PianoRoll({ instrument }) {
  const scrollContainerRef = useRef(null);
  // --- YENİ: Cetvel ve klavye için ayrı referanslar ---
  const rulerContentRef = useRef(null);
  const keyboardContentRef = useRef(null);

  // Scroll state to trigger child re-renders
  const [scrollVersion, setScrollVersion] = useState(0);
  
  const showVelocityLane = usePianoRollStoreV2(state => state.showVelocityLane);
  const velocityLaneHeight = usePianoRollStoreV2(state => state.velocityLaneHeight);
  const zoomX = usePianoRollStoreV2(state => state.zoomX);
  const setZoomX = usePianoRollStoreV2(state => state.setZoomX);
  const lod = usePianoRollStoreV2(state => state.getLODLevel());

  const handleZoom = createWheelZoomHandler(setZoomX, 0.005, 20);
  const engine = usePianoRollEngineV2(scrollContainerRef); // loopLength artık motor içinde yönetiliyor
  const interactions = useNoteInteractionsV2(instrument?.id, engine);

  // --- YENİ: Scroll Senkronizasyon Etkisi ---
  useEffect(() => {
    if (!scrollContainerRef.current) return;

    // Hedefleri tanımla: ana grid'in scroll'u, cetveli ve klavyeyi kontrol edecek.
    const syncTargets = [
      { ref: rulerContentRef, axis: 'x' },
      { ref: keyboardContentRef, axis: 'y' }
    ];

    // Scroll pozisyonu değiştiğinde çağrılacak callback
    const handleScrollChange = (scrollLeft, scrollTop) => {
      // Engine'in scroll değerlerini güncelle
      if (engine && engine.scroll) {
        engine.scroll.x = scrollLeft;
        engine.scroll.y = scrollTop;
      }
      // Re-render tetikle - state değişikliği ile child bileşenler de re-render olur
      setScrollVersion(prev => prev + 1);
    };

    // Senkronizasyonu başlat ve cleanup fonksiyonunu al.
    const cleanup = createScrollSynchronizer(scrollContainerRef, syncTargets, handleScrollChange);

    // Component unmount olduğunda dinleyicileri kaldır.
    return cleanup;
  }, [engine]); // Engine değiştiğinde yeniden çalıştır

  useEffect(() => {
    const gridContainer = scrollContainerRef.current;
    if (!gridContainer) return;
    
    // Ana grid container için wheel handler
    const handleGridWheel = (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleZoom(e, zoomX);
        }
    };
    
    // Cetvel ve klavye için wheel handler
    const handleRulerKeyboardWheel = (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleZoom(e, zoomX);
            
            // Zoom sonrası scroll pozisyonlarını manuel senkronize et
            if (gridContainer) {
                const scrollLeft = gridContainer.scrollLeft;
                const scrollTop = gridContainer.scrollTop;
                
                if (rulerContentRef.current) {
                    rulerContentRef.current.style.transform = 
                        `translate3d(-${scrollLeft}px, 0, 0)`;
                }
                if (keyboardContentRef.current) {
                    keyboardContentRef.current.style.transform = 
                        `translate3d(0, -${scrollTop}px, 0)`;
                }
            }
        }
    };
    
    // Grid container'a listener ekle
    gridContainer.addEventListener('wheel', handleGridWheel, { passive: false });
    
    // Cetvel ve klavye container'larına da listener ekle
    const rulerContainer = document.querySelector('.prv2-ruler-container');
    const keyboardContainer = document.querySelector('.prv2-keyboard-container');
    
    if (rulerContainer) {
        rulerContainer.addEventListener('wheel', handleRulerKeyboardWheel, { passive: false });
    }
    if (keyboardContainer) {
        keyboardContainer.addEventListener('wheel', handleRulerKeyboardWheel, { passive: false });
    }
    
    return () => {
        gridContainer.removeEventListener('wheel', handleGridWheel);
        if (rulerContainer) {
            rulerContainer.removeEventListener('wheel', handleRulerKeyboardWheel);
        }
        if (keyboardContainer) {
            keyboardContainer.removeEventListener('wheel', handleRulerKeyboardWheel);
        }
    };
}, [handleZoom, zoomX]);
  
  if (!instrument) {
    return (
      <div className="prv2-placeholder">
        <Music size={48} className="prv2-placeholder__icon" />
        <h3 className="prv2-placeholder__title">Piano Roll</h3>
        <p className="prv2-placeholder__text">Düzenlemek için bir enstrüman seçin.</p>
      </div>
    );
  }

  return (
    <div className="prv2-container">
      <Toolbar />
      <div className="prv2-layout-grid" style={{
        gridTemplateRows: showVelocityLane
          ? `32px 1fr ${velocityLaneHeight}px`
          : '32px 1fr'
      }}>
        <div className="prv2-corner" />
        
        {/* --- Cetvel artık bir sarmalayıcı içinde --- */}
        <div className="prv2-ruler-container">
          <EnhancedTimelineRuler key={scrollVersion} engine={engine} contentRef={rulerContentRef} />
        </div>

        {/* --- Klavye artık bir sarmalayıcı içinde --- */}
        <div className="prv2-keyboard-container">
          <PianoKeyboard key={scrollVersion} engine={engine} instrumentId={instrument.id} contentRef={keyboardContentRef} />
        </div>
        
        <div
          ref={scrollContainerRef}
          className="prv2-grid-area-container"
          onMouseDown={interactions.onMouseDown}
          onMouseMove={interactions.onMouseMove}
          onMouseUp={interactions.onMouseUp}
          onContextMenu={(e) => e.preventDefault()}
          onMouseLeave={interactions.onMouseLeave}
        >
          <div
            style={{
              width: engine.gridWidth,
              height: engine.gridHeight,
              position: 'relative',
              contain: 'layout style paint'
            }}
          >
            {/* GridTile artık kaldırıldı, PrecisionGrid daha performanslı */}
            <PrecisionGrid engine={engine} />

            <VirtualNotesRenderer
              notes={interactions.notes}
              selectedNotes={interactions.selectedNotes}
              engine={engine}
              interaction={interactions.interaction}
              onResizeStart={interactions.onResizeStart}
              lod={lod}
            />

            <PlayheadOptimized engine={engine} />
          </div>
        </div>
        {showVelocityLane && (
          <>
            <div className="prv2-velocity-label-area"><span>Velocity</span></div>
            <div className="prv2-velocity-lane">
               <VelocityLane
                notes={interactions.notes}
                selectedNotes={interactions.selectedNotes}
                engine={engine}
                height={velocityLaneHeight}
                onVelocityChange={interactions.handleVelocityChange}
                onNoteSelect={interactions.handleNoteSelectFromLane}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default React.memo(PianoRoll);
