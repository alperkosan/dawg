// lib/utils/NativeTimeUtils.js
// DAWG - Native Time Utilities - Tone.js Time sınıfının native implementasyonu

export class NativeTimeUtils {
    constructor(bpm = 120, timeSignature = [4, 4]) {
        this.bpm = bpm;
        this.timeSignature = timeSignature;
        this.ppq = 96; // Pulses per quarter note
    }

    static create(value, bpm = 120) {
        return new NativeTime(value, bpm);
    }

    setBPM(bpm) {
        this.bpm = bpm;
    }

    setTimeSignature(numerator, denominator = 4) {
        this.timeSignature = [numerator, denominator];
    }

    // Static utility methods
    static parseTime(value, bpm = 120) {
        return new NativeTime(value, bpm).toSeconds();
    }

    static timeToSeconds(value, bpm = 120) {
        return NativeTime.timeToSeconds(value, bpm);
    }

    static secondsToTime(seconds, bpm = 120) {
        return NativeTime.secondsToTime(seconds, bpm);
    }
}

export class NativeTime {
    constructor(value, bpm = 120) {
        this.bpm = bpm;
        this.value = value;
        this.parsedValue = this.parseValue(value);
    }

    parseValue(value) {
        if (typeof value === 'number') {
            return { type: 'seconds', value: value };
        }

        if (typeof value === 'string') {
            // Note durations: "4n", "8n", "16n", "2n", etc.
            const noteDurationMatch = value.match(/^(\d+(?:\.\d+)?)(n|t|d)$/);
            if (noteDurationMatch) {
                const [, noteValue, modifier] = noteDurationMatch;
                return {
                    type: 'note',
                    noteValue: parseFloat(noteValue),
                    modifier: modifier
                };
            }

            // Bar:Beat:Sixteenth notation: "1:2:0", "0:1:2"
            const barBeatMatch = value.match(/^(\d+):(\d+):(\d+)$/);
            if (barBeatMatch) {
                const [, bar, beat, sixteenth] = barBeatMatch.map(Number);
                return {
                    type: 'barBeat',
                    bar: bar,
                    beat: beat,
                    sixteenth: sixteenth
                };
            }

            // Hz notation: "440hz"
            const hzMatch = value.match(/^(\d+(?:\.\d+)?)hz$/i);
            if (hzMatch) {
                return {
                    type: 'frequency',
                    frequency: parseFloat(hzMatch[1])
                };
            }

            // Time notation: "1m", "30s", "500ms"
            const timeMatch = value.match(/^(\d+(?:\.\d+)?)(m|s|ms)$/);
            if (timeMatch) {
                const [, timeValue, unit] = timeMatch;
                return {
                    type: 'time',
                    value: parseFloat(timeValue),
                    unit: unit
                };
            }

            // Default to note duration if it's a simple number string
            if (!isNaN(value)) {
                return { type: 'seconds', value: parseFloat(value) };
            }
        }

        throw new Error(`Invalid time value: ${value}`);
    }

    toSeconds() {
        switch (this.parsedValue.type) {
            case 'seconds':
                return this.parsedValue.value;

            case 'note':
                return this.noteDurationToSeconds(
                    this.parsedValue.noteValue,
                    this.parsedValue.modifier
                );

            case 'barBeat':
                return this.barBeatToSeconds(
                    this.parsedValue.bar,
                    this.parsedValue.beat,
                    this.parsedValue.sixteenth
                );

            case 'frequency':
                return 1 / this.parsedValue.frequency;

            case 'time':
                return this.timeValueToSeconds(
                    this.parsedValue.value,
                    this.parsedValue.unit
                );

            default:
                throw new Error(`Unknown time type: ${this.parsedValue.type}`);
        }
    }

    noteDurationToSeconds(noteValue, modifier = 'n') {
        // Base duration for quarter note at current BPM
        const quarterNoteDuration = 60 / this.bpm;

        // Calculate note duration (4 = quarter note, 8 = eighth note, etc.)
        let duration = quarterNoteDuration * (4 / noteValue);

        // Apply modifiers
        switch (modifier) {
            case 't': // Triplet
                duration *= (2 / 3);
                break;
            case 'd': // Dotted
                duration *= 1.5;
                break;
            case 'n': // Normal
            default:
                break;
        }

        return duration;
    }

    barBeatToSeconds(bar, beat, sixteenth) {
        const beatsPerBar = 4; // Standard 4/4 time
        const sixteenthsPerBeat = 4;
        const quarterNoteDuration = 60 / this.bpm;
        const sixteenthDuration = quarterNoteDuration / 4;

        const totalSixteenths = (bar * beatsPerBar * sixteenthsPerBeat) + 
                              (beat * sixteenthsPerBeat) + 
                              sixteenth;

        return totalSixteenths * sixteenthDuration;
    }

    timeValueToSeconds(value, unit) {
        switch (unit) {
            case 'ms':
                return value / 1000;
            case 's':
                return value;
            case 'm':
                return value * 60;
            default:
                return value;
        }
    }

    // Convenience methods
    toMilliseconds() {
        return this.toSeconds() * 1000;
    }

    toBarBeatSixteenth() {
        const seconds = this.toSeconds();
        const quarterNoteDuration = 60 / this.bpm;
        const sixteenthDuration = quarterNoteDuration / 4;

        const totalSixteenths = Math.floor(seconds / sixteenthDuration);
        const beatsPerBar = 4;
        const sixteenthsPerBeat = 4;

        const bar = Math.floor(totalSixteenths / (beatsPerBar * sixteenthsPerBeat));
        const beat = Math.floor((totalSixteenths % (beatsPerBar * sixteenthsPerBeat)) / sixteenthsPerBeat);
        const sixteenth = totalSixteenths % sixteenthsPerBeat;

        return { bar, beat, sixteenth };
    }

    toString() {
        const { bar, beat, sixteenth } = this.toBarBeatSixteenth();
        return `${bar}:${beat}:${sixteenth}`;
    }

    // Static methods for utility
    static timeToSeconds(value, bpm = 120) {
        return new NativeTime(value, bpm).toSeconds();
    }

    static secondsToTime(seconds, bpm = 120) {
        const time = new NativeTime(seconds, bpm);
        return time.toString();
    }

    // Mathematical operations
    add(otherTime) {
        const otherSeconds = new NativeTime(otherTime, this.bpm).toSeconds();
        return new NativeTime(this.toSeconds() + otherSeconds, this.bpm);
    }

    subtract(otherTime) {
        const otherSeconds = new NativeTime(otherTime, this.bpm).toSeconds();
        return new NativeTime(this.toSeconds() - otherSeconds, this.bpm);
    }

    multiply(factor) {
        return new NativeTime(this.toSeconds() * factor, this.bpm);
    }

    divide(factor) {
        return new NativeTime(this.toSeconds() / factor, this.bpm);
    }

    // Comparison methods
    equals(otherTime) {
        const otherSeconds = new NativeTime(otherTime, this.bpm).toSeconds();
        return Math.abs(this.toSeconds() - otherSeconds) < 0.001; // 1ms tolerance
    }

    greaterThan(otherTime) {
        const otherSeconds = new NativeTime(otherTime, this.bpm).toSeconds();
        return this.toSeconds() > otherSeconds;
    }

    lessThan(otherTime) {
        const otherSeconds = new NativeTime(otherTime, this.bpm).toSeconds();
        return this.toSeconds() < otherSeconds;
    }

    // Quantization
    quantize(subdivision = '16n') {
        const subdivisionSeconds = new NativeTime(subdivision, this.bpm).toSeconds();
        const currentSeconds = this.toSeconds();
        const quantizedSeconds = Math.round(currentSeconds / subdivisionSeconds) * subdivisionSeconds;
        return new NativeTime(quantizedSeconds, this.bpm);
    }

    // Swing application
    applySwing(swingAmount = 0, subdivision = '16n') {
        if (swingAmount === 0) return this;

        const subdivisionSeconds = new NativeTime(subdivision, this.bpm).toSeconds();
        const currentSeconds = this.toSeconds();
        const subdivisionPosition = currentSeconds % (subdivisionSeconds * 2);

        // Apply swing to off-beat subdivisions
        if (subdivisionPosition >= subdivisionSeconds) {
            const swingDelay = subdivisionSeconds * swingAmount * 0.3;
            return new NativeTime(currentSeconds + swingDelay, this.bpm);
        }

        return this;
    }
}

// Export for compatibility
export { NativeTime as Time };
export default NativeTimeUtils;
