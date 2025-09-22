// client/src/lib/core/HybridAudioEngine.js - Debug fix
import AudioEngine from './AudioEngine.js';
import { WorkletManager } from '../audio/WorkletManager.js';
import { WorkletInstrument } from '../audio/WorkletInstrument.js';
import * as Tone from 'tone';

export class HybridAudioEngine extends AudioEngine {
  constructor(callbacks) {
    super(callbacks);
    
    this.workletManager = null;
    this.workletInstruments = new Map();
    this.hybridMode = false;
    
    this.performanceMetrics = {
      workletNodesCreated: 0,
      workletErrors: 0,
      fallbacksToTone: 0
    };
    
    console.log('🎵 HybridAudioEngine initialized');
  }

  async enableHybridMode() {
    try {
      console.log('🔄 enableHybridMode started...');
      
      // AudioWorklet support check
      if (!window.AudioWorkletNode) {
        console.warn('⚠️ AudioWorklet not supported, using Tone.js only');
        return false;
      }

      console.log('✅ AudioWorkletNode support confirmed');

      // WorkletManager'ı native context ile initialize et
      console.log('🔧 Creating WorkletManager...');
      this.workletManager = new WorkletManager();
      
      console.log('📊 WorkletManager stats after creation:', this.workletManager.getStats());

      // === TIMEOUT EKLEYELİM: Worklet yükleme işlemine timeout ===
      console.log('📦 Starting worklet loading with timeout...');
      
      const workletLoadingPromise = Promise.all([
        this.workletManager.loadWorklet('/worklets/instrument-processor.js', 'instrument-processor'),
        this.workletManager.loadWorklet('/worklets/effects-processor.js', 'effects-processor')
      ]);

      // 10 saniye timeout
      const timeoutPromise = new Promise((resolve, reject) => {
        setTimeout(() => {
          reject(new Error('Worklet loading timeout (10 seconds)'));
        }, 10000);
      });

      let results;
      try {
        results = await Promise.race([
          Promise.allSettled(workletLoadingPromise),
          timeoutPromise
        ]);
        
        console.log('📦 Worklet loading completed:', results);
      } catch (timeoutError) {
        console.warn('⚠️ Worklet loading timed out, falling back to Tone.js only:', timeoutError);
        return false;
      }
      
      // Başarılı yüklenen worklet'leri kontrol et
      if (Array.isArray(results)) {
        const failedWorklets = results.filter(r => r.status === 'rejected');
        if (failedWorklets.length > 0) {
          console.warn('⚠️ Some worklets failed to load:', failedWorklets);
          // Yine de devam et, fallback mekanizması var
        }

        const successfulWorklets = results.filter(r => r.status === 'fulfilled');
        console.log(`✅ ${successfulWorklets.length}/${results.length} worklets loaded successfully`);
      }

      this.hybridMode = true;
      console.log('🚀 Hybrid Audio Engine enabled successfully!');
      console.log('📊 Final WorkletManager stats:', this.workletManager.getStats());
      
      return true;
      
    } catch (error) {
      console.error('❌ Failed to enable Hybrid mode:', error);
      this.performanceMetrics.workletErrors++;
      
      // Fallback: Sadece Tone.js kullan
      console.log('🔄 Falling back to Tone.js only mode');
      this.hybridMode = false;
      return false;
    }
  }

  // Worklet dosyalarının varlığını kontrol et
  async checkWorkletFiles() {
    const filesToCheck = [
      '/worklets/instrument-processor.js',
      '/worklets/effects-processor.js'
    ];

    const fileCheckResults = await Promise.allSettled(
      filesToCheck.map(async (file) => {
        try {
          const response = await fetch(file, { method: 'HEAD' });
          return {
            file,
            exists: response.ok,
            status: response.status
          };
        } catch (error) {
          return {
            file,
            exists: false,
            error: error.message
          };
        }
      })
    );

    console.log('📂 Worklet file check results:', fileCheckResults);
    return fileCheckResults;
  }

  async createInstrument(instData) {
    const useWorklet = this.shouldUseWorklet(instData);

    if (useWorklet && this.hybridMode) {
      try {
        console.log(`🎯 Using AudioWorklet for: ${instData.name}`);
        return await this.createWorkletInstrument(instData);
      } catch (error) {
        console.warn(`⚠️ WorkletInstrument creation failed for ${instData.name}, falling back to Tone.js:`, error);
        this.performanceMetrics.fallbacksToTone++;
        return super.createInstrument(instData);
      }
    } else {
      console.log(`🎹 Using Tone.js for: ${instData.name} (worklet: ${useWorklet}, hybrid: ${this.hybridMode})`);
      return super.createInstrument(instData);
    }
  }

  shouldUseWorklet(instData) {
    if (!this.hybridMode) {
      console.log(`❌ Worklet not available for ${instData.name}: hybrid mode disabled`);
      return false;
    }
    
    if (instData.type === 'synth') {
      console.log(`✅ Worklet eligible for ${instData.name}: synth type`);
      return true;
    }
    
    if (instData.settings?.lowLatency === true) {
      console.log(`✅ Worklet eligible for ${instData.name}: low latency flag`);
      return true;
    }
    
    if (instData.settings?.customDSP === true) {
      console.log(`✅ Worklet eligible for ${instData.name}: custom DSP flag`);
      return true;
    }
    
    console.log(`❌ Worklet not eligible for ${instData.name}: no matching criteria`);
    return false;
  }

  async createWorkletInstrument(instData) {
    try {
      console.log(`🔧 Creating WorkletInstrument: ${instData.name}`);
      
      const workletInst = new WorkletInstrument(instData, this.workletManager);
      await workletInst.initialize();

      // Native AudioNode'u Tone.js ile bridge etme
      const nativeToToneBridge = Tone.context.createGain();
      workletInst.outputGain.connect(nativeToToneBridge);
      
      const toneGainNode = new Tone.Gain(1);
      nativeToToneBridge.connect(toneGainNode.input.input);

      console.log('🔗 Native -> Tone.js bridge established');

      this.workletInstruments.set(instData.id, {
        workletInst,
        toneGainNode,
        nativeToToneBridge,
        type: 'worklet',
        instData
      });

      this.connectInstrumentToMixer(instData.id, instData.mixerTrackId, 'worklet');

      this.performanceMetrics.workletNodesCreated++;
      console.log(`✅ WorkletInstrument created successfully: ${instData.name}`);
      
      return workletInst;

    } catch (error) {
      console.error('❌ WorkletInstrument creation failed:', error);
      this.performanceMetrics.workletErrors++;
      throw error;
    }
  }

  connectInstrumentToMixer(instrumentId, mixerTrackId, instrumentType = 'tone') {
    if (instrumentType === 'worklet') {
      const workletData = this.workletInstruments.get(instrumentId);
      const targetStrip = this.mixerStrips.get(mixerTrackId);
      
      if (workletData && targetStrip) {
        try {
          workletData.toneGainNode.disconnect();
          workletData.toneGainNode.connect(targetStrip.inputGain);
          console.log(`🔗 WorkletInstrument connected to mixer: ${instrumentId} -> ${mixerTrackId}`);
        } catch (error) {
          console.error(`❌ Failed to connect worklet instrument to mixer:`, error);
        }
      } else {
        console.warn(`⚠️ Failed to connect worklet - missing data:`, {
          workletData: !!workletData,
          targetStrip: !!targetStrip,
          instrumentId,
          mixerTrackId
        });
      }
    } else {
      super.connectInstrumentToMixer(instrumentId, mixerTrackId);
    }
  }

  auditionNoteOn(id, pitch, vel) {
    const workletData = this.workletInstruments.get(id);
    
    if (workletData) {
      try {
        workletData.workletInst.triggerNote(pitch, vel);
        console.log(`🎵 Worklet note ON: ${id} - ${pitch} - ${vel}`);
      } catch (error) {
        console.error(`❌ Worklet note trigger failed:`, error);
        super.auditionNoteOn(id, pitch, vel);
      }
    } else {
      super.auditionNoteOn(id, pitch, vel);
    }
  }

  auditionNoteOff(id, pitch) {
    const workletData = this.workletInstruments.get(id);
    
    if (workletData) {
      try {
        workletData.workletInst.releaseNote(pitch);
        console.log(`🎵 Worklet note OFF: ${id} - ${pitch}`);
      } catch (error) {
        console.error(`❌ Worklet note release failed:`, error);
        super.auditionNoteOff(id, pitch);
      }
    } else {
      super.auditionNoteOff(id, pitch);
    }
  }

  updateInstrumentParameters(instrumentId, updatedInstrumentData) {
    const workletData = this.workletInstruments.get(instrumentId);
    
    if (workletData && updatedInstrumentData.synthParams) {
      try {
        const synthParams = updatedInstrumentData.synthParams;
        const worklet = workletData.workletInst;

        console.log(`🔧 Updating worklet parameters for ${instrumentId}:`, synthParams);

        if (synthParams.oscillator) {
          worklet.updateParameter('detune', synthParams.oscillator.detune || 0);
        }

        if (synthParams.envelope) {
          worklet.updateParameter('attack', synthParams.envelope.attack || 0.01);
          worklet.updateParameter('decay', synthParams.envelope.decay || 0.3);
          worklet.updateParameter('sustain', synthParams.envelope.sustain || 0.7);
          worklet.updateParameter('release', synthParams.envelope.release || 1);
        }

        if (synthParams.filter) {
          worklet.updateParameter('filterFreq', synthParams.filter.frequency || 1000);
          worklet.updateParameter('filterQ', synthParams.filter.Q || 1);
        }

        workletData.instData = updatedInstrumentData;
        
      } catch (error) {
        console.error(`❌ Worklet parameter update failed:`, error);
        super.updateInstrumentParameters(instrumentId, updatedInstrumentData);
      }
    } else {
      super.updateInstrumentParameters(instrumentId, updatedInstrumentData);
    }
  }

  reschedule() {
    super.reschedule();
    
    if (this.hybridMode) {
      this.rescheduleWorkletInstruments();
    }
  }

  rescheduleWorkletInstruments() {
    try {
      const activePattern = this.patterns?.[this.activePatternId];
      if (!activePattern) return;

      this.workletInstruments.forEach((workletData, instrumentId) => {
        const notes = activePattern.data[instrumentId] || [];
        if (notes.length > 0) {
          workletData.workletInst.loadPattern(notes);
          console.log(`📋 Pattern loaded to worklet: ${instrumentId} (${notes.length} notes)`);
        }
      });
      
    } catch (error) {
      console.error('❌ Worklet rescheduling failed:', error);
    }
  }

  getPerformanceMetrics() {
    const baseMetrics = super.getPerformanceMetrics ? super.getPerformanceMetrics() : {};
    const workletStats = this.workletManager ? this.workletManager.getStats() : {};
    
    return {
      ...baseMetrics,
      hybridMode: this.hybridMode,
      workletInstruments: this.workletInstruments.size,
      toneInstruments: this.instruments.size,
      audioLatency: this.hybridMode ? 'Ultra-Low (<5ms)' : 'Standard (<20ms)',
      workletManager: workletStats,
      performance: {
        ...this.performanceMetrics,
        totalInstruments: this.workletInstruments.size + this.instruments.size
      }
    };
  }

  dispose() {
    console.log('🗑️ Disposing HybridAudioEngine...');
    
    this.workletInstruments.forEach((data, id) => {
      try {
        data.workletInst.dispose();
        data.toneGainNode.dispose();
        if (data.nativeToToneBridge) {
          data.nativeToToneBridge.disconnect();
        }
      } catch (error) {
        console.error(`❌ Error disposing worklet instrument ${id}:`, error);
      }
    });
    this.workletInstruments.clear();
    
    if (this.workletManager) {
      this.workletManager.disposeAllNodes();
    }
    
    super.dispose();
    console.log('✅ HybridAudioEngine disposed');
  }

  listInstruments() {
    console.log('🎹 Active Instruments:');
    console.log('  Tone.js Instruments:', Array.from(this.instruments.keys()));
    console.log('  Worklet Instruments:', Array.from(this.workletInstruments.keys()));
  }

  getInstrumentInfo(instrumentId) {
    const workletData = this.workletInstruments.get(instrumentId);
    if (workletData) {
      return {
        type: 'worklet',
        engine: 'AudioWorklet',
        latency: '<5ms',
        ...workletData.instData
      };
    }
    
    const toneInst = this.instruments.get(instrumentId);
    if (toneInst) {
      return {
        type: 'tone',
        engine: 'Tone.js',
        latency: '<20ms',
        node: toneInst.constructor.name
      };
    }
    
    return null;
  }
}