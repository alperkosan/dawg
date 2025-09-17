import * as Tone from 'tone';

/**
 * "Kurşun Geçirmez" InstrumentNode v2.1
 * GÜNCELLEME: Artık 'readyPromise' adında bir promise tutuyor.
 * Bu, ses motorunun, buffer yüklemesinin bitmesini beklemesine olanak tanır.
 */
export class InstrumentNode {
  constructor(instrumentData) {
    this.id = instrumentData.id;
    this.pianoRoll = instrumentData.pianoRoll;
    this.isReady = false;

    // YENİ: Tone.Sampler'ın döndürdüğü promise'i yakalayıp saklıyoruz.
    this.readyPromise = new Promise((resolve, reject) => {
        this.sampler = new Tone.Sampler({
            urls: { C4: instrumentData.url },
            baseUrl: window.location.origin,
            onload: () => {
                console.info(`✅ ${instrumentData.name} için buffer yüklendi.`);
                this.isReady = true;
                resolve(this); // Yükleme tamamlandığında promise'i çöz.
            },
            onerror: (error) => {
                console.error(`❌ ${instrumentData.name} için buffer yüklenemedi:`, error);
                reject(error); // Hata durumunda promise'i reddet.
            },
            envelope: instrumentData.envelope,
        });
    });

    this.output = new Tone.Channel(0, 0);
    this.sampler.connect(this.output);
  }

  trigger(time, note, bufferDuration, cutItself) {
    if (!this.isReady) return;
    if (cutItself) this.sampler.releaseAll(time);
    const pitchToPlay = this.pianoRoll ? (note.pitch || 'C4') : 'C4';
    const duration = note.duration || "1n";
    this.sampler.triggerAttackRelease(pitchToPlay, duration, time, note.velocity ?? 1.0);
  }
  
  triggerAttack(pitch, time, velocity) {
    if (!this.sampler.loaded) return;
    this.sampler.triggerAttack(pitch, time, velocity);
  }

  triggerRelease(pitch, time) {
    if (!this.sampler.loaded) return;
    this.sampler.triggerRelease(pitch, time);
  }

  updateParameters(instrumentData) {
    if (this.sampler.envelope && instrumentData.envelope) {
      this.sampler.set({ envelope: instrumentData.envelope });
    }
    this.pianoRoll = instrumentData.pianoRoll;
  }

  dispose() {
    this.sampler.dispose();
    this.output.dispose();
  }
}
