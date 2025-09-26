// client/src/lib/audio/WorkletManager.js

export class WorkletManager {
  constructor(audioContext = null) {
    this.audioContext = null;
    this.loadedWorklets = new Set();
    this.activeNodes = new Map();
    
    this.initializeAudioContext(audioContext);
  }

  /**
   * Native AudioContext'i doğru şekilde al
   */
  initializeAudioContext(providedContext = null) {
    if (providedContext) {
      this.audioContext = this.extractNativeContext(providedContext);
    } else {
      // Tone.js'den native context al
      this.audioContext = this.getNativeAudioContext();
    }

    console.log(`🎵 WorkletManager: AudioContext initialized (${this.audioContext.constructor.name})`);
  }

  /**
   * Verilen context'den native AudioContext'i çıkar
   */
  extractNativeContext(context) {
    // Eğer zaten native context ise
    if (context instanceof AudioContext || context instanceof BaseAudioContext) {
      return context;
    }

    // Tone.js context wrapper'ı ise
    if (context.rawContext) {
      // Tone.js v14+ için
      if (context.rawContext._nativeAudioContext) {
        return context.rawContext._nativeAudioContext;
      }
      // Tone.js eski versiyonlar için
      if (context.rawContext instanceof AudioContext) {
        return context.rawContext;
      }
    }

    // Son çare: yeni native context oluştur
    console.warn('🔧 Native context çıkarılamadı, yeni oluşturuluyor...');
    return this.createNativeAudioContext();
  }

  /**
   * Native AudioContext oluştur
   */
  createNativeAudioContext() {
    const ContextClass = window.AudioContext || window.webkitAudioContext;
    if (!ContextClass) {
      throw new Error('AudioContext desteklenmiyor');
    }
    return new ContextClass();
  }

  /**
   * Tone.js'den native context al
   */
  getNativeAudioContext() {
    try {
      // Tone.js başlatılmış mı kontrol et
      if (Tone.context) {
        return this.extractNativeContext(Tone.context);
      }
      
      // Tone.js başlatılmamışsa, yeni context oluştur
      console.warn('🔧 Tone.js context bulunamadı, yeni native context oluşturuluyor...');
      return this.createNativeAudioContext();
      
    } catch (error) {
      console.error('❌ AudioContext alma hatası:', error);
      return this.createNativeAudioContext();
    }
  }

  /**
   * Context'in AudioWorklet için uygun olup olmadığını kontrol et
   */
  validateContextForWorklet() {
    if (!this.audioContext) {
      throw new Error('AudioContext mevcut değil');
    }

    if (!window.AudioWorkletNode) {
      throw new Error('AudioWorkletNode desteklenmiyor');
    }

    if (!this.audioContext.audioWorklet) {
      throw new Error('audioWorklet özelliği mevcut değil');
    }

    // Context tipini kontrol et
    const isValidContext = this.audioContext instanceof AudioContext || 
                          this.audioContext instanceof BaseAudioContext ||
                          (window.webkitAudioContext && this.audioContext instanceof window.webkitAudioContext);

    if (!isValidContext) {
      throw new Error(`Geçersiz AudioContext tipi: ${this.audioContext.constructor.name}`);
    }

    return true;
  }

  async loadWorklet(workletPath, processorName) {
    if (this.loadedWorklets.has(processorName)) {
      return true;
    }

    try {
      // Context validation
      this.validateContextForWorklet();

      // Context'in active olduğundan emin ol
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      console.log(`📦 Loading AudioWorklet: ${processorName} from ${workletPath}`);
      
      await this.audioContext.audioWorklet.addModule(workletPath);
      this.loadedWorklets.add(processorName);
      
      console.log(`✅ AudioWorklet loaded successfully: ${processorName}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to load AudioWorklet: ${processorName}`, error);
      throw error;
    }
  }

  async createWorkletNode(processorName, options = {}) {
    if (!this.loadedWorklets.has(processorName)) {
      throw new Error(`AudioWorklet processor not loaded: ${processorName}`);
    }

    try {
      // Context validation
      this.validateContextForWorklet();

      const nodeOptions = {
        numberOfInputs: options.numberOfInputs || 1,
        numberOfOutputs: options.numberOfOutputs || 1,
        outputChannelCount: options.outputChannelCount || [2],
        processorOptions: options.processorOptions || {},
        ...options
      };

      console.log(`🔧 Creating AudioWorkletNode: ${processorName}`, nodeOptions);

      const node = new AudioWorkletNode(this.audioContext, processorName, nodeOptions);

      // Error handling
      node.onprocessorerror = (event) => {
        console.error(`❌ AudioWorklet processor error (${processorName}):`, event);
        this.handleProcessorError(processorName, event);
      };

      const nodeId = `${processorName}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      this.activeNodes.set(nodeId, {
        node,
        processorName,
        created: Date.now()
      });

      console.log(`✅ AudioWorkletNode created: ${nodeId}`);
      return { node, nodeId };

    } catch (error) {
      console.error(`❌ Failed to create AudioWorkletNode: ${processorName}`, error);
      throw error;
    }
  }

  handleProcessorError(processorName, event) {
    console.error(`🔥 Processor Error in ${processorName}:`, event);
    // TODO: Error reporting, fallback logic
  }

  getActiveNode(nodeId) {
    const nodeData = this.activeNodes.get(nodeId);
    return nodeData ? nodeData.node : null;
  }

  getNodeInfo(nodeId) {
    return this.activeNodes.get(nodeId);
  }

  disposeNode(nodeId) {
    const nodeData = this.activeNodes.get(nodeId);
    if (nodeData) {
      try {
        nodeData.node.disconnect();
        this.activeNodes.delete(nodeId);
        console.log(`🗑️ AudioWorkletNode disposed: ${nodeId}`);
        return true;
      } catch (error) {
        console.error(`❌ Error disposing node ${nodeId}:`, error);
        return false;
      }
    }
    return false;
  }

  disposeAllNodes() {
    const nodeIds = Array.from(this.activeNodes.keys());
    let disposed = 0;
    
    nodeIds.forEach(nodeId => {
      if (this.disposeNode(nodeId)) {
        disposed++;
      }
    });
    
    console.log(`🗑️ Disposed ${disposed} AudioWorkletNodes`);
    return disposed;
  }

  // Debug ve monitoring metodları
  getStats() {
    return {
      contextType: this.audioContext?.constructor.name,
      contextState: this.audioContext?.state,
      sampleRate: this.audioContext?.sampleRate,
      loadedWorklets: Array.from(this.loadedWorklets),
      activeNodes: this.activeNodes.size,
      contextValid: this.isContextValid()
    };
  }

  isContextValid() {
    try {
      this.validateContextForWorklet();
      return true;
    } catch {
      return false;
    }
  }

  // Context'i yeniden initialize et
  async reinitializeContext() {
    try {
      console.log('🔄 Reinitializing AudioContext...');
      
      // Mevcut node'ları temizle
      this.disposeAllNodes();
      
      // Yeni native context oluştur
      this.audioContext = this.createNativeAudioContext();
      await this.audioContext.resume();
      
      // Worklet'leri tekrar yüklemek gerekebilir
      this.loadedWorklets.clear();
      
      console.log('✅ AudioContext reinitialized');
      return true;
      
    } catch (error) {
      console.error('❌ Context reinitialization failed:', error);
      throw error;
    }
  }
}