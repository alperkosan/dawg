import * as Tone from 'tone';

/**
 * "Kurşun Geçirmez" InstrumentNode v2.0
 * Bu versiyon, her enstrümanı kendi ses verisini yüklemekten ve yönetmekten
 * sorumlu, tamamen izole bir birim haline getirir. Bu, enstrümanlar arası
 * buffer sızıntısını ve "yarış durumu" hatalarını mimari olarak engeller.
 */
export class InstrumentNode {
  constructor(instrumentData) {
    this.id = instrumentData.id;
    this.pianoRoll = instrumentData.pianoRoll;
    this.isReady = false;

    this.sampler = new Tone.Sampler({
      urls: { C4: instrumentData.url },
      baseUrl: window.location.origin,
      onload: () => {
        this.isReady = true;
      },
      onerror: (error) => {
        console.error(`❌ ${instrumentData.name} için buffer yüklenemedi:`, error);
      },
      envelope: instrumentData.envelope,
    });

    this.output = new Tone.Channel(0, 0);
    
    // NİHAİ DÜZELTME: Sampler'ın ses çıkışını, enstrümanın ana çıkışına bağlıyoruz.
    // BU SATIR OLMADAN HİÇBİR SES DIŞARI ÇIKAMAZ!
    this.sampler.connect(this.output);
  }

  /**
   * Bu fonksiyon artık AudioEngine tarafından kullanılmayacak.
   * Her node kendi buffer'ını kendisi yönetir.
   * Yine de uyumluluk için boş olarak bırakmakta fayda var.
   */
  updateBuffer(newBuffer) {
    // Bu metodun içi artık boş.
  }

  /**
   * Sesi tetiklemeden önce, Sampler'ın hazır olup olmadığını KONTROL EDER.
   */
  trigger(time, note, bufferDuration, cutItself) {
    // Eğer buffer henüz yüklenmediyse, hiçbir şey yapma. Bu, hataları önler.
    if (!this.isReady) {
      return;
    }

    if (cutItself) {
      this.sampler.releaseAll(time);
    }

    const pitchToPlay = this.pianoRoll ? (note.pitch || 'C4') : 'C4';
    
    // Artık bufferDuration'a ihtiyacımız yok, Sampler kendi süresini bilir.
    const duration = note.duration || "1n"; // Varsayılan bir süre verelim.
    
    this.sampler.triggerAttackRelease(
      pitchToPlay, 
      duration, 
      time, 
      note.velocity ?? 1.0
    );
  }
  
  // YENİ: Nota deneme (auditioning) için anlık çalma
  triggerAttack(pitch, time, velocity) {
    if (!this.sampler.loaded) return;
    this.sampler.triggerAttack(pitch, time, velocity);
  }

  // YENİ: Nota deneme (auditioning) için anlık susturma
  triggerRelease(pitch, time) {
    if (!this.sampler.loaded) return;
    this.sampler.triggerRelease(pitch, time);
  }

  /**
   * Enstrüman parametrelerini günceller.
   */
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