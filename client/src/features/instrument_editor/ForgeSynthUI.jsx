import React from 'react';
import { ProfessionalKnob } from '../../ui/plugin_system/PluginControls';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import * as Tone from 'tone';
import { SignalVisualizer } from '../../ui/SignalVisualizer';

// === YENİ: MODÜLASYON MATRİSİ ARAYÜZ BİLEŞENİ ===
const ModulationMatrix = ({ modMatrix, instrument }) => {
    const sources = [{ value: 'none', label: 'Kapalı'}, { value: 'lfo1', label: 'LFO 1'}, { value: 'lfo2', label: 'LFO 2'}];
    const destinations = [
        { value: 'none', label: 'Atanmamış' },
        { value: 'filterFreq', label: 'Filtre Frekansı' },
        { value: 'filterQ', label: 'Filtre Rezonans' },
        { value: 'oscPitch', label: 'Osilatör Perde' },
        { value: 'pan', label: 'Pan' },
    ];

    const handleMatrixChange = (index, param, value) => {
        const { updateInstrument } = useInstrumentsStore.getState();
        const newMatrix = [...instrument.synthParams.modMatrix];
        newMatrix[index] = { ...newMatrix[index], [param]: value };
        updateInstrument(instrument.id, { synthParams: { ...instrument.synthParams, modMatrix: newMatrix } });
    };

    return (
        <div className="synth-module synth-module--matrix">
            <h3 className="synth-module__title">MODULATION MATRIX</h3>
            <div className="mod-matrix-slots">
                {modMatrix.map((slot, index) => (
                    <div key={slot.id} className="mod-matrix-slot">
                        <select value={slot.source} onChange={(e) => handleMatrixChange(index, 'source', e.target.value)} className="mod-matrix__select">
                            {sources.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                        <span className="mod-matrix__arrow">→</span>
                        <select value={slot.destination} onChange={(e) => handleMatrixChange(index, 'destination', e.target.value)} className="mod-matrix__select">
                            {destinations.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                        </select>
                        <div className="mod-matrix__amount">
                            <ProfessionalKnob value={slot.amount} onChange={(v) => handleMatrixChange(index, 'amount', v)} min={-1} max={1} defaultValue={0} precision={2} size={40} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


// Mevcut bileşenler ve ana bileşen güncellendi
export const ForgeSynthUI = ({ instrument }) => {
    if (!instrument || instrument.type !== 'synth' || !instrument.synthParams) {
        return <div className="p-4 text-center">Geçerli bir synth enstrümanı değil.</div>;
    }
    
    const handleParamChange = (paramPath, value) => {
        const { updateInstrument } = useInstrumentsStore.getState();
        const keys = paramPath.split('.');
        const newSynthParams = { ...instrument.synthParams };
        let current = newSynthParams;
        for (let i = 0; i < keys.length - 1; i++) {
            current = current[keys[i]] = { ...current[keys[i]] };
        }
        current[keys[keys.length - 1]] = value;
        updateInstrument(instrument.id, { synthParams: newSynthParams });
    };

    const { oscillator, envelope, filter, lfo1, lfo2, modMatrix } = instrument.synthParams;

    return (
        <div className="forge-synth-container forge-synth-container--v2">
            <header className="forge-synth-header">
                <div className="forge-synth-header__logo">FS-1</div>
                <div>
                    <h2 className="forge-synth-header__title">ForgeSynth</h2>
                    <p className="forge-synth-header__subtitle">Modular Synthesizer</p>
                </div>
            </header>

            {/* ANA KONTROL ALANI - ARTIK KAYDIRILABİLİR */}
            <main className="forge-synth-main forge-synth-main--v2">
                
                {/* --- 1. SATIR: Kaynak, Filtre ve Görselleştirme --- */}
                <div className="synth-row">
                    <div className="synth-module synth-module--source-filter">
                        <h3 className="synth-module__title">SOURCE & FILTER</h3>
                        <div className="synth-module__knob-group justify-around">
                             <div className="synth-module__control">
                                <label className="synth-module__label">Waveform</label>
                                <select value={oscillator.type} onChange={(e) => handleParamChange('oscillator.type', e.target.value)} className="synth-module__select">
                                   <option value="fatsawtooth">Fat Saw</option><option value="fatsquare">Fat Square</option><option value="fattriangle">Fat Triangle</option><option value="sawtooth">Sawtooth</option><option value="square">Square</option><option value="triangle">Triangle</option><option value="sine">Sine</option>
                                </select>
                            </div>
                            <ProfessionalKnob label="Cutoff" value={filter.frequency} onChange={v => handleParamChange('filter.frequency', v)} min={20} max={15000} defaultValue={3000} unit="Hz" precision={0} size={56} logarithmic />
                            <ProfessionalKnob label="Resonance" value={filter.Q} onChange={v => handleParamChange('filter.Q', v)} min={0.1} max={10} defaultValue={1} precision={2} size={56} />
                        </div>
                    </div>
                    <div className="synth-module synth-module--visualizer">
                         <SignalVisualizer meterId={`${instrument.mixerTrackId}-waveform`} type="scope" color="var(--color-accent-secondary)" config={{ lineWidth: 1.5, showBackground: false }}/>
                    </div>
                </div>

                {/* --- 2. SATIR: Zarf (ADSR) --- */}
                <div className="synth-module">
                     <h3 className="synth-module__title">AMP ENVELOPE</h3>
                    <div className="synth-module__knob-group">
                        <ProfessionalKnob label="Attack" value={envelope.attack} onChange={v => handleParamChange('envelope.attack', v)} min={0.005} max={2} unit="s" precision={3} size={56} />
                        <ProfessionalKnob label="Decay" value={envelope.decay} onChange={v => handleParamChange('envelope.decay', v)} min={0.01} max={2} unit="s" precision={2} size={56} />
                        <ProfessionalKnob label="Sustain" value={envelope.sustain} onChange={v => handleParamChange('envelope.sustain', v)} min={0} max={1} precision={2} size={56} />
                        <ProfessionalKnob label="Release" value={envelope.release} onChange={v => handleParamChange('envelope.release', v)} min={0.01} max={5} unit="s" precision={2} size={56} />
                    </div>
                </div>

                {/* --- 3. SATIR: LFO'lar --- */}
                <div className="synth-row">
                    <div className="synth-module">
                         <h3 className="synth-module__title">LFO 1</h3>
                        <div className="synth-module__knob-group--small">
                            <ProfessionalKnob label="Rate" value={Tone.Time(lfo1.frequency).toFrequency()} onChange={v => handleParamChange('lfo1.frequency', `${v}n`)} min={1} max={32} unit="n" size={56} />
                            <ProfessionalKnob label="Depth" value={lfo1.amplitude} onChange={v => handleParamChange('lfo1.amplitude', v)} min={0} max={1} size={56} />
                        </div>
                    </div>
                    <div className="synth-module">
                         <h3 className="synth-module__title">LFO 2</h3>
                        <div className="synth-module__knob-group--small">
                            <ProfessionalKnob label="Rate" value={Tone.Time(lfo2.frequency).toFrequency()} onChange={v => handleParamChange('lfo2.frequency', `${v}n`)} min={1} max={32} unit="n" size={56} />
                            <ProfessionalKnob label="Depth" value={lfo2.amplitude} onChange={v => handleParamChange('lfo2.amplitude', v)} min={0} max={1} size={56} />
                        </div>
                    </div>
                </div>

                {/* --- 4. SATIR: Modülasyon Matrisi --- */}
                <ModulationMatrix modMatrix={modMatrix} instrument={instrument} />
            </main>
        </div>
    );
};