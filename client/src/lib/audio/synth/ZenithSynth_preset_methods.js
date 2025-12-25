/**
 * Export current synth settings as JSON preset
 * @returns {Object} Preset data object
 */
exportPreset() {
    return {
        oscillators: this.oscillatorSettings.map(osc => ({ ...osc })),
        filter: { ...this.filterSettings },
        filterEnvelope: {
            delay: this.filterEnvelope.delay,
            attack: this.filterEnvelope.attack,
            hold: this.filterEnvelope.hold,
            decay: this.filterEnvelope.decay,
            sustain: this.filterEnvelope.sustain,
            release: this.filterEnvelope.release,
            velocitySensitivity: this.filterEnvelope.velocitySensitivity
        },
        amplitudeEnvelope: {
            delay: this.amplitudeEnvelope.delay,
            attack: this.amplitudeEnvelope.attack,
            hold: this.amplitudeEnvelope.hold,
            decay: this.amplitudeEnvelope.decay,
            sustain: this.amplitudeEnvelope.sustain,
            release: this.amplitudeEnvelope.release,
            velocitySensitivity: this.amplitudeEnvelope.velocitySensitivity
        },
        lfos: this.lfos.map(lfo => ({
            waveform: lfo.waveform,
            rate: lfo.rate,
            depth: lfo.depth,
            tempoSync: lfo.tempoSync,
            syncValue: lfo.syncValue
        })),
        modulation: this.modulationEngine.slots.map(slot => ({
            enabled: slot.enabled,
            source: slot.source,
            destination: slot.destination,
            amount: slot.amount,
            curve: slot.curve
        })),
        voiceMode: this.voiceMode,
        portamento: this.portamento,
        legato: this.legato,
        masterVolume: this.masterVolume
    };
}

/**
 * Import preset data and apply to synth
 * @param {Object} presetData - Preset data object
 */
importPreset(presetData) {
    if (!presetData) return;

    // Apply oscillators
    if (presetData.oscillators) {
        presetData.oscillators.forEach((osc, i) => {
            if (i < this.oscillatorSettings.length) {
                this.oscillatorSettings[i] = { ...osc };
            }
        });
    }

    // Apply filter
    if (presetData.filter) {
        this.filterSettings = { ...presetData.filter };
    }

    // Apply envelopes
    if (presetData.filterEnvelope) {
        Object.assign(this.filterEnvelope, presetData.filterEnvelope);
    }
    if (presetData.amplitudeEnvelope) {
        Object.assign(this.amplitudeEnvelope, presetData.amplitudeEnvelope);
    }

    // Apply LFOs
    if (presetData.lfos) {
        presetData.lfos.forEach((lfoData, i) => {
            if (i < this.lfos.length) {
                const lfo = this.lfos[i];
                lfo.waveform = lfoData.waveform || 'sine';
                lfo.rate = lfoData.rate || 1;
                lfo.depth = lfoData.depth || 0;
                lfo.tempoSync = lfoData.tempoSync !== undefined ? lfoData.tempoSync : false;
                lfo.syncValue = lfoData.syncValue || '1/4';
            }
        });
    }

    // Apply modulation
    if (presetData.modulation) {
        presetData.modulation.forEach((slotData, i) => {
            if (i < this.modulationEngine.slots.length) {
                const slot = this.modulationEngine.slots[i];
                slot.enabled = slotData.enabled !== undefined ? slotData.enabled : false;
                slot.source = slotData.source || null;
                slot.destination = slotData.destination || null;
                slot.amount = slotData.amount || 0;
                slot.curve = slotData.curve || 'linear';
            }
        });
    }

    // Apply voice settings
    if (presetData.voiceMode) this.voiceMode = presetData.voiceMode;
    if (presetData.portamento !== undefined) this.portamento = presetData.portamento;
    if (presetData.legato !== undefined) this.legato = presetData.legato;
    if (presetData.masterVolume !== undefined) {
        this.masterVolume = presetData.masterVolume;
        this.masterGain.gain.setValueAtTime(presetData.masterVolume, this.context.currentTime);
    }

    console.log('✅ ZenithSynth preset imported');
}
