/**
 * CHORUS EFFECT
 * 
 * Classic Modulation Effect
 * Adds richness and width by mixing the original signal with
 * a slightly delayed and pitch-modulated copy.
 * 
 * DSP Chain:
 * Input -> Split -> Dry Gain --------------------> Output
 *             \-> Delay --(Feedback)--> Wet Gain --/
 *                  ^
 *             LFO (Modulates Delay Time)
 */

import { BaseEffect } from './BaseEffect.js';

export class ChorusEffect extends BaseEffect {
    constructor(context) {
        super(context, 'chorus', 'Chorus');

        // Parameters
        this.parameters = {
            rate: {
                value: 0.5,
                min: 0.1,
                max: 10.0,
                default: 1.5,
                label: 'Rate',
                unit: 'Hz'
            },
            depth: {
                value: 0.002,
                min: 0.0,
                max: 0.01, // 10ms modulation depth
                default: 0.002,
                label: 'Depth',
                unit: 's'
            },
            delay: {
                value: 0.03,
                min: 0.005,
                max: 0.1,
                default: 0.03, // 30ms base delay
                label: 'Delay',
                unit: 's'
            },
            feedback: {
                value: 0.4,
                min: 0.0,
                max: 0.95,
                default: 0.4,
                label: 'Feedback',
                unit: '%'
            },
            mix: {
                value: 0.0,  // ✅ Start with effect OFF
                min: 0.0,
                max: 1.0,
                default: 0.0,
                label: 'Mix',
                unit: '%'
            }
        };

        this._buildEffectGraph();
        this._updateParameters();
    }

    _buildEffectGraph() {
        const ctx = this.context;

        // I/O
        this.inputNode = ctx.createGain();
        this.outputNode = ctx.createGain();

        // Dry/Wet Gains
        this.dryGain = ctx.createGain();
        this.wetGain = ctx.createGain();

        // Delay Line
        this.delayNode = ctx.createDelay(1.0); // Max 1 sec buffer
        this.feedbackGain = ctx.createGain();

        // Modulation (LFO)
        this.lfo = ctx.createOscillator();
        this.lfo.type = 'sine';
        this.lfoDepthGain = ctx.createGain();

        // Routing
        // Input -> Dry
        this.inputNode.connect(this.dryGain);
        this.dryGain.connect(this.outputNode);

        // Input -> Wet (Delay)
        this.inputNode.connect(this.delayNode);
        this.delayNode.connect(this.wetGain);
        this.wetGain.connect(this.outputNode);

        // Feedback
        this.delayNode.connect(this.feedbackGain);
        this.feedbackGain.connect(this.delayNode);

        // Modulation Connection
        // LFO -> Depth -> Delay.delayTime
        this.lfo.connect(this.lfoDepthGain);
        this.lfoDepthGain.connect(this.delayNode.delayTime);

        // Start LFO
        this.lfo.start();
    }

    _updateParameters() {
        const rate = this.getParameter('rate');
        const depth = this.getParameter('depth');
        const delay = this.getParameter('delay');
        const feedback = this.getParameter('feedback');
        const mix = this.getParameter('mix');

        // Update LFO
        // Determine current time for smooth transitions
        const now = this.context.currentTime;

        this.lfo.frequency.setTargetAtTime(rate, now, 0.02);
        this.lfoDepthGain.gain.setTargetAtTime(depth, now, 0.02);

        // Base delay time is effectively set by the modulation center point?
        // Actually, AudioParam summing: delayNode.delayTime = baseParam + connection.
        // But delayNode.delayTime is an AudioParam.
        // We set the base value here.
        this.delayNode.delayTime.setTargetAtTime(delay, now, 0.02);

        // Feedback
        this.feedbackGain.gain.setTargetAtTime(feedback, now, 0.02);

        // Mix (Standard linear crossfade or equal power)
        // Using equal power for consistent volume
        // const wetGain = Math.sin(mix * Math.PI / 2);
        // const dryGain = Math.cos(mix * Math.PI / 2);
        // Using linear for simplicity as per other effects
        this.dryGain.gain.setTargetAtTime(1 - mix, now, 0.02);
        this.wetGain.gain.setTargetAtTime(mix, now, 0.02);
    }

    onParameterChange(name, value) {
        this._updateParameters();
    }

    // Worklet support (optional, for now using Web Audio nodes)
    process(inputSamples, outputSamples, sampleRate) {
        // Fallback for worklet-based systems if needed
    }
}
