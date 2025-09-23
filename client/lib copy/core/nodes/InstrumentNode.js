import * as Tone from 'tone';
import { INSTRUMENT_TYPES } from '../../../config/constants';

const MODULATION_TARGET_RANGES = {
    filterFreq: { min: 20, max: 15000 },
    filterQ: { min: 0.1, max: 18 },
    oscPitch: { min: -2400, max: 2400 },
    pan: { min: -1, max: 1 },
};

export class InstrumentNode {
  constructor(instrumentData) {
    this.id = instrumentData.id;
    this.type = instrumentData.type;
    this.pianoRoll = instrumentData.pianoRoll;
    this.isReady = false;
    this.node = null;

    this.filter = null;
    this.filterEnv = null;
    this.lfo1 = null;
    this.lfo2 = null;
    this.panner = new Tone.Panner(0);
    this.output = new Tone.Channel(0, 0);
    this.activeModulations = [];

    this.readyPromise = this._initialize(instrumentData);
  }

  async _initialize(instrumentData) {
    try {
      if (this.type === INSTRUMENT_TYPES.SYNTH) {
        this.node = new Tone.PolySynth(Tone.Synth, {
            oscillator: instrumentData.synthParams.oscillator,
            envelope: instrumentData.synthParams.envelope,
            detune: instrumentData.synthParams.oscillator.detune || 0,
        });
        
        this.filter = new Tone.Filter(instrumentData.synthParams.filter);
        this.filterEnv = new Tone.FrequencyEnvelope(instrumentData.synthParams.filterEnv);
        this.lfo1 = new Tone.LFO(instrumentData.synthParams.lfo1).start();
        this.lfo2 = new Tone.LFO(instrumentData.synthParams.lfo2).start();

        this.filterEnv.connect(this.filter.frequency);
        this.node.chain(this.filter, this.panner, this.output);

        this.updateParameters(instrumentData);
        console.info(`✅ Synth oluşturuldu: ${instrumentData.name}`);

      } else if (this.type === INSTRUMENT_TYPES.SAMPLE) {
        // === KRİTİK DÜZELTME: Hatalı .toPromise() yapısı kaldırıldı, doğru callback yapısı geri getirildi ===
        this.node = await new Promise((resolve, reject) => {
          const sampler = new Tone.Sampler({
            urls: { C4: instrumentData.url },
            baseUrl: window.location.origin,
            onload: () => resolve(sampler), // Yüklendiğinde sampler'ı döndür
            onerror: (err) => reject(err),   // Hata durumunda reddet
            envelope: instrumentData.envelope,
          });
        });
        this.node.connect(this.output);
        console.info(`✅ Sample yüklendi: ${instrumentData.name}`);
      }
      
      this.isReady = true;
      return this;
    } catch (error) {
      console.error(`❌ Enstrüman başlatılamadı: ${instrumentData.name}`, error);
      throw error;
    }
  }
  
  updateParameters(instrumentData) {
    if (!this.node) return;
    this.pianoRoll = instrumentData.pianoRoll;

    if (this.type === INSTRUMENT_TYPES.SYNTH && instrumentData.synthParams) {
      this.node.set({
          detune: instrumentData.synthParams.oscillator.detune || 0,
      });
      if (this.node.voices) { // Güvenlik kontrolü
        this.node.voices.forEach(voice => {
            if (voice && voice.oscillator) voice.oscillator.set(instrumentData.synthParams.oscillator);
            if (voice && voice.envelope) voice.envelope.set(instrumentData.synthParams.envelope);
        });
      }

      if (this.filter) this.filter.set(instrumentData.synthParams.filter);
      if (this.filterEnv) this.filterEnv.set(instrumentData.synthParams.filterEnv);
      if (this.lfo1) this.lfo1.set(instrumentData.synthParams.lfo1);
      if (this.lfo2) this.lfo2.set(instrumentData.synthParams.lfo2);
      
      this.activeModulations.forEach(mod => mod.dispose());
      this.activeModulations = [];

      instrumentData.synthParams.modMatrix?.forEach(slot => {
        if (!slot || slot.amount === 0 || slot.source === 'none' || slot.destination === 'none') return;
        const sourceNode = slot.source === 'lfo1' ? this.lfo1 : this.lfo2;
        let destParam;
        
        switch(slot.destination) {
            case 'filterFreq': destParam = this.filter.frequency; break;
            case 'filterQ': destParam = this.filter.Q; break;
            case 'oscPitch': destParam = this.node.detune; break;
            case 'pan': destParam = this.panner.pan; break;
            default: return;
        }

        const targetRange = MODULATION_TARGET_RANGES[slot.destination];
        if (!targetRange || !destParam) return;
        
        const scaleNode = new Tone.Scale(targetRange.min, targetRange.max);
        const modAmountNode = new Tone.Gain(slot.amount);
        const addNode = new Tone.Add();
        addNode.connect(destParam);
        addNode.addend.value = destParam.value;

        sourceNode.connect(scaleNode);
        scaleNode.connect(modAmountNode);
        modAmountNode.connect(addNode.addend);
        
        this.activeModulations.push({ dispose: () => {
            if (sourceNode && !sourceNode.disposed) sourceNode.disconnect(scaleNode);
            scaleNode.dispose();
            modAmountNode.dispose();
            addNode.dispose();
        }});
      });
    } else if (instrumentData.envelope) {
      this.node.set({ envelope: instrumentData.envelope });
    }
  }

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
      if (this.filterEnv) {
          this.filterEnv.triggerAttackRelease(duration, time, velocity);
      }
    }
  }
  
  triggerAttack(pitch, time, velocity) {
    if (!this.isReady || !this.node) return;
    this.node.triggerAttack(pitch, time, velocity);
    if (this.type === INSTRUMENT_TYPES.SYNTH && this.filterEnv) {
        this.filterEnv.triggerAttack(time, velocity);
    }
  }

  triggerRelease(pitch, time) {
    if (!this.isReady || !this.node) return;
    this.node.triggerRelease(pitch, time);
    if (this.type === INSTRUMENT_TYPES.SYNTH && this.filterEnv) {
        this.filterEnv.triggerRelease(time);
    }
  }

  dispose() {
    this.node?.dispose();
    this.output?.dispose();
    this.filter?.dispose();
    this.filterEnv?.dispose();
    this.lfo1?.dispose();
    this.lfo2?.dispose();
    this.panner?.dispose();
    this.activeModulations.forEach(mod => mod.dispose());
  }
}