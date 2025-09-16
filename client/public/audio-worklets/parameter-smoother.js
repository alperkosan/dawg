class ParameterSmootherProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      
      // Basit parameter storage
      this.parameters = new Map();
      this.targetValues = new Map();
      this.currentValues = new Map();
      this.smoothingFactors = new Map();
      
      // Main thread'den mesajları dinle
      this.port.onmessage = (event) => {
        this.handleMessage(event.data);
      };
      
      console.log('[WORKLET] Parameter Smoother initialized');
    }
  
    handleMessage(message) {
      switch (message.type) {
        case 'createParameter':
          this.createParameter(message.id, message.defaultValue, message.smoothTime);
          break;
          
        case 'setParameter':
          this.setParameter(message.id, message.value, message.smoothTime);
          break;
          
        case 'getParameter':
          this.getParameter(message.id);
          break;
      }
    }
  
    createParameter(id, defaultValue = 0, smoothTime = 0.02) {
      this.currentValues.set(id, defaultValue);
      this.targetValues.set(id, defaultValue);
      
      // Smoothing factor calculation (exponential smoothing)
      const smoothingFactor = 1 - Math.exp(-1 / (smoothTime * sampleRate));
      this.smoothingFactors.set(id, smoothingFactor);
      
      // Ana thread'e bildir
      this.port.postMessage({
        type: 'parameterCreated',
        id: id,
        value: defaultValue
      });
    }
  
    setParameter(id, targetValue, smoothTime = null) {
      if (!this.currentValues.has(id)) {
        // Parameter yoksa oluştur
        this.createParameter(id, targetValue);
        return;
      }
      
      this.targetValues.set(id, targetValue);
      
      // Smooth time update edilmişse
      if (smoothTime !== null) {
        const smoothingFactor = 1 - Math.exp(-1 / (smoothTime * sampleRate));
        this.smoothingFactors.set(id, smoothingFactor);
      }
    }
  
    getParameter(id) {
      const value = this.currentValues.get(id) || 0;
      
      // Ana thread'e değeri gönder
      this.port.postMessage({
        type: 'parameterValue',
        id: id,
        value: value
      });
    }
  
    // Her audio frame'de çağrılır (128 sample'da bir)
    process(inputs, outputs, parameters) {
      // Parameter smoothing işlemi
      this.currentValues.forEach((currentValue, id) => {
        const targetValue = this.targetValues.get(id) || currentValue;
        const smoothingFactor = this.smoothingFactors.get(id) || 0.1;
        
        // Hedefe ulaşmadıysak smooth et
        if (Math.abs(currentValue - targetValue) > 0.0001) {
          const newValue = currentValue + (targetValue - currentValue) * smoothingFactor;
          this.currentValues.set(id, newValue);
        } else {
          // Hedefe ulaştıysak direkt hedef değeri kullan
          this.currentValues.set(id, targetValue);
        }
      });
      
      return true; // Worklet aktif kalsın
    }
  }
  