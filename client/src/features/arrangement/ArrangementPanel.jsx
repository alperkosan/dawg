import React from 'react';
import { ArrangementToolbar } from './ArrangementToolbar';
import { TrackList } from './TrackList';
import { ClipArea } from './ClipArea';

function ArrangementPanel({ audioEngineRef }) {
  return (
    <div className="w-full h-full flex flex-col bg-[var(--color-surface)] text-white select-none">
      <ArrangementToolbar />
      <div className="flex-grow flex min-h-0 relative">
        <TrackList audioEngineRef={audioEngineRef} />
        <ClipArea />
      </div>
    </div>
  );
}

export default ArrangementPanel;