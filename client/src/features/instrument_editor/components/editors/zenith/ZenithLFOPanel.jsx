/**
 * ZenithLFOPanel - 4 LFO Control Panel
 * 
 * Features:
 * - 4 independent LFOs
 * - Waveform selection
 * - Rate control (Hz or tempo-synced)
 * - Depth control
 * - Tempo sync toggle
 * - Visual waveform display
 */

import React, { useCallback } from 'react';
import { ZenithKnob } from './ZenithKnob';
import './ZenithLFOPanel.css';

export const ZenithLFOPanel = ({ lfos = [], onChange }) => {
    const handleLFOChange = useCallback((lfoIndex, param, value) => {
        onChange?.(lfoIndex, param, value);
    }, [onChange]);

    const getWaveformIcon = (waveform) => {
        switch (waveform) {
            case 'sine': return '∿';
            case 'triangle': return '△';
            case 'sawtooth': return '⊿';
            case 'square': return '⊓';
            default: return '∿';
        }
    };

    const formatRate = (lfo) => {
        if (lfo.tempoSync) {
            const divisions = ['1/64', '1/32', '1/16', '1/8', '1/4', '1/2', '1', '2', '4'];
            const index = Math.round((lfo.rate / 20) * (divisions.length - 1));
            return divisions[Math.max(0, Math.min(divisions.length - 1, index))];
        }
        return `${lfo.rate.toFixed(2)} Hz`;
    };

    return (
        <div className="zenith-lfo-panel">
            <div className="zenith-lfo-panel__header">
                <span className="zenith-lfo-panel__icon">🌊</span>
                <span className="zenith-lfo-panel__title">LFOs</span>
            </div>

            <div className="zenith-lfo-panel__lfos">
                {lfos.map((lfo, index) => (
                    <div key={index} className="zenith-lfo">
                        <div className="zenith-lfo__header">
                            <span className="zenith-lfo__name">LFO {index + 1}</span>
                            <label className="zenith-lfo__sync">
                                <input
                                    type="checkbox"
                                    checked={lfo.tempoSync || false}
                                    onChange={(e) => handleLFOChange(index, 'tempoSync', e.target.checked)}
                                />
                                <span>Sync</span>
                            </label>
                        </div>

                        {/* Waveform Display */}
                        <div className="zenith-lfo__waveform-display">
                            <canvas
                                className="zenith-lfo__canvas"
                                width="120"
                                height="40"
                                ref={(canvas) => {
                                    if (canvas) {
                                        const ctx = canvas.getContext('2d');
                                        ctx.clearRect(0, 0, 120, 40);

                                        // Draw waveform
                                        ctx.strokeStyle = '#00d9ff';
                                        ctx.lineWidth = 2;
                                        ctx.beginPath();

                                        const points = 120;
                                        for (let i = 0; i < points; i++) {
                                            const x = i;
                                            const t = i / points;
                                            let y = 20;

                                            switch (lfo.waveform) {
                                                case 'sine':
                                                    y = 20 + Math.sin(t * Math.PI * 2) * 15;
                                                    break;
                                                case 'triangle':
                                                    y = 20 + (Math.abs((t * 2) % 2 - 1) * 2 - 1) * 15;
                                                    break;
                                                case 'sawtooth':
                                                    y = 20 + ((t % 1) * 2 - 1) * 15;
                                                    break;
                                                case 'square':
                                                    y = 20 + (t % 1 < 0.5 ? -15 : 15);
                                                    break;
                                            }

                                            if (i === 0) {
                                                ctx.moveTo(x, y);
                                            } else {
                                                ctx.lineTo(x, y);
                                            }
                                        }

                                        ctx.stroke();
                                    }
                                }}
                            />
                        </div>

                        {/* Waveform Selector */}
                        <div className="zenith-lfo__waveform-selector">
                            {['sine', 'triangle', 'sawtooth', 'square'].map((waveform) => (
                                <button
                                    key={waveform}
                                    className={`zenith-lfo__waveform-btn ${lfo.waveform === waveform ? 'zenith-lfo__waveform-btn--active' : ''}`}
                                    onClick={() => handleLFOChange(index, 'waveform', waveform)}
                                    title={waveform}
                                >
                                    {getWaveformIcon(waveform)}
                                </button>
                            ))}
                        </div>

                        {/* Controls */}
                        <div className="zenith-lfo__controls">
                            <ZenithKnob
                                label="Rate"
                                value={lfo.rate || 1}
                                min={0.01}
                                max={20}
                                size={55}
                                color="#00d9ff"
                                valueFormatter={() => formatRate(lfo)}
                                onChange={(value) => handleLFOChange(index, 'rate', value)}
                            />
                            <ZenithKnob
                                label="Depth"
                                value={lfo.depth || 0}
                                min={0}
                                max={1}
                                size={55}
                                color="#00d9ff"
                                valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                                onChange={(value) => handleLFOChange(index, 'depth', value)}
                            />
                            <ZenithKnob
                                label="Phase"
                                value={lfo.phase || 0}
                                min={0}
                                max={360}
                                size={55}
                                color="#00d9ff"
                                valueFormatter={(v) => `${Math.round(v)}°`}
                                onChange={(value) => handleLFOChange(index, 'phase', value)}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
