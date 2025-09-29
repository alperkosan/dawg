// src/features/piano_roll_v7/renderer.js
import { premiumNoteRenderer } from './renderers/noteRenderer.js';

const RULER_HEIGHT = 30;
const KEYBOARD_WIDTH = 80;
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function drawPianoRoll(ctx, engine) {
    const { viewport } = engine;
    if (!viewport || viewport.width === 0 || viewport.height === 0) return;

    ctx.fillStyle = '#181A20';
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    // Draw layers
    drawGrid(ctx, engine);
    drawNotes(ctx, engine); // Premium note rendering
    drawSelectionArea(ctx, engine); // Selection area overlay
    drawTimeline(ctx, engine);
    drawKeyboard(ctx, engine);
    drawCornerAndBorders(ctx, engine);
}

function drawGrid(ctx, { viewport, dimensions, lod, snapValue }) {
    ctx.save();
    ctx.translate(KEYBOARD_WIDTH, RULER_HEIGHT);
    ctx.beginPath();
    ctx.rect(0, 0, viewport.width - KEYBOARD_WIDTH, viewport.height - RULER_HEIGHT);
    ctx.clip();
    ctx.translate(-viewport.scrollX, -viewport.scrollY);

    const { stepWidth, keyHeight } = dimensions;

    if (lod < 3) {
        ctx.fillStyle = '#202229';
        const { startKey, endKey } = viewport.visibleKeys;
        for (let i = startKey; i <= endKey; i++) {
            if ([1, 3, 6, 8, 10].includes(i % 12)) {
                ctx.fillRect(0, i * keyHeight, dimensions.totalWidth, keyHeight);
            }
        }
    }

    const { startStep, endStep } = viewport.visibleSteps;

    // snapValue bir ölçü içindeki step sayısını belirtir (16 = bar, 4 = beat, 1 = 16th note)
    // Kullanıcı snap ayarı seçtiyse o ayara göre grid çiz
    let gridStepIncrement = snapValue || 1;

    // Triplet detection - check if current snap is a triplet value
    const isTripletSnap = typeof snapValue === 'string' && snapValue.endsWith('T');

    // Convert triplet string to numeric value for grid calculations
    if (isTripletSnap) {
        gridStepIncrement = parseFloat(snapValue.replace('T', ''));
    }

    // LOD bazlı minimum grid increment'i - triplet için agresif azaltma
    let lodStepIncrement = 1;
    if (isTripletSnap) {
        // Triplet mode: Daha erken ve agresif azaltma
        if (lod >= 4) lodStepIncrement = 16; // Sadece bar'lar
        else if (lod >= 3) lodStepIncrement = 8; // Yarım nota seviyesi
        else if (lod >= 2) lodStepIncrement = 4; // Beat seviyesi
        else if (lod >= 1) lodStepIncrement = gridStepIncrement * 2; // Her ikinci triplet
        else lodStepIncrement = gridStepIncrement; // Tüm triplet'ler
    } else {
        // Regular mode - daha agresif LOD azaltması
        if (lod >= 4) lodStepIncrement = 16; // Sadece bar'lar
        else if (lod >= 3) lodStepIncrement = Math.max(8, gridStepIncrement * 4); // Yarım nota seviyesi
        else if (lod >= 2) lodStepIncrement = Math.max(4, gridStepIncrement * 2); // Beat seviyesi
        else lodStepIncrement = gridStepIncrement; // Tüm grid'ler
    }

    // Effective step increment - hem triplet hem regular mode'da agresif LOD
    let effectiveStepIncrement;
    if (isTripletSnap) {
        // Triplet mode: LOD 2'den itibaren seyrek grid
        effectiveStepIncrement = lod >= 2 ? lodStepIncrement : gridStepIncrement;
    } else {
        // Regular mode: LOD 2'den itibaren seyrek grid (daha agresif)
        effectiveStepIncrement = lod >= 2 ? lodStepIncrement : gridStepIncrement;
    }
    const startLine = Math.floor(startStep / effectiveStepIncrement) * effectiveStepIncrement;

    // Precision-safe loop için integer counter kullan
    const startCounter = Math.floor(startLine / effectiveStepIncrement);
    const endCounter = Math.ceil(endStep / effectiveStepIncrement);

    for (let counter = startCounter; counter < endCounter; counter++) {
        const step = counter * effectiveStepIncrement;
        if (step >= endStep) break; // Güvenlik kontrolü

        const x = step * stepWidth;
        const isBar = Math.abs(step % 16) < 0.001;
        const isBeat = Math.abs(step % 4) < 0.001;
        // Floating point safe snap grid detection
        const isSnapGridLine = Math.abs(step % gridStepIncrement) < 0.01;

        if (isBar) {
            // Bar lines - en kalın ve belirgin
            ctx.strokeStyle = `rgba(180, 188, 208, ${lod > 2 ? 0.4 : 0.7})`;
            ctx.lineWidth = lod > 2 ? 1.2 : 1.5;
        } else if (isBeat && gridStepIncrement <= 4 && !isTripletSnap && lod < 3) {
            // Beat lines - orta kalınlık (sadece LOD < 3'te, küçük snap'lerde ve triplet değilse)
            ctx.strokeStyle = `rgba(100, 110, 140, ${lod > 2 ? 0.3 : 0.5})`;
            ctx.lineWidth = 0.8;
        } else if (isSnapGridLine) {
            // Snap grid lines - triplet mode'da LOD-aware hierarchy
            if (isTripletSnap) {
                // Triplet beat detection: her 3 subdivision'da bir beat
            // Use precise floating point comparison for triplet steps
            const exactSubdivisionIndex = step / gridStepIncrement;
            const subdivisionIndex = Math.round(exactSubdivisionIndex);
            const isTripletBeat = Math.abs(exactSubdivisionIndex - subdivisionIndex) < 0.01 && subdivisionIndex % 3 === 0;

                // Triplet beat hierarchy
                if (isTripletBeat) {
                    // Triplet beat positions - her LOD'da göster
                    ctx.strokeStyle = `rgba(140, 150, 170, ${lod > 2 ? 0.6 : 0.9})`;
                    ctx.lineWidth = lod > 2 ? 1.1 : 1.4;
                } else if (lod < 2) {
                    // Triplet subdivision lines - sadece LOD < 2'de
                    ctx.strokeStyle = `rgba(120, 130, 150, 0.3)`;
                    ctx.lineWidth = 0.7;
                } else {
                    // Yüksek LOD'da triplet subdivision'ları skip et
                    continue;
                }
            } else {
                // Regular snap grid lines - LOD bazlı filtreleme
                if (lod >= 3 && gridStepIncrement < 4) {
                    // Yüksek LOD'da küçük snap grid'leri skip et
                    continue;
                } else if (lod >= 2 && gridStepIncrement < 2) {
                    // Orta LOD'da çok küçük snap grid'leri skip et
                    continue;
                }
                ctx.strokeStyle = `rgba(120, 130, 150, ${lod > 2 ? 0.2 : 0.4})`;
                ctx.lineWidth = 0.6;
            }
            ctx.setLineDash([]);
        } else {
            // Diğer grid lines - LOD bazlı aggressive filtreleme
            if (isTripletSnap && lod >= 2) {
                // Triplet mode'da yüksek LOD'larda skip
                continue;
            } else if (!isTripletSnap && lod >= 3) {
                // Regular mode'da yüksek LOD'larda skip
                continue;
            } else if (isTripletSnap) {
                // Triplet mode'da düşük LOD'da çok ince çizgiler
                ctx.strokeStyle = `rgba(80, 88, 112, 0.05)`;
                ctx.lineWidth = 0.1;
            } else {
                // Regular mode - LOD'a göre azalan görünürlük
                if (lod >= 2) {
                    ctx.strokeStyle = `rgba(80, 88, 112, 0.05)`;
                    ctx.lineWidth = 0.2;
                } else {
                    ctx.strokeStyle = `rgba(80, 88, 112, 0.3)`;
                    ctx.lineWidth = 0.4;
                }
            }
            ctx.setLineDash([]);
        }

        
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, dimensions.totalHeight);
        ctx.stroke();

        // Reset line dash for next iteration
        ctx.setLineDash([]);
    }
    
    if (lod < 3) {
        const { startKey, endKey } = viewport.visibleKeys;
        ctx.strokeStyle = `rgba(100, 116, 139, ${lod < 2 ? 0.3 : 0.2})`;
        ctx.lineWidth = 0.5;
        for (let key = startKey; key <= endKey; key++) {
            const y = key * keyHeight;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(dimensions.totalWidth, y);
            ctx.stroke();
        }
    }
    ctx.restore();
}

function drawTimeline(ctx, { viewport, dimensions, lod, snapValue }) {
    ctx.save();
    ctx.translate(KEYBOARD_WIDTH, 0);
    ctx.beginPath();
    ctx.rect(0, 0, viewport.width - KEYBOARD_WIDTH, RULER_HEIGHT);
    ctx.clip();
    ctx.translate(-viewport.scrollX, 0);
    ctx.fillStyle = '#202229';
    ctx.fillRect(0, 0, dimensions.totalWidth, RULER_HEIGHT);
    ctx.textAlign = 'left';

    const { startStep, endStep } = viewport.visibleSteps;

    // LOD bazlı minimum bar increment
    let lodBarIncrement = 1;
    if (lod === 4) lodBarIncrement = 32;
    else if (lod === 3) lodBarIncrement = 8;
    else if (lod === 2) lodBarIncrement = 4;
    else if (lod === 1) lodBarIncrement = 2;

    // Snap value'ya göre timeline step increment'i (grid ile tutarlı)
    let timelineSnapIncrement = snapValue || 1;

    // Convert triplet string to numeric value
    if (typeof snapValue === 'string' && snapValue.endsWith('T')) {
        timelineSnapIncrement = parseFloat(snapValue.replace('T', ''));
    }

    // Use the same increment calculation as grid for consistency
    let timelineStepIncrement = timelineSnapIncrement;

    // Apply same LOD filtering as grid for perfect sync
    const isTripletSnapTimeline = typeof snapValue === 'string' && snapValue.endsWith('T');

    if (isTripletSnapTimeline) {
        if (lod >= 3) timelineStepIncrement = 16; // Bars only
        else if (lod >= 2) timelineStepIncrement = 4; // Beat level
        else timelineStepIncrement = timelineSnapIncrement; // Use triplet increment
    } else {
        if (lod >= 3) timelineStepIncrement = Math.max(4, timelineSnapIncrement * 2);
        else timelineStepIncrement = timelineSnapIncrement;
    }

    // Timeline'da integer step increment garantisi
    timelineStepIncrement = Math.max(1, Math.round(timelineStepIncrement));
    const barIncrement = Math.max(lodBarIncrement, Math.ceil(timelineStepIncrement / 16));

    // Timeline loop - sadece integer step'lerle
    const startTimelineStep = Math.floor(startStep / timelineStepIncrement) * timelineStepIncrement;
    for (let step = startTimelineStep; step < endStep; step += timelineStepIncrement) {
        const x = step * dimensions.stepWidth;
        const isBar = step % 16 === 0;
        const isBeat = step % 4 === 0;
        if (isBar) {
            const barNumber = step / 16 + 1;
            ctx.strokeStyle = `rgba(148, 163, 184, ${lod > 2 ? 0.4 : 0.8})`;
            ctx.lineWidth = lod > 2 ? 0.8 : 1.2;
            ctx.beginPath();
            ctx.moveTo(x, RULER_HEIGHT - (lod > 1 ? 8 : 12));
            ctx.lineTo(x, RULER_HEIGHT);
            ctx.stroke();
            if (barNumber % barIncrement === 0) {
                ctx.font = lod < 1 ? '12px sans-serif' : lod < 2 ? '10px sans-serif' : '9px sans-serif';
                ctx.fillStyle = `rgba(226, 232, 240, ${lod > 2 ? 0.7 : 1.0})`;
                ctx.fillText(barNumber, x + 5, RULER_HEIGHT - 9);
            }
        } else if (isBeat && lod < 2 && timelineStepIncrement <= 4) {
            // Beat lines - sadece küçük snap değerlerinde göster
            ctx.strokeStyle = 'rgba(100, 116, 139, 0.6)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(x, RULER_HEIGHT - 5);
            ctx.lineTo(x, RULER_HEIGHT);
            ctx.stroke();
        }
    }
    ctx.restore();
}

function drawKeyboard(ctx, { viewport, dimensions, lod }) {
    ctx.save();
    ctx.translate(0, RULER_HEIGHT);
    ctx.beginPath();
    ctx.rect(0, 0, KEYBOARD_WIDTH, viewport.height - RULER_HEIGHT);
    ctx.clip();
    ctx.translate(0, -viewport.scrollY);
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(0, 0, KEYBOARD_WIDTH, dimensions.totalHeight);

    if (lod < 4) {
        const { startKey, endKey } = viewport.visibleKeys;
        for (let key = startKey; key <= endKey; key++) {
            const y = key * dimensions.keyHeight;
            const isBlack = [1, 3, 6, 8, 10].includes(key % 12);
            ctx.fillStyle = isBlack ? '#1a202c' : '#cbd5e1';
            ctx.fillRect(0, y, KEYBOARD_WIDTH, dimensions.keyHeight);
            if (!isBlack && lod < 2 && dimensions.keyHeight >= 12) {
                const octave = Math.floor((127 - key) / 12);
                const noteName = NOTES[(127-key) % 12];
                if (noteName === 'C') {
                    ctx.fillStyle = '#1a202c';
                    const fontSize = lod < 1 ? 10 : 8;
                    ctx.font = `${fontSize}px sans-serif`;
                    ctx.textAlign = 'right';
                    ctx.fillText(`${noteName}${octave}`, KEYBOARD_WIDTH - 8, y + dimensions.keyHeight / 2 + 4);
                }
            }
        }
    }

    if (lod < 3) {
        const { startKey, endKey } = viewport.visibleKeys;
        const alpha = lod === 2 ? 0.5 : 1;
        ctx.strokeStyle = `rgba(74, 85, 104, ${alpha})`;
        ctx.lineWidth = lod === 2 ? 0.5 : 1;
        for (let key = startKey; key <= endKey; key++) {
            const y = key * dimensions.keyHeight;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(KEYBOARD_WIDTH, y);
            ctx.stroke();
        }
    }
    ctx.restore();
}

function drawNotes(ctx, engine) {
    // Get real notes from engine data
    const notes = engine.notes || [];
    const selectedNoteIds = engine.selectedNoteIds || new Set();
    const hoveredNoteId = engine.hoveredNoteId || null;

    // Don't render if no notes
    if (notes.length === 0) return;

    ctx.save();
    ctx.translate(KEYBOARD_WIDTH, RULER_HEIGHT);
    ctx.beginPath();
    ctx.rect(0, 0, engine.viewport.width - KEYBOARD_WIDTH, engine.viewport.height - RULER_HEIGHT);
    ctx.clip();
    ctx.translate(-engine.viewport.scrollX, -engine.viewport.scrollY);

    // Render real notes using premium renderer
    premiumNoteRenderer.renderNotes(
        ctx,
        notes,
        engine.dimensions,
        engine.viewport,
        selectedNoteIds,
        hoveredNoteId
    );

    // Render preview note if exists
    if (engine.previewNote) {
        console.log("🎨 Rendering preview note:", engine.previewNote);
        premiumNoteRenderer.renderPreviewNote(
            ctx,
            engine.previewNote,
            engine.dimensions,
            engine.viewport
        );
    }

    ctx.restore();
}

function drawSelectionArea(ctx, engine) {
    const { selectionArea, isSelectingArea, viewport } = engine;

    if (!isSelectingArea || !selectionArea) return;

    ctx.save();
    ctx.translate(KEYBOARD_WIDTH, RULER_HEIGHT);
    ctx.beginPath();
    ctx.rect(0, 0, viewport.width - KEYBOARD_WIDTH, viewport.height - RULER_HEIGHT);
    ctx.clip();

    const { startX, startY, endX, endY } = selectionArea;
    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);

    // Skip if selection area is too small
    if (width < 3 || height < 3) {
        ctx.restore();
        return;
    }

    // Premium gradient background
    // Safe gradient creation
    if (!isFinite(x) || !isFinite(y) || !isFinite(height)) {
        console.warn('⚠️ Non-finite gradient in renderer:', { x, y, height });
        return;
    }
    const bgGradient = ctx.createLinearGradient(x, y, x, y + height);
    bgGradient.addColorStop(0, 'rgba(59, 130, 246, 0.08)'); // Blue-500 with low alpha
    bgGradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.12)');
    bgGradient.addColorStop(1, 'rgba(59, 130, 246, 0.08)');

    ctx.fillStyle = bgGradient;
    ctx.fillRect(x, y, width, height);

    // Premium animated border
    const time = Date.now() * 0.002; // Slow animation
    const dashOffset = (time * 20) % 16; // Animated dash movement

    // Outer glow effect
    ctx.shadowColor = 'rgba(59, 130, 246, 0.4)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Main border - animated dashed line
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 4]);
    ctx.lineDashOffset = -dashOffset;
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);

    // Reset shadow
    ctx.shadowBlur = 0;

    // Inner highlight border
    ctx.strokeStyle = 'rgba(147, 197, 253, 0.6)'; // Blue-300
    ctx.lineWidth = 0.5;
    ctx.setLineDash([6, 2]);
    ctx.lineDashOffset = -dashOffset * 0.5;
    ctx.strokeRect(x + 1.5, y + 1.5, width - 3, height - 3);

    // Corner indicators for better visual feedback
    const cornerSize = Math.min(8, width * 0.1, height * 0.1);
    ctx.fillStyle = 'rgba(59, 130, 246, 0.8)';
    ctx.setLineDash([]); // Reset dash

    // Top-left corner
    ctx.fillRect(x, y, cornerSize, 2);
    ctx.fillRect(x, y, 2, cornerSize);

    // Top-right corner
    ctx.fillRect(x + width - cornerSize, y, cornerSize, 2);
    ctx.fillRect(x + width - 2, y, 2, cornerSize);

    // Bottom-left corner
    ctx.fillRect(x, y + height - 2, cornerSize, 2);
    ctx.fillRect(x, y + height - cornerSize, 2, cornerSize);

    // Bottom-right corner
    ctx.fillRect(x + width - cornerSize, y + height - 2, cornerSize, 2);
    ctx.fillRect(x + width - 2, y + height - cornerSize, 2, cornerSize);

    ctx.restore();
}

function drawCornerAndBorders(ctx, { viewport }) {
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(0, 0, KEYBOARD_WIDTH, RULER_HEIGHT);
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(KEYBOARD_WIDTH, 0);
    ctx.lineTo(KEYBOARD_WIDTH, viewport.height);
    ctx.moveTo(0, RULER_HEIGHT);
    ctx.lineTo(viewport.width, RULER_HEIGHT);
    ctx.stroke();
}
