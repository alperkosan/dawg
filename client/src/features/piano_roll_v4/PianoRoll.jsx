import React, { useRef, useLayoutEffect } from 'react';
import { usePianoRollStore } from './store/usePianoRollStore';
import PianoRollCanvas from './components/PianoRollCanvas.jsx';
import { PianoRollToolbar } from './components/PianoRollToolbar.jsx';
import { PianoRollKeyboard } from './components/PianoRollKeyboard.jsx';
import { PianoRollTimeline } from './components/PianoRollTimeline.jsx';
import { useScrollSync } from './hooks/useScrollSync';
import './index.css';

export default function PianoRoll() {
  const gridRef = useRef(null);
  const timelineContentRef = useRef(null);
  const keyboardContentRef = useRef(null);

  const viewport = usePianoRollStore(state => state.viewport);
  const initViewport = usePianoRollStore(state => state.initViewport);
  const setViewportScroll = usePianoRollStore(state => state.setViewportScroll);
  
  // Viewport'u başlatmak için bu hook'u kullanıyoruz.
  useLayoutEffect(() => {
    // Sadece viewport henüz başlatılmadıysa ve ref'imiz DOM'a bağlandıysa çalışır.
    if (!viewport && gridRef.current) {
      const rect = gridRef.current.getBoundingClientRect();
      // Elementin bir boyutu olduğundan emin ol (gizli veya sıfır boyutlu değil)
      if (rect.width > 0 && rect.height > 0) {
        initViewport(rect.width, rect.height);
      }
    }
  }, [viewport, initViewport]); // Bağımlılıklar doğru.

  // useScrollSync'i burada koşulsuz olarak çağırabiliriz.
  useScrollSync(gridRef, [
    { ref: timelineContentRef, axis: 'x' },
    { ref: keyboardContentRef, axis: 'y' }
  ], setViewportScroll);
  
  // totalSize'ı sadece viewport varsa ve geçerli boyutlar varsa hesapla.
  const totalSize = viewport && viewport.canvasWidth > 0 && viewport.canvasHeight > 0
    ? viewport.getTotalSize()
    : { width: 0, height: 0 };

  return (
    <div className="piano-roll-v4-wrapper">
      <PianoRollToolbar />
      {/* YAPIYI HER ZAMAN RENDER EDİYORUZ.
        Bu, gridRef'in her zaman DOM'da olmasını sağlar.
      */}
      <div className="piano-roll-v4-layout">
        <div className="prv4-corner"></div>
        <div className="prv4-timeline">
          <div ref={timelineContentRef} className="prv4-timeline-content" style={{ width: totalSize.width }}>
            {/* İçeriği sadece viewport hazır olduğunda render et */}
            {viewport && <PianoRollTimeline />}
          </div>
        </div>
        <div className="prv4-keyboard">
          <div ref={keyboardContentRef} className="prv4-keyboard-content" style={{ height: totalSize.height }}>
            {viewport && <PianoRollKeyboard />}
          </div>
        </div>
        <div ref={gridRef} className="prv4-grid">
          <div className="prv4-virtual-content" style={{ width: totalSize.width, height: totalSize.height }}>
            {viewport && <PianoRollCanvas />}
          </div>
        </div>
      </div>
    </div>
  );
}