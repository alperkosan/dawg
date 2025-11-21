
import { VASynth } from './VASynth.js';
import { SYNTH_PRESETS } from './presets.js';

// Mock AudioContext
class MockAudioContext {
    constructor() {
        this.currentTime = 0;
        this.state = 'running';
    }
    createGain() {
        return {
            gain: {
                value: 1,
                setValueAtTime: (v, t) => console.log(`[Mock] Gain.setValueAtTime(${v}, ${t})`),
                linearRampToValueAtTime: (v, t) => console.log(`[Mock] Gain.linearRampToValueAtTime(${v}, ${t})`),
                exponentialRampToValueAtTime: (v, t) => console.log(`[Mock] Gain.exponentialRampToValueAtTime(${v}, ${t})`),
                cancelScheduledValues: (t) => console.log(`[Mock] Gain.cancelScheduledValues(${t})`),
                setTargetAtTime: (v, t, c) => console.log(`[Mock] Gain.setTargetAtTime(${v}, ${t}, ${c})`)
            },
            connect: (dest) => console.log(`[Mock] Gain connected to`, dest),
            disconnect: () => console.log(`[Mock] Gain disconnected`)
        };
    }
    createOscillator() {
        return {
            frequency: {
                value: 440,
                setValueAtTime: (v, t) => console.log(`[Mock] Osc.frequency.setValueAtTime(${v}, ${t})`),
                exponentialRampToValueAtTime: (v, t) => console.log(`[Mock] Osc.frequency.exponentialRampToValueAtTime(${v}, ${t})`),
                cancelScheduledValues: (t) => console.log(`[Mock] Osc.frequency.cancelScheduledValues(${t})`)
            },
            detune: { setValueAtTime: () => { } },
            type: 'sine',
            connect: (dest) => console.log(`[Mock] Osc connected`),
            start: (t) => console.log(`[Mock] Osc started at ${t}`),
            stop: (t) => console.log(`[Mock] Osc stopped at ${t}`),
            disconnect: () => console.log(`[Mock] Osc disconnected`)
        };
    }
    createBiquadFilter() {
        return {
            frequency: {
                value: 1000,
                setValueAtTime: (v, t) => console.log(`[Mock] Filter.frequency.setValueAtTime(${v}, ${t})`),
                exponentialRampToValueAtTime: (v, t) => console.log(`[Mock] Filter.frequency.exponentialRampToValueAtTime(${v}, ${t})`),
                cancelScheduledValues: (t) => console.log(`[Mock] Filter.frequency.cancelScheduledValues(${t})`)
            },
            Q: { setValueAtTime: () => { } },
            connect: (dest) => console.log(`[Mock] Filter connected`),
            disconnect: () => console.log(`[Mock] Filter disconnected`)
        };
    }
    createStereoPanner() {
        return {
            pan: { setValueAtTime: () => { } },
            connect: () => { },
            disconnect: () => { }
        };
    }
    createWaveShaper() {
        return {
            curve: null,
            connect: () => { },
            disconnect: () => { }
        };
    }
}

async function testClassicLead() {
    console.log('--- Starting VASynth Debug Test ---');
    const ctx = new MockAudioContext();
    const synth = new VASynth(ctx);

    const preset = SYNTH_PRESETS['Classic Lead'];
    if (!preset) {
        console.error('Classic Lead preset not found!');
        return;
    }

    console.log('Loading preset...');
    synth.loadPreset(preset);
    console.log(`Voice Mode: ${synth.voiceMode}`);

    console.log('\n--- Note On 1 (C4) ---');
    synth.noteOn(60, 100, 0);

    console.log('\n--- Note Off 1 (C4) ---');
    ctx.currentTime = 0.5;
    synth.noteOff(0.5);

    console.log('\n--- Note On 2 (D4) - After Release ---');
    ctx.currentTime = 1.0;
    synth.noteOn(62, 100, 1.0);

    console.log('\n--- Note On 3 (E4) - Overlapping (Legato/Portamento check) ---');
    ctx.currentTime = 1.2;
    synth.noteOn(64, 100, 1.2);
}

testClassicLead();
