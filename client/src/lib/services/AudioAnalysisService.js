/**
 * AudioAnalysisService
 * 
 * Real-time audio feature extraction for the Co-Producer AI Assistant.
 * Listens to the master output and extracts harmonic, temporal, and spectral features.
 */

import { MixerService } from './MixerService';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import EventBus from '../core/EventBus';

export class AudioAnalysisService {
    static instance = null;

    static getInstance() {
        if (!this.instance) {
            this.instance = new AudioAnalysisService();
        }
        return this.instance;
    }

    constructor() {
        this.analyzer = null;
        this.isAnalyzing = false;
        this.analysisInterval = null;
        this.dataArray = null;
        this.activeListeners = 0; // Optimization: only analyze when UI is open
        this.bufferLength = 0;

        // Feature storage
        this.features = {
            rms: 0,
            peak: 0,
            energy: 0,
            spectralCentroid: 0,
            detectedKey: 'Scanning...',
            detectedBpm: 0,
            confidence: 0
        };

        this.pitchClasses = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        this.chroma = new Float32Array(12);
        this.rootChroma = new Float32Array(12); // Specific for sub-bass roots
        this.keyBuffer = []; // For smoothing key detection
        this.MAX_KEY_BUFFER = 20;

        // Krumhansl-Schmuckler Key Profiles
        this.profiles = {
            major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
            minor: [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
        };

        this.updateIntervalMs = 100; // Analysis frequency
    }

    /**
     * Start the analysis engine by connecting to the master analyzer
     */
    start() {
        this.activeListeners++;
        if (this.isAnalyzing) return;

        console.log('🚀 AudioAnalysisService: Requesting start (Listeners:', this.activeListeners, ')');

        this.analyzer = MixerService.getAnalyzer('master');
        if (!this.analyzer) {
            console.warn('⚠️ AudioAnalysisService: Master analyzer not available yet. Retrying in 1s...');
            setTimeout(() => { if (this.activeListeners > 0) this.start(); }, 1000);
            return;
        }

        // Increase FFT size for higher frequency resolution (16384 is essential for sub-bass precision)
        this.analyzer.fftSize = 16384;
        this.isAnalyzing = true;
        this.bufferLength = this.analyzer.frequencyBinCount;
        this.dataArray = new Float32Array(this.bufferLength);
        this.timeDataArray = new Float32Array(this.bufferLength);

        if (this.analysisInterval) clearInterval(this.analysisInterval);
        this.analysisInterval = setInterval(() => this._performAnalysis(), this.updateIntervalMs);
    }

    /**
     * Stop the analysis engine
     */
    stop() {
        this.activeListeners = Math.max(0, this.activeListeners - 1);
        if (this.activeListeners > 0) return;

        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
            this.analysisInterval = null;
        }
        this.isAnalyzing = false;
        console.log('🛑 AudioAnalysisService: All listeners gone. Analysis stopped.');
    }

    /**
     * Internal analysis loop
     * @private
     */
    _performAnalysis() {
        if (!this.analyzer) return;

        // Get Frequency and Time Domain data
        this.analyzer.getFloatFrequencyData(this.dataArray);
        this.analyzer.getFloatTimeDomainData(this.timeDataArray);

        // 1. Calculate RMS and Peak (Time Domain)
        let sumSquares = 0;
        let peakValue = 0;
        for (let i = 0; i < this.timeDataArray.length; i++) {
            const val = this.timeDataArray[i];
            sumSquares += val * val;
            if (Math.abs(val) > peakValue) peakValue = Math.abs(val);
        }

        this.features.rms = Math.sqrt(sumSquares / this.timeDataArray.length);
        this.features.peak = peakValue;

        // 2. Calculate Energy (Frequency Domain)
        let totalEnergy = 0;
        let weightedFreqSum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            // Convert dB to linear frequency energy
            const energy = Math.pow(10, this.dataArray[i] / 20);
            totalEnergy += energy;
            weightedFreqSum += energy * i;
        }

        this.features.energy = totalEnergy;

        // 3. Spectral Centroid (Rough "brightness" indicator)
        if (totalEnergy > 0) {
            this.features.spectralCentroid = weightedFreqSum / totalEnergy;
        }

        // 4. Temporal Analysis (Sync with DAW BPM)
        this.features.detectedBpm = usePlaybackStore.getState().bpm;

        // 5. Harmonic Analysis (Simplified Chroma)
        this._analyzeKey();

        // Emit features for Co-Producer UI
        EventBus.emit('AUDIO_ANALYSIS_FEATURES', this.features);
    }

    /**
     * Map frequency bins to 12 semitones
     * @private
     */
    _analyzeKey() {
        if (!this.analyzer || !this.dataArray) return;

        const currentSampleRate = this.analyzer.context.sampleRate;
        const currentBinFreq = currentSampleRate / this.analyzer.fftSize;

        // Reset both chromas
        this.chroma.fill(0);
        this.rootChroma.fill(0);

        // Analyze frequency range (C1 to C5 for harmonics, C1 to A4 for roots)
        for (let i = 0; i < this.dataArray.length; i++) {
            const freq = i * currentBinFreq;
            // Ignore high-frequency sparkle for key detection
            if (freq < 30 || freq > 800) continue;

            // Power-based weighting (db/10) makes spectral peaks much more dominant
            const energy = Math.pow(10, this.dataArray[i] / 10);
            if (energy < 0.000001) continue;

            const midiNote = 12 * Math.log2(freq / 440) + 69;
            const pitchClass = (Math.round(midiNote) % 12 + 12) % 12;

            // 1. Root Chroma (Bass foundation: 30-400Hz)
            if (freq < 400) {
                // Extreme bias for the fundamental region (30-150Hz)
                const subBias = freq < 150 ? 10.0 : 1.0;
                this.rootChroma[pitchClass] += energy * 1000.0 * subBias;
            }

            // 2. Harmonic Chroma (Musical body: 30-800Hz)
            const weight = freq < 400 ? 50.0 : 1.0;
            this.chroma[pitchClass] += energy * weight;
        }

        // Normalize chroma
        let sum = 0;
        for (let i = 0; i < 12; i++) sum += this.chroma[i];
        if (sum < 0.00000001) return;
        for (let i = 0; i < 12; i++) this.chroma[i] /= sum;

        // Normalize rootChroma for relative comparison
        let rootSum = 0;
        for (let i = 0; i < 12; i++) rootSum += this.rootChroma[i];
        if (rootSum > 0) {
            for (let i = 0; i < 12; i++) this.rootChroma[i] /= rootSum;
        }

        // Determine the \"Sub-Bass Root\" via Lowest-Significant-Peak (Dictator Mode)
        let rootPC = -1;
        let maxRootE = 0;
        let maxEnergy = -Infinity;
        let dictatorFreq = -1;

        // 1. Find the absolute strongest spectral peak below 300Hz
        let strongestBin = -1;
        for (let i = 0; i < this.dataArray.length; i++) {
            const freq = i * currentBinFreq;
            if (freq < 30) continue;
            if (freq > 300) break;
            if (this.dataArray[i] > maxEnergy) {
                maxEnergy = this.dataArray[i];
                strongestBin = i;
            }
        }

        // 2. Dictator Preference: Pick the LOWEST frequency bin that is within 6dB of that peak.
        if (maxEnergy > -60) {
            for (let i = 0; i < this.dataArray.length; i++) {
                const freq = i * currentBinFreq;
                if (freq < 30) continue;
                if (freq > 300) break;
                if (this.dataArray[i] > maxEnergy - 6.0) {
                    let targetBin = i;

                    // Quadratic Interpolation for sub-bin precision
                    const alpha = this.dataArray[targetBin - 1] || this.dataArray[targetBin];
                    const beta = this.dataArray[targetBin];
                    const gamma = this.dataArray[targetBin + 1] || this.dataArray[targetBin];

                    const p = (alpha - gamma) / (2 * (alpha - 2 * beta + gamma) || 1);
                    dictatorFreq = (targetBin + p) * currentBinFreq;
                    break;
                }
            }
        }

        if (dictatorFreq !== -1) {
            const midiNote = 12 * Math.log2(dictatorFreq / 440) + 69;
            rootPC = (Math.round(midiNote) % 12 + 12) % 12;
            maxRootE = 1.0;
        }

        const correlate = (observed, profile, rootIdx) => {
            let sumObs = 0, sumProf = 0;
            for (let i = 0; i < 12; i++) {
                sumObs += observed[i];
                sumProf += profile[i];
            }
            const meanObs = sumObs / 12;
            const meanProf = sumProf / 12;

            let num = 0, denObs = 0, denProf = 0;
            for (let i = 0; i < 12; i++) {
                const dO = observed[i] - meanObs;
                const dP = profile[i] - meanProf;
                num += dO * dP;
                denObs += dO * dO;
                denProf += dP * dP;
            }

            let r = num / (Math.sqrt(denObs) * Math.sqrt(denProf) || 1);
            return r;
        };

        // Test all 12 major and 12 minor keys
        let bestKey = '';
        let maxCorrelation = -Infinity;

        for (let root = 0; root < 12; root++) {
            const shiftedMajor = Array.from({ length: 12 }, (_, i) => this.profiles.major[(i - root + 12) % 12]);
            const shiftedMinor = Array.from({ length: 12 }, (_, i) => this.profiles.minor[(i - root + 12) % 12]);

            const corrMaj = correlate(this.chroma, shiftedMajor, root);
            const corrMin = correlate(this.chroma, shiftedMinor, root);

            if (corrMaj > maxCorrelation) {
                maxCorrelation = corrMaj;
                bestKey = this.pitchClasses[root];
            }
            if (corrMin > maxCorrelation) {
                maxCorrelation = corrMin;
                bestKey = `${this.pitchClasses[root]}m`;
            }
        }

        // 5. Final Decision with \"Strict Root Anchor\"
        let finalBestKey = bestKey;

        // ABSOLUTE TONIC OVERRIDE: If any note has > 30% of relative sub-bass energy, it's a candidate.
        if (rootPC !== -1 && maxRootE > 0.3) {
            const rootName = this.pitchClasses[rootPC];

            const rMaj = correlate(this.chroma, Array.from({ length: 12 }, (_, i) => this.profiles.major[(i - rootPC + 12) % 12]), rootPC);
            const rMin = correlate(this.chroma, Array.from({ length: 12 }, (_, i) => this.profiles.minor[(i - rootPC + 12) % 12]), rootPC);

            finalBestKey = rMaj >= rMin ? rootName : `${rootName}m`;
            maxCorrelation = Math.max(rMaj, rMin);
        }

        // Debug Log: EVERY 1.5 seconds, show the battle
        if (Date.now() % 1500 < 100) {
            const dictatorName = rootPC !== -1 ? this.pitchClasses[rootPC] : 'NONE';
            const topHarmonics = [...this.chroma].map((v, i) => ({ pc: this.pitchClasses[i], v: (v * 100).toFixed(1) }))
                .sort((a, b) => b.v - a.v).slice(0, 3);

            console.log(`🔍 RootDictator: ${dictatorName} (${dictatorFreq?.toFixed(1)}Hz) | Keys: ${topHarmonics.map(h => `${h.pc}:${h.v}%`).join('|')} | FINAL: ${finalBestKey}`);
        }

        // Smooth detection
        if (sum > 0.0001) {
            this.keyBuffer.push(finalBestKey);
            if (this.keyBuffer.length > this.MAX_KEY_BUFFER) this.keyBuffer.shift();
        }

        // Get most frequent key in buffer
        const counts = {};
        let winner = finalBestKey;
        let maxCount = 0;
        this.keyBuffer.forEach(k => {
            counts[k] = (counts[k] || 0) + 1;
            if (counts[k] > maxCount) {
                maxCount = counts[k];
                winner = k;
            }
        });

        this.features.detectedKey = winner;
        this.features.confidence = maxCorrelation;
    }

    /**
     * Get current features
     */
    getFeatures() {
        return { ...this.features };
    }
}

export const audioAnalysisService = AudioAnalysisService.getInstance();
