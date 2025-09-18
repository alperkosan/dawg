import * as Tone from 'tone';

/**
 * "Kurşun Geçirmez" InstrumentNode v3.0
 * GÜNCELLEME: Artık 'sample' ve 'synth' olmak üzere iki tür enstrümanı destekliyor.
 * Generic 'this.node' propertysi ile her iki tipi de yönetir.
 */
export class InstrumentNode {
  constructor(instrumentData) {
    this.id = instrumentData.id;
    this.type = instrumentData.type;
    this.pianoRoll = instrumentData.pianoRoll;
    this.isReady = false;
    this.node = null; // Sampler veya PolySynth'i tutacak
    this.output = new Tone.Channel(0, 0);

    this.readyPromise = this._initialize(instrumentData);
  }

  async _initialize(instrumentData) {
    try {
      if (this.type === 'sample') {
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
      } else if (this.type === 'synth') {
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
      return this; // Kendini döndürerek zincirleme işlemlere izin ver
    } catch (error) {
      console.error(`❌ Enstrüman başlatılamadı: ${instrumentData.name}`, error);
      // Hata durumunda bile promise'i reddederek bekleyen işlemlerin haberdar olmasını sağla
      throw error;
    }
  }

  // --- MOTOR İLETİŞİMİNİN SON DURAĞI ---
  // Gelen yeni parametreleri doğrudan Tone.js enstrümanına uygular.
  updateParameters(instrumentData) {
    if (!this.node) return;

    // Hem 'sample' hem de 'synth' tipleri için bu ortak metot çalışır.
    // Bu, Tone.js'in en verimli anlık güncelleme yöntemidir.
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

    if (this.type === 'sample') {
      if (cutItself) this.node.releaseAll(time);
      this.node.triggerAttackRelease(this.pianoRoll ? pitchToPlay : 'C4', duration, time, velocity);
    } else if (this.type === 'synth') {
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