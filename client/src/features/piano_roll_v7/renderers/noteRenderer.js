// Premium Note Renderer for Piano Roll v7
// Zenith design system ile uyumlu, premium hissi uyandıran note görünümleri

import { globalStyleCache } from '../../../lib/rendering/StyleCache.js';

export class PremiumNoteRenderer {
    constructor() {
        this.animationCache = new Map();
        this.gradientCache = new Map();
        // Note animations: noteId -> { type: 'added'|'deleted'|'modified', startTime, duration }
        this.noteAnimations = new Map();
    }

    /**
     * ✅ DOPAMINERGIC EASING FUNCTIONS
     * Professional animation curves for satisfying feedback
     */
    easeOutElastic(t) {
        const c4 = (2 * Math.PI) / 3;
        return t === 0 ? 0 : t === 1 ? 1 :
            Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }

    easeOutBounce(t) {
        const n1 = 7.5625;
        const d1 = 2.75;
        if (t < 1 / d1) {
            return n1 * t * t;
        } else if (t < 2 / d1) {
            return n1 * (t -= 1.5 / d1) * t + 0.75;
        } else if (t < 2.5 / d1) {
            return n1 * (t -= 2.25 / d1) * t + 0.9375;
        } else {
            return n1 * (t -= 2.625 / d1) * t + 0.984375;
        }
    }

    easeOutBack(t) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }

    /**
     * Trigger animation for a note
     * @param {string} noteId - Note ID
     * @param {'added'|'deleted'|'modified'} type - Animation type
     */
    animateNote(noteId, type) {
        const durations = {
            added: 500,      // ✅ 0.5s (longer for satisfaction)
            deleted: 350,    // ✅ 0.35s (longer for dramatic effect)
            modified: 250    // 0.25s
        };

        this.noteAnimations.set(noteId, {
            type,
            startTime: performance.now(),
            duration: durations[type] || 300
        });

        // Auto-cleanup after animation completes
        setTimeout(() => {
            this.noteAnimations.delete(noteId);
        }, durations[type] + 50);
    }

    /**
     * Get animation progress (0 to 1) for a note
     * @param {string} noteId - Note ID
     * @returns {{ type: string, progress: number } | null}
     */
    getAnimationState(noteId) {
        const anim = this.noteAnimations.get(noteId);
        if (!anim) return null;

        const elapsed = performance.now() - anim.startTime;
        const progress = Math.min(elapsed / anim.duration, 1);

        return { type: anim.type, progress };
    }

    // Safe gradient creation with NaN/Infinity protection
    createSafeLinearGradient(ctx, x1, y1, x2, y2, fallbackColor = '#666666') {
        if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2)) {
            console.warn('⚠️ Non-finite gradient coordinates, using fallback color:', { x1, y1, x2, y2 });
            // Return a mock gradient object for compatibility
            return {
                addColorStop: () => {},
                toString: () => fallbackColor
            };
        }
        return ctx.createLinearGradient(x1, y1, x2, y2);
    }

    // Premium note rendering with advanced visuals
    renderNote(ctx, note, dimensions, viewport, isSelected = false, isHovered = false, isEraserTarget = false) {
        // ✅ OPTIMIZED: Using StyleCache
        const { stepWidth, keyHeight } = dimensions;

        // Calculate note position and size - ensure it fills grid cells completely
        // Debug: Check for undefined values before calculation
        if (note.startTime === undefined || note.pitch === undefined || note.length === undefined) {
            console.error('❌ Note has undefined values:', {
                startTime: note.startTime,
                pitch: note.pitch,
                length: note.length,
                note
            });
            return;
        }

        if (!stepWidth || !keyHeight) {
            console.error('❌ Viewport dimensions undefined:', { stepWidth, keyHeight });
            return;
        }

        // Note: stepWidth = BASE_STEP_WIDTH * zoomX, startTime in steps
        const x = Math.round(note.startTime * stepWidth);
        const y = Math.round((127 - note.pitch) * keyHeight);

        // Calculate width to fill grid cells completely based on note length
        const noteWidthInSteps = Math.round(note.length * stepWidth);
        const width = Math.max(Math.round(stepWidth) - 1, noteWidthInSteps - 1); // -1 for grid line visibility
        const height = Math.round(keyHeight) - 1; // -1 for horizontal grid line visibility

        // Skip if note is not visible
        if (x + width < viewport.scrollX || x > viewport.scrollX + viewport.width ||
            y + height < viewport.scrollY || y > viewport.scrollY + viewport.height) {
            return;
        }

        ctx.save();

        // ✅ DOPAMINERGIC ANIMATIONS - Satisfying, juicy feedback
        const animState = this.getAnimationState(note.id);
        let scale = 1;
        let animAlpha = 1;
        let glowIntensity = 0;
        let colorShift = 0; // Hue shift for animation

        if (animState) {
            const { type, progress } = animState;

            if (type === 'added') {
                // ✅ SUBTLE ADD: Quick fade-in with minimal scale
                const t = progress;
                const eased = 1 - Math.pow(1 - t, 2); // Ease out quad
                scale = 0.92 + eased * 0.08; // Subtle: 0.92 → 1.0

                // Quick fade-in
                animAlpha = eased;

                // ✅ SUBTLE GLOW: Soft green hint
                const glowProgress = Math.sin(t * Math.PI); // Peak at 50%
                glowIntensity = glowProgress * 6; // Max 6 (subtle)

                // ✅ MINIMAL COLOR SHIFT: Light green tint
                colorShift = glowProgress * 20; // Subtle shift
            } else if (type === 'deleted') {
                // ✅ SUBTLE DELETE: Simple fade-out
                const t = progress;
                const eased = Math.pow(t, 1.5); // Ease in

                scale = 1 - eased * 0.1; // Subtle shrink: 1.0 → 0.9
                animAlpha = 1 - eased; // Smooth fade

                // ✅ SUBTLE GLOW: Soft red hint
                glowIntensity = (1 - t) * 5; // Fade from 5 to 0

                // ✅ MINIMAL COLOR SHIFT: Light red tint
                colorShift = -15; // Subtle red
            } else if (type === 'modified') {
                // ✅ SUBTLE MODIFIED: Tiny pulse
                const t = progress;
                scale = 1 + Math.sin(t * Math.PI) * 0.03; // Very gentle: ±3%
                glowIntensity = Math.sin(t * Math.PI) * 4; // Soft glow
                colorShift = Math.sin(t * Math.PI) * 10; // Minimal wave
            }
        }

        // Apply scale transform
        if (scale !== 1) {
            const centerX = x + width / 2;
            const centerY = y + height / 2;
            ctx.translate(centerX, centerY);
            ctx.scale(scale, scale);
            ctx.translate(-centerX, -centerY);
        }

        // ✅ ERASER TARGET OVERRIDE - Red warning color
        let alpha, baseHue, saturation, lightness;

        if (isEraserTarget) {
            alpha = 0.9;
            baseHue = 0; // Red
            saturation = 80;
            lightness = 50;
        } else {
            // Premium note styling based on velocity and pitch
            alpha = (0.85 + (note.velocity / 127) * 0.15) * animAlpha;
            baseHue = (note.hue || ((note.pitch * 2.8) % 360)) + colorShift; // ✅ Apply color shift
            saturation = note.saturation || (60 + (note.velocity / 127) * 40);
            lightness = note.brightness || (45 + (note.velocity / 127) * 25);

            // ✅ Boost saturation during animations for more vibrant feedback
            if (animState) {
                saturation = Math.min(100, saturation + glowIntensity * 0.5);
            }
        }

        // ✅ SUBTLE GLOW EFFECT - Pleasant, minimal feedback
        if (glowIntensity > 0) {
            const glowAlpha = Math.min(glowIntensity / 6, 1); // Normalize to 0-1

            if (animState?.type === 'deleted') {
                // Soft red hint
                ctx.shadowBlur = glowIntensity;
                ctx.shadowColor = `rgba(239, 68, 68, ${glowAlpha * 0.4})`;
            } else if (animState?.type === 'added') {
                // Soft green hint
                ctx.shadowBlur = glowIntensity;
                ctx.shadowColor = `rgba(34, 197, 94, ${glowAlpha * 0.4})`;
            } else {
                // Soft colored glow
                ctx.shadowBlur = glowIntensity;
                ctx.shadowColor = `hsla(${baseHue}, 80%, 60%, ${glowAlpha * 0.3})`;
            }
        }

        // Create premium gradient
        const gradient = this.createPremiumGradient(ctx, x, y, width, height, {
            hue: baseHue,
            saturation,
            lightness,
            alpha,
            isSelected,
            isHovered: isEraserTarget ? false : isHovered // Disable normal hover if eraser target
        });

        // Main note body with subtle 3D effect - aligned to grid
        ctx.fillStyle = gradient;
        this.drawRoundedRect(ctx, x, y, width, height, 3);
        ctx.fill();

        // Reset shadow for other elements
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        // Premium border with depth
        this.renderNoteBorder(ctx, x, y, width, height, {
            hue: baseHue,
            isSelected,
            isHovered,
            velocity: note.velocity
        });

        // Velocity indicator (subtle left bar)
        this.renderVelocityIndicator(ctx, x + 1, y + 1, height - 2, note.velocity);

        // Premium highlight effect
        this.renderNoteHighlight(ctx, x, y, width, height, {
            hue: baseHue,
            isSelected,
            isHovered
        });

        // Note content (optional pitch/velocity text for large notes)
        if (width > 40 && height > 16) {
            this.renderNoteContent(ctx, note, x, y, width, height);
        }

        // Resize handles for selected notes
        if (isSelected && width > 20) {
            this.renderResizeHandles(ctx, x, y, width, height);
        }

        ctx.restore();
    }

    // Create premium gradient for note fill
    createPremiumGradient(ctx, x, y, width, height, style) {
        const cacheKey = `${style.hue}_${style.saturation}_${style.lightness}_${style.isSelected}_${style.isHovered}`;

        if (this.gradientCache.has(cacheKey)) {
            return this.gradientCache.get(cacheKey);
        }

        // Debug: Check for non-finite values before creating gradient
        if (!isFinite(x) || !isFinite(y) || !isFinite(width) || !isFinite(height)) {
            console.error('❌ Non-finite values in gradient:', { x, y, width, height });
            // Return fallback solid color
            return '#666666';
        }

        const gradient = this.createSafeLinearGradient(ctx, x, y, x, y + height);

        let h = style.hue;
        let s = style.saturation;
        let l = style.lightness;

        if (style.isSelected) {
            // More dramatic color changes for selection
            s = Math.min(100, s + 35);
            l = Math.min(85, l + 25);
            h = (h + 15) % 360; // Slight hue shift for better visibility
        }

        if (style.isHovered) {
            l = Math.min(80, l + 10);
        }

        // Premium gradient stops
        gradient.addColorStop(0, `hsla(${h}, ${s}%, ${l + 15}%, ${style.alpha})`);
        gradient.addColorStop(0.3, `hsla(${h}, ${s}%, ${l + 5}%, ${style.alpha})`);
        gradient.addColorStop(0.7, `hsla(${h}, ${s}%, ${l}%, ${style.alpha})`);
        gradient.addColorStop(1, `hsla(${h}, ${s}%, ${l - 10}%, ${style.alpha})`);

        this.gradientCache.set(cacheKey, gradient);
        return gradient;
    }

    // Premium note border with depth
    renderNoteBorder(ctx, x, y, width, height, style) {
        // ✅ OPTIMIZED: Using StyleCache
        const borderHue = style.hue;
        const borderAlpha = style.isSelected ? 0.9 : 0.6;
        const borderWidth = style.isSelected ? 2 : 1;

        // Outer border (darker)
        ctx.strokeStyle = `hsla(${borderHue}, 40%, 20%, ${borderAlpha})`;
        ctx.lineWidth = borderWidth + 1;
        this.drawRoundedRect(ctx, x, y, width, height, 3);
        ctx.stroke();

        // Inner border (lighter)
        ctx.strokeStyle = `hsla(${borderHue}, 60%, 60%, ${borderAlpha * 0.7})`;
        ctx.lineWidth = borderWidth;
        this.drawRoundedRect(ctx, x + 0.5, y + 0.5, width - 1, height - 1, 2.5);
        ctx.stroke();

        // Refined selection effects - more elegant
        if (style.isSelected) {
            // Subtle outer selection border
            const accentCool = globalStyleCache.get('--zenith-accent-cool');
            ctx.strokeStyle = accentCool || 'rgba(59, 130, 246, 0.8)';
            ctx.lineWidth = 2;
            ctx.setLineDash([]);
            this.drawRoundedRect(ctx, x - 1, y - 1, width + 2, height + 2, 3.5);
            ctx.stroke();

            // Gentle selection glow
            const accentCoolFaded = globalStyleCache.get('--zenith-accent-cool-faded');
            ctx.shadowColor = accentCoolFaded || 'rgba(59, 130, 246, 0.3)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            // Inner accent border
            const textPrimary = globalStyleCache.get('--zenith-text-primary');
            ctx.strokeStyle = textPrimary || 'rgba(255, 255, 255, 0.6)';
            ctx.lineWidth = 1;
            this.drawRoundedRect(ctx, x + 0.5, y + 0.5, width - 1, height - 1, 2.5);
            ctx.stroke();

            ctx.shadowBlur = 0;

            // Minimal corner indicators (only top corners)
            const cornerSize = 4;
            const accentCoolBright = globalStyleCache.get('--zenith-accent-cool');
            ctx.fillStyle = accentCoolBright || 'rgba(59, 130, 246, 0.9)';
            // Top-left corner dot
            ctx.fillRect(x - 1, y - 1, cornerSize, 1);
            ctx.fillRect(x - 1, y - 1, 1, cornerSize);
            // Top-right corner dot
            ctx.fillRect(x + width - cornerSize + 1, y - 1, cornerSize, 1);
            ctx.fillRect(x + width, y - 1, 1, cornerSize);
        }
    }

    // Velocity indicator bar (left side)
    renderVelocityIndicator(ctx, x, y, height, velocity) {
        // Debug: Check for non-finite values before calculation
        if (!isFinite(x) || !isFinite(y) || !isFinite(height) || !isFinite(velocity)) {
            console.error('❌ Non-finite values in velocityIndicator:', { x, y, height, velocity });
            return;
        }

        const barWidth = 3;
        const barHeight = height * (velocity / 127);
        const barY = y + (height - barHeight);

        // Safety check for gradient coordinates
        if (!isFinite(barY) || !isFinite(barHeight)) {
            console.error('❌ Non-finite gradient coords in velocityIndicator:', { barY, barHeight });
            return;
        }

        // Velocity color gradient
        const velocityGradient = this.createSafeLinearGradient(ctx, x, barY, x, barY + barHeight);

        if (velocity < 40) {
            velocityGradient.addColorStop(0, 'hsla(200, 70%, 60%, 0.8)'); // Blue (soft)
            velocityGradient.addColorStop(1, 'hsla(200, 70%, 40%, 0.8)');
        } else if (velocity < 80) {
            velocityGradient.addColorStop(0, 'hsla(120, 70%, 60%, 0.8)'); // Green (medium)
            velocityGradient.addColorStop(1, 'hsla(120, 70%, 40%, 0.8)');
        } else {
            velocityGradient.addColorStop(0, 'hsla(0, 80%, 70%, 0.8)'); // Red (strong)
            velocityGradient.addColorStop(1, 'hsla(0, 80%, 50%, 0.8)');
        }

        ctx.fillStyle = velocityGradient;
        ctx.fillRect(x + 1, barY, barWidth, barHeight);
    }

    // Premium highlight effect
    renderNoteHighlight(ctx, x, y, width, height, style) {
        // Top highlight for all notes
        const baseHighlight = this.createSafeLinearGradient(ctx,x, y, x, y + height * 0.3);
        baseHighlight.addColorStop(0, `hsla(${style.hue}, 60%, 85%, 0.2)`);
        baseHighlight.addColorStop(1, `hsla(${style.hue}, 60%, 85%, 0)`);

        ctx.fillStyle = baseHighlight;
        this.drawRoundedRect(ctx, x + 1, y + 1, width - 2, height * 0.3, 2);
        ctx.fill();

        // Enhanced hover effect
        if (style.isHovered && !style.isSelected) {
            // Hover glow
            ctx.shadowColor = `hsla(${style.hue}, 70%, 80%, 0.4)`;
            ctx.shadowBlur = 6;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            // Hover border
            ctx.strokeStyle = `hsla(${style.hue}, 80%, 75%, 0.7)`;
            ctx.lineWidth = 1;
            this.drawRoundedRect(ctx, x + 0.5, y + 0.5, width - 1, height - 1, 2.5);
            ctx.stroke();

            ctx.shadowBlur = 0;

            // Brighter top highlight for hover
            const hoverHighlight = this.createSafeLinearGradient(ctx,x, y, x, y + height * 0.4);
            hoverHighlight.addColorStop(0, `hsla(${style.hue}, 80%, 95%, 0.4)`);
            hoverHighlight.addColorStop(1, `hsla(${style.hue}, 80%, 95%, 0)`);

            ctx.fillStyle = hoverHighlight;
            this.drawRoundedRect(ctx, x + 1, y + 1, width - 2, height * 0.4, 2);
            ctx.fill();
        }
    }

    // Note content (pitch and velocity info)
    renderNoteContent(ctx, note, x, y, width, height) {
        if (width < 50 || height < 20) return;

        // ✅ OPTIMIZED: Using StyleCache
        const textPrimary = globalStyleCache.get('--zenith-text-primary');

        ctx.fillStyle = textPrimary || 'rgba(255, 255, 255, 0.9)';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        // Note name (pitch)
        const noteName = this.pitchToNoteName(note.pitch);
        ctx.fillText(noteName, x + 8, y + height * 0.3);

        // Velocity (if space allows)
        if (width > 80) {
            ctx.font = '8px Inter, sans-serif';
            const textSecondary = globalStyleCache.get('--zenith-text-secondary');
            ctx.fillStyle = textSecondary || 'rgba(255, 255, 255, 0.7)';
            ctx.fillText(`v${note.velocity}`, x + 8, y + height * 0.7);
        }
    }

    // Render multiple notes efficiently
    renderNotes(ctx, notes, dimensions, viewport, selectedNoteIds, hoveredNoteId, activeTool = 'select', dragState = null, snapValue = 1) {
        // Sort notes by pitch (render lower notes first for proper layering)
        const sortedNotes = [...notes].sort((a, b) => b.pitch - a.pitch);

        sortedNotes.forEach(note => {
            const isSelected = selectedNoteIds.has(note.id);
            const isHovered = hoveredNoteId === note.id;

            // ✅ ERASER TOOL FEEDBACK - Red highlight for hovered note
            const isEraserTarget = activeTool === 'eraser' && isHovered;

            // ✅ DRAG VISUAL FEEDBACK - Apply delta to note position during drag
            let renderNote = note;
            if (dragState && dragState.currentDelta) {
                if (dragState.type === 'moving' && dragState.noteIds && dragState.noteIds.includes(note.id)) {
                    // Moving: apply delta to position
                    const original = dragState.originalNotes.get(note.id);
                    if (original) {
                        const { deltaTime, deltaPitch } = dragState.currentDelta;
                        let newTime = original.startTime + deltaTime;
                        let newPitch = original.pitch + deltaPitch;

                        // Snap to grid
                        if (snapValue > 0) {
                            newTime = Math.max(0, Math.round(newTime / snapValue) * snapValue);
                        }

                        newTime = Math.max(0, newTime);
                        newPitch = Math.max(0, Math.min(127, Math.round(newPitch)));

                        renderNote = { ...note, startTime: newTime, pitch: newPitch };
                    }
                } else if (dragState.type === 'resizing') {
                    // ✅ MULTI-NOTE RESIZE: Check if this note is being resized
                    const noteIds = dragState.noteIds || [dragState.noteId];
                    const originalNotes = dragState.originalNotes || new Map([[dragState.noteId, dragState.originalNote]]);
                    
                    if (noteIds.includes(note.id)) {
                        // This note is being resized - apply delta
                        const { deltaTime } = dragState.currentDelta;
                        const original = originalNotes.get(note.id);
                        const minLength = 0.25;

                        if (dragState.resizeHandle === 'left') {
                            const originalEndTime = original.startTime + original.length;
                            let newStartTime = Math.max(0, original.startTime + deltaTime);

                            if (snapValue > 0) {
                                newStartTime = Math.max(0, Math.round(newStartTime / snapValue) * snapValue);
                            }

                            const newLength = Math.max(minLength, originalEndTime - newStartTime);
                            renderNote = { ...note, startTime: newStartTime, length: newLength };
                        } else if (dragState.resizeHandle === 'right') {
                            const originalStartTime = original.startTime;
                            let newEndTime = originalStartTime + original.length + deltaTime;

                            if (snapValue > 0) {
                                newEndTime = Math.max(0, Math.round(newEndTime / snapValue) * snapValue);
                            }

                            const newLength = Math.max(minLength, newEndTime - originalStartTime);
                            renderNote = { ...note, length: newLength };
                        }
                    }
                }
            }

            this.renderNote(ctx, renderNote, dimensions, viewport, isSelected, isHovered, isEraserTarget);
        });
    }

    // Render preview note with special styling
    renderPreviewNote(ctx, note, dimensions, viewport) {
        const { stepWidth, keyHeight } = dimensions;

        // Calculate note position and size
        const x = Math.round(note.startTime * stepWidth);
        const y = Math.round((127 - note.pitch) * keyHeight);
        const noteWidthInSteps = Math.round(note.length * stepWidth);
        const width = Math.max(Math.round(stepWidth) - 1, noteWidthInSteps - 1);
        const height = Math.round(keyHeight) - 1;

        // Skip if note is not visible
        if (x + width < viewport.scrollX || x > viewport.scrollX + viewport.width ||
            y + height < viewport.scrollY || y > viewport.scrollY + viewport.height) {
            return;
        }

        ctx.save();

        // Preview note styling - semi-transparent and distinctive
        const alpha = 0.4; // More transparent than regular notes
        const baseHue = (note.pitch * 2.8) % 360;

        // Create preview gradient with reduced opacity
        const gradient = this.createSafeLinearGradient(ctx, x, y, x, y + height);
        gradient.addColorStop(0, `hsla(${baseHue}, 60%, 70%, ${alpha})`);
        gradient.addColorStop(0.3, `hsla(${baseHue}, 60%, 60%, ${alpha})`);
        gradient.addColorStop(0.7, `hsla(${baseHue}, 60%, 50%, ${alpha})`);
        gradient.addColorStop(1, `hsla(${baseHue}, 60%, 40%, ${alpha})`);

        // Draw preview note body
        ctx.fillStyle = gradient;
        this.drawRoundedRect(ctx, x, y, width, height, 3);
        ctx.fill();

        // Preview border - dashed line for distinction
        ctx.strokeStyle = `hsla(${baseHue}, 70%, 80%, 0.7)`;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]); // Dashed border for preview
        this.drawRoundedRect(ctx, x, y, width, height, 3);
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash

        // Subtle preview highlight
        const previewHighlight = this.createSafeLinearGradient(ctx,x, y, x, y + height * 0.3);
        previewHighlight.addColorStop(0, `hsla(${baseHue}, 80%, 90%, 0.3)`);
        previewHighlight.addColorStop(1, `hsla(${baseHue}, 80%, 90%, 0)`);

        ctx.fillStyle = previewHighlight;
        this.drawRoundedRect(ctx, x + 1, y + 1, width - 2, height * 0.3, 2);
        ctx.fill();

        // Preview label (optional for larger notes)
        if (width > 30 && height > 16) {
            // ✅ OPTIMIZED: Using StyleCache
            const textPrimary = globalStyleCache.get('--zenith-text-primary');
            ctx.fillStyle = textPrimary || 'rgba(255, 255, 255, 0.8)';
            ctx.font = '9px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Preview', x + width/2, y + height/2);
        }

        ctx.restore();
    }

    // Helper: Draw rounded rectangle
    drawRoundedRect(ctx, x, y, width, height, radius) {
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
    }

    // Render resize handles for selected notes
    renderResizeHandles(ctx, x, y, width, height) {
        // ✅ OPTIMIZED: Using StyleCache
        const handleSize = 10; // Increased size for better usability
        const handleWidth = 5; // Increased width
        const handleOffset = 3;

        // Left resize handle (start time)
        const accentCool = globalStyleCache.get('--zenith-accent-cool');
        const textPrimary = globalStyleCache.get('--zenith-text-primary');
        ctx.fillStyle = accentCool || '#3b82f6';
        ctx.strokeStyle = textPrimary || 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 1;

        const leftHandleX = x - handleOffset;
        const leftHandleY = y + (height - handleSize) / 2;

        // Rounded rectangle for better appearance
        ctx.fillRect(leftHandleX, leftHandleY, handleWidth, handleSize);
        ctx.strokeRect(leftHandleX, leftHandleY, handleWidth, handleSize);

        // Right resize handle (end time/length)
        const rightHandleX = x + width - handleWidth + 1;
        const rightHandleY = y + (height - handleSize) / 2;

        ctx.fillRect(rightHandleX, rightHandleY, handleWidth, handleSize);
        ctx.strokeRect(rightHandleX, rightHandleY, handleWidth, handleSize);

        // Visual indicator lines (grip lines)
        const textPrimaryBright = globalStyleCache.get('--zenith-text-primary');
        ctx.strokeStyle = textPrimaryBright || 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1;

        // Left handle grip lines
        ctx.beginPath();
        ctx.moveTo(leftHandleX + 1, leftHandleY + 2);
        ctx.lineTo(leftHandleX + 1, leftHandleY + handleSize - 2);
        ctx.moveTo(leftHandleX + 3, leftHandleY + 2);
        ctx.lineTo(leftHandleX + 3, leftHandleY + handleSize - 2);
        ctx.stroke();

        // Right handle grip lines
        ctx.beginPath();
        ctx.moveTo(rightHandleX + 1, rightHandleY + 2);
        ctx.lineTo(rightHandleX + 1, rightHandleY + handleSize - 2);
        ctx.moveTo(rightHandleX + 3, rightHandleY + 2);
        ctx.lineTo(rightHandleX + 3, rightHandleY + handleSize - 2);
        ctx.stroke();
    }

    // Helper: Convert MIDI pitch to note name
    pitchToNoteName(pitch) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(pitch / 12) - 1;
        const noteName = notes[pitch % 12];
        return `${noteName}${octave}`;
    }

    // Clear caches (call when theme changes)
    clearCaches() {
        this.gradientCache.clear();
        this.animationCache.clear();
    }
}

// Singleton instance
export const premiumNoteRenderer = new PremiumNoteRenderer();