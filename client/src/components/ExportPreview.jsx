/**
 * 🎵 EXPORT PREVIEW
 *
 * Component for previewing export settings and estimated results
 * - Waveform preview (if audio buffer available)
 * - Duration display
 * - File size estimation
 * - Format and quality info
 * - Export settings summary
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Play, Pause, Volume2, File, Clock, HardDrive, Gauge, Info } from 'lucide-react';
import { formatFileSize, formatDuration, formatSampleRate, formatBitDepth, formatExportFormat } from '@/utils/formatUtils';
import { getCurrentBPM } from '@/lib/audio/audioRenderConfig';
import './ExportPreview.css';

/**
 * Estimate file size based on format, duration, sample rate, bit depth
 */
function estimateFileSize(duration, format, sampleRate, bitDepth, channels = 2) {
    if (!duration || duration <= 0) return 0;

    const bytesPerSample = bitDepth / 8;
    const samplesPerSecond = sampleRate;
    const totalSamples = duration * samplesPerSecond;
    const uncompressedSize = totalSamples * bytesPerSample * channels;

    switch (format) {
        case 'wav':
        case 'aiff':
            // WAV/AIFF: minimal compression, ~uncompressed size
            return uncompressedSize * 1.05; // 5% overhead for headers
        case 'flac':
            // FLAC: lossless compression, typically 50-60% of uncompressed
            return uncompressedSize * 0.55;
        case 'mp3':
            // MP3: bitrate-based (assume 320kbps CBR)
            const bitrate = 320000; // bits per second
            return (bitrate / 8) * duration; // bytes
        case 'ogg':
            // OGG Vorbis: similar to MP3, assume 320kbps
            const oggBitrate = 320000;
            return (oggBitrate / 8) * duration;
        default:
            return uncompressedSize;
    }
}

/**
 * Draw waveform on canvas
 */
function drawWaveform(canvas, audioBuffer, currentTime = 0, isPlaying = false) {
    if (!canvas || !audioBuffer) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    // Background
    const bgColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--zenith-bg-tertiary') || '#1E242F';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Get audio data (use first channel or mix)
    const channelData = audioBuffer.getChannelData(0);
    const totalSamples = channelData.length;
    const samplesPerPixel = Math.max(1, Math.floor(totalSamples / width));

    // Waveform colors
    const waveColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--zenith-accent-cool') || '#4ECDC4';
    const playedColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--zenith-accent-warm') || '#FFB627';
    const centerY = height / 2;

    // Draw waveform
    ctx.lineWidth = 1;
    const progress = audioBuffer.duration > 0 ? currentTime / audioBuffer.duration : 0;
    const progressPixel = progress * width;

    // Draw played portion
    if (progress > 0) {
        ctx.strokeStyle = playedColor;
        ctx.beginPath();
        for (let x = 0; x < progressPixel; x++) {
            const sampleStart = Math.floor(x * samplesPerPixel);
            const sampleEnd = Math.min(sampleStart + samplesPerPixel, totalSamples);
            
            let min = 0;
            let max = 0;
            for (let i = sampleStart; i < sampleEnd; i++) {
                const value = channelData[i];
                min = Math.min(min, value);
                max = Math.max(max, value);
            }

            const y1 = centerY + (min * centerY);
            const y2 = centerY + (max * centerY);
            
            if (x === 0) {
                ctx.moveTo(x, y1);
            } else {
                ctx.lineTo(x, y1);
            }
            ctx.lineTo(x, y2);
        }
        ctx.stroke();
    }

    // Draw unplayed portion
    ctx.strokeStyle = waveColor;
    ctx.beginPath();
    for (let x = Math.max(0, progressPixel); x < width; x++) {
        const sampleStart = Math.floor(x * samplesPerPixel);
        const sampleEnd = Math.min(sampleStart + samplesPerPixel, totalSamples);
        
        let min = 0;
        let max = 0;
        for (let i = sampleStart; i < sampleEnd; i++) {
            const value = channelData[i];
            min = Math.min(min, value);
            max = Math.max(max, value);
        }

        const y1 = centerY + (min * centerY);
        const y2 = centerY + (max * centerY);
        
        if (x === Math.max(0, progressPixel)) {
            ctx.moveTo(x, y1);
        } else {
            ctx.lineTo(x, y1);
        }
        ctx.lineTo(x, y2);
    }
    ctx.stroke();

    // Draw center line
    ctx.strokeStyle = getComputedStyle(document.documentElement)
        .getPropertyValue('--zenith-border-subtle') || 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Draw playhead
    if (isPlaying || progress > 0) {
        ctx.strokeStyle = playedColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(progressPixel, 0);
        ctx.lineTo(progressPixel, height);
        ctx.stroke();
    }

    ctx.restore();
}

export const ExportPreview = ({
    audioBuffer = null,
    duration = null,
    format = 'wav',
    sampleRate = 44100,
    bitDepth = 16,
    channels = 2,
    settings = {},
    onPlay = null,
    onPause = null,
    onSeek = null
}) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const animationFrameRef = useRef(null);

    // Calculate estimated file size
    const estimatedSize = useMemo(() => {
        const dur = duration || (audioBuffer ? audioBuffer.duration : 0);
        return estimateFileSize(dur, format, sampleRate, bitDepth, channels);
    }, [duration, audioBuffer, format, sampleRate, bitDepth, channels]);

    // Get actual duration
    const actualDuration = useMemo(() => {
        return duration || (audioBuffer ? audioBuffer.duration : 0);
    }, [duration, audioBuffer]);

    // Handle canvas resize
    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const updateDimensions = () => {
            const rect = container.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            canvas.style.width = `${rect.width}px`;
            canvas.style.height = `${rect.height}px`;
            drawWaveform(canvas, audioBuffer, currentTime, isPlaying);
        };

        updateDimensions();
        const observer = new ResizeObserver(updateDimensions);
        observer.observe(container);

        return () => observer.disconnect();
    }, [audioBuffer, currentTime, isPlaying]);

    // Draw waveform
    useEffect(() => {
        if (audioBuffer && canvasRef.current) {
            drawWaveform(canvasRef.current, audioBuffer, currentTime, isPlaying);
        }
    }, [audioBuffer, currentTime, isPlaying]);

    // Animation loop for playback
    useEffect(() => {
        if (isPlaying && audioBuffer) {
            const startTime = performance.now() - (currentTime * 1000);
            const animate = () => {
                const elapsed = (performance.now() - startTime) / 1000;
                if (elapsed >= audioBuffer.duration) {
                    setCurrentTime(audioBuffer.duration);
                    setIsPlaying(false);
                    if (onPause) onPause();
                } else {
                    setCurrentTime(elapsed);
                    animationFrameRef.current = requestAnimationFrame(animate);
                }
            };
            animationFrameRef.current = requestAnimationFrame(animate);
        } else {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        }

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isPlaying, audioBuffer, onPause]);

    // Handle play/pause
    const handlePlayPause = useCallback(() => {
        if (isPlaying) {
            setIsPlaying(false);
            if (onPause) onPause();
        } else {
            setIsPlaying(true);
            if (onPlay) onPlay();
        }
    }, [isPlaying, onPlay, onPause]);

    // Handle seek
    const handleSeek = useCallback((e) => {
        if (!audioBuffer || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const progress = Math.max(0, Math.min(1, x / rect.width));
        const newTime = progress * audioBuffer.duration;
        setCurrentTime(newTime);
        if (onSeek) onSeek(newTime);
    }, [audioBuffer, onSeek]);

    const hasPreview = !!audioBuffer;

    return (
        <div className="export-preview">
            <div className="export-preview-header">
                <h4>
                    <Info size={16} />
                    Export Preview
                </h4>
            </div>

            {hasPreview ? (
                <>
                    {/* Waveform Preview */}
                    <div className="export-preview-waveform-container">
                        <div
                            ref={containerRef}
                            className="export-preview-waveform"
                            onClick={handleSeek}
                            style={{ cursor: 'pointer' }}
                        >
                            <canvas ref={canvasRef} />
                        </div>
                        <div className="export-preview-controls">
                            <button
                                className="export-preview-play-btn"
                                onClick={handlePlayPause}
                                title={isPlaying ? 'Pause' : 'Play'}
                            >
                                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                            </button>
                            <span className="export-preview-time">
                                {formatDuration(currentTime)} / {formatDuration(actualDuration)}
                            </span>
                        </div>
                    </div>
                </>
            ) : (
                <div className="export-preview-placeholder">
                    <Volume2 size={32} />
                    <p>No preview available</p>
                    <small>Preview will appear after export</small>
                </div>
            )}

            {/* Export Info */}
            <div className="export-preview-info">
                <div className="export-preview-info-item">
                    <Clock size={14} />
                    <span className="label">Duration:</span>
                    <span className="value">{formatDuration(actualDuration)}</span>
                </div>
                <div className="export-preview-info-item">
                    <HardDrive size={14} />
                    <span className="label">Est. Size:</span>
                    <span className="value">{formatFileSize(estimatedSize)}</span>
                </div>
                <div className="export-preview-info-item">
                    <Gauge size={14} />
                    <span className="label">Format:</span>
                    <span className="value">
                        {formatExportFormat(format)}
                        {sampleRate && ` / ${formatSampleRate(sampleRate)}`}
                        {bitDepth && ` / ${formatBitDepth(bitDepth)}`}
                    </span>
                </div>
                {settings.includeEffects !== undefined && (
                    <div className="export-preview-info-item">
                        <File size={14} />
                        <span className="label">Effects:</span>
                        <span className="value">{settings.includeEffects ? 'Included' : 'Excluded'}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExportPreview;








