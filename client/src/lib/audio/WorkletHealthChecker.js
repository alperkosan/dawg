// lib/audio/WorkletHealthChecker.js OLUŞTUR
export class WorkletHealthChecker {
    static async validateAllWorklets() {
      const results = {};
      const worklets = [
        'instrument-processor',
        'mixer-processor', 
        'analysis-processor',
        'effects-processor'
      ];
      
      for (const worklet of worklets) {
        try {
          // Test worklet'i yükle ve hemen test et
          const testContext = new AudioContext();
          await testContext.audioWorklet.addModule(`/worklets/${worklet}.js`);
          
          // Test node oluştur
          const testNode = new AudioWorkletNode(testContext, worklet);
          
          // Message test
          let messageReceived = false;
          testNode.port.onmessage = () => messageReceived = true;
          testNode.port.postMessage({ type: 'test' });
          
          // 100ms bekle
          await new Promise(resolve => setTimeout(resolve, 100));
          
          results[worklet] = {
            loaded: true,
            responsive: messageReceived,
            healthy: true
          };
          
          testContext.close();
        } catch (error) {
          results[worklet] = {
            loaded: false,
            error: error.message,
            healthy: false
          };
        }
      }
      
      return results;
    }
  }