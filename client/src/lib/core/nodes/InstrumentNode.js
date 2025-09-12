import * as Tone from 'tone';

const semitonesToPlaybackRate = (semitones) => {
  return Math.pow(2, semitones / 12);
};

const noteToMidi = (note) => {
  return Tone.Frequency(note).toMidi();
}

export class InstrumentNode {
  constructor(instrumentData, buffer) {
    this.id = instrumentData.id;
    this.baseMidi = 60;
    
    // State tracking için yeni özellikler
    this.isEnvelopeBusy = false;
    this.lastTriggerTime = 0;
    this.pendingRelease = null; // Bekleyen release işlemini takip et
    
    // Ses düğümleri
    this.output = new Tone.Channel(0, 0);
    this.player = new Tone.Player(buffer);
    this.envelope = new Tone.AmplitudeEnvelope(instrumentData.envelope);

    // Bağlantılar
    this.player.connect(this.envelope);
    this.envelope.connect(this.output);

    // Envelope olaylarını dinle
    this.envelope.onsilence = () => {
      this.isEnvelopeBusy = false;
      this.pendingRelease = null;
    };

    // Player olaylarını dinle
    this.player.onstop = () => {
      // Player durduğunda envelope'u da temizle
      if (this.isEnvelopeBusy) {
        this.forceEnvelopeRelease();
      }
    };

    this.updateParameters(instrumentData);
  }

  /**
   * Zarf (envelope) güvenli bir şekilde temizler.
   */
  _cleanupEnvelope(time) {
    // Pending release varsa iptal et
    if (this.pendingRelease) {
      Tone.Transport.clear(this.pendingRelease);
      this.pendingRelease = null;
    }

    if (this.isEnvelopeBusy) {
      try {
        // Küçük bir gecikme ile release
        const releaseTime = Math.max(time - 0.002, Tone.now());
        this.envelope.triggerRelease(releaseTime);
        this.isEnvelopeBusy = false;
      } catch (error) {
        console.warn(`[INSTRUMENT] Envelope cleanup hatası ${this.id}:`, error);
        // Force cleanup
        this.forceEnvelopeRelease();
      }
    }
  }

  /**
   * Envelope'u zorla serbest bırak
   */
  forceEnvelopeRelease() {
    try {
      this.envelope.triggerRelease();
      this.isEnvelopeBusy = false;
      this.pendingRelease = null;
    } catch (error) {
      console.warn(`[INSTRUMENT] Force release hatası ${this.id}:`, error);
    }
  }

  /**
   * Player'ı güvenli bir şekilde durdur
   */
  stopPlayerSafely(time) {
    try {
      if (this.player.state === 'started') {
        // Transport time'ı kontrol et
        const stopTime = Math.max(time, Tone.now());
        this.player.stop(stopTime);
      }
    } catch (error) {
      console.warn(`[INSTRUMENT] Durdurma hatası ${this.id}:`, error);
      // Force stop
      try {
        this.player.stop();
      } catch (e) {
        // Ignore force stop errors
      }
    }
  }

  /**
   * Player'ı güvenli bir şekilde başlat
   */
  startPlayerSafely(time) {
    try {
      // Önce durduğundan emin ol
      if (this.player.state === 'started') {
        this.player.stop(time - 0.001);
      }
      
      // Buffer'ın hazır olduğunu kontrol et
      if (!this.player.buffer || !this.player.buffer.loaded) {
        console.warn(`[INSTRUMENT] Buffer hazır değil: ${this.id}`);
        return;
      }

      this.player.start(time);
    } catch (error) {
      console.error(`[INSTRUMENT] Başlatma hatası ${this.id}:`, error);
    }
  }

  /**
   * KRİTİK DÜZELTİLMİŞ trigger metodu - Envelope state management ile
   */
  trigger(time, note, bufferDuration, cutItself, instrumentData) {
    // Çok yakın zamanlı tetiklemeleri engelle (debounce)
    const currentTime = Tone.now();
    const timeDiff = Math.abs(time - this.lastTriggerTime);
    if (timeDiff < 0.001) { // 1ms minimum aralık
      console.warn(`[INSTRUMENT] Çok yakın tetikleme engellendi: ${this.id}`);
      return;
    }

    try {
      // KRİTİK: Her durumda envelope'u temizle
      this._cleanupEnvelope(time);

      // Pitch hesaplama
      let pitchToPlay = this.baseMidi;
      if (instrumentData.pianoRoll) {
        pitchToPlay = noteToMidi(note.pitch);
      }
      
      const semitoneShift = pitchToPlay - this.baseMidi;
      this.player.playbackRate = semitonesToPlaybackRate(semitoneShift);

      // GÜVENLİ başlatma - Küçük offset ile timing conflict'i önle
      const safeStartTime = time + 0.003; // 3ms offset
      this.startPlayerSafely(safeStartTime);
      
      // Envelope'u güvenli şekilde tetikle
      const duration = note.duration ? Tone.Time(note.duration).toSeconds() : bufferDuration;
      this.envelope.triggerAttackRelease(duration, safeStartTime, note.velocity ?? 1.0);
      this.isEnvelopeBusy = true;

      // Release zamanını hesapla ve otomatik temizlik planla
      const releaseTime = safeStartTime + duration;
      this.pendingRelease = Tone.Transport.schedule(() => {
        this.isEnvelopeBusy = false;
        this.pendingRelease = null;
      }, releaseTime + 0.1); // Release'den 100ms sonra temizle

      this.lastTriggerTime = time;

    } catch (error) {
      console.error(`[INSTRUMENT] Tetikleme hatası ${this.id}:`, error);
    }
  }

  updateBuffer(newBuffer) {
    this.player.buffer = newBuffer;
  }

  updateParameters(instrumentData) {
    if (instrumentData.envelope) {
      this.envelope.set(instrumentData.envelope);
    }
    this.instrumentData = instrumentData;
  }

  dispose() {
    // Pending işlemleri temizle
    if (this.pendingRelease) {
      Tone.Transport.clear(this.pendingRelease);
    }
    
    this.forceEnvelopeRelease();
    this.player.dispose();
    this.envelope.dispose();
    this.output.dispose();
  }
}