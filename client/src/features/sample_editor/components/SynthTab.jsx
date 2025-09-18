import React from 'react';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { ProfessionalKnob } from '../../ui/plugin_system/PluginControls';

const OSCILLATOR_TYPES = ['sine', 'square', 'sawtooth', 'triangle', 'fmsine', 'amsquare'];

const SynthTab = ({ instrument }) => {
    const { handleInstrumentSynthParamChange } = useInstrumentsStore.getState();
    const synthParams = instrument.synthParams || {};
    const oscillator = synthParams.oscillator || {};
    const envelope = synthParams.envelope || {};

    const handleParamChange = (paramPath, value) => {
        handleInstrumentSynthParamChange(instrument.id, paramPath, value);
    };

    return (
        <div className="w-full h-full flex p-4 gap-4 bg-[var(--color-surface)]">
            <div className="w-64 shrink-0 flex flex-col gap-4 bg-[var(--color-background)] rounded-lg p-4">
                <div>
                    <h3 className="text-center font-bold uppercase text-xs text-[var(--color-muted)] mb-2">Osilatör</h3>
                    <select
                        value={oscillator.type || 'sawtooth'}
                        onChange={(e) => handleParamChange('oscillator.type', e.target.value)}
                        className="w-full bg-[var(--color-surface2)] text-white rounded px-3 py-2 text-sm border border-[var(--color-border)]"
                    >
                        {OSCILLATOR_TYPES.map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                </div>
                <div className="w-full h-[1px] bg-[var(--color-border)]" />
                <div>
                    <h3 className="text-center font-bold uppercase text-xs text-[var(--color-muted)] mb-2">Volume Envelope</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <ProfessionalKnob label="Attack" value={envelope.attack} onChange={(v) => handleParamChange('envelope.attack', v)} min={0.001} max={2} defaultValue={0.02} size={60} unit="s" precision={3}/>
                        <ProfessionalKnob label="Decay" value={envelope.decay} onChange={(v) => handleParamChange('envelope.decay', v)} min={0.001} max={2} defaultValue={0.1} size={60} unit="s" precision={3}/>
                        <ProfessionalKnob label="Sustain" value={envelope.sustain} onChange={(v) => handleParamChange('envelope.sustain', v)} min={0} max={1} defaultValue={0.3} size={60} unit="%" displayMultiplier={100} precision={0}/>
                        <ProfessionalKnob label="Release" value={envelope.release} onChange={(v) => handleParamChange('envelope.release', v)} min={0.001} max={5} defaultValue={0.8} size={60} unit="s" precision={3}/>
                    </div>
                </div>
            </div>
            <div className="flex-grow rounded-lg flex items-center justify-center bg-[var(--color-background)]">
                <p className="text-[var(--color-muted)]">Filtre & LFO (Çok Yakında)</p>
            </div>
        </div>
    );
};

export default SynthTab;