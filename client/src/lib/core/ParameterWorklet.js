export class ParameterWorklet {
    constructor() {
      this.workletNode = null;
      this.isSupported = false;
      this.isLoaded = false;
      this.parameters = new Map(); // paramId -> paramInfo
      this.callbacks = new Map(); // paramId -> callback function
      
      this.checkSupport();
    }
  
    checkSupport() {
      try {
        this.isSupported = !!(
          window.AudioContext && 
          AudioContext.prototype.audioWorklet &&
          Tone.context
        );
        
        console.log(`[PARAMETER WORKLET] Support: ${this.isSupported}`);
      } catch (error) {
        console.warn('[PARAMETER WORKLET] Support check failed:', error);
        this.isSupported = false;
      }
    }
  
    async initialize() {
      if (!this.isSupported) {
        console.log('[PARAMETER WORKLET] Not supported, using fallback mode');
        return false;
      }
  
      try {
        // Worklet dosyasını yükle
        await Tone.context.audioWorklet.addModule('/audio-worklets/parameter-smoother.js');
        
        // AudioWorkletNode oluştur
        this.workletNode = new AudioWorkletNode(Tone.context, 'parameter-smoother');
        
        // Mesaj dinleyici ekle
        this.workletNode.port.onmessage = (event) => {
          this.handleWorkletMessage(event.data);
        };
        
        // Error handling
        this.workletNode.port.onmessageerror = (error) => {
          console.error('[PARAMETER WORKLET] Message error:', error);
        };
        
        this.isLoaded = true;
        console.log('[PARAMETER WORKLET] Initialized successfully');
        
        return true;
        
      } catch (error) {
        console.error('[PARAMETER WORKLET] Initialization failed:', error);
        this.isLoaded = false;
        return false;
      }
    }
  
    handleWorkletMessage(message) {
      switch (message.type) {
        case 'parameterCreated':
          console.log(`[PARAMETER WORKLET] Parameter created: ${message.id}`);
          break;
          
        case 'parameterValue':
          // Callback varsa çağır
          const callback = this.callbacks.get(message.id);
          if (callback) {
            callback(message.value);
          }
          break;
      }
    }
  
    // Parameter oluştur (mevcut API'nize uyumlu)
    createParameter(id, defaultValue = 0, smoothTime = 0.02) {
      const paramInfo = {
        id,
        defaultValue,
        smoothTime,
        lastValue: defaultValue
      };
      
      this.parameters.set(id, paramInfo);
      
      if (this.isLoaded) {
        // Worklet'e gönder
        this.workletNode.port.postMessage({
          type: 'createParameter',
          id: id,
          defaultValue: defaultValue,
          smoothTime: smoothTime
        });
      }
      
      return paramInfo;
    }
  
    // Parameter değerini ayarla (ana API)
    setParameter(id, value, smoothTime = null) {
      const paramInfo = this.parameters.get(id);
      if (!paramInfo) {
        // Parameter yoksa oluştur
        this.createParameter(id, value);
        return;
      }
      
      // Local cache'i güncelle
      paramInfo.lastValue = value;
      
      if (this.isLoaded) {
        // Ultra-low latency worklet update
        this.workletNode.port.postMessage({
          type: 'setParameter',
          id: id,
          value: value,
          smoothTime: smoothTime
        });
      } else {
        // Fallback: callback varsa hemen çağır
        const callback = this.callbacks.get(id);
        if (callback) {
          // Basit linear interpolation fallback
          setTimeout(() => callback(value), smoothTime ? smoothTime * 1000 : 0);
        }
      }
    }
  
    // Parameter değerini oku
    getParameter(id) {
      const paramInfo = this.parameters.get(id);
      if (!paramInfo) return 0;
      
      if (this.isLoaded) {
        this.workletNode.port.postMessage({
          type: 'getParameter',
          id: id
        });
        // Async operation - callback ile dönüş
        return paramInfo.lastValue; // Son bilinen değer
      } else {
        // Fallback
        return paramInfo.lastValue;
      }
    }
  
    // Parameter değişimlerini dinle
    onParameterChange(id, callback) {
      this.callbacks.set(id, callback);
    }
  
    // Cleanup
    dispose() {
      if (this.workletNode) {
        this.workletNode.disconnect();
        this.workletNode = null;
      }
      
      this.parameters.clear();
      this.callbacks.clear();
      this.isLoaded = false;
      
      console.log('[PARAMETER WORKLET] Disposed');
    }
  }
  