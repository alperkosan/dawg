// public/worklets/mixer-processor.js
// DAWG - Native Mixer Processor - Advanced mixing capabilities
// ⚡ OPTIMIZED: Uses WebAssembly for high-performance DSP

import init, { WasmAudioProcessor } from '/wasm/dawg_audio_dsp.js';

class MixerProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'gain', defaultValue: 0.8, minValue: 0, maxValue: 2 },
            { name: 'pan', defaultValue: 0, minValue: -1, maxValue: 1 },
            { name: 'mono', defaultValue: 0, minValue: 0, maxValue: 1 },
            { name: 'lowGain', defaultValue: 1, minValue: 0, maxValue: 3 },
            { name: 'midGain', defaultValue: 1, minValue: 0, maxValue: 3 },
            { name: 'highGain', defaultValue: 1, minValue: 0, maxValue: 3 },
            { name: 'lowFreq', defaultValue: 200, minValue: 20, maxValue: 500 },
            { name: 'highFreq', defaultValue: 3000, minValue: 1000, maxValue: 8000 },
            { name: 'compThreshold', defaultValue: -12, minValue: -40, maxValue: 0 },
            { name: 'compRatio', defaultValue: 4, minValue: 1, maxValue: 20 },
            { name: 'send1', defaultValue: 0, minValue: 0, maxValue: 1 },
            { name: 'send2', defaultValue: 0, minValue: 0, maxValue: 1 }
        ];
    }

    constructor(options) {
        super();

        this.stripId = options?.processorOptions?.stripId || 'strip';
        this.stripName = options?.processorOptions?.stripName || 'Mixer Strip';

        this.sampleRate = globalThis.sampleRate || 44100;
        this.frameCount = 0;

        // WASM State
        this.wasmProcessor = null;
        this.isWasmReady = false;
        this.wasmHeap = null; // Float32Array view of WASM memory

        // Buffers for WASM interaction (allocated once)
        this.bufferSize = 128;
        this.inputL = new Float32Array(this.bufferSize);
        this.inputR = new Float32Array(this.bufferSize);
        this.outputL = new Float32Array(this.bufferSize);
        this.outputR = new Float32Array(this.bufferSize);

        // Initialize WASM
        this.initWasm();

        // VU meter
        this.vuMeter = {
            peakL: 0,
            peakR: 0,
            rmsL: 0,
            rmsR: 0,
            samples: []
        };

        // Target: ~6 updates per second
        const TARGET_VU_UPDATE_HZ = 6;
        this.vuUpdateInterval = Math.floor(this.sampleRate / TARGET_VU_UPDATE_HZ / 128) * 128;
    }

    async initWasm() {
        try {
            // Initialize WASM module
            // Note: In AudioWorklet, we might need to check if already initialized
            // but init() usually handles idempotency or we can catch error
            await init('/wasm/dawg_audio_dsp_bg.wasm');

            this.wasmProcessor = new WasmAudioProcessor(this.sampleRate);
            this.isWasmReady = true;
            console.log(`✅ [MixerProcessor] WASM initialized for ${this.stripId}`);
        } catch (error) {
            console.error(`❌ [MixerProcessor] WASM initialization failed for ${this.stripId}:`, error);
            // Fallback to JS processing would go here if we kept the code, 
            // but for now we rely on WASM or bypass.
        }
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];

        if (!input || !input.length || !output || !output.length) {
            return true;
        }

        const blockSize = output[0].length;

        // If WASM not ready, bypass
        if (!this.isWasmReady || !this.wasmProcessor) {
            // Passthrough
            for (let i = 0; i < blockSize; i++) {
                if (output.length > 0) output[0][i] = input.length > 0 ? input[0][i] : 0;
                if (output.length > 1) output[1][i] = input.length > 1 ? input[1][i] : 0;
            }
            return true;
        }

        // Get parameters
        const gain = this.getParamValue(parameters.gain, 0);
        const pan = this.getParamValue(parameters.pan, 0);
        const mono = this.getParamValue(parameters.mono, 0) > 0.5;

        const lowGain = this.getParamValue(parameters.lowGain, 0);
        const midGain = this.getParamValue(parameters.midGain, 0);
        const highGain = this.getParamValue(parameters.highGain, 0);
        const lowFreq = this.getParamValue(parameters.lowFreq, 0);
        const highFreq = this.getParamValue(parameters.highFreq, 0);

        const threshold = this.getParamValue(parameters.compThreshold, 0);
        const ratio = this.getParamValue(parameters.compRatio, 0);

        // Check active states
        const eqActive = (lowGain !== 1 || midGain !== 1 || highGain !== 1);
        const compActive = (threshold < 0 && ratio > 1);

        // Update EQ coefficients if needed
        // Note: WasmAudioProcessor handles coefficient calculation internally
        if (eqActive) {
            this.wasmProcessor.update_eq_coefficients(lowGain, midGain, highGain, lowFreq, highFreq);
        }

        // Prepare inputs for WASM
        // We need to copy to our Float32Arrays because WASM expects slices
        // In a more advanced setup, we'd write directly to WASM memory, but this is safe/easy
        const inputL = input.length > 0 ? input[0] : this.inputL.fill(0);
        const inputR = input.length > 1 ? input[1] : (input.length > 0 ? input[0] : this.inputR.fill(0));

        // Process using WASM
        // process_buffer(input_l, input_r, output_l, output_r, eq_active, comp_active, gain, pan, mono, threshold, ratio)
        this.wasmProcessor.process_buffer(
            inputL,
            inputR,
            this.outputL,
            this.outputR,
            eqActive,
            compActive,
            gain,
            pan,
            mono,
            threshold,
            ratio
        );

        // Copy output back
        output[0].set(this.outputL);
        if (output.length > 1) {
            output[1].set(this.outputR);
        }

        // VU Metering (using output)
        this.updateVUMeter(this.outputL, this.outputR, blockSize);

        // Send VU data
        this.frameCount++;
        if (this.frameCount % this.vuUpdateInterval === 0) {
            this.sendVUData();
        }

        return true;
    }

    updateVUMeter(leftBuffer, rightBuffer, length) {
        let maxL = 0;
        let maxR = 0;
        let sumSqL = 0;
        let sumSqR = 0;

        // Sample a few points for efficiency
        const step = 4;
        for (let i = 0; i < length; i += step) {
            const l = leftBuffer[i];
            const r = rightBuffer[i];

            const absL = Math.abs(l);
            const absR = Math.abs(r);

            if (absL > maxL) maxL = absL;
            if (absR > maxR) maxR = absR;

            sumSqL += l * l;
            sumSqR += r * r;
        }

        this.vuMeter.peakL = Math.max(this.vuMeter.peakL * 0.95, maxL);
        this.vuMeter.peakR = Math.max(this.vuMeter.peakR * 0.95, maxR);

        // Accumulate RMS samples (simplified)
        const rmsL = Math.sqrt(sumSqL / (length / step));
        const rmsR = Math.sqrt(sumSqR / (length / step));

        this.vuMeter.rmsL = rmsL;
        this.vuMeter.rmsR = rmsR;
    }

    sendVUData() {
        this.port.postMessage({
            type: 'vuMeter',
            data: {
                peakL: this.vuMeter.peakL,
                peakR: this.vuMeter.peakR,
                rmsL: this.vuMeter.rmsL,
                rmsR: this.vuMeter.rmsR
            }
        });
    }

    getParamValue(param, sampleIndex) {
        return param.length > 1 ? param[sampleIndex] : param[0];
    }
}

registerProcessor('mixer-processor', MixerProcessor);
