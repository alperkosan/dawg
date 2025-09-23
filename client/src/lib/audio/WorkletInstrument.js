// client/src/lib/audio/WorkletInstrument.js
import { WasmMessage } from './WorkletMessageProtocol'; // Yeni protokolü import et
import { NativeTimeUtils } from '../utils/NativeTimeUtils.js';

export class WorkletInstrument {
  constructor(instrumentData, workletManager) {
    this.id = instrumentData.id;
    this.name = instrumentData.name;
    this.type = instrumentData.type;
    this.workletManager = workletManager;
    this.audioContext = workletManager.audioContext;
    
    // ❌ SORUN: Message protocol eksik import
    // ✅ ÇÖZÜM: Protocol'ü kullan
    this.messageProtocol = {
        NOTE_ON: 'noteOn',
        NOTE_OFF: 'noteOff',
        ALL_NOTES_OFF: 'allNotesOff'
    };
    
    this.instrumentNode = null;
    this.output = null;
    this.parameters = new Map();
  }

  async initialize() {
    try {
        let processorOptions = {
            instrumentId: this.id,
            instrumentName: this.name
        };

        // Instrument tipine göre farklı parametreler
        if (this.type === 'synth' && this.synthParams) {
            processorOptions.synthParams = this.synthParams;
        }

        const { node, nodeId } = await this.workletManager.createWorkletNode(
            'instrument-processor',
            {
                numberOfInputs: 0,
                numberOfOutputs: 1,
                outputChannelCount: [2],
                processorOptions
            }
        );

        this.instrumentNode = node;
        this.output = this.audioContext.createGain();
        this.output.gain.value = 0.8;

        this.instrumentNode.connect(this.output);
        this.setupMessageHandling();
        
        console.log(`✅ Worklet instrument ready: ${this.name}`);
        
    } catch (error) {
        console.error(`❌ Worklet instrument failed: ${this.name}`, error);
    }
  }

  // --- YENİ: MERKEZİ KOMUT GÖNDERİCİ ---
  postCommand(type, data = {}) {
    if (this.instrumentNode && this.instrumentNode.port) {
      this.instrumentNode.port.postMessage({ type, data });
    }
  }

  setupMessageHandling() {
    if (!this.instrumentNode?.port) return;
    
    // ⚡ PERFORMANS: Message batching
    const messageQueue = [];
    let processingMessages = false;
    
    const processMessageQueue = () => {
      if (processingMessages || messageQueue.length === 0) return;
      processingMessages = true;
      
      // Batch process messages
      const batch = messageQueue.splice(0, 10); // Max 10 per batch
      
      batch.forEach(({ type, data }) => {
        switch (type) {
          case 'noteStarted':
            // UI'ya bildir ama throttle et
            this.throttledNoteStarted?.(data);
            break;
          case 'noteEnded':
            this.throttledNoteEnded?.(data);
            break;
          case 'debug':
            if (process.env.NODE_ENV === 'development') {
              console.log(`🎵 ${this.name}:`, data.message);
            }
            break;
        }
      });
      
      processingMessages = false;
      
      // Kalan mesajlar varsa devam et
      if (messageQueue.length > 0) {
        requestAnimationFrame(processMessageQueue);
      }
    };
    
    this.instrumentNode.port.onmessage = (event) => {
      messageQueue.push(event.data);
      
      if (!processingMessages) {
        requestAnimationFrame(processMessageQueue);
      }
    };
    
    // Throttled handlers
    this.throttledNoteStarted = throttle((data) => {
      // VU meter update
      this.emit('noteStarted', data);
    }, 50);
    
    this.throttledNoteEnded = throttle((data) => {
      this.emit('noteEnded', data);
    }, 50);
  }

  setupParameters() {
    // AudioParam referansları - instrument processor'ın parametreleri
    const paramNames = [
      'pitch', 'gate', 'velocity', 'detune',
      'filterFreq', 'filterQ', 
      'attack', 'decay', 'sustain', 'release'
    ];

    paramNames.forEach(paramName => {
      const param = this.instrumentNode.parameters.get(paramName);
      if (param) {
        this.parameters.set(paramName, param);
      } else {
        console.warn(`⚠️ Parameter not found: ${paramName}`);
      }
    });

    console.log(`🎛️ Parameters setup: ${this.parameters.size} params available`);
  }

  // Note triggering
  triggerNote(pitch, velocity, time, duration) {
    if (!this.instrumentNode || !this.instrumentNode.port) {
        console.error(`❌ Worklet node not ready: ${this.name}`);
        return;
    }

    const frequency = this.pitchToFrequency(pitch);
    const durationInSeconds = duration ? duration : null;
    
    // ❗ KRİTİK: Worklet'e doğru mesaj formatında gönder
    this.instrumentNode.port.postMessage({
        type: this.messageProtocol.NOTE_ON,
        data: {
            pitch: frequency,
            velocity,
            time: time || this.audioContext.currentTime,
            duration: durationInSeconds,
            noteId: this.generateNoteId()
        }
    });

    console.log(`🎵 Note triggered: ${this.name} - ${pitch} at ${time}`);
  }

  releaseNote(pitch, time) {
    if (!this.isReady) return;
    this.postCommand(WasmMessage.NOTE_OFF, {
      pitch: this.pitchToFrequency(pitch),
      time: time || this.audioContext.currentTime
    });
  }

  allNotesOff() {
    this.activeNotes.clear();
    this.postCommand(WasmMessage.ALL_NOTES_OFF, { 
      time: this.audioContext.currentTime 
    });
    console.log(`🔇 Tüm notalar susturuldu: ${this.name}`);
  }


  // Parameter updates
  updateParameter(paramName, value, time = this.audioContext.currentTime) {
    const param = this.parameters.get(paramName);
    if (param) {
      try {
        // Smooth parameter change için setTargetAtTime kullan
        param.setTargetAtTime(value, time, 0.01);
        console.log(`🎛️ Parameter updated: ${this.name}.${paramName} = ${value}`);
      } catch (error) {
        console.error(`❌ Parameter update failed: ${paramName}`, error);
      }
    } else {
      console.warn(`⚠️ Parameter not found: ${paramName}`);
    }
  }

  updateParameters(paramObject, time = this.audioContext.currentTime) {
    Object.entries(paramObject).forEach(([paramName, value]) => {
      this.updateParameter(paramName, value, time);
    });
  }

  // Pattern playback support
  loadPattern(patternNotes) {
    this.patternData = patternNotes;
    
    // Worklet'e pattern data gönder
    this.instrumentNode.port.postMessage({
      type: 'loadPattern',
      data: {
        notes: patternNotes.map(note => ({
          ...note,
          frequency: this.pitchToFrequency(note.pitch)
        }))
      }
    });

    console.log(`📋 Pattern loaded: ${this.name} (${patternNotes.length} notes)`);
  }

  startPatternPlayback(startTime = this.audioContext.currentTime) {
    this.instrumentNode.port.postMessage({
      type: 'startPattern',
      data: { startTime }
    });

    console.log(`▶️ Pattern playback started: ${this.name}`);
  }

  stopPatternPlayback() {
    this.instrumentNode.port.postMessage({
      type: 'stopPattern',
      data: {}
    });

    console.log(`⏹️ Pattern playback stopped: ${this.name}`);
  }

  // Effects chain
  async addEffect(effectType, settings = {}) {
    try {
      const { node, nodeId } = await this.workletManager.createWorkletNode(
        'effects-processor',
        {
          processorOptions: {
            effectType,
            settings
          }
        }
      );

      // Effect'i chain'e ekle
      this.effectsChain.push({
        node,
        nodeId,
        type: effectType,
        settings,
        parameters: new Map([
          ['drive', node.parameters.get('drive')],
          ['tone', node.parameters.get('tone')],
          ['level', node.parameters.get('level')],
          ['delayTime', node.parameters.get('delayTime')],
          ['feedback', node.parameters.get('feedback')],
          ['mix', node.parameters.get('mix')]
        ])
      });

      // Chain'i yeniden kur
      this.rebuildEffectChain();

      console.log(`🎚️ Effect added: ${this.name} -> ${effectType} (${nodeId})`);
      return nodeId;

    } catch (error) {
      console.error(`❌ Failed to add effect to ${this.name}:`, error);
      throw error;
    }
  }

  removeEffect(nodeId) {
    const effectIndex = this.effectsChain.findIndex(effect => effect.nodeId === nodeId);
    
    if (effectIndex !== -1) {
      const effect = this.effectsChain[effectIndex];
      
      // Node'u dispose et
      this.workletManager.disposeNode(nodeId);
      
      // Chain'den kaldır
      this.effectsChain.splice(effectIndex, 1);
      
      // Chain'i yeniden kur
      this.rebuildEffectChain();

      console.log(`🗑️ Effect removed: ${this.name} -> ${effect.type}`);
    }
  }

  rebuildEffectChain() {
    // Tüm bağlantıları kes
    this.instrumentNode.disconnect();
    this.effectsChain.forEach(effect => effect.node.disconnect());

    // Chain'i yeniden kur
    let currentNode = this.instrumentNode;
    
    this.effectsChain.forEach(effect => {
      currentNode.connect(effect.node);
      currentNode = effect.node;
    });

    // Final output'a bağla
    currentNode.connect(this.outputGain);

    console.log(`🔗 Effect chain rebuilt: ${this.name} (${this.effectsChain.length} effects)`);
  }

  // Event handlers
  handleNoteStarted(data) {
    console.log(`🎵 Note started in worklet: ${this.name}`, data);
  }

  handleNoteEnded(data) {
    console.log(`🎵 Note ended in worklet: ${this.name}`, data);
  }

  // Utility methods
  pitchToFrequency(pitch) {
    if (typeof pitch === 'string') {
      // "C4" formatından frequency'ye çevir
      const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const match = pitch.match(/([A-G]#?)(\d+)/);
      
      if (match) {
        const noteName = match[1];
        const octave = parseInt(match[2]);
        const noteIndex = noteNames.indexOf(noteName);
        
        if (noteIndex !== -1) {
          const midiNumber = (octave + 1) * 12 + noteIndex;
          return 440 * Math.pow(2, (midiNumber - 69) / 12);
        }
      }
    }
    
    // Zaten frequency ise
    return typeof pitch === 'number' ? pitch : 440;
  }

  generateNoteId() {
    return `note_${this.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  // Status ve debug
  getStatus() {
    return {
      id: this.id,
      name: this.name,
      isReady: this.isReady,
      activeNotes: this.activeNotes.size,
      effectsChain: this.effectsChain.length,
      noteCount: this.noteCount,
      lastNoteTime: this.lastNoteTime,
      parameters: this.parameters.size
    };
  }

  getActiveNotes() {
    return Array.from(this.activeNotes.values());
  }

  // Cleanup
  dispose() {
    try {
      console.log(`🗑️ Disposing WorkletInstrument: ${this.name}`);

      // Stop all notes
      this.allNotesOff();

      // Disconnect and dispose effects
      this.effectsChain.forEach(effect => {
        this.workletManager.disposeNode(effect.nodeId);
      });
      this.effectsChain = [];

      // Disconnect main nodes
      if (this.instrumentNode) {
        this.instrumentNode.disconnect();
      }
      
      if (this.outputGain) {
        this.outputGain.disconnect();
      }

      // Dispose instrument node
      if (this.instrumentNodeId) {
        this.workletManager.disposeNode(this.instrumentNodeId);
      }

      // Clear state
      this.activeNotes.clear();
      this.parameters.clear();
      this.isReady = false;

      console.log(`✅ WorkletInstrument disposed: ${this.name}`);

    } catch (error) {
      console.error(`❌ Error disposing WorkletInstrument ${this.name}:`, error);
    }
  }
}