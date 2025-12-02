/**
 * Metronome - Audio click sound generator
 * 
 * Generates metronome click sounds for count-in and recording
 */

export class Metronome {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.oscillator = null;
        this.gainNode = null;
        this.isInitialized = false;
    }

    /**
     * Initialize metronome audio nodes
     */
    initialize() {
        if (this.isInitialized) return;

        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = 0;
        this.gainNode.connect(this.audioContext.destination);

        this.isInitialized = true;
    }

    /**
     * Play a click sound
     * @param {number} frequency - Frequency of the click (higher for accent)
     * @param {number} duration - Duration in seconds
     * @param {number} volume - Volume (0-1)
     */
    playClick(frequency = 1000, duration = 0.05, volume = 0.3) {
        if (!this.isInitialized) {
            this.initialize();
        }

        const now = this.audioContext.currentTime;
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(volume, now + 0.001);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.start(now);
        oscillator.stop(now + duration);
    }

    /**
     * Play a standard click (beat)
     */
    playBeat() {
        this.playClick(1000, 0.05, 0.3);
    }

    /**
     * Play an accent click (downbeat/bar)
     */
    playAccent() {
        this.playClick(1200, 0.08, 0.5);
    }

    /**
     * Start metronome with specified BPM
     * @param {number} bpm - Beats per minute
     * @param {number} beatsPerBar - Beats per bar (default: 4)
     * @param {Function} onBeat - Callback on each beat
     */
    start(bpm, beatsPerBar = 4, onBeat = null) {
        this.stop();

        const msPerBeat = (60000 / bpm);
        let beatCount = 0;

        this.intervalId = setInterval(() => {
            beatCount++;
            const isDownbeat = (beatCount % beatsPerBar === 1);

            if (isDownbeat) {
                this.playAccent();
            } else {
                this.playBeat();
            }

            if (onBeat) {
                onBeat(beatCount, isDownbeat);
            }
        }, msPerBeat);
    }

    /**
     * Stop metronome
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Cleanup
     */
    dispose() {
        this.stop();
        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }
        this.isInitialized = false;
    }
}

export default Metronome;




