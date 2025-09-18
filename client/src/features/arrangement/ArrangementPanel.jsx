import React from 'react';
import { ArrangementToolbar } from './ArrangementToolbar';
import { TrackList } from './TrackList';
import { ClipArea } from './ClipArea';

// DÜZELTME: Bileşen artık 'audioEngineRef' prop'unu almıyor.
function ArrangementPanel() {
  return (
    <div className="w-full h-full flex flex-col bg-[var(--color-surface)] text-white select-none">
      <ArrangementToolbar />
      <div className="flex-grow flex min-h-0 relative">
        {/* DÜZELTME: Alt bileşenlere prop geçirmiyoruz. */}
        <TrackList />
        <ClipArea />
      </div>
    </div>
  );
}

export default ArrangementPanel;
