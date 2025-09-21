import * as Tone from 'tone';
import { INSTRUMENT_TYPES } from '../../../config/constants';

export class InstrumentNode {
  constructor(instrumentData) {
    this.id = instrumentData.id;
    this.type = instrumentData.type;
    this.pianoRoll = instrumentData.pianoRoll;
    this.isReady = false;
    this.node = null;

    // Sinyal zinciri bileşenleri
    this.filter = null;
    this.lfo1 = null;
    this.lfo2 = null; // YENİ: İkinci LFO
    this.panner = new Tone.Panner(0); // YENİ: Pan modülasyonu için
    this.output = new Tone.Channel(0, 0);

    // YENİ: Aktif modülasyon bağlantılarını takip etmek için
    this.activeModulations = [];

    this.readyPromise = this._initialize(instrumentData);
  }

  async _initialize(instrumentData) {
    try {
      if (this.type === INSTRUMENT_TYPES.SYNTH) {
        this.node = new Tone.PolySynth(Tone.Synth, instrumentData.synthParams);
        
        this.filter = new Tone.Filter(instrumentData.synthParams?.filter);
        this.lfo1 = new Tone.LFO(instrumentData.synthParams?.lfo1).start();
        this.lfo2 = new Tone.LFO(instrumentData.synthParams?.lfo2).start(); // YENİ

        // Sinyal Zinciri: Synth -> Filtre -> Panner -> Çıkış
        this.node.chain(this.filter, this.panner, this.output);

        // Başlangıç modülasyonlarını uygula
        this.updateParameters(instrumentData);

        console.info(`✅ Modülasyon Matrisli Synth oluşturuldu: ${instrumentData.name}`);
      } else {
         // Sample enstrümanları için mevcut kod aynı kalıyor...
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
        this.node.connect(this.output);
      }
      
      this.isReady = true;
      return this;
    } catch (error) {
      console.error(`❌ Enstrüman başlatılamadı: ${instrumentData.name}`, error);
      throw error;
    }
  }

  // === MODÜLASYON MATRİSİNİN BEYNİ ===
  updateParameters(instrumentData) {
    if (!this.node) return;
    this.pianoRoll = instrumentData.pianoRoll;

    if (this.type === INSTRUMENT_TYPES.SYNTH && instrumentData.synthParams) {
      // Temel parametreleri güncelle
      this.node.set(instrumentData.synthParams);
      if (this.filter) this.filter.set(instrumentData.synthParams.filter);
      if (this.lfo1) this.lfo1.set(instrumentData.synthParams.lfo1);
      if (this.lfo2) this.lfo2.set(instrumentData.synthParams.lfo2); // YENİ
      
      // --- Akıllı Modülasyon Yönlendirmesi ---
      
      // 1. Önceki tüm modülasyon bağlantılarını temizle
      this.activeModulations.forEach(mod => mod.dispose());
      this.activeModulations = [];

      // 2. State'deki modülasyon matrisine göre yeni bağlantıları kur
      instrumentData.synthParams.modMatrix?.forEach(slot => {
        if (!slot || slot.amount === 0 || slot.source === 'none' || slot.destination === 'none') {
            return;
        }

        const sourceNode = slot.source === 'lfo1' ? this.lfo1 : this.lfo2;
        let destParam;
        
        // Hedef parametreyi bul
        switch(slot.destination) {
            case 'filterFreq': destParam = this.filter.frequency; break;
            case 'filterQ': destParam = this.filter.Q; break;
            case 'oscPitch': destParam = this.node.voice.oscillator.frequency; break; // Bu tüm notaları etkiler
            case 'pan': destParam = this.panner.pan; break;
            default: return;
        }

        // 3. Amount'u (miktarı) ölçeklendirmek için bir Gain düğümü kullan
        const modAmountNode = new Tone.Gain(slot.amount);
        sourceNode.connect(modAmountNode);
        modAmountNode.connect(destParam);
        
        // Bu bağlantıyı daha sonra temizleyebilmek için sakla
        this.activeModulations.push(modAmountNode);
      });
    } else if (instrumentData.envelope) {
      this.node.set({ envelope: instrumentData.envelope });
    }
  }

  // trigger, triggerAttack, triggerRelease ve dispose metodları öncekiyle aynı
  trigger(time, note, bufferDuration, cutItself) {
    if (!this.node) return;
    const pitchToPlay = note.pitch || 'C4';
    const duration = note.duration || "1n";
    const velocity = note.velocity ?? 1.0;

    if (this.type === INSTRUMENT_TYPES.SAMPLE) {
      if (cutItself) this.node.releaseAll(time);
      this.node.triggerAttackRelease(this.pianoRoll ? pitchToPlay : 'C4', duration, time, velocity);
    } else if (this.type === INSTRUMENT_TYPES.SYNTH) {
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
    this.filter?.dispose();
    this.lfo1?.dispose();
    this.lfo2?.dispose();
    this.panner?.dispose();
    this.activeModulations.forEach(mod => mod.dispose());
  }
}