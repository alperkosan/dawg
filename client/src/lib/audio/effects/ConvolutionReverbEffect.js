/**
 * Convolution Reverb Effect
 * 
 * High-quality reverb using ConvolverNode with procedurally generated
 * impulse responses. No external files needed.
 */

import { BaseEffect } from './BaseEffect.js';

export class ConvolutionReverbEffect extends BaseEffect {
    constructor(context) {
        super(context, 'convolutionReverb', 'Convolution Reverb');

        this.parameters = {
            size: {
                value: 0.5,
                min: 0.0,
                max: 1.0,
                default: 0.5,
                label: 'Size',
                unit: '%'
            },
            decay: {
                value: 0.5,
                min: 0.1,
                max: 1.0,
                default: 0.5,
                label: 'Decay',
                unit: '%'
            },
            wet: {
                value: 0.0,  // ✅ Start with effect OFF
                min: 0.0,
                max: 1.0,
                default: 0.0,
                label: 'Mix',
                unit: '%'
            },
            roomType: {
                value: 'medium',
                default: 'medium',
                label: 'Room Type',
                options: ['small', 'medium', 'large', 'hall']
            }
        };

        this._buildReverbNetwork();
        this._updateParameters();
    }

    _buildReverbNetwork() {
        const ctx = this.context;

        // I/O
        this.inputNode = ctx.createGain();
        this.outputNode = ctx.createGain();

        // Dry/Wet
        this.dryGain = ctx.createGain();
        this.wetGain = ctx.createGain();

        // Convolver
        this.convolver = ctx.createConvolver();

        // Pre-delay for early reflections
        this.preDelay = ctx.createDelay(0.1);
        this.preDelay.delayTime.value = 0.02; // 20ms pre-delay

        // Damping filter (simulates air absorption)
        this.damping = ctx.createBiquadFilter();
        this.damping.type = 'lowpass';
        this.damping.frequency.value = 5000;

        // Routing
        this.inputNode.connect(this.dryGain);
        this.dryGain.connect(this.outputNode);

        // Wet path: Input -> PreDelay -> Convolver -> Damping -> WetGain -> Output
        this.inputNode.connect(this.preDelay);
        this.preDelay.connect(this.convolver);
        this.convolver.connect(this.damping);
        this.damping.connect(this.wetGain);
        this.wetGain.connect(this.outputNode);

        // Generate initial impulse response
        this._generateImpulseResponse();
    }

    /**
     * Generate procedural impulse response
     * Creates realistic reverb without external files
     */
    _generateImpulseResponse() {
        const size = this.getParameter('size');
        const decay = this.getParameter('decay');
        const roomType = this.getParameter('roomType');

        const sampleRate = this.context.sampleRate;

        // Room size determines duration
        const baseLength = {
            'small': 0.5,   // 0.5 seconds
            'medium': 1.5,  // 1.5 seconds
            'large': 3.0,   // 3 seconds
            'hall': 5.0     // 5 seconds
        }[roomType] || 1.5;

        const duration = baseLength * (0.5 + size * 1.5);
        let length = Math.floor(sampleRate * duration);

        // Safety check
        if (length <= 0 || isNaN(length)) {
            length = sampleRate * 1.5; // Fallback
        }

        const impulseBuffer = this.context.createBuffer(2, length, sampleRate);
        const bufferL = impulseBuffer.getChannelData(0);
        const bufferR = impulseBuffer.getChannelData(1);

        // Decay curve (exponential)
        const decayRate = 3 + decay * 7; // 3-10 range

        let maxPeak = 0;

        // Generate noise-based impulse with decay
        for (let i = 0; i < length; i++) {
            const t = i / sampleRate;

            // Exponential decay envelope
            const envelope = Math.exp(-decayRate * t);

            // Random noise for diffusion
            let noiseL = (Math.random() * 2 - 1) * envelope;
            let noiseR = (Math.random() * 2 - 1) * envelope;

            // Add early reflections (first 50ms)
            if (t < 0.05) {
                const reflectionCount = {
                    'small': 8,
                    'medium': 12,
                    'large': 16,
                    'hall': 24
                }[roomType] || 12;

                for (let r = 0; r < reflectionCount; r++) {
                    const reflectionTime = (r + 1) * 0.005;
                    const reflectionSample = Math.floor(reflectionTime * sampleRate);

                    if (i === reflectionSample) {
                        const reflectionGain = 0.5 * Math.pow(0.7, r);
                        noiseL += reflectionGain * (Math.random() * 2 - 1);
                        noiseR += reflectionGain * (Math.random() * 2 - 1);
                    }
                }
            }

            bufferL[i] = noiseL;
            bufferR[i] = noiseR;

            // Track peak
            const absL = Math.abs(noiseL);
            const absR = Math.abs(noiseR);
            if (absL > maxPeak) maxPeak = absL;
            if (absR > maxPeak) maxPeak = absR;
        }

        // Normalize buffer
        if (maxPeak > 0) {
            const normFactor = 0.9 / maxPeak;
            for (let i = 0; i < length; i++) {
                bufferL[i] *= normFactor;
                bufferR[i] *= normFactor;
            }
        }

        // Set convolver buffer
        this.convolver.normalize = true;
        this.convolver.buffer = impulseBuffer;

        console.log(`ConvolutionReverb: Generated IR Type:${roomType} Dur:${duration.toFixed(2)}s`);
    }

    _updateParameters() {
        const size = this.getParameter('size');
        const decay = this.getParameter('decay');
        const wet = this.getParameter('wet');

        // Mix
        this.dryGain.gain.value = 1 - wet;
        this.wetGain.gain.value = wet * 3.0; // Boosted wet signal for audibility

        // Damping based on decay (longer decay = less damping)
        const dampFreq = 2000 + (1 - decay) * 8000;
        this.damping.frequency.value = dampFreq;

        // Pre-delay based on size
        const preDelayTime = 0.01 + size * 0.04; // 10-50ms
        this.preDelay.delayTime.value = preDelayTime;

        // Note: For performance, we don't regenerate IR on every small parameter change in real-time,
        // typically IR generation happens on 'roomType' change or distinct events.
        // But for this simple implementation, if 'size' significantly affects IR length, we might need to.
        // For now, let's keep it simple and only regen on roomType or manual trigger if needed.
        // But the previous implementation called it every time. Let's call it if room params changed logic.
        // Actually, let's just regenerate to be safe and responsive as user drags knobs.
        this._generateImpulseResponse();
    }

    onParameterChange(name, value) {
        // Regenerate impulse response if room type changes
        if (name === 'roomType' || name === 'size' || name === 'decay') {
            // Debounce could be good here but direct call is fine for modern CPUs
        }
        this._updateParameters();
    }

    dispose() {
        try {
            this.inputNode.disconnect();
            this.outputNode.disconnect();
            this.dryGain.disconnect();
            this.wetGain.disconnect();
            this.preDelay.disconnect();
            this.convolver.disconnect();
            this.damping.disconnect();
        } catch (e) {
            console.error('Error disposing ConvolutionReverbEffect:', e);
        }
    }
}
