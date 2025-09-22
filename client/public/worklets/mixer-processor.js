// public/worklets/mixer-processor.js
// DAWG - Native Mixer Processor - Advanced mixing capabilities

class MixerProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'gain', defaultValue: 0.8, minValue: 0, maxValue: 2 },
            { name: 'pan', defaultValue: 0, minValue: -1, maxValue: 1 },
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

        // EQ state
        this.eqState = {
            low: [0, 0, 0, 0],
            mid: [0, 0, 0, 0], 
            high: [0, 0, 0, 0]
        };

        // Compressor state
        this.compState = {
            envelope: 0,
            gain: 1
        };

        // VU meter
        this.vuMeter = {
            peakL: 0,
            peakR: 0,
            rmsL: 0,
            rmsR: 0,
            samples: []
        };

        this.sampleRate = globalThis.sampleRate || 44100;

        console.log(`🎛️ MixerProcessor initialized: ${this.stripName}`);
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];

        if (!input || !input.length || !output || !output.length) {
            return true;
        }

        const blockSize = output[0].length;
        const channelCount = Math.min(input.length, output.length, 2);

        for (let i = 0; i < blockSize; i++) {
            let samplesL = channelCount > 0 ? input[0][i] : 0;
            let samplesR = channelCount > 1 ? input[1][i] : samplesL;

            // EQ processing
            const eqOutput = this.processEQ(samplesL, samplesR, parameters, i);
            samplesL = eqOutput.left;
            samplesR = eqOutput.right;

            // Compression
            const compOutput = this.processCompression(samplesL, samplesR, parameters, i);
            samplesL = compOutput.left;
            samplesR = compOutput.right;

            // Gain and pan
            const gain = this.getParamValue(parameters.gain, i);
            const pan = this.getParamValue(parameters.pan, i);

            samplesL *= gain;
            samplesR *= gain;

            // Pan processing
            if (pan !== 0) {
                const panGainL = Math.cos((pan + 1) * Math.PI / 4);
                const panGainR = Math.sin((pan + 1) * Math.PI / 4);

                const tempL = samplesL;
                const tempR = samplesR;

                samplesL = tempL * panGainL + tempR * (1 - panGainL);
                samplesR = tempR * panGainR + tempL * (1 - panGainR);
            }

            // Output
            if (output.length > 0) output[0][i] = samplesL;
            if (output.length > 1) output[1][i] = samplesR;

            // VU metering
            this.updateVUMeter(samplesL, samplesR);
        }

        // Send VU data periodically
        if (currentFrame % 1024 === 0) {
            this.sendVUData();
        }

        return true;
    }

    processEQ(left, right, parameters, sampleIndex) {
        const lowGain = this.getParamValue(parameters.lowGain, sampleIndex);
        const midGain = this.getParamValue(parameters.midGain, sampleIndex);
        const highGain = this.getParamValue(parameters.highGain, sampleIndex);
        const lowFreq = this.getParamValue(parameters.lowFreq, sampleIndex);
        const highFreq = this.getParamValue(parameters.highFreq, sampleIndex);

        // Simple 3-band EQ using biquad filters
        const processedLeft = this.applyEQBand(left, this.eqState.low, lowFreq, lowGain, 'lowshelf') +
                             this.applyEQBand(left, this.eqState.mid, 1000, midGain, 'peaking') +
                             this.applyEQBand(left, this.eqState.high, highFreq, highGain, 'highshelf');

        const processedRight = this.applyEQBand(right, this.eqState.low, lowFreq, lowGain, 'lowshelf') +
                              this.applyEQBand(right, this.eqState.mid, 1000, midGain, 'peaking') +
                              this.applyEQBand(right, this.eqState.high, highFreq, highGain, 'highshelf');

        return { left: processedLeft / 3, right: processedRight / 3 };
    }

    applyEQBand(input, state, frequency, gain, type) {
        // Simplified biquad filter implementation
        const omega = 2 * Math.PI * frequency / this.sampleRate;
        const alpha = Math.sin(omega) / 2;
        const A = Math.pow(10, gain / 40);

        let b0, b1, b2, a0, a1, a2;

        switch (type) {
            case 'lowshelf':
                b0 = A * ((A + 1) - (A - 1) * Math.cos(omega) + 2 * Math.sqrt(A) * alpha);
                b1 = 2 * A * ((A - 1) - (A + 1) * Math.cos(omega));
                b2 = A * ((A + 1) - (A - 1) * Math.cos(omega) - 2 * Math.sqrt(A) * alpha);
                a0 = (A + 1) + (A - 1) * Math.cos(omega) + 2 * Math.sqrt(A) * alpha;
                a1 = -2 * ((A - 1) + (A + 1) * Math.cos(omega));
                a2 = (A + 1) + (A - 1) * Math.cos(omega) - 2 * Math.sqrt(A) * alpha;
                break;

            case 'highshelf':
                b0 = A * ((A + 1) + (A - 1) * Math.cos(omega) + 2 * Math.sqrt(A) * alpha);
                b1 = -2 * A * ((A - 1) + (A + 1) * Math.cos(omega));
                b2 = A * ((A + 1) + (A - 1) * Math.cos(omega) - 2 * Math.sqrt(A) * alpha);
                a0 = (A + 1) - (A - 1) * Math.cos(omega) + 2 * Math.sqrt(A) * alpha;
                a1 = 2 * ((A - 1) - (A + 1) * Math.cos(omega));
                a2 = (A + 1) - (A - 1) * Math.cos(omega) - 2 * Math.sqrt(A) * alpha;
                break;

            case 'peaking':
            default:
                b0 = 1 + alpha * A;
                b1 = -2 * Math.cos(omega);
                b2 = 1 - alpha * A;
                a0 = 1 + alpha / A;
                a1 = -2 * Math.cos(omega);
                a2 = 1 - alpha / A;
                break;
        }

        // Apply biquad filter
        const output = (b0 * input + b1 * state[0] + b2 * state[1] - a1 * state[2] - a2 * state[3]) / a0;

        // Update state
        state[1] = state[0];
        state[0] = input;
        state[3] = state[2];
        state[2] = output;

        return output;
    }

    processCompression(left, right, parameters, sampleIndex) {
        const threshold = this.getParamValue(parameters.compThreshold, sampleIndex);
        const ratio = this.getParamValue(parameters.compRatio, sampleIndex);

        // Simple compressor
        const inputLevel = Math.max(Math.abs(left), Math.abs(right));
        const inputLevelDB = 20 * Math.log10(Math.max(inputLevel, 0.001));

        let gainReduction = 0;
        if (inputLevelDB > threshold) {
            const excess = inputLevelDB - threshold;
            gainReduction = excess * (1 - 1/ratio);
        }

        const targetGain = Math.pow(10, -gainReduction / 20);

        // Smooth gain changes
        const attack = 0.003;
        const release = 0.1;
        const timeConstant = targetGain < this.compState.gain ? attack : release;

        this.compState.gain += (targetGain - this.compState.gain) * 
                              (1 - Math.exp(-1 / (timeConstant * this.sampleRate)));

        return {
            left: left * this.compState.gain,
            right: right * this.compState.gain
        };
    }

    updateVUMeter(left, right) {
        this.vuMeter.peakL = Math.max(this.vuMeter.peakL * 0.95, Math.abs(left));
        this.vuMeter.peakR = Math.max(this.vuMeter.peakR * 0.95, Math.abs(right));

        this.vuMeter.samples.push({ left: left * left, right: right * right });

        if (this.vuMeter.samples.length > 128) {
            this.vuMeter.samples.shift();
        }
    }

    sendVUData() {
        if (this.vuMeter.samples.length === 0) return;

        const rmsL = Math.sqrt(
            this.vuMeter.samples.reduce((sum, s) => sum + s.left, 0) / this.vuMeter.samples.length
        );
        const rmsR = Math.sqrt(
            this.vuMeter.samples.reduce((sum, s) => sum + s.right, 0) / this.vuMeter.samples.length
        );

        this.port.postMessage({
            type: 'vuMeter',
            data: {
                peakL: this.vuMeter.peakL,
                peakR: this.vuMeter.peakR,
                rmsL: rmsL,
                rmsR: rmsR
            }
        });
    }

    getParamValue(param, sampleIndex) {
        return param.length > 1 ? param[sampleIndex] : param[0];
    }
}

registerProcessor('mixer-processor', MixerProcessor);
