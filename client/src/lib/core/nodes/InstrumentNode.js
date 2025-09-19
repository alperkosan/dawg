import * as Tone from 'tone';
import { INSTRUMENT_TYPES } from '../../../config/constants'; // GÜNCELLENDİ

export class InstrumentNode {
  constructor(instrumentData) {
    this.id = instrumentData.id;
    this.type = instrumentData.type;
    this.pianoRoll = instrumentData.pianoRoll;
    this.isReady = false;
    this.node = null;
    this.output = new Tone.Channel(0, 0);

    this.readyPromise = this._initialize(instrumentData);
  }

  async _initialize(instrumentData) {
    try {
      if (this.type === INSTRUMENT_TYPES.SAMPLE) { // GÜNCELLENDİ
        this.node = await new Promise((resolve, reject) => {
          const sampler = new Tone.Sampler({
            urls: { C4: instrumentData.url },
            baseUrl: window.location.origin,
            onload: () => resolve(sampler),
            onerror: reject,
            envelope: instrumentData.envelope,
          });
        });
        console.info(`✅ Sample yüklendi: ${instrumentData.name}`);
      } else if (this.type === INSTRUMENT_TYPES.SYNTH) { // GÜNCELLENDİ
        this.node = new Tone.PolySynth(Tone.Synth, {
          oscillator: instrumentData.synthParams?.oscillator || { type: 'sawtooth' },
          envelope: instrumentData.synthParams?.envelope || { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.8 }
        });
        console.info(`✅ Synth oluşturuldu: ${instrumentData.name}`);
      } else {
        throw new Error(`Bilinmeyen enstrüman tipi: ${this.type}`);
      }

      this.node.connect(this.output);
      this.isReady = true;
      return this;
    } catch (error) {
      console.error(`❌ Enstrüman başlatılamadı: ${instrumentData.name}`, error);
      throw error;
    }
  }

  updateParameters(instrumentData) {
    if (!this.node) return;

    if (instrumentData.envelope) {
      this.node.set({ envelope: instrumentData.envelope });
    }
    if (instrumentData.synthParams) {
      this.node.set(instrumentData.synthParams);
    }
    this.pianoRoll = instrumentData.pianoRoll;
  }

  trigger(time, note, bufferDuration, cutItself) {
    if (!this.node) return;
    const pitchToPlay = note.pitch || 'C4';
    const duration = note.duration || "1n";
    const velocity = note.velocity ?? 1.0;

    if (this.type === INSTRUMENT_TYPES.SAMPLE) { // GÜNCELLENDİ
      if (cutItself) this.node.releaseAll(time);
      this.node.triggerAttackRelease(this.pianoRoll ? pitchToPlay : 'C4', duration, time, velocity);
    } else if (this.type === INSTRUMENT_TYPES.SYNTH) { // GÜNCELLENDİ
      this.node.triggerAttackRelease(pitchToPlay, duration, time, velocity);
    }
  }
  
  triggerAttack(pitch, time, velocity) {
    if (!this.isReady || !this.node) return;
    this.node.triggerAttack(pitch, time, velocity);
  }

  triggerRelease(pitch, time) {
    if (!this.isReady || !this.node) return;
    this.node.triggerRelease(pitch, time);
  }

  dispose() {
    this.node?.dispose();
    this.output?.dispose();
  }
}
