/**
 * PerformanceOverlay - Real-time Performance Monitor UI
 *
 * Shows live performance metrics:
 * - CPU usage
 * - Memory usage
 * - Active voices/grains
 * - Warnings and tips
 *
 * Toggle with: Ctrl+Shift+P
 */

import { useState, useEffect } from 'react';
import EventBus from '@/lib/core/EventBus';
import './PerformanceOverlay.css';

export function PerformanceOverlay({ performanceMonitor }) {
    const [visible, setVisible] = useState(false);
    const [metrics, setMetrics] = useState(null);
    const [warnings, setWarnings] = useState([]);

    // Listen for performance updates
    useEffect(() => {
        const handleUpdate = (newMetrics) => {
            setMetrics(newMetrics);
        };

        const handleWarnings = (newWarnings) => {
            setWarnings(newWarnings);
        };

        EventBus.on('PERFORMANCE_UPDATE', handleUpdate);
        EventBus.on('PERFORMANCE_WARNING', handleWarnings);

        return () => {
            EventBus.off('PERFORMANCE_UPDATE', handleUpdate);
            EventBus.off('PERFORMANCE_WARNING', handleWarnings);
        };
    }, []);

    // Keyboard shortcut: Ctrl+Shift+P
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'P') {
                e.preventDefault();
                setVisible(v => !v);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    if (!visible || !metrics) {
        return null;
    }

    // Get status classes
    const cpuStatus = getCPUStatus(metrics.cpuUsage);
    const memoryStatus = getMemoryStatus(metrics.memoryPercent);

    return (
        <div className="performance-overlay">
            <div className="performance-overlay__header">
                <h3>Performance Monitor</h3>
                <button
                    className="performance-overlay__close"
                    onClick={() => setVisible(false)}
                    title="Close (Ctrl+Shift+P)"
                >
                    ×
                </button>
            </div>

            <div className="performance-overlay__content">
                {/* CPU */}
                <div className="performance-metric">
                    <div className="performance-metric__label">CPU</div>
                    <div className="performance-metric__value">
                        <div className={`performance-bar performance-bar--${cpuStatus}`}>
                            <div
                                className="performance-bar__fill"
                                style={{ width: `${Math.min(metrics.cpuUsage, 100)}%` }}
                            />
                            <span className="performance-bar__text">
                                {metrics.cpuUsage.toFixed(0)}%
                            </span>
                        </div>
                    </div>
                    <div className="performance-metric__info">
                        Avg: {metrics.cpuAverage.toFixed(0)}% | Peak: {metrics.cpuPeak.toFixed(0)}%
                    </div>
                </div>

                {/* Memory */}
                <div className="performance-metric">
                    <div className="performance-metric__label">Memory</div>
                    <div className="performance-metric__value">
                        <div className={`performance-bar performance-bar--${memoryStatus}`}>
                            <div
                                className="performance-bar__fill"
                                style={{ width: `${Math.min(metrics.memoryPercent, 100)}%` }}
                            />
                            <span className="performance-bar__text">
                                {metrics.memoryUsed}MB / {metrics.memoryTotal}MB
                            </span>
                        </div>
                    </div>
                </div>

                {/* Activity */}
                <div className="performance-stats">
                    <div className="performance-stat">
                        <span className="performance-stat__label">Voices</span>
                        <span className="performance-stat__value">
                            {metrics.activeVoices} / {metrics.maxVoices}
                        </span>
                    </div>
                    <div className="performance-stat">
                        <span className="performance-stat__label">Instruments</span>
                        <span className="performance-stat__value">{metrics.activeInstruments}</span>
                    </div>
                    <div className="performance-stat">
                        <span className="performance-stat__label">Effects</span>
                        <span className="performance-stat__value">
                            {metrics.activeEffects} active
                        </span>
                    </div>
                </div>

                {/* Audio Info */}
                <div className="performance-audio">
                    <div className="performance-audio__item">
                        Latency: {metrics.audioLatency.toFixed(1)}ms
                    </div>
                    <div className="performance-audio__item">
                        Sample Rate: {(metrics.sampleRate / 1000).toFixed(0)}kHz
                    </div>
                    <div className="performance-audio__item">
                        Buffer: {metrics.bufferSize} samples
                    </div>
                </div>

                {/* Scheduler */}
                {metrics.scheduler && (
                    <div className="performance-scheduler">
                        <div className="performance-scheduler__header">
                            <span>Scheduler</span>
                            <span>
                                {metrics.scheduler.lastDurationMs?.toFixed
                                    ? metrics.scheduler.lastDurationMs.toFixed(2)
                                    : metrics.scheduler.lastDurationMs || 0} ms
                            </span>
                        </div>
                        <div className="performance-scheduler__grid">
                            <div>
                                <span className="performance-scheduler__label">Scope</span>
                                <span className="performance-scheduler__value">{metrics.scheduler.lastScope}</span>
                            </div>
                            <div>
                                <span className="performance-scheduler__label">Priority</span>
                                <span className="performance-scheduler__value">{metrics.scheduler.lastPriority}</span>
                            </div>
                            <div>
                                <span className="performance-scheduler__label">Dirty Instruments</span>
                                <span className="performance-scheduler__value">{metrics.scheduler.dirtyInstrumentCount}</span>
                            </div>
                            <div>
                                <span className="performance-scheduler__label">Notes Scheduled</span>
                                <span className="performance-scheduler__value">{metrics.scheduler.scheduledNotes}</span>
                            </div>
                            <div>
                                <span className="performance-scheduler__label">Avg Duration</span>
                                <span className="performance-scheduler__value">
                                    {metrics.scheduler.avgDurationMs?.toFixed
                                        ? metrics.scheduler.avgDurationMs.toFixed(2)
                                        : metrics.scheduler.avgDurationMs || 0} ms
                                </span>
                            </div>
                            <div>
                                <span className="performance-scheduler__label">Queue Size</span>
                                <span className="performance-scheduler__value">{metrics.scheduler.queueSize}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Warnings */}
                {warnings.length > 0 && (
                    <div className="performance-warnings">
                        {warnings.map((warning, index) => (
                            <div
                                key={index}
                                className={`performance-warning performance-warning--${warning.level}`}
                            >
                                <div className="performance-warning__icon">
                                    {warning.level === 'critical' ? '🔴' : '⚠️'}
                                </div>
                                <div className="performance-warning__content">
                                    <div className="performance-warning__message">
                                        {warning.message}
                                    </div>
                                    <div className="performance-warning__tip">
                                        💡 {warning.tip}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Session Info */}
                <div className="performance-footer">
                    Session: {formatDuration(metrics.sessionDuration)}
                </div>
            </div>

            <div className="performance-overlay__hint">
                Press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> to toggle
            </div>
        </div>
    );
}

// Helper functions
function getCPUStatus(cpu) {
    if (cpu >= 85) return 'critical';
    if (cpu >= 70) return 'warning';
    return 'good';
}

function getMemoryStatus(memory) {
    if (memory >= 85) return 'critical';
    if (memory >= 70) return 'warning';
    return 'good';
}

function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
