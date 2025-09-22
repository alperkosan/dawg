// client/src/lib/audio/WorkletInstrument.js
import * as Tone from 'tone'; // Süre hesaplaması için Tone.Time kullanacağız

export class WorkletInstrument {
  constructor(instrumentData, workletManager) {
    this.id = instrumentData.id;
    this.name = instrumentData.name;
    this.type = instrumentData.type;
    this.workletManager = workletManager;
    this.audioContext = workletManager.audioContext;
    
    // Audio nodes
    this.instrumentNode = null;
    this.instrumentNodeId = null;
    this.outputGain = null;
    this.effectsChain = [];
    
    // State
    this.isReady = false;
    this.parameters = new Map();
    this.activeNotes = new Map(); // Note tracking
    this.patternData = [];
    
    // Performance tracking
    this.noteCount = 0;
    this.lastNoteTime = 0;
  }

  async initialize() {
    try {
      console.log(`🔧 Initializing WorkletInstrument: ${this.name}`);

      // Instrument processor node oluştur
      const { node, nodeId } = await this.workletManager.createWorkletNode(
        'instrument-processor',
        {
          numberOfInputs: 0,  // Synth olduğu için input yok
          numberOfOutputs: 1,
          outputChannelCount: [2], // Stereo
          processorOptions: {
            instrumentId: this.id,
            instrumentName: this.name
          }
        }
      );

      this.instrumentNode = node;
      this.instrumentNodeId = nodeId;

      // Output gain oluştur (native AudioNode)
      this.outputGain = this.audioContext.createGain();
      this.outputGain.gain.value = 0.8; // Default level

      // Node'ları bağla
      this.instrumentNode.connect(this.outputGain);

      // Message port setup
      this.setupMessageHandling();

      // Parameter referansları
      this.setupParameters();

      this.isReady = true;
      console.log(`✅ WorkletInstrument initialized: ${this.name} (${this.instrumentNodeId})`);
      
    } catch (error) {
      console.error(`❌ WorkletInstrument initialization failed: ${this.name}`, error);
      throw error;
    }
  }

  setupMessageHandling() {
    // Worklet'ten gelen mesajları işle
    this.instrumentNode.port.onmessage = (event) => {
      const { type, data } = event.data;
      
      switch (type) {
        case 'noteStarted':
          this.handleNoteStarted(data);
          break;
        case 'noteEnded':
          this.handleNoteEnded(data);
          break;
        case 'error':
          console.error(`❌ WorkletInstrument error (${this.name}):`, data);
          break;
        case 'debug':
          console.log(`🔍 WorkletInstrument debug (${this.name}):`, data);
          break;
      }
    };

    // Error handling
    this.instrumentNode.onprocessorerror = (event) => {
      console.error(`❌ Processor error in ${this.name}:`, event);
    };
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
  // --- GÜNCELLENMİŞ triggerNote FONKSİYONU ---
  triggerNote(pitch, velocity, time, duration) {
    if (!this.isReady) {
      console.warn(`⚠️ WorkletInstrument hazır değil: ${this.name}`);
      return;
    }

    const frequency = this.pitchToFrequency(pitch);
    const noteId = `note_${this.id}_${Date.now()}`;
    
    // Süreyi saniyeye çeviriyoruz. Tone.js'i bu tür hesaplamalar için
    // bir "yardımcı kütüphane" olarak kullanmak çok pratiktir.
    const durationInSeconds = duration ? Tone.Time(duration).toSeconds() : null;

    // Worklet'e `noteOn` mesajını tüm bilgilerle gönderiyoruz.
    this.instrumentNode.port.postMessage({
      type: 'noteOn',
      data: {
        noteId,
        pitch: frequency,
        velocity: velocity,
        time: time || this.audioContext.currentTime, // Eğer zaman belirtilmemişse, şimdiki zamanı kullan
        duration: durationInSeconds, // Süreyi saniye olarak gönder
      }
    });
  }

  releaseNote(pitch, time = this.audioContext.currentTime) {
    if (!this.isReady) return;

    const frequency = this.pitchToFrequency(pitch);

    // Active notes'tan kaldır
    const noteToRemove = Array.from(this.activeNotes.entries()).find(
      ([id, note]) => Math.abs(note.frequency - frequency) < 1
    );

    if (noteToRemove) {
      this.activeNotes.delete(noteToRemove[0]);
    }

    // Worklet'e release message
    this.instrumentNode.port.postMessage({
      type: 'noteOff',
      data: {
        pitch: frequency,
        time: time
      }
    });

    console.log(`🎵 Note released: ${this.name} - ${pitch} (${frequency.toFixed(1)}Hz)`);
  }

  allNotesOff() {
    this.activeNotes.clear();
    
    this.instrumentNode.port.postMessage({
      type: 'allNotesOff',
      data: { time: this.audioContext.currentTime }
    });

    console.log(`🔇 All notes off: ${this.name}`);
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