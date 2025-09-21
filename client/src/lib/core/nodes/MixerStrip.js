import * as Tone from 'tone';
import { PluginNodeFactory } from './PluginNodeFactory.js';
import { MeteringService } from '../MeteringService';
import { setParamSmoothly } from '../../utils/audioUtils';
import { MIXER_TRACK_TYPES } from '../../../config/constants';

export class MixerStrip {
  constructor(trackData) {
    this.id = trackData.id;
    this.type = trackData.type;
    this.trackData = trackData;
    this.isDisposed = false;
    this.inputGain = new Tone.Gain(1);
    this.inputMeter = new Tone.Meter();
    
    // === YENİ: DALGA FORMU VE SPEKTRUM ANALİZÖRLERİ ===
    this.waveformAnalyzer = new Tone.Analyser('waveform', 1024);
    this.fftAnalyzer = new Tone.Analyser('fft', 256);

    this.panner = this.type !== MIXER_TRACK_TYPES.MASTER ? new Tone.Panner(trackData.pan || 0) : null;
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
    this.trackData = trackData;
    if (this.isDisposed) return;
    this.inputGain.disconnect();
    this.clearChain();
    
    // Sinyal önce tüm analizörlere ve ölçerlere gider
    const mainSignalChain = [this.inputGain, this.inputMeter, this.waveformAnalyzer, this.fftAnalyzer];

    (trackData.insertEffects || []).forEach(fxData => {
        if (!fxData.bypass) {
            const fxNode = PluginNodeFactory.create(fxData);
            if (fxNode) {
                mainSignalChain.push(fxNode.input);
                if (fxNode.input !== fxNode.output) mainSignalChain.push(fxNode.output);
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
  }

  // ... (updateChannelEQ, setupOutputRouting, setupSends, updateParam, updateEffectParam, updateSendLevel, setSolo, setMute metodları aynı kalır) ...

  updateChannelEQ(bandId, param, value) {
    if (this.isDisposed) return;
    const eqEffectData = this.trackData.insertEffects.find(fx => fx.type === 'MultiBandEQ');
    if (eqEffectData) {
        const eqNode = this.effectNodes.get(eqEffectData.id);
        if (eqNode && eqNode.updateBandParam) {
            eqNode.updateBandParam(bandId, param, value);
        }
    }
  }
  setupOutputRouting(trackData, masterInput, busInputs) {
    this.outputGain.disconnect();
    if (this.type === MIXER_TRACK_TYPES.MASTER) { this.outputGain.toDestination(); return; }
    const customOutput = trackData.output;
    if (customOutput && busInputs.has(customOutput)) this.outputGain.connect(busInputs.get(customOutput));
    else this.outputGain.connect(masterInput);
  }
  setupSends(sendsData, sourceNode, busInputs) {
    sendsData.forEach(send => {
      const sendGain = new Tone.Gain(Tone.dbToGain(send.level));
      sourceNode.connect(sendGain);
      const targetBusInput = busInputs.get(send.busId);
      if (targetBusInput) sendGain.connect(targetBusInput);
      this.sendNodes.set(send.busId, sendGain);
    });
  }

  updateEffectBandParam(effectId, bandId, param, value) {
    const effectNode = this.effectNodes.get(effectId);
    if (effectNode?.updateBandParam) {
      try {
        console.log(`🎛️ EQ Update: ${effectId} > Band ${bandId} > ${param} = ${value}`);
        effectNode.updateBandParam(bandId, param, value);
      } catch (error) { 
        console.error(`EQ band parametresi güncelleme hatası (${effectId}):`, error); 
      }
    } else {
      console.warn(`EQ updateBandParam metodu bulunamadı: ${effectId}`);
    }
  }
  updateParam(param, value) {
    if (this.isDisposed) return;
    try {
      if (param === 'volume') setParamSmoothly(this.fader.volume, value, 0.02);
      else if (param === 'pan' && this.panner) setParamSmoothly(this.panner.pan, value, 0.02);
    } catch (error) { console.error(`Parametre güncelleme hatası (${param}):`, error); }
  }
  updateEffectParam(effectId, paramOrSettings, value) {
    const effectNode = this.effectNodes.get(effectId);
    if (effectNode?.updateParam) {
      try {
        if (typeof paramOrSettings === 'string') effectNode.updateParam(paramOrSettings, value);
        else Object.entries(paramOrSettings).forEach(([p, v]) => effectNode.updateParam(p, v));
      } catch (error) { console.error(`Efekt parametresi güncelleme hatası (${effectId}):`, error); }
    }
  }
  updateSendLevel(busId, level) {
    const sendNode = this.sendNodes.get(busId);
    if (sendNode) setParamSmoothly(sendNode.gain, Tone.dbToGain(level), 0.02);
  }
  setSolo(isSoloed, isAnySoloActive) {
    if (this.type === MIXER_TRACK_TYPES.MASTER || this.type === MIXER_TRACK_TYPES.BUS) {
      setParamSmoothly(this.soloGain.gain, 1, 0.01);
      return;
    }
    setParamSmoothly(this.soloGain.gain, (isAnySoloActive && !isSoloed) ? 0 : 1, 0.01);
  }
  setMute(isMuted) {
    setParamSmoothly(this.muteGain.gain, isMuted ? 0 : 1, 0.01);
  }

  setupMetering() {
    this.clearMetering();
    const outputMeterId = `${this.id}-output`;
    const inputMeterId = `${this.id}-input`;
    // === YENİ: Analizörler için yeni ID'ler ===
    const waveformId = `${this.id}-waveform`;
    const fftId = `${this.id}-fft`;

    // dB seviyeleri için zamanlanmış döngü
    const scheduleId = Tone.Transport.scheduleRepeat(() => {
        if (this.isDisposed) return;
        MeteringService.publish(outputMeterId, this.outputMeter.getValue());
        MeteringService.publish(inputMeterId, this.inputMeter.getValue());
    }, "32n");
    this.meteringSchedules.set('levels', scheduleId);
    
    // Dalga formu ve FFT için animasyon döngüsü (daha yüksek frekanslı)
    const visualizerLoop = () => {
        if(this.isDisposed) return;
        MeteringService.publish(waveformId, this.waveformAnalyzer.getValue());
        MeteringService.publish(fftId, this.fftAnalyzer.getValue());
        this.meteringSchedules.set('visuals', requestAnimationFrame(visualizerLoop));
    };
    visualizerLoop();
  }

  setupEffectMetering(effectId, effectNode, effectType) {
    if (effectType !== 'Compressor' || effectType !== 'BassEnhancer808') return;
    const meterId = `${this.id}-${effectId}`;
    const eventId = Tone.Transport.scheduleRepeat(() => {
        if (this.isDisposed) return;
        const reduction = effectNode.input?.reduction;
        if (typeof reduction === 'number') MeteringService.publish(meterId, reduction);
    }, "32n");
    this.meteringSchedules.set(effectId, eventId);
  }

  clearMetering() {
      this.meteringSchedules.forEach((id, key) => {
        if (key === 'levels' || key.startsWith('fx-')) {
          Tone.Transport.clear(id);
        } else if (key === 'visuals') {
          cancelAnimationFrame(id);
        }
      });
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
    [this.inputGain, this.inputMeter, this.waveformAnalyzer, this.fftAnalyzer, this.panner, this.fader, this.outputMeter, this.outputGain, this.soloGain, this.muteGain]
        .forEach(node => node?.dispose());
  }
}