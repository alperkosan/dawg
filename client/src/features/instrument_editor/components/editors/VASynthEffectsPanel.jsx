import React from 'react';
import { Knob } from '@/components/controls';
import './VASynthEditorV2.css';
import './vasynth_effects.css'; // Effects panel styles

const VASynthEffectsPanel = ({
    eq = {},
    chorus = {},
    delay = {},
    reverb = {},
    onParameterChange
}) => {
    return (
        <div className="vasynth-effects-panel">

            {/* EQ Section */}
            <div className="vasynth-effect-group">
                <div className="vasynth-effect-header">
                    <span className="vasynth-effect-title">EQ</span>
                </div>
                <div className="vasynth-effect-controls">
                    <Knob
                        label="Low"
                        value={eq.low || 0}
                        min={-12}
                        max={12}
                        sizeVariant="small"
                        color="#6B8EBF"
                        valueFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`}
                        onChange={(val) => onParameterChange('eq.low', val)}
                    />
                    <Knob
                        label="Mid"
                        value={eq.mid || 0}
                        min={-12}
                        max={12}
                        sizeVariant="small"
                        color="#6B8EBF"
                        valueFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`}
                        onChange={(val) => onParameterChange('eq.mid', val)}
                    />
                    <Knob
                        label="High"
                        value={eq.high || 0}
                        min={-12}
                        max={12}
                        sizeVariant="small"
                        color="#6B8EBF"
                        valueFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`}
                        onChange={(val) => onParameterChange('eq.high', val)}
                    />
                </div>
            </div>

            {/* Chorus Section */}
            <div className="vasynth-effect-group">
                <div className="vasynth-effect-header">
                    <span className="vasynth-effect-title">CHORUS</span>
                    <span className="vasynth-effect-status" style={{ opacity: (chorus.mix || 0) > 0 ? 1 : 0.3 }}>
                        {(chorus.mix || 0) > 0 ? 'ON' : 'OFF'}
                    </span>
                </div>
                <div className="vasynth-effect-controls">
                    <Knob
                        label="Rate"
                        value={chorus.rate || 1.5}
                        min={0.1}
                        max={10}
                        sizeVariant="small"
                        color="#9B59B6"
                        valueFormatter={(v) => `${v.toFixed(1)} Hz`}
                        onChange={(val) => onParameterChange('chorus.rate', val)}
                    />
                    <Knob
                        label="Depth"
                        value={chorus.depth || 0.002}
                        min={0}
                        max={0.01}
                        sizeVariant="small"
                        color="#9B59B6"
                        valueFormatter={(v) => `${(v * 1000).toFixed(1)} ms`}
                        onChange={(val) => onParameterChange('chorus.depth', val)}
                    />
                    <Knob
                        label="Mix"
                        value={chorus.mix || 0.0}
                        min={0}
                        max={1}
                        sizeVariant="small"
                        color="#9B59B6"
                        valueFormatter={(v) => `${(v * 100).toFixed(0)}% `}
                        onChange={(val) => onParameterChange('chorus.mix', val)}
                    />
                </div>
            </div>

            {/* Delay Section */}
            <div className="vasynth-effect-group">
                <div className="vasynth-effect-header">
                    <span className="vasynth-effect-title">DELAY</span>
                    <span className="vasynth-effect-status" style={{ opacity: (delay.wet || 0) > 0 ? 1 : 0.3 }}>
                        {(delay.wet || 0) > 0 ? 'ON' : 'OFF'}
                    </span>
                </div>
                <div className="vasynth-effect-controls">
                    <Knob
                        label="Time L"
                        value={delay.timeLeft || 0.375}
                        min={0.01}
                        max={2}
                        sizeVariant="small"
                        color="#F1C40F"
                        valueFormatter={(v) => `${(v * 1000).toFixed(0)} ms`}
                        onChange={(val) => onParameterChange('delay.timeLeft', val)}
                    />
                    <Knob
                        label="Feedback"
                        value={delay.feedback || 0.4}
                        min={0}
                        max={0.95}
                        sizeVariant="small"
                        color="#F1C40F"
                        valueFormatter={(v) => `${(v * 100).toFixed(0)}% `}
                        onChange={(val) => onParameterChange('delay.feedback', val)}
                    />
                    <Knob
                        label="Mix"
                        value={delay.wet || 0.0}
                        min={0}
                        max={1}
                        sizeVariant="small"
                        color="#F1C40F"
                        valueFormatter={(v) => `${(v * 100).toFixed(0)}% `}
                        onChange={(val) => onParameterChange('delay.wet', val)}
                    />
                </div>
            </div>

            {/* Reverb Section */}
            <div className="vasynth-effect-group">
                <div className="vasynth-effect-header">
                    <span className="vasynth-effect-title">REVERB</span>
                    <span className="vasynth-effect-status" style={{ opacity: (reverb.wet || 0) > 0 ? 1 : 0.3 }}>
                        {(reverb.wet || 0) > 0 ? 'ON' : 'OFF'}
                    </span>
                </div>
                <div className="vasynth-effect-controls">
                    <Knob
                        label="Size"
                        value={reverb.size || 0.5}
                        min={0.1}
                        max={1}
                        sizeVariant="small"
                        color="#2ECC71"
                        valueFormatter={(v) => `${(v * 100).toFixed(0)}% `}
                        onChange={(val) => onParameterChange('reverb.size', val)}
                    />
                    <Knob
                        label="Decay"
                        value={reverb.decay || 0.5}
                        min={0.1}
                        max={1}
                        sizeVariant="small"
                        color="#2ECC71"
                        valueFormatter={(v) => `${(v * 100).toFixed(0)}% `}
                        onChange={(val) => onParameterChange('reverb.decay', val)}
                    />
                    <Knob
                        label="Mix"
                        value={reverb.wet || 0.0}
                        min={0}
                        max={1}
                        sizeVariant="small"
                        color="#2ECC71"
                        valueFormatter={(v) => `${(v * 100).toFixed(0)}% `}
                        onChange={(val) => onParameterChange('reverb.wet', val)}
                    />
                </div>
            </div>

        </div>
    );
};

export default VASynthEffectsPanel;
