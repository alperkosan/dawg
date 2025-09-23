// src/lib/core/nodes/NativeSamplerNode.js - ANINDA SUSTURMA YETENEĞİ EKLENDİ VE TONE.JS KALDIRILDI

import { NativeTimeUtils } from '../../utils/NativeTimeUtils';
import { usePlaybackStore } from '../../../src/store/usePlaybackStore';

export class NativeSamplerNode {
  constructor(instrumentData, audioBuffer, audioContext) {
    this.id = instrumentData.id;
    this.name = instrumentData.name;
    this.buffer = audioBuffer;
    this.context = audioContext;
    this.pianoRoll = instrumentData.pianoRoll;
    this.cutItself = instrumentData.cutItself;
    this.output = this.context.createGain();
    
    this.activeSources = new Set();
  }

  triggerNote(pitch, velocity, time, duration) {
    const startTime = time || this.context.currentTime;

    if (this.cutItself) {
      this.stopAll(startTime);
    }

    const source = this.context.createBufferSource();
    source.buffer = this.buffer;

    if (this.pianoRoll) {
      const midiNoteC4 = 60;
      // --- DÜZELTME BURADA: pitch'in tanımsız olma ihtimaline karşı 'C4' varsayılanı ekleniyor.
      const targetMidi = this.pitchToMidi(pitch || 'C4'); 
      const semitoneShift = targetMidi - midiNoteC4;
      // playbackRate'in her zaman geçerli bir sayı olmasını garantiliyoruz.
      source.playbackRate.setValueAtTime(Math.pow(2, semitoneShift / 12), startTime);
    }

    const gainNode = this.context.createGain();
    gainNode.gain.setValueAtTime(velocity, startTime);
    
    source.connect(gainNode);
    gainNode.connect(this.output);

    source.start(startTime);
    
    if (duration) {
      try {
        // --- DEĞİŞİKLİK BURADA ---
        // 1. Güncel BPM'i store'dan alıyoruz.
        const currentBpm = usePlaybackStore.getState().bpm;
        // 2. `Tone.Time` yerine kendi `NativeTimeUtils` aracımızı kullanıyoruz.
        const durationInSeconds = NativeTimeUtils.parseTime(duration, currentBpm);
        
        if (isFinite(durationInSeconds)) {
          source.stop(startTime + durationInSeconds);
        }
      } catch (e) { 
        console.warn(`[NativeSamplerNode] Geçersiz süre formatı: ${duration}`, e);
      }
    }

    this.activeSources.add(source);

    source.onended = () => {
      this.activeSources.delete(source);
      gainNode.disconnect();
      source.disconnect();
    };
  }

  stopAll(time = 0) {
    const stopTime = time || this.context.currentTime;
    this.activeSources.forEach(source => {
      try {
        source.stop(stopTime);
      } catch(e) { /* Zaten durmuş olabilir, hatayı yoksay */ }
    });
    this.activeSources.clear();
  }

  pitchToMidi(pitch) {
    // Eğer pitch null veya undefined ise, hemen varsayılan değeri döndür.
    if (!pitch) return 60; 

    const noteNames = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
    const match = pitch.match(/([A-G]#?)(-?\d+)/);
    if (!match) return 60;
    
    const noteName = match[1];
    const octave = parseInt(match[2], 10);
    const noteValue = noteNames[noteName];

    // Eğer nota ismi haritada bulunamazsa, tanımsız değerle hesaplama yapmasını engelle.
    if (noteValue === undefined) return 60;

    return (octave + 1) * 12 + noteValue;
  }

  releaseNote() {}
}
