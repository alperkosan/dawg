/**
 * ARRANGEMENT RENDERER
 *
 * Piano Roll rendering pattern'i kullanarak optimize edilmiş
 * - Viewport-based rendering
 * - LOD-aware grid drawing
 * - Clip intersection check
 */

import { audioAssetManager } from '../../../lib/audio/AudioAssetManager';

const TRACK_HEADER_WIDTH = 150;
const TIMELINE_HEIGHT = 40;
const PIXELS_PER_BEAT = 32;
const BEATS_PER_BAR = 4;

// Helper: Convert pitch string (e.g., "C4") to MIDI note number
function midiNoteToNumber(pitch) {
  const noteMap = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };
  const match = pitch.match(/^([A-G]#?)(\d+)$/);
  if (!match) return 60; // Default to C4
  const [, note, octave] = match;
  return (parseInt(octave) + 1) * 12 + noteMap[note];
}

// Helper: Parse Tone.js duration to beats (assuming 4/4 time)
function parseDuration(duration) {
  if (typeof duration === 'number') return duration;

  const durationMap = {
    '1n': 4,     // whole note
    '2n': 2,     // half note
    '4n': 1,     // quarter note
    '8n': 0.5,   // eighth note
    '16n': 0.25, // sixteenth note
    '32n': 0.125 // thirty-second note
  };

  // Handle triplets (e.g., '8t')
  if (duration.endsWith('t')) {
    const base = durationMap[duration.replace('t', 'n')] || 1;
    return base * (2 / 3);
  }

  return durationMap[duration] || 0.5;
}

function drawGhostPreview(ctx, engine) {
  const { viewport, dimensions, patternInteraction, tracks } = engine;

  if (!patternInteraction || !patternInteraction.ghostPosition) return;

  const { ghostPosition, clip, mode, currentStartTime, currentDuration, targetTrackIndex } = patternInteraction;

  if (!clip) return;

  // ✅ Use target track index for ghost preview if moving, otherwise use original
  let trackIndex = targetTrackIndex;
  if (trackIndex === null || trackIndex === undefined) {
    const track = tracks.find(t => t.id === clip.trackId);
    if (!track) return;
    trackIndex = tracks.indexOf(track);
  }

  ctx.save();
  ctx.translate(TRACK_HEADER_WIDTH, TIMELINE_HEIGHT);
  ctx.beginPath();
  ctx.rect(0, 0, viewport.width - TRACK_HEADER_WIDTH, viewport.height - TIMELINE_HEIGHT);
  ctx.clip();
  ctx.translate(-viewport.scrollX, -viewport.scrollY);

  if (mode === 'move' || mode === 'resize-left') {
    // Ghost preview için yeni pozisyon (hem X hem Y)
    const ghostX = currentStartTime * PIXELS_PER_BEAT * viewport.zoomX;
    const ghostY = trackIndex * dimensions.trackHeight + 4;
    const ghostWidth = currentDuration * PIXELS_PER_BEAT * viewport.zoomX;
    const ghostHeight = dimensions.trackHeight - 8;

    // Ghost outline
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(ghostX, ghostY, ghostWidth, ghostHeight);
    ctx.setLineDash([]);

    // Snap grid line
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ghostX, 0);
    ctx.lineTo(ghostX, dimensions.totalHeight);
    ctx.stroke();
  } else if (mode === 'resize-right') {
    // Loop extension ghost
    const ghostX = clip.startTime * PIXELS_PER_BEAT * viewport.zoomX;
    const ghostY = trackIndex * dimensions.trackHeight + 4;
    const ghostWidth = currentDuration * PIXELS_PER_BEAT * viewport.zoomX;
    const ghostHeight = dimensions.trackHeight - 8;

    // Extended portion highlight
    const originalWidth = clip.duration * PIXELS_PER_BEAT * viewport.zoomX;
    const extensionX = ghostX + originalWidth;
    const extensionWidth = ghostWidth - originalWidth;

    if (extensionWidth > 0) {
      ctx.fillStyle = 'rgba(0, 255, 136, 0.2)';
      ctx.fillRect(extensionX, ghostY, extensionWidth, ghostHeight);

      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(extensionX, ghostY, extensionWidth, ghostHeight);
      ctx.setLineDash([]);
    }

    // Snap line at end
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ghostX + ghostWidth, 0);
    ctx.lineTo(ghostX + ghostWidth, dimensions.totalHeight);
    ctx.stroke();
  } else if (mode === 'split') {
    // Split line preview
    const splitX = ghostPosition.beat * PIXELS_PER_BEAT * viewport.zoomX;

    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(splitX, trackIndex * dimensions.trackHeight);
    ctx.lineTo(splitX, (trackIndex + 1) * dimensions.trackHeight);
    ctx.stroke();

    // Split indicator
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(splitX, trackIndex * dimensions.trackHeight + dimensions.trackHeight / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawDropPreview(ctx, engine) {
  const { viewport, dimensions, dropPreview } = engine;

  if (!dropPreview) return;

  const { trackIndex, startBeat, duration, color } = dropPreview;

  ctx.save();
  ctx.translate(TRACK_HEADER_WIDTH, TIMELINE_HEIGHT);
  ctx.beginPath();
  ctx.rect(0, 0, viewport.width - TRACK_HEADER_WIDTH, viewport.height - TIMELINE_HEIGHT);
  ctx.clip();
  ctx.translate(-viewport.scrollX, -viewport.scrollY);

  const x = startBeat * PIXELS_PER_BEAT * viewport.zoomX;
  const y = trackIndex * dimensions.trackHeight + 4;
  const width = duration * PIXELS_PER_BEAT * viewport.zoomX;
  const height = dimensions.trackHeight - 8;

  // Ghost outline with dashed border
  ctx.strokeStyle = color || '#00ff88';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 4]);
  ctx.strokeRect(x, y, width, height);
  ctx.setLineDash([]);

  // Semi-transparent fill
  ctx.fillStyle = `${color || '#00ff88'}20`;
  ctx.fillRect(x, y, width, height);

  // Snap grid line
  ctx.strokeStyle = `${color || '#00ff88'}60`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, dimensions.totalHeight);
  ctx.stroke();

  ctx.restore();
}

function drawMarqueeSelection(ctx, engine) {
  const { viewport, marqueeSelection } = engine;
  if (!marqueeSelection) return;

  ctx.save();
  ctx.translate(TRACK_HEADER_WIDTH, TIMELINE_HEIGHT);
  ctx.beginPath();
  ctx.rect(0, 0, viewport.width - TRACK_HEADER_WIDTH, viewport.height - TIMELINE_HEIGHT);
  ctx.clip();
  ctx.translate(-viewport.scrollX, -viewport.scrollY);

  const { startX, startY, currentX, currentY } = marqueeSelection;

  const x = Math.min(startX, currentX);
  const y = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);

  // Draw selection box
  ctx.fillStyle = 'rgba(100, 200, 255, 0.15)';
  ctx.fillRect(x, y, width, height);

  ctx.strokeStyle = 'rgba(100, 200, 255, 0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, width, height);

  ctx.restore();
}

function drawRightClickDeleteMode(ctx, engine) {
  const { viewport, isRightClickDelete } = engine;
  if (!isRightClickDelete) return;

  // Draw overlay indicator for delete mode
  ctx.save();
  ctx.fillStyle = 'rgba(255, 0, 0, 0.05)';
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  // Draw text indicator
  ctx.fillStyle = 'rgba(255, 80, 80, 0.9)';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DELETE MODE - Drag over clips to delete', viewport.width / 2, 20);

  ctx.restore();
}

export function drawArrangement(ctx, engine) {
  const { viewport, dimensions } = engine;
  if (!viewport || viewport.width === 0 || viewport.height === 0) return;

  // Clear canvas
  ctx.fillStyle = '#0f0f0f';
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  // Draw layers in order
  drawGrid(ctx, engine);
  drawClips(ctx, engine);
  drawGhostPreview(ctx, engine);
  drawDropPreview(ctx, engine);
  drawMarqueeSelection(ctx, engine);
  drawRightClickDeleteMode(ctx, engine);
  drawPlayhead(ctx, engine);
  drawTimeline(ctx, engine);
  drawTrackHeaders(ctx, engine);
}

function drawGrid(ctx, engine) {
  const { viewport, dimensions, lod, gridSize, tracks } = engine;

  ctx.save();
  ctx.translate(TRACK_HEADER_WIDTH, TIMELINE_HEIGHT);
  ctx.beginPath();
  ctx.rect(0, 0, viewport.width - TRACK_HEADER_WIDTH, viewport.height - TIMELINE_HEIGHT);
  ctx.clip();
  ctx.translate(-viewport.scrollX, -viewport.scrollY);

  const { start: startTrack, end: endTrack } = viewport.visibleTracks;
  const { start: startBeat, end: endBeat } = viewport.visibleBeats;

  // Draw track backgrounds (virtual tracks dahil)
  for (let i = startTrack; i < endTrack && i < dimensions.virtualTrackCount; i++) {
    const y = i * dimensions.trackHeight;
    ctx.fillStyle = i % 2 === 0 ? '#0f0f0f' : '#121212';
    ctx.fillRect(0, y, dimensions.totalWidth, dimensions.trackHeight);
  }

  // Grid size mapping (beats cinsinden)
  const gridSizeMap = {
    '1/1': 4,      // 1 bar = 4 beat
    '1/2': 2,      // 1/2 note = 2 beat
    '1/4': 1,      // 1/4 note = 1 beat
    '1/8': 0.5,    // 1/8 note = 0.5 beat
    '1/16': 0.25,  // 1/16 note = 0.25 beat
    '1/32': 0.125  // 1/32 note = 0.125 beat
  };
  const baseGridInterval = gridSizeMap[gridSize] || 1;

  // LOD-based dynamic grid adjustment - snap'e göre akıllı seyrekleştirme
  let effectiveInterval = baseGridInterval;

  if (lod >= 4) {
    // Çok düşük zoom: 8 kat daha seyrek (ör: 1/8 → 1/1 bar, 1/16 → 1/2)
    effectiveInterval = baseGridInterval * 8;
  } else if (lod >= 3) {
    // Düşük zoom: 4 kat daha seyrek (ör: 1/8 → 1/2, 1/16 → 1/4)
    effectiveInterval = baseGridInterval * 4;
  } else if (lod >= 2) {
    // Orta zoom: 2 kat daha seyrek (ör: 1/8 → 1/4, 1/16 → 1/8)
    effectiveInterval = baseGridInterval * 2;
  }
  // lod 0-1: Seçili snap değeri kullanılır

  const startLine = Math.floor(startBeat / effectiveInterval) * effectiveInterval;
  const startCounter = Math.floor(startLine / effectiveInterval);
  const endCounter = Math.ceil(endBeat / effectiveInterval);

  // Draw vertical grid lines
  for (let counter = startCounter; counter < endCounter; counter++) {
    const beat = counter * effectiveInterval;
    if (beat >= endBeat) break;

    const x = beat * PIXELS_PER_BEAT * viewport.zoomX;
    const isBar = Math.abs(beat % BEATS_PER_BAR) < 0.001;
    const isBeat = Math.abs(beat % 1) < 0.001;
    const isHalfNote = Math.abs(beat % 2) < 0.001;

    // Grid çizgi stilleri - LOD ve beat type'a göre
    if (isBar) {
      // Bar çizgileri - her zaman en belirgin
      ctx.strokeStyle = lod >= 3 ? 'rgba(180, 188, 208, 0.5)' : 'rgba(180, 188, 208, 0.8)';
      ctx.lineWidth = lod >= 3 ? 1.3 : 1.6;
    } else if (isHalfNote && lod >= 2) {
      // 1/2 note çizgileri - orta LOD'larda
      ctx.strokeStyle = lod >= 3 ? 'rgba(140, 150, 170, 0.35)' : 'rgba(140, 150, 170, 0.5)';
      ctx.lineWidth = 1.0;
    } else if (isBeat && lod >= 1 && lod < 3) {
      // Beat çizgileri - normal zoom'da
      ctx.strokeStyle = 'rgba(100, 110, 140, 0.45)';
      ctx.lineWidth = 0.8;
    } else if (lod < 2) {
      // Subdivision çizgileri - yüksek zoom'da
      ctx.strokeStyle = 'rgba(120, 130, 150, 0.3)';
      ctx.lineWidth = 0.6;
    } else {
      // Diğer çizgiler
      ctx.strokeStyle = 'rgba(120, 130, 150, 0.25)';
      ctx.lineWidth = 0.6;
    }

    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, dimensions.totalHeight);
    ctx.stroke();
  }

  // Draw track dividers
  for (let i = startTrack; i <= endTrack && i < tracks.length; i++) {
    const y = i * dimensions.trackHeight;
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(dimensions.totalWidth, y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawClips(ctx, engine) {
  const { viewport, dimensions, clips, tracks, selectedClips, patterns, instruments, patternInteraction } = engine;

  ctx.save();
  ctx.translate(TRACK_HEADER_WIDTH, TIMELINE_HEIGHT);
  ctx.beginPath();
  ctx.rect(0, 0, viewport.width - TRACK_HEADER_WIDTH, viewport.height - TIMELINE_HEIGHT);
  ctx.clip();
  ctx.translate(-viewport.scrollX, -viewport.scrollY);

  const { start: startTrack, end: endTrack } = viewport.visibleTracks;
  const { start: startBeat, end: endBeat } = viewport.visibleBeats;

  if (!clips || !Array.isArray(clips)) {
    ctx.restore();
    return;
  }

  // Filter visible clips (intersection check)
  const visibleClips = clips.filter(clip => {
    const track = tracks.find(t => t.id === clip.trackId);
    if (!track) return false;

    const trackIndex = tracks.indexOf(track);
    if (trackIndex < startTrack || trackIndex >= endTrack) return false;

    const clipEndBeat = clip.startTime + clip.duration;
    return clipEndBeat >= startBeat && clip.startTime <= endBeat;
  });

  // Draw clips
  visibleClips.forEach(clip => {
    const track = tracks.find(t => t.id === clip.trackId);
    if (!track) return;

    const trackIndex = tracks.indexOf(track);
    const y = trackIndex * dimensions.trackHeight + 4;
    const x = clip.startTime * PIXELS_PER_BEAT * viewport.zoomX;
    const clipWidth = clip.duration * PIXELS_PER_BEAT * viewport.zoomX;
    const clipHeight = dimensions.trackHeight - 8;

    const isSelected = selectedClips?.includes(clip.id);
    const borderRadius = 4; // Rounded corners

    // Helper function for rounded rectangle
    const roundRect = (ctx, x, y, width, height, radius) => {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    };

    // Clip background with rounded corners
    roundRect(ctx, x, y, clipWidth, clipHeight, borderRadius);
    ctx.fillStyle = clip.color || track.color || '#00ff88';
    ctx.globalAlpha = clip.type === 'pattern' ? 0.6 : 0.8;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Clip border with subtle shadow
    if (isSelected) {
      // Selection glow
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2;
      roundRect(ctx, x, y, clipWidth, clipHeight, borderRadius);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      // Normal border with subtle depth
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.lineWidth = 1;
      roundRect(ctx, x, y, clipWidth, clipHeight, borderRadius);
      ctx.stroke();
    }

    // Clip name (only if wide enough)
    if (clipWidth > 40) {
      ctx.fillStyle = '#fff';
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 2, y + 2, clipWidth - 4, clipHeight - 4);
      ctx.clip();
      ctx.fillText(clip.name || 'Clip', x + 6, y + 6);
      ctx.restore();
    }

    // Audio waveform visualization (always show for audio clips)
    if (clip.type === 'audio') {
      let audioBuffer = null;

      // Priority 1: Check AudioAssetManager (centralized system)
      if (clip.assetId) {
        const asset = audioAssetManager.getAsset(clip.assetId);
        audioBuffer = asset?.buffer;
      }

      // Priority 2: Check instruments (legacy)
      if (!audioBuffer && clip.sampleId && instruments) {
        const instrument = instruments.find(inst => inst.id === clip.sampleId);
        audioBuffer = instrument?.audioBuffer;
      }

      // Priority 3: Check by URL (fallback)
      if (!audioBuffer && clip.audioUrl) {
        const asset = audioAssetManager.getAssetByUrl(clip.audioUrl);
        audioBuffer = asset?.buffer;
      }

      if (audioBuffer) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + 2, y + 20, clipWidth - 4, clipHeight - 24);
        ctx.clip();

        // Draw waveform
        const waveformHeight = clipHeight - 24;
        const waveformY = y + 20 + waveformHeight / 2;

        // Get audio data (use first channel for simplicity)
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;

        // All properties are clip-specific now (instance system not used for properties)
        const fadeInBeats = clip.fadeIn || 0;
        const fadeOutBeats = clip.fadeOut || 0;
        const gainDb = clip.gain || 0;
        const sampleOffsetBeats = clip.sampleOffset || 0;
        const playbackRate = clip.playbackRate || 1.0;
        const clipDuration = clip.duration;

        const gainLinear = Math.pow(10, gainDb / 20); // Convert dB to linear

        // Convert durations to seconds
        const beatsToSeconds = (beats) => (beats * 60) / 140; // Assuming 140 BPM
        const clipDurationSeconds = beatsToSeconds(clipDuration);
        const audioDurationSeconds = audioBuffer.duration;
        const offsetSeconds = beatsToSeconds(sampleOffsetBeats);

        // Calculate actual audio width in pixels (might be less than clip width)
        const audioLengthBeats = (audioDurationSeconds * 140) / 60; // Convert audio duration to beats
        const audioWidthPixels = Math.min(clipWidth, audioLengthBeats * PIXELS_PER_BEAT * viewport.zoomX);

        // Total samples to display
        const totalSamplesToDisplay = Math.floor((audioDurationSeconds * sampleRate) / playbackRate);
        const sampleOffsetInSamples = Math.floor((offsetSeconds * sampleRate) / playbackRate);

        const samplesPerPixel = Math.max(1, totalSamplesToDisplay / audioWidthPixels);

        const fadeInWidth = fadeInBeats * PIXELS_PER_BEAT * viewport.zoomX;
        const fadeOutWidth = fadeOutBeats * PIXELS_PER_BEAT * viewport.zoomX;

        // Draw smooth filled waveform (only for actual audio length)
        ctx.beginPath();

        // Top half of waveform
        for (let i = 0; i < audioWidthPixels; i++) {
          const startSample = Math.floor(sampleOffsetInSamples + (i * samplesPerPixel));
          const endSample = Math.min(startSample + samplesPerPixel, channelData.length);

          let min = 1.0;
          let max = -1.0;

          for (let j = startSample; j < endSample; j++) {
            if (j >= 0 && j < channelData.length) {
              const sample = channelData[j];
              if (sample < min) min = sample;
              if (sample > max) max = sample;
            }
          }

          // Apply gain
          min *= gainLinear;
          max *= gainLinear;

          // Apply fade envelope
          let fadeMultiplier = 1.0;
          if (i < fadeInWidth) {
            fadeMultiplier = i / fadeInWidth;
          } else if (i > audioWidthPixels - fadeOutWidth) {
            fadeMultiplier = (audioWidthPixels - i) / fadeOutWidth;
          }

          min *= fadeMultiplier;
          max *= fadeMultiplier;

          const maxY = waveformY - (max * waveformHeight / 2);

          if (i === 0) {
            ctx.moveTo(x + 2, maxY);
          } else {
            ctx.lineTo(x + 2 + i, maxY);
          }
        }

        // Bottom half of waveform (reverse)
        for (let i = audioWidthPixels - 1; i >= 0; i--) {
          const startSample = Math.floor(sampleOffsetInSamples + (i * samplesPerPixel));
          const endSample = Math.min(startSample + samplesPerPixel, channelData.length);

          let min = 1.0;

          for (let j = startSample; j < endSample; j++) {
            if (j >= 0 && j < channelData.length) {
              const sample = channelData[j];
              if (sample < min) min = sample;
            }
          }

          min *= gainLinear;

          let fadeMultiplier = 1.0;
          if (i < fadeInWidth) {
            fadeMultiplier = i / fadeInWidth;
          } else if (i > audioWidthPixels - fadeOutWidth) {
            fadeMultiplier = (audioWidthPixels - i) / fadeOutWidth;
          }

          min *= fadeMultiplier;

          const minY = waveformY - (min * waveformHeight / 2);
          ctx.lineTo(x + 2 + i, minY);
        }

        ctx.closePath();

        // Fill with gradient
        const waveGradient = ctx.createLinearGradient(x, y + 20, x, y + 20 + waveformHeight);
        waveGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        waveGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.6)');
        waveGradient.addColorStop(1, 'rgba(255, 255, 255, 0.4)');
        ctx.fillStyle = waveGradient;
        ctx.fill();

        // Stroke outline
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw smooth fade overlays with better curves
        if (fadeInWidth > 0) {
          const gradient = ctx.createLinearGradient(x + 2, 0, x + 2 + fadeInWidth, 0);
          gradient.addColorStop(0, 'rgba(255, 180, 80, 0.35)');
          gradient.addColorStop(0.3, 'rgba(255, 200, 100, 0.25)');
          gradient.addColorStop(0.7, 'rgba(255, 220, 120, 0.1)');
          gradient.addColorStop(1, 'rgba(255, 200, 100, 0)');
          ctx.fillStyle = gradient;

          // Rounded fade region
          ctx.save();
          ctx.beginPath();
          ctx.rect(x + 2, y + 20, fadeInWidth, waveformHeight);
          ctx.clip();
          ctx.fillRect(x + 2, y + 20, fadeInWidth, waveformHeight);
          ctx.restore();

          // Fade curve line indicator
          ctx.strokeStyle = 'rgba(255, 180, 80, 0.6)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x + 2, y + 20 + waveformHeight);
          ctx.quadraticCurveTo(x + 2 + fadeInWidth * 0.3, y + 20 + waveformHeight * 0.7, x + 2 + fadeInWidth, y + 20);
          ctx.stroke();
        }

        if (fadeOutWidth > 0) {
          const gradient = ctx.createLinearGradient(x + clipWidth - fadeOutWidth - 2, 0, x + clipWidth - 2, 0);
          gradient.addColorStop(0, 'rgba(100, 150, 255, 0)');
          gradient.addColorStop(0.3, 'rgba(120, 170, 255, 0.1)');
          gradient.addColorStop(0.7, 'rgba(100, 150, 255, 0.25)');
          gradient.addColorStop(1, 'rgba(80, 140, 255, 0.35)');
          ctx.fillStyle = gradient;

          // Rounded fade region
          ctx.save();
          ctx.beginPath();
          ctx.rect(x + clipWidth - fadeOutWidth - 2, y + 20, fadeOutWidth, waveformHeight);
          ctx.clip();
          ctx.fillRect(x + clipWidth - fadeOutWidth - 2, y + 20, fadeOutWidth, waveformHeight);
          ctx.restore();

          // Fade curve line indicator
          ctx.strokeStyle = 'rgba(80, 140, 255, 0.6)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x + clipWidth - fadeOutWidth - 2, y + 20);
          ctx.quadraticCurveTo(x + clipWidth - fadeOutWidth * 0.7 - 2, y + 20 + waveformHeight * 0.3, x + clipWidth - 2, y + 20 + waveformHeight);
          ctx.stroke();
        }

        // Draw gain indicator
        if (gainDb !== 0) {
          ctx.fillStyle = gainDb > 0 ? 'rgba(255, 100, 100, 0.9)' : 'rgba(200, 200, 200, 0.9)';
          ctx.font = '10px Inter, system-ui, sans-serif';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'top';
          ctx.fillText(`${gainDb > 0 ? '+' : ''}${gainDb.toFixed(1)}dB`, x + clipWidth - 6, y + 22);
        }

        // Draw playback rate indicator (time stretch)
        if (playbackRate !== 1.0) {
          ctx.fillStyle = 'rgba(100, 200, 255, 0.9)';
          ctx.font = 'bold 10px Inter, system-ui, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          const ratePercent = (playbackRate * 100).toFixed(0);
          ctx.fillText(`${ratePercent}%`, x + 6, y + 22);

          // Draw stretch indicator icon
          ctx.strokeStyle = 'rgba(100, 200, 255, 0.6)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x + 6, y + clipHeight - 8);
          ctx.lineTo(x + 12, y + clipHeight - 8);
          ctx.moveTo(x + 9, y + clipHeight - 11);
          ctx.lineTo(x + 9, y + clipHeight - 5);
          ctx.stroke();
        }

        // Center line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 2, waveformY);
        ctx.lineTo(x + clipWidth - 2, waveformY);
        ctx.stroke();

        ctx.restore();

        // Draw interactive handles at actual fade/gain positions
        const handleRadius = 5;

        // Check if this clip is being interacted with
        const isInteracting = patternInteraction?.clip?.id === clip.id;
        const interactionMode = patternInteraction?.mode;

        // Get fade values (use interaction state if dragging, otherwise use clip values)
        const activeFadeIn = (isInteracting && interactionMode === 'fade-in' && patternInteraction.fadeIn !== undefined)
          ? patternInteraction.fadeIn
          : fadeInBeats;
        const activeFadeOut = (isInteracting && interactionMode === 'fade-out' && patternInteraction.fadeOut !== undefined)
          ? patternInteraction.fadeOut
          : fadeOutBeats;

        const activeFadeInWidth = activeFadeIn * PIXELS_PER_BEAT * viewport.zoomX;
        const activeFadeOutWidth = activeFadeOut * PIXELS_PER_BEAT * viewport.zoomX;

        // Fade-in handle - positioned at fade-in endpoint
        if (clipWidth > 80 && activeFadeIn > 0) {
          const fadeInEndX = x + 2 + activeFadeInWidth;
          const isDragging = isInteracting && interactionMode === 'fade-in';

          ctx.beginPath();
          ctx.arc(fadeInEndX, y + 8, handleRadius, 0, Math.PI * 2);
          ctx.fillStyle = isDragging ? 'rgba(255, 220, 120, 1)' : 'rgba(255, 180, 80, 0.95)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.lineWidth = isDragging ? 3 : 2;
          ctx.stroke();

          // Tooltip showing fade-in value (only when dragging)
          if (isDragging) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
            ctx.fillRect(fadeInEndX - 28, y - 20, 56, 18);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Inter, system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${activeFadeIn.toFixed(2)}♩`, fadeInEndX, y - 11);
          }
        } else if (clipWidth > 80) {
          // Show handle at start if no fade
          const isDragging = isInteracting && interactionMode === 'fade-in';
          ctx.beginPath();
          ctx.arc(x + 8, y + 8, handleRadius - 1, 0, Math.PI * 2);
          ctx.fillStyle = isDragging ? 'rgba(255, 220, 120, 0.7)' : 'rgba(255, 180, 80, 0.5)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Fade-out handle - positioned at fade-out start point
        if (clipWidth > 80 && activeFadeOut > 0) {
          const fadeOutStartX = x + clipWidth - 2 - activeFadeOutWidth;
          const isDragging = isInteracting && interactionMode === 'fade-out';

          ctx.beginPath();
          ctx.arc(fadeOutStartX, y + 8, handleRadius, 0, Math.PI * 2);
          ctx.fillStyle = isDragging ? 'rgba(120, 180, 255, 1)' : 'rgba(80, 140, 255, 0.95)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.lineWidth = isDragging ? 3 : 2;
          ctx.stroke();

          // Tooltip showing fade-out value (only when dragging)
          if (isDragging) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
            ctx.fillRect(fadeOutStartX - 28, y - 20, 56, 18);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Inter, system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${activeFadeOut.toFixed(2)}♩`, fadeOutStartX, y - 11);
          }
        } else if (clipWidth > 80) {
          // Show handle at end if no fade
          const isDragging = isInteracting && interactionMode === 'fade-out';
          ctx.beginPath();
          ctx.arc(x + clipWidth - 8, y + 8, handleRadius - 1, 0, Math.PI * 2);
          ctx.fillStyle = isDragging ? 'rgba(120, 180, 255, 0.7)' : 'rgba(80, 140, 255, 0.5)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Gain handle (bottom-center)
        if (clipWidth > 60) {
          // Get active gain value (use interaction state if dragging)
          const activeGain = (isInteracting && interactionMode === 'gain' && patternInteraction.gain !== undefined)
            ? patternInteraction.gain
            : gainDb;
          const isDragging = isInteracting && interactionMode === 'gain';

          ctx.beginPath();
          ctx.arc(x + clipWidth / 2, y + clipHeight - 8, handleRadius, 0, Math.PI * 2);
          ctx.fillStyle = isDragging ? 'rgba(255, 220, 120, 1)' : (activeGain !== 0 ? 'rgba(255, 200, 100, 0.95)' : 'rgba(150, 150, 150, 0.7)');
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.lineWidth = isDragging ? 3 : (activeGain !== 0 ? 2 : 1);
          ctx.stroke();

          // Small arrows on gain handle
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          // Up arrow
          ctx.moveTo(x + clipWidth / 2, y + clipHeight - 10);
          ctx.lineTo(x + clipWidth / 2 - 2, y + clipHeight - 8);
          ctx.moveTo(x + clipWidth / 2, y + clipHeight - 10);
          ctx.lineTo(x + clipWidth / 2 + 2, y + clipHeight - 8);
          // Down arrow
          ctx.moveTo(x + clipWidth / 2, y + clipHeight - 6);
          ctx.lineTo(x + clipWidth / 2 - 2, y + clipHeight - 8);
          ctx.moveTo(x + clipWidth / 2, y + clipHeight - 6);
          ctx.lineTo(x + clipWidth / 2 + 2, y + clipHeight - 8);
          ctx.stroke();

          // Tooltip showing gain value (only when dragging)
          if (isDragging) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
            ctx.fillRect(x + clipWidth / 2 - 30, y + clipHeight + 2, 60, 18);
            ctx.fillStyle = activeGain > 0 ? '#ffaa66' : (activeGain < 0 ? '#66aaff' : '#fff');
            ctx.font = 'bold 11px Inter, system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${activeGain > 0 ? '+' : ''}${activeGain.toFixed(1)}dB`, x + clipWidth / 2, y + clipHeight + 11);
          }
        }
      }
    }

    // Pattern notes mini view
    if (clip.type === 'pattern' && patterns && clipWidth > 40) {
      const pattern = patterns[clip.patternId];

      if (pattern) {
        // Extract all notes from pattern data (instrument-based structure)
        let allNotes = [];

        if (pattern.notes && Array.isArray(pattern.notes)) {
          // New format: direct notes array
          allNotes = pattern.notes;
        } else if (pattern.data && typeof pattern.data === 'object') {
          // Old format: data per instrument (time in 16th note units, need to convert to beats)
          const patternLength = pattern.settings?.length || 64; // In 16th notes
          Object.values(pattern.data).forEach(instrumentNotes => {
            if (Array.isArray(instrumentNotes)) {
              allNotes = allNotes.concat(instrumentNotes.map(note => ({
                note: typeof note.pitch === 'string' ? midiNoteToNumber(note.pitch) : note.note || 60,
                time: (note.time || 0) * 0.25, // Convert 16th note units to beats (1 beat = 4 sixteenths)
                duration: typeof note.duration === 'string' ? parseDuration(note.duration) : ((note.duration || 1) * 0.25),
                velocity: note.velocity || 0.8
              })));
            }
          });
        }

      if (allNotes.length > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + 2, y + 20, clipWidth - 4, clipHeight - 24);
        ctx.clip();

        // Find min/max MIDI notes for scaling
        const midiNotes = allNotes.map(n => n.note);
        const minNote = Math.min(...midiNotes);
        const maxNote = Math.max(...midiNotes);
        const noteRange = maxNote - minNote || 12;

        // Pattern length from settings or default (convert from 16th notes to beats if needed)
        const patternLengthIn16ths = pattern.settings?.length || pattern.length || 64;
        const patternLength = patternLengthIn16ths * 0.25; // Convert to beats

        // Draw each note as a mini rectangle
        allNotes.forEach(note => {
          const noteStartBeat = note.time;
          const noteEndBeat = note.time + note.duration;

          // Calculate position relative to clip
          const relativeStart = noteStartBeat - (clip.startTime % patternLength);
          const relativeEnd = noteEndBeat - (clip.startTime % patternLength);

          // Loop pattern if needed
          const loopCount = Math.ceil(clip.duration / patternLength);

          for (let loop = 0; loop < loopCount; loop++) {
            const loopOffset = loop * patternLength;
            const noteX = x + (relativeStart + loopOffset) * PIXELS_PER_BEAT * viewport.zoomX;
            const noteWidth = (noteEndBeat - noteStartBeat) * PIXELS_PER_BEAT * viewport.zoomX;

            // Only draw if visible
            if (noteX + noteWidth >= x && noteX <= x + clipWidth) {
              const normalizedNote = (note.note - minNote) / noteRange;
              const noteY = y + clipHeight - 6 - (normalizedNote * (clipHeight - 28));
              const noteHeight = 3;

              ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + note.velocity * 0.4})`;
              ctx.fillRect(
                Math.max(noteX, x + 2),
                noteY,
                Math.min(noteWidth, x + clipWidth - noteX),
                noteHeight
              );
            }
          }
        });

        ctx.restore();
      }
      }
    }
  });

  ctx.restore();
}

function drawPlayhead(ctx, engine) {
  const { viewport, dimensions, playhead } = engine;

  if (!playhead) {
    console.warn('🎵 No playhead data in engine');
    return;
  }

  ctx.save();
  ctx.translate(TRACK_HEADER_WIDTH, TIMELINE_HEIGHT);
  ctx.beginPath();
  ctx.rect(0, 0, viewport.width - TRACK_HEADER_WIDTH, viewport.height - TIMELINE_HEIGHT);
  ctx.clip();

  // playhead.position is currentStep (16th note steps)
  // Convert steps to beats: 1 beat = 4 sixteenth notes
  const beatPosition = playhead.position / 4;
  const playheadX = beatPosition * PIXELS_PER_BEAT * viewport.zoomX - viewport.scrollX;

  // Debug only when position changes significantly (disabled to reduce console spam)
  // if (playhead.position % 16 === 0) {
  //   console.log(`🎵 Arrangement playhead at step ${playhead.position}, beat ${beatPosition}, x: ${playheadX}`);
  // }

  if (playheadX >= 0 && playheadX <= viewport.width - TRACK_HEADER_WIDTH) {
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, viewport.height - TIMELINE_HEIGHT);
    ctx.stroke();

    // Playhead handle
    ctx.fillStyle = '#00ff88';
    ctx.beginPath();
    ctx.moveTo(playheadX - 6, 0);
    ctx.lineTo(playheadX + 6, 0);
    ctx.lineTo(playheadX, 8);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawTimeline(ctx, engine) {
  const { viewport } = engine;
  const { start: startBeat, end: endBeat } = viewport.visibleBeats;

  ctx.save();
  ctx.translate(TRACK_HEADER_WIDTH, 0);
  ctx.beginPath();
  ctx.rect(0, 0, viewport.width - TRACK_HEADER_WIDTH, TIMELINE_HEIGHT);
  ctx.clip();

  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, viewport.width - TRACK_HEADER_WIDTH, TIMELINE_HEIGHT);

  ctx.font = '10px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  for (let beat = startBeat; beat <= endBeat; beat++) {
    const x = beat * PIXELS_PER_BEAT * viewport.zoomX - viewport.scrollX;

    if (x < -50 || x > viewport.width - TRACK_HEADER_WIDTH + 50) continue;

    const isMajor = beat % BEATS_PER_BAR === 0;

    ctx.beginPath();
    ctx.moveTo(x, isMajor ? 0 : TIMELINE_HEIGHT - 10);
    ctx.lineTo(x, TIMELINE_HEIGHT);
    ctx.strokeStyle = isMajor ? '#555' : '#333';
    ctx.lineWidth = isMajor ? 2 : 1;
    ctx.stroke();

    if (isMajor) {
      const barNumber = Math.floor(beat / BEATS_PER_BAR) + 1;
      ctx.fillStyle = '#999';
      ctx.fillText(barNumber.toString(), x + 4, 4);
    }
  }

  ctx.restore();
}

function drawTrackHeaders(ctx, engine) {
  const { viewport, dimensions, tracks } = engine;
  const { start: startTrack, end: endTrack } = viewport.visibleTracks;

  ctx.save();
  ctx.translate(0, TIMELINE_HEIGHT);
  ctx.beginPath();
  ctx.rect(0, 0, TRACK_HEADER_WIDTH, viewport.height - TIMELINE_HEIGHT);
  ctx.clip();

  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, TRACK_HEADER_WIDTH, viewport.height - TIMELINE_HEIGHT);

  // Virtual track rendering - görünen range'deki tüm track'ler (var olsun ya da olmasın)
  for (let i = startTrack; i < endTrack && i < dimensions.virtualTrackCount; i++) {
    const y = i * dimensions.trackHeight - viewport.scrollY;

    // Track background
    ctx.fillStyle = i % 2 === 0 ? '#1a1a1a' : '#151515';
    ctx.fillRect(0, y, TRACK_HEADER_WIDTH, dimensions.trackHeight);

    // Gerçek track var mı?
    const track = tracks[i];

    if (track) {
      // Real track - color indicator
      ctx.fillStyle = track.color || '#00ff88';
      ctx.fillRect(0, y, 3, dimensions.trackHeight);

      // Track name
      ctx.fillStyle = track.muted ? '#555' : '#fff';
      ctx.font = '12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      ctx.save();
      ctx.beginPath();
      ctx.rect(8, y, TRACK_HEADER_WIDTH - 16, dimensions.trackHeight);
      ctx.clip();
      ctx.fillText(track.name || `Track ${i + 1}`, 12, y + dimensions.trackHeight / 2);
      ctx.restore();
    } else {
      // Virtual empty track - placeholder
      ctx.fillStyle = '#333';
      ctx.fillRect(0, y, 2, dimensions.trackHeight);

      ctx.fillStyle = '#444';
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Track ${i + 1}`, 12, y + dimensions.trackHeight / 2);
    }

    // Divider
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + dimensions.trackHeight);
    ctx.lineTo(TRACK_HEADER_WIDTH, y + dimensions.trackHeight);
    ctx.stroke();
  }

  ctx.restore();
}
