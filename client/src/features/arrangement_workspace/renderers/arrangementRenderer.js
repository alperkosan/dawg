/**
 * ARRANGEMENT RENDERER
 *
 * Piano Roll rendering pattern'i kullanarak optimize edilmiş
 * - Viewport-based rendering
 * - LOD-aware grid drawing
 * - Clip intersection check
 */

const TRACK_HEADER_WIDTH = 150;
const TIMELINE_HEIGHT = 40;
const PIXELS_PER_BEAT = 32;
const BEATS_PER_BAR = 4;

function drawGhostPreview(ctx, engine) {
  const { viewport, dimensions, patternInteraction, tracks } = engine;

  if (!patternInteraction || !patternInteraction.ghostPosition) return;

  const { ghostPosition, clip, mode, currentStartTime, currentDuration } = patternInteraction;

  if (!clip) return;

  const track = tracks.find(t => t.id === clip.trackId);
  if (!track) return;

  const trackIndex = tracks.indexOf(track);

  ctx.save();
  ctx.translate(TRACK_HEADER_WIDTH, TIMELINE_HEIGHT);
  ctx.beginPath();
  ctx.rect(0, 0, viewport.width - TRACK_HEADER_WIDTH, viewport.height - TIMELINE_HEIGHT);
  ctx.clip();
  ctx.translate(-viewport.scrollX, -viewport.scrollY);

  if (mode === 'move' || mode === 'resize-left') {
    // Ghost preview için yeni pozisyon
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
  const { viewport, dimensions, clips, tracks, selectedClips } = engine;

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

    // Clip background
    ctx.fillStyle = clip.color || track.color || '#00ff88';
    ctx.globalAlpha = clip.type === 'pattern' ? 0.6 : 0.8;
    ctx.fillRect(x, y, clipWidth, clipHeight);
    ctx.globalAlpha = 1;

    // Clip border
    ctx.strokeStyle = isSelected ? '#00ff88' : '#000';
    ctx.lineWidth = isSelected ? 3 : 1;
    ctx.strokeRect(x, y, clipWidth, clipHeight);

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

    // Pattern preview (only if zoomed in)
    if (clip.type === 'pattern' && viewport.zoomX > 0.5 && clipWidth > 60) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      const previewLines = Math.min(16, Math.floor(clipWidth / 8));
      for (let j = 0; j < previewLines; j++) {
        const lineX = x + (clipWidth / previewLines) * j;
        const lineHeight = Math.random() * (clipHeight * 0.6);
        ctx.beginPath();
        ctx.moveTo(lineX, y + clipHeight - 4);
        ctx.lineTo(lineX, y + clipHeight - 4 - lineHeight);
        ctx.stroke();
      }
    }
  });

  ctx.restore();
}

function drawPlayhead(ctx, engine) {
  const { viewport, dimensions, playhead } = engine;

  if (!playhead) return;

  ctx.save();
  ctx.translate(TRACK_HEADER_WIDTH, TIMELINE_HEIGHT);
  ctx.beginPath();
  ctx.rect(0, 0, viewport.width - TRACK_HEADER_WIDTH, viewport.height - TIMELINE_HEIGHT);
  ctx.clip();

  const playheadX = (playhead.position / 480) * PIXELS_PER_BEAT * viewport.zoomX - viewport.scrollX;

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

    if (isMajor && beat > 0) {
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
