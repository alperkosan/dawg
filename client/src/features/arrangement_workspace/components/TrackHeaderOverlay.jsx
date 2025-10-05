/**
 * TRACK HEADER OVERLAY
 *
 * Canvas üzerinde track header'lar için interaktif kontroller:
 * - Mute/Solo buttons
 * - Track renk göstergesi
 * - Track isim düzenleme
 */

import React, { useCallback } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import './TrackHeaderOverlay.css';

const TIMELINE_HEIGHT = 40;
const TRACK_HEADER_WIDTH = 150;

export const TrackHeaderOverlay = ({
  tracks,
  virtualTrackCount,
  trackHeight,
  scrollY,
  onToggleMute,
  onToggleSolo,
  onTrackColorChange
}) => {
  const visibleStartTrack = Math.floor(scrollY / trackHeight);
  const visibleEndTrack = Math.ceil((scrollY + window.innerHeight) / trackHeight);

  const handleMuteClick = useCallback((e, trackId) => {
    e.stopPropagation();
    onToggleMute(trackId);
  }, [onToggleMute]);

  const handleSoloClick = useCallback((e, trackId) => {
    e.stopPropagation();
    onToggleSolo(trackId);
  }, [onToggleSolo]);

  return (
    <div
      className="track-header-overlay"
      style={{
        position: 'absolute',
        left: 0,
        top: TIMELINE_HEIGHT,
        width: TRACK_HEADER_WIDTH,
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10
      }}
    >
      {Array.from({ length: virtualTrackCount }).map((_, index) => {
        // Only render visible tracks
        if (index < visibleStartTrack || index >= visibleEndTrack) return null;

        const track = tracks[index];
        const yPosition = index * trackHeight - scrollY;

        return (
          <div
            key={track?.id || `virtual-${index}`}
            className="track-header-controls"
            style={{
              position: 'absolute',
              top: yPosition,
              right: 0,
              height: trackHeight,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '4px',
              padding: '0 8px',
              pointerEvents: 'auto'
            }}
          >
            {track && (
              <>
                {/* Mute button */}
                <button
                  className={`track-btn track-btn-mute ${track.muted ? 'active' : ''}`}
                  onClick={(e) => handleMuteClick(e, track.id)}
                  title={track.muted ? 'Unmute' : 'Mute'}
                >
                  {track.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                </button>

                {/* Solo button */}
                <button
                  className={`track-btn track-btn-solo ${track.solo ? 'active' : ''}`}
                  onClick={(e) => handleSoloClick(e, track.id)}
                  title={track.solo ? 'Unsolo' : 'Solo'}
                >
                  S
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};
