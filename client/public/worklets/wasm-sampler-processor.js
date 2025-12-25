// public/worklets/wasm-sampler-processor.js

// ✅ Polyfill for TextDecoder/TextEncoder in AudioWorklet (needed for Wasm Bindgen)
// Vercel/Some browsers don't have this in Worklet scope by default
if (typeof TextDecoder === 'undefined') {
    self.TextDecoder = class TextDecoder {
        decode(u8) {
            return String.fromCharCode.apply(null, u8);
        }
    };
    console.log('🔧 TextDecoder Polyfilled in WasmSamplerProcessor');
}

if (typeof TextEncoder === 'undefined') {
    self.TextEncoder = class TextEncoder {
        encode(str) {
            const arr = new Uint8Array(str.length);
            for (let i = 0; i < str.length; i++) {
                arr[i] = str.charCodeAt(i);
            }
            return arr;
        }
    };
}

import init, { Sampler } from '../wasm/dawg_audio_dsp.js';

class WasmSamplerProcessor extends AudioWorkletProcessor {
    constructor(options) {
        console.log('🔧 WasmSamplerProcessor created');
        super();
        this.sampleRate = globalThis.sampleRate || 44100;
        this.voices = [];
        this.pendingQueue = []; // ✅ Initialize queue
        this.sampleData = null;
        this.isInitialized = false;

        this.port.onmessage = async (event) => {
            // console.log('📩 WasmSamplerProcessor received:', event.data.type);
            const { type, data } = event.data;

            if (type === 'ping') {
                console.log('🏓 WasmSamplerProcessor received PING');
                this.port.postMessage({ type: 'pong' });
            } else if (type === 'init-wasm') {
                console.log('⚙️ Initializing Wasm in Processor...', data ? 'with Data' : 'NO DATA');
                if (data.wasmBytes) {
                    console.log(`⚙️ Compiling Wasm bytes in Worklet (${data.wasmBytes.byteLength})...`);
                    const module = await WebAssembly.compile(data.wasmBytes);
                    await this.initWasm(module);
                } else if (data.module) {
                    // Fallback if module is somehow passed
                    await this.initWasm(data.module);
                } else {
                    throw new Error('No wasmBytes or module received');
                }
            } else if (type === 'load-sample') {
                this.loadSample(data);
            } else if (this.isInitialized) {
                this.handleMessage(type, data);
            }
        };
    }

    async initWasm(module) {
        try {
            if (!module) throw new Error('No Wasm module provided to initWasm');
            // Initialize Wasm module using the compiled Module
            await init(module);
            this.Sampler = Sampler; // ✅ Store Class Reference
            console.log('✅ Wasm initialized in Worklet!');
            this.isInitialized = true;
            this.port.postMessage({ type: 'initialized' });
        } catch (error) {
            console.error('❌ Failed to initialize Wasm Sampler:', error);
            this.port.postMessage({ type: 'error', error: error.message });
        }
    }

    loadSample(samples) {
        // Store sample data for future voices
        this.sampleData = samples;
        // Clear existing voices
        this.voices = [];
        this.port.postMessage({ type: 'sample-loaded' });
    }


    handleMessage(type, data) {
        if (!this.sampleData) return;
        // this.pendingQueue = this.pendingQueue || []; 

        if (type === 'play') {
            // Check scheduling
            const now = currentTime;
            // console.log(`🎵 Play received. Time: ${data.startTime}, Now: ${now}`);

            if (data.startTime && data.startTime > now) {
                this.pendingQueue.push(data);
                this.pendingQueue.sort((a, b) => a.startTime - b.startTime);
            } else {
                this.playVoice(
                    data.speed,
                    data.velocity,
                    data.start,
                    data.end,
                    data.adsr,
                    data.filter,
                    data.bassBoost
                );
            }
        } else if (type === 'stop') {
            this.pendingQueue = [];
            this.stopAll();
        } else if (type === 'release') {
            this.releaseAll();
        } else if (type === 'update-params') {
            this.updateVoiceParams(data);
        } else if (type === 'dispose') {
            this.dispose();
        }
    }

    updateVoiceParams(data) {
        if (!this.voices || this.voices.length === 0) return;

        // Update ADSR for all active voices
        if (data.adsr) {
            const { attack, decay, sustain, release } = data.adsr;
            for (let i = 0; i < this.voices.length; i++) {
                const voice = this.voices[i];
                if (voice.active && voice.sampler && voice.sampler.set_adsr) {
                    voice.sampler.set_adsr(attack, decay, sustain, release);
                }
            }
        }

        // Update Trim Range for all active voices
        if (data.range) {
            const { start, end } = data.range;
            for (let i = 0; i < this.voices.length; i++) {
                const voice = this.voices[i];
                if (voice.active && voice.sampler && voice.sampler.set_range) {
                    voice.sampler.set_range(start, end);
                }
            }
        }

        // Update Filter for all active voices
        if (data.filter) {
            const { cutoff, q, type, enabled } = data.filter;
            for (let i = 0; i < this.voices.length; i++) {
                const voice = this.voices[i];
                if (voice.active && voice.sampler && voice.sampler.set_filter) {
                    voice.sampler.set_filter(cutoff, q, type, enabled);
                }
            }
        }
        // Update Bass Boost
        if (data.bassBoost !== undefined) {
            const boost = data.bassBoost;
            for (let i = 0; i < this.voices.length; i++) {
                const voice = this.voices[i];
                if (voice.active && voice.sampler && voice.sampler.set_bass_boost) {
                    voice.sampler.set_bass_boost(boost);
                }
            }
        }
    }

    playVoice(speed, velocity, start, end, adsr, filter, bassBoost) {
        if (!this.Sampler) {
            console.error('❌ Play ignored: Wasm Sampler class missing');
            return;
        }

        // Find a free voice or steal the oldest one
        if (this.voices.length > 32) {
            const stolen = this.voices.shift(); // Remove oldest
            if (stolen && stolen.sampler) stolen.sampler.free(); // Free WASM memory
        }

        const voice = new this.Sampler(this.sampleRate);

        if (this.sampleData) {
            // Pass Left and Right (Right might be empty float32array if mono)
            voice.load_sample(this.sampleData.left, this.sampleData.right);
        }

        // Apply trim settings if provided
        if (start !== undefined && end !== undefined) {
            voice.set_range(start, end);
        }

        // Apply ADSR if provided
        if (adsr) {
            voice.set_adsr(adsr.attack, adsr.decay, adsr.sustain, adsr.release);
        } else {
            // Default "Gate" envelope
            voice.set_adsr(0.001, 0.1, 1.0, 0.01);
        }

        // Apply Filter
        if (filter && voice.set_filter) {
            voice.set_filter(filter.cutoff, filter.q, filter.type, filter.enabled);
        }

        // Apply Bass Boost
        if (bassBoost !== undefined && voice.set_bass_boost) {
            voice.set_bass_boost(bassBoost);
        }

        voice.set_speed(speed);

        // play() now auto-handles start position based on speed direction & set_range
        voice.play();

        this.voices.push({
            sampler: voice,
            velocity: velocity,
            active: true
        });
    }

    stopAll() {
        this.voices.forEach(v => {
            if (v.sampler && v.sampler.stop) {
                v.sampler.stop();
            }
        });
        // Filter out finished ones ideally, but for stopAll we just stop them.
    }

    releaseAll() {
        this.voices.forEach(v => {
            if (v.sampler && v.sampler.release) {
                v.sampler.release();
            }
        });
    }

    dispose() {
        this.voices.forEach(v => {
            if (v.sampler && v.sampler.free) {
                try {
                    v.sampler.free();
                } catch (e) {
                    // Ignore already freed
                }
            }
        });
        this.voices = [];
        this.sampleData = null; // Release buffer reference
        this.Sampler = null; // Release Class reference?
        console.log('🗑️ WasmSamplerProcessor disposed.');
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const outL = output[0];
        const outR = output.length > 1 ? output[1] : null;

        if (!this.Sampler) return true;
        this.pendingQueue = this.pendingQueue || [];

        // --- SCHEDULING LOGIC ---
        const now = currentTime;
        const blockSize = outL.length; // usually 128
        const duration = blockSize / this.sampleRate;
        const nextBlockTime = now + duration;

        // Map of sample_index -> [events]
        const blockEvents = {};

        while (this.pendingQueue.length > 0) {
            const nextEvent = this.pendingQueue[0];

            // If event is in future beyond this block, stop checking
            if (nextEvent.startTime >= nextBlockTime) break;

            // It's in this block (or late)
            this.pendingQueue.shift();

            let offset = Math.floor((nextEvent.startTime - now) * this.sampleRate);
            // Clamp to valid range. Note: late events (offset < 0) play at 0.
            if (offset < 0) offset = 0;
            if (offset >= blockSize) offset = blockSize - 1; // Should not trigger if >= nextBlockTime check worked, but for safety.

            if (!blockEvents[offset]) blockEvents[offset] = [];
            blockEvents[offset].push(nextEvent);
        }

        // Clear output buffers
        outL.fill(0);
        if (outR) outR.fill(0);

        // Mix Loop
        for (let i = 0; i < blockSize; i++) {
            // 1. Trigger Scheduled Events
            if (blockEvents[i]) {
                const events = blockEvents[i];
                for (let k = 0; k < events.length; k++) {
                    const e = events[k];
                    this.playVoice(e.speed, e.velocity, e.start, e.end, e.adsr, e.filter, e.bassBoost);
                }
            }

            let sumL = 0;
            let sumR = 0;

            // 2. Process Voices
            for (let vIdx = 0; vIdx < this.voices.length; vIdx++) {
                const v = this.voices[vIdx];
                if (!v.active) continue;

                // Process (sample-accurate)
                const sL = v.sampler.process();
                const sR = v.sampler.get_current_right();

                const gain = v.velocity;

                sumL += sL * gain;
                sumR += sR * gain;

                if (!v.sampler.is_playing()) {
                    v.active = false;
                    try { v.sampler.free(); } catch (e) { }
                    v.sampler = null;
                }
            }

            outL[i] = sumL;
            if (outR) outR[i] = sumR;
        }

        // Cleanup inactive voices
        if (this.voices.some(v => !v.active)) {
            this.voices = this.voices.filter(v => v.active);
        }

        // Safety limit
        if (this.voices.length > 32) {
            const stolen = this.voices.shift();
            if (stolen && stolen.sampler) stolen.sampler.free();
        }

        return true;
    }
}

registerProcessor('wasm-sampler-processor', WasmSamplerProcessor);
