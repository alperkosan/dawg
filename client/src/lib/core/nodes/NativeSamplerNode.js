// src/lib/core/nodes/NativeSamplerNode.js - TONE.JS BAĞIMLILIĞI KALDIRILDI VE DÜZELTME

import { NativeTimeUtils } from '../../utils/NativeTimeUtils';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { EffectFactory } from '../../audio/effects';

export class NativeSamplerNode {
    constructor(instrumentData, audioBuffer, audioContext) {
        this.id = instrumentData.id;
        this.name = instrumentData.name;
        this.buffer = audioBuffer;
        this.context = audioContext;
        this.pianoRoll = instrumentData.pianoRoll;
        this.cutItself = instrumentData.cutItself;
        this.pitchOffset = instrumentData.pitchOffset || 0;

        // ✅ NEW: Effect chain support
        this.effectChain = [];
        this.effectChainActive = false;
        this.internalOutput = this.context.createGain(); // Direct audio output
        this.output = this.internalOutput; // Public output (may be last effect or internalOutput)

        this.activeSources = new Set();

        // ✅ NEW: Initialize effect chain if provided
        if (instrumentData.effectChain && instrumentData.effectChain.length > 0) {
            this.setEffectChain(instrumentData.effectChain);
        }

        console.log(`✅ NativeSamplerNode created: ${this.name}`);
    }

    triggerNote(pitch, velocity, time, duration) {
        const startTime = time || this.context.currentTime;

        // ✅ DÜZELTME: cutItself özelliği
        if (this.cutItself) {
            this.stopAll(startTime);
        }

        const source = this.context.createBufferSource();
        source.buffer = this.buffer;

        // ✅ DÜZELTME: PianoRoll pitch handling
        if (this.pianoRoll) {
            const midiNoteC4 = 60;
            // Pitch'in tanımsız olma ihtimaline karşı 'C4' varsayılanı ekleniyor.
            const targetMidi = this.pitchToMidi(pitch || 'C4');
            let semitoneShift = targetMidi - midiNoteC4;

            // Add pitch offset if set
            if (this.pitchOffset) {
                semitoneShift += this.pitchOffset;
            }

            // playbackRate'in her zaman geçerli bir sayı olmasını garantiliyoruz.
            source.playbackRate.setValueAtTime(Math.pow(2, semitoneShift / 12), startTime);
        }

        const gainNode = this.context.createGain();
        gainNode.gain.setValueAtTime(velocity || 0.8, startTime);

        source.connect(gainNode);
        gainNode.connect(this.internalOutput); // ✅ Changed to internalOutput (effect chain start)

        source.start(startTime);
        
        // ✅ DÜZELTME: Duration handling with Native Time Utils
        if (duration) {
            try {
                // Güncel BPM'i store'dan alıyoruz.
                const currentBpm = usePlaybackStore.getState().bpm;
                // `Tone.Time` yerine kendi `NativeTimeUtils` aracımızı kullanıyoruz.
                const durationInSeconds = NativeTimeUtils.parseTime(duration, currentBpm);
                
                if (isFinite(durationInSeconds) && durationInSeconds > 0) {
                    source.stop(startTime + durationInSeconds);
                }
            } catch (e) { 
                console.warn(`[NativeSamplerNode] Geçersiz süre formatı: ${duration}`, e);
                // Default 1 saniye duration
                source.stop(startTime + 1);
            }
        }

        this.activeSources.add(source);

        source.onended = () => {
            this.activeSources.delete(source);
            gainNode.disconnect();
            source.disconnect();
        };
    }

    // ✅ DÜZELTME: Anında susturma yeteneği
    stopAll(time = 0) {
        const stopTime = time || this.context.currentTime;
        console.log(`🛑 Stopping all samples: ${this.name} (${this.activeSources.size} active)`);
        
        this.activeSources.forEach(source => {
            try {
                source.stop(stopTime);
            } catch(e) { 
                // Zaten durmuş olabilir, hatayı yoksay
            }
        });
        this.activeSources.clear();
    }

    // ✅ DÜZELTME: Pitch to MIDI conversion
    pitchToMidi(pitch) {
        // Eğer pitch null veya undefined ise, hemen varsayılan değeri döndür.
        if (!pitch) return 60; 

        const noteNames = { 
            C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 
            'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 
        };
        
        const match = pitch.match(/([A-G]#?)(-?\d+)/);
        if (!match) {
            console.warn(`Invalid pitch format: ${pitch}, using C4`);
            return 60;
        }
        
        const noteName = match[1];
        const octave = parseInt(match[2], 10);
        const noteValue = noteNames[noteName];

        // Eğer nota ismi haritada bulunamazsa, tanımsız değerle hesaplama yapmasını engelle.
        if (noteValue === undefined) {
            console.warn(`Unknown note name: ${noteName}, using C4`);
            return 60;
        }

        const midiNumber = (octave + 1) * 12 + noteValue;
        return Math.max(0, Math.min(127, midiNumber)); // MIDI range clamping
    }

    // Sample için releaseNote boş (trigger-based playback)
    releaseNote() {
        // Samples are usually trigger-based, no release needed
    }

    // ✅ EKLENEN: Dispose metodu
    dispose() {
        this.stopAll();
        if (this.output) {
            this.output.disconnect();
        }
        console.log(`🗑️ NativeSamplerNode disposed: ${this.name}`);
    }

    // ✅ EKLENEN: Voice count for debugging
    getActiveVoiceCount() {
        return this.activeSources.size;
    }

    // ✅ EKLENEN: Parameter update for real-time control
    updateParameters(params) {
        console.log(`🎛️ NativeSamplerNode.updateParameters:`, this.name, params);

        if (params.volume !== undefined) {
            // Update main volume
            if (this.output) {
                const linearValue = this.dbToLinear(params.volume);
                this.output.gain.setTargetAtTime(linearValue, this.context.currentTime, 0.02);
                console.log(`🔊 Updated sampler volume: ${params.volume}dB → ${linearValue.toFixed(3)}`);
            }
        }

        if (params.pitchOffset !== undefined) {
            // Store pitch offset for new notes (can't change existing notes)
            this.pitchOffset = params.pitchOffset;
            console.log(`🎵 Updated sampler pitch offset: ${params.pitchOffset} semitones`);
        }

        if (params.cutItself !== undefined) {
            this.cutItself = params.cutItself;
            console.log(`✂️ Updated cutItself: ${params.cutItself}`);
        }
    }

    // ✅ UTILITY: Convert dB to linear
    dbToLinear(db) {
        return Math.pow(10, db / 20);
    }

    // ✅ NEW: Set or update effect chain
    setEffectChain(effectChainData) {
        console.log(`🎛️ NativeSamplerNode.setEffectChain:`, this.name, effectChainData);

        // Disconnect old effect chain
        if (this.effectChain.length > 0) {
            this.effectChain.forEach(effect => {
                try {
                    effect.disconnect();
                } catch (e) {
                    console.warn('Error disconnecting effect:', e);
                }
            });
            this.effectChain = [];
        }

        // Reset to direct connection
        this.internalOutput.disconnect();

        if (!effectChainData || effectChainData.length === 0) {
            // No effects, connect directly to output
            this.output = this.internalOutput;
            this.effectChainActive = false;
            return;
        }

        // Build effect chain
        let currentNode = this.internalOutput;

        for (const effectData of effectChainData) {
            try {
                const effect = EffectFactory.deserialize(effectData, this.context);
                if (!effect) {
                    console.warn(`Failed to create effect: ${effectData.type}`);
                    continue;
                }

                // Connect current node to effect input
                currentNode.connect(effect.inputNode);
                currentNode = effect.outputNode;

                this.effectChain.push(effect);
                console.log(`🎛️ Added effect: ${effect.name} (${effect.type})`);
            } catch (error) {
                console.error(`Error creating effect ${effectData.type}:`, error);
            }
        }

        // Final output is the last effect's output
        this.output = currentNode;
        this.effectChainActive = true;
        console.log(`✅ Effect chain set for ${this.name}: ${this.effectChain.length} effects`);
    }
}