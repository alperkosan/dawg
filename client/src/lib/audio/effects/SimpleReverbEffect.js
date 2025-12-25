/**
 * Simple Reverb Effect
 * 
 * Ultra-stable reverb with NO feedback loops.
 * Uses only delay taps - cannot self-oscillate.
 */

import { BaseEffect } from './BaseEffect.js';

export class SimpleReverbEffect extends BaseEffect {
    constructor(context) {
        super(context, 'simpleReverb', 'Simple Reverb');

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
                min: 0.0,
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

        // ✅ NO FEEDBACK - Only delay taps
        // Create multiple delay taps at different times
        this.delayTaps = [];

        // Prime numbers for natural diffusion (ms at 44.1kHz)
        const tapTimes = [29, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79];

        tapTimes.forEach((timeMs, index) => {
            const delay = ctx.createDelay(0.2);
            const gain = ctx.createGain();
            const damping = ctx.createBiquadFilter();

            delay.delayTime.value = timeMs / 1000;
            damping.type = 'lowpass';
            damping.frequency.value = 5000;

            // ✅ NO FEEDBACK - Linear chain only
            this.inputNode.connect(delay);
            delay.connect(damping);
            damping.connect(gain);
            gain.connect(this.wetGain);

            this.delayTaps.push({ delay, gain, damping, index });
        });

        // Routing
        this.inputNode.connect(this.dryGain);
        this.dryGain.connect(this.outputNode);
        this.wetGain.connect(this.outputNode);
    }

    _updateParameters() {
        const size = this.getParameter('size');
        const decay = this.getParameter('decay');
        const wet = this.getParameter('wet');

        // Mix
        this.dryGain.gain.value = 1 - wet;
        this.wetGain.gain.value = wet * 0.5; // Scale down to prevent clipping

        // Update delay taps
        this.delayTaps.forEach((tap, index) => {
            // Exponential decay for natural reverb tail
            const tapDecay = Math.pow(decay, index / this.delayTaps.length);
            tap.gain.gain.value = tapDecay * 0.3; // Max 0.3 per tap

            // Size affects delay times
            const baseTime = (29 + index * 6) / 1000; // Base pattern
            tap.delay.delayTime.value = baseTime * (0.5 + size * 1.5);

            // Damping based on decay
            const dampFreq = 2000 + (1 - decay) * 8000;
            tap.damping.frequency.value = dampFreq;
        });
    }

    onParameterChange(name, value) {
        this._updateParameters();
    }
}
