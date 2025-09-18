import * as Tone from 'tone';
import { PluginNodeFactory } from './PluginNodeFactory.js';
import { MeteringService } from '../MeteringService';
import { setParamSmoothly } from '../../utils/audioUtils';

export class MixerStrip {
  constructor(trackData) {
    this.id = trackData.id;
    this.type = trackData.type;
    this.isDisposed = false;
    this.inputGain = new Tone.Gain(1);
    this.inputMeter = new Tone.Meter(); 
    this.panner = this.type !== 'master' ? new Tone.Panner(trackData.pan || 0) : null;
    this.fader = new Tone.Volume(trackData.volume ?? 0);
    this.soloGain = new Tone.Gain(1);
    this.muteGain = new Tone.Gain(1);
    this.outputMeter = new Tone.Meter();
    this.outputGain = new Tone.Gain(1);
    this.effectNodes = new Map();
    this.sendNodes = new Map();
    this.meteringSchedules = new Map();
  }

  buildSignalChain(trackData, masterInput, busInputs) {
    if (this.isDisposed) return;
    this.inputGain.disconnect();
    this.clearChain();
    
    const mainSignalChain = [this.inputGain, this.inputMeter];

    (trackData.insertEffects || []).forEach(fxData => {
        if (!fxData.bypass) {
            const fxNode = PluginNodeFactory.create(fxData);
            if (fxNode) {
                mainSignalChain.push(fxNode.input);
                if (fxNode.input !== fxNode.output) { // Efektin giriş ve çıkışı ayrı ise ikisini de ekle
                    mainSignalChain.push(fxNode.output);
                }
                this.effectNodes.set(fxData.id, fxNode);
                this.setupEffectMetering(fxData.id, fxNode, fxData.type);
            }
        }
    });
    
    if (this.panner) mainSignalChain.push(this.panner);
    mainSignalChain.push(this.fader);

    Tone.connectSeries(...mainSignalChain);
    
    this.setupSends(trackData.sends || [], this.fader, busInputs);

    this.fader.connect(this.soloGain);
    this.soloGain.connect(this.muteGain);
    this.muteGain.connect(this.outputMeter);
    this.outputMeter.connect(this.outputGain);
    
    this.setupOutputRouting(trackData, masterInput, busInputs);
    
    this.setupMetering();
    console.log(`✅ [MixerStrip: ${this.id}] Sinyal zinciri başarıyla kuruldu.`);
  }

  setupOutputRouting(trackData, masterInput, busInputs) {
    this.outputGain.disconnect();
    
    if (this.type === 'master') {
      // Master kanalını doğrudan hedefe bağla
      this.outputGain.toDestination();
      return;
    }
    
    const customOutput = trackData.output;
    if (customOutput && busInputs.has(customOutput)) {
      this.outputGain.connect(busInputs.get(customOutput));
    } else {
      this.outputGain.connect(masterInput);
    }
  }
  
  // YENİ: Send'leri (gönderileri) oluşturan ve hedeflerine bağlayan fonksiyon
  setupSends(sendsData, sourceNode, busInputs) {
    sendsData.forEach(send => {
      const sendGain = new Tone.Gain(Tone.dbToGain(send.level));
      sourceNode.connect(sendGain);
      
      const targetBusInput = busInputs.get(send.busId);
      if (targetBusInput) {
        sendGain.connect(targetBusInput);
      } else {
        console.warn(`[ROUTING] Hedef Bus bulunamadı: ${this.id} -> ${send.busId}`);
      }
      this.sendNodes.set(send.busId, sendGain);
    });
  }

  // Anlık parametre güncellemeleri
  updateParam(param, value) {
    if (this.isDisposed) return;
    try {
      switch (param) {
        case 'volume': setParamSmoothly(this.fader.volume, value, 0.02); break;
        case 'pan': if (this.panner) setParamSmoothly(this.panner.pan, value, 0.02); break;
      }
    } catch (error) {
      console.error(`Parametre güncelleme hatası (${param}):`, error);
    }
  }

  updateEffectParam(effectId, paramOrSettings, value) {
    const effectNode = this.effectNodes.get(effectId);
    if (effectNode?.updateParam) {
        try {
            if (typeof paramOrSettings === 'string') {
                effectNode.updateParam(paramOrSettings, value);
            } else {
                Object.entries(paramOrSettings).forEach(([p, v]) => effectNode.updateParam(p, v));
            }
        } catch (error) {
            console.error(`Efekt parametresi güncelleme hatası (${effectId}):`, error);
        }
    }
  }

  updateSendLevel(busId, level) {
      const sendNode = this.sendNodes.get(busId);
      if (sendNode) {
          const gainValue = Tone.dbToGain(level);
          setParamSmoothly(sendNode.gain, gainValue, 0.02);
      }
  }
  
  // YENİ: Solo durumunu ayarlar
  setSolo(isSoloed, isAnySoloActive) {
    // Master ve Bus kanalları solo'dan etkilenmez.
    if (this.type === 'master' || this.type === 'bus') {
      setParamSmoothly(this.soloGain.gain, 1, 0.01);
      return;
    }
    const gainValue = (isAnySoloActive && !isSoloed) ? 0 : 1;
    setParamSmoothly(this.soloGain.gain, gainValue, 0.01);
  }

  // YENİ: Mute durumunu ayarlar
  setMute(isMuted) {
    const gainValue = isMuted ? 0 : 1;
    setParamSmoothly(this.muteGain.gain, gainValue, 0.01);
  }

  // Metreleme kurulumu
  setupMetering() {
    this.clearMetering();
    const meterId = `${this.id}-output`;
    const eventId = Tone.Transport.scheduleRepeat(() => {
        if (this.isDisposed || !this.outputMeter) return;
        MeteringService.publish(meterId, this.outputMeter.getValue());
    }, "32n");
    this.meteringSchedules.set('output', eventId);
  }

  setupEffectMetering(effectId, effectNode, effectType) {
    if (effectType !== 'Compressor') return;
    const meterId = `${this.id}-${effectId}`;
    const eventId = Tone.Transport.scheduleRepeat(() => {
        if (this.isDisposed) return;
        const reduction = effectNode.input?.reduction;
        if (typeof reduction === 'number') {
            MeteringService.publish(meterId, reduction);
        }
    }, "32n");
    this.meteringSchedules.set(effectId, eventId);
  }

  clearMetering() {
      this.meteringSchedules.forEach(id => Tone.Transport.clear(id));
      this.meteringSchedules.clear();
  }

  clearChain() {
    this.clearMetering();
    this.sendNodes.forEach(node => node.dispose());
    this.sendNodes.clear();
    this.effectNodes.forEach(node => node.dispose());
    this.effectNodes.clear();
  }

  dispose() {
    this.isDisposed = true;
    this.clearChain();
    [this.inputGain, this.panner, this.fader, this.outputMeter, this.outputGain, this.soloGain, this.muteGain]
        .forEach(node => node?.dispose());
  }
}
