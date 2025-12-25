/**
 * VASynth Effect Chain
 * 
 * Manages the built-in effects graph for VASynth:
 * Input -> EQ -> Chorus -> Delay -> Reverb -> Output
 */

import { ConvolutionReverbEffect } from '../../effects/ConvolutionReverbEffect.js';
import { ModernDelayEffect } from '../../effects/ModernDelayEffect.js';
import { ChorusEffect } from '../../effects/ChorusEffect.js';

export class VASynthEffectChain {
    constructor(context) {
        this.context = context;
        this.enabled = true;

        // Input/Output nodes
        this.input = context.createGain();
        this.output = context.createGain();

        // ✅ SAFETY: DC Blocker (Highpass 30Hz) - Prevents DC offset accumulation in feedback loops
        this.dcBlocker = context.createBiquadFilter();
        this.dcBlocker.type = 'highpass';
        this.dcBlocker.frequency.value = 30;

        // ✅ SAFETY: Output Limiter - Prevents ear-piercing volumes
        this.safetyLimiter = context.createDynamicsCompressor();
        this.safetyLimiter.threshold.value = -3; // Start limiting at -3dB
        this.safetyLimiter.knee.value = 12;
        this.safetyLimiter.ratio.value = 12; // High ratio (limiting)
        this.safetyLimiter.attack.value = 0.003;
        this.safetyLimiter.release.value = 0.25;

        // Initialize Effects
        this._initEQ();
        this.chorus = new ChorusEffect(context);
        this.delay = new ModernDelayEffect(context);
        this.reverb = new ConvolutionReverbEffect(context); // ✅ High-quality convolution reverb

        // Build Graph
        this._buildGraph();
    }

    _initEQ() {
        this.eq = {
            low: this.context.createBiquadFilter(),
            mid: this.context.createBiquadFilter(),
            high: this.context.createBiquadFilter()
        };

        // Low Shelf
        this.eq.low.type = 'lowshelf';
        this.eq.low.frequency.value = 200; // Hz

        // Peaking
        this.eq.mid.type = 'peaking';
        this.eq.mid.frequency.value = 1000; // Hz
        this.eq.mid.Q.value = 1.0;

        // High Shelf
        this.eq.high.type = 'highshelf';
        this.eq.high.frequency.value = 5000; // Hz
    }

    _buildGraph() {
        // Chain: Input -> DC Blocker -> EQ(Low->Mid->High) -> Chorus -> Delay -> Reverb -> Safety Limiter -> Output

        // 1. Input to DC Blocker
        this.input.connect(this.dcBlocker);

        // 2. DC Blocker to EQ
        this.dcBlocker.connect(this.eq.low);
        this.eq.low.connect(this.eq.mid);
        this.eq.mid.connect(this.eq.high);

        // 3. EQ to Chorus
        // Handle Chorus I/O
        // Assuming effects have .inputNode and .outputNode (Standard BaseEffect)
        this.eq.high.connect(this.chorus.inputNode);

        // 4. Chorus to Delay
        this.chorus.outputNode.connect(this.delay.inputNode);

        // 5. Delay to Reverb
        this.delay.outputNode.connect(this.reverb.inputNode);

        // 6. Reverb to Safety Limiter
        this.reverb.outputNode.connect(this.safetyLimiter);

        // 7. Limiter to Output
        this.safetyLimiter.connect(this.output);
    }

    update(params) {
        if (!params) return;

        console.log('🎛️ VASynthEffectChain.update:', params);

        // EQ
        if (params.eq) {
            if (params.eq.low !== undefined) this.eq.low.gain.setTargetAtTime(params.eq.low, 0, 0.02);
            if (params.eq.mid !== undefined) this.eq.mid.gain.setTargetAtTime(params.eq.mid, 0, 0.02);
            if (params.eq.high !== undefined) this.eq.high.gain.setTargetAtTime(params.eq.high, 0, 0.02);

            // Optional freq/Q control if exposed
            if (params.eq.lowFreq !== undefined) this.eq.low.frequency.value = params.eq.lowFreq;
            if (params.eq.midFreq !== undefined) this.eq.mid.frequency.value = params.eq.midFreq;
            if (params.eq.highFreq !== undefined) this.eq.high.frequency.value = params.eq.highFreq;
        }

        // Chorus
        if (params.chorus) {
            // Map settings to effect parameters
            Object.entries(params.chorus).forEach(([key, value]) => {
                this.chorus.setParameter(key, value);
            });
        }

        // Delay
        if (params.delay) {
            Object.entries(params.delay).forEach(([key, value]) => {
                this.delay.setParameter(key, value);
            });
        }

        // Reverb
        if (params.reverb) {
            Object.entries(params.reverb).forEach(([key, value]) => {
                this.reverb.setParameter(key, value);
            });
        }
    }

    dispose() {
        try {
            this.input.disconnect();
            this.output.disconnect();

            // Disconnect EQ
            this.eq.low.disconnect();
            this.eq.mid.disconnect();
            this.eq.high.disconnect();

            // Disconnect safety nodes
            this.dcBlocker.disconnect();
            this.safetyLimiter.disconnect();

            // Dispose effects (if they support it, BaseEffect usually does but check implementation)
            // Assuming BaseEffect has minimal cleanup or relying on GC. 
            // Better to check if they define dispose.

            // Reverb/Delay might be heavy, check if they need cleanup
        } catch (e) {
            console.error('Error disposing VASynthEffectChain:', e);
        }
    }

    // Bypass/Enable toggles could be added here
}
