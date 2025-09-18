import * as Tone from 'tone';
import { AudioMath } from '../utils/audioMath';

export class SpectrumAnalyzer {
  constructor(audioNode) {
    this.analyzer = new Tone.Analyser('fft', 2048);
    this.waveformAnalyzer = new Tone.Analyser('waveform', 1024);
    
    if (audioNode) {
      audioNode.connect(this.analyzer);
      audioNode.connect(this.waveformAnalyzer);
    }
    
    this.isRunning = false;
    this.animationFrame = null;
    this.callbacks = {
      onSpectrum: null,
      onWaveform: null,
      onFeatures: null
    };
  }

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.analyze();
  }

  stop() {
    this.isRunning = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  analyze() {
    if (!this.isRunning) return;

    // Get spectrum and waveform data
    const spectrum = this.analyzer.getValue();
    const waveform = this.waveformAnalyzer.getValue();

    // Extract features
    const features = this.extractFeatures(spectrum, waveform);

    // Trigger callbacks
    this.callbacks.onSpectrum?.(spectrum);
    this.callbacks.onWaveform?.(waveform);
    this.callbacks.onFeatures?.(features);

    this.animationFrame = requestAnimationFrame(() => this.analyze());
  }

  extractFeatures(spectrum, waveform) {
    // Convert spectrum to linear values
    const linearSpectrum = spectrum.map(db => AudioMath.dbToLinear(db));
    
    // Calculate spectral centroid
    const centroid = AudioMath.calculateSpectralCentroid(linearSpectrum);
    
    // Calculate RMS
    const rms = AudioMath.calculateRMS(waveform);
    
    // Calculate peak
    const peak = Math.max(...waveform.map(Math.abs));
    
    // Spectral rolloff (90% of energy)
    let cumulativeEnergy = 0;
    const totalEnergy = linearSpectrum.reduce((sum, mag) => sum + mag * mag, 0);
    const targetEnergy = totalEnergy * 0.9;
    
    let rolloff = 0;
    for (let i = 0; i < linearSpectrum.length; i++) {
      cumulativeEnergy += linearSpectrum[i] * linearSpectrum[i];
      if (cumulativeEnergy >= targetEnergy) {
        rolloff = (i / linearSpectrum.length) * 22050; // Nyquist frequency
        break;
      }
    }
    
    // Spectral flux (change in spectrum)
    const flux = this.calculateSpectralFlux(linearSpectrum);
    
    return {
      centroid,
      rms,
      peak,
      rolloff,
      flux,
      timestamp: Date.now()
    };
  }

  calculateSpectralFlux(currentSpectrum) {
    if (!this.previousSpectrum) {
      this.previousSpectrum = currentSpectrum;
      return 0;
    }

    let flux = 0;
    for (let i = 0; i < currentSpectrum.length; i++) {
      const diff = currentSpectrum[i] - this.previousSpectrum[i];
      if (diff > 0) flux += diff;
    }

    this.previousSpectrum = currentSpectrum;
    return flux / currentSpectrum.length;
  }

  onSpectrum(callback) { 
    this.callbacks.onSpectrum = callback; 
    return this;
  }

  onWaveform(callback) { 
    this.callbacks.onWaveform = callback; 
    return this;
  }

  onFeatures(callback) { 
    this.callbacks.onFeatures = callback; 
    return this;
  }

  dispose() {
    this.stop();
    this.analyzer.dispose();
    this.waveformAnalyzer.dispose();
  }
}