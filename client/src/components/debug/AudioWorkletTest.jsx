import React, { useState, useEffect } from 'react';

export const AudioWorkletTest = () => {
  const [testStatus, setTestStatus] = useState('not-started');
  const [testResults, setTestResults] = useState({});
  const [logs, setLogs] = useState([]);

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { 
      message, 
      type, 
      timestamp: new Date().toLocaleTimeString() 
    }]);
  };

  const runTest = async () => {
    setTestStatus('running');
    setTestResults({});
    setLogs([]);
    
    addLog('🚀 AudioWorklet test başlatılıyor...');
    
    try {
      // 1. AudioWorklet desteği kontrolü
      if (!window.AudioWorkletNode) {
        throw new Error('AudioWorkletNode desteklenmiyor');
      }
      addLog('✅ AudioWorkletNode desteği mevcut');

      // 2. AudioContext oluştur - DÜZELTME: Native context kullan
      let audioContext;
      
      try {
        // Önce Tone.js'i başlat
        await Tone.start();
        addLog('✅ Tone.js başlatıldı');
        
        // Tone.js'den native context'i al - doğru yol
        audioContext = Tone.getContext().rawContext._nativeAudioContext || Tone.getContext().rawContext;
        
        // Eğer hala wrapper ise, yeni bir native context oluştur
        if (!audioContext || audioContext.constructor.name.includes('Context') === false) {
          addLog('⚠️ Tone.js context wrapper tespit edildi, native context oluşturuluyor...');
          audioContext = new (window.AudioContext || window.webkitAudioContext)();
          await audioContext.resume();
        }
        
        addLog(`✅ Native AudioContext hazır (${audioContext.constructor.name})`);
        addLog(`📊 Sample Rate: ${audioContext.sampleRate}Hz, State: ${audioContext.state}`);
        
      } catch (contextError) {
        addLog(`⚠️ Context alma hatası, yeni native context oluşturuluyor: ${contextError.message}`);
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        await audioContext.resume();
        addLog(`✅ Yeni AudioContext oluşturuldu (${audioContext.constructor.name})`);
      }

      // 3. Context tipini kontrol et
      addLog(`🔍 Context type: ${audioContext.constructor.name}`);
      addLog(`🔍 Context instanceof AudioContext: ${audioContext instanceof AudioContext}`);
      addLog(`🔍 Context instanceof BaseAudioContext: ${audioContext instanceof BaseAudioContext}`);

      // 4. Test processor yükle
      addLog('📦 Test processor yükleniyor...');
      await audioContext.audioWorklet.addModule('/worklets/test-processor.js');
      addLog('✅ Test processor başarıyla yüklendi');

      // 5. AudioWorkletNode oluştur
      addLog('🔧 AudioWorkletNode oluşturuluyor...');
      const workletNode = new AudioWorkletNode(audioContext, 'test-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2]
      });
      
      // Heartbeat mesajlarını dinle
      let heartbeatCount = 0;
      workletNode.port.onmessage = (event) => {
        const { type, sampleCount } = event.data;
        if (type === 'heartbeat') {
          heartbeatCount++;
          addLog(`💓 Heartbeat ${heartbeatCount}: ${sampleCount} samples processed`, 'success');
        }
      };

      // Error handler
      workletNode.onprocessorerror = (event) => {
        addLog(`❌ Processor error: ${event.message || 'Unknown error'}`, 'error');
      };

      addLog('✅ AudioWorkletNode oluşturuldu');

      // 6. Gain node ile bağla
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0.1; // Düşük volume
      
      workletNode.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      addLog('✅ Audio chain kuruldu');

      // 7. Test oscillator oluştur
      const oscillator = audioContext.createOscillator();
      oscillator.frequency.value = 440; // A4 note
      oscillator.type = 'sine';
      
      oscillator.connect(workletNode);
      addLog('✅ Test oscillator bağlandı');

      // 8. 3 saniye test çal
      addLog('🎵 3 saniye test sesi çalıyor...');
      oscillator.start();
      
      setTimeout(() => {
        oscillator.stop();
        workletNode.disconnect();
        gainNode.disconnect();
        addLog('✅ Test tamamlandı!', 'success');
        setTestStatus('success');
        
        setTestResults({
          workletSupported: true,
          processorLoaded: true,
          audioPlayed: true,
          contextType: audioContext.constructor.name,
          sampleRate: audioContext.sampleRate,
          contextState: audioContext.state,
          heartbeatsReceived: heartbeatCount
        });
      }, 3000);

    } catch (error) {
      addLog(`❌ Test başarısız: ${error.message}`, 'error');
      console.error('AudioWorklet Test Error:', error);
      setTestStatus('failed');
      setTestResults({
        workletSupported: !!window.AudioWorkletNode,
        error: error.message,
        errorStack: error.stack
      });
    }
  };

  const getStatusColor = () => {
    switch (testStatus) {
      case 'running': return 'text-yellow-400';
      case 'success': return 'text-green-400';
      case 'failed': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="bg-gray-900 text-white p-6 rounded-lg max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">🎵 AudioWorklet Test (Fixed)</h2>
      
      <div className="mb-4">
        <button
          onClick={runTest}
          disabled={testStatus === 'running'}
          className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 px-4 py-2 rounded mr-4"
        >
          {testStatus === 'running' ? 'Test Çalışıyor...' : 'Test Başlat'}
        </button>
        
        <span className={`font-semibold ${getStatusColor()}`}>
          Status: {testStatus}
        </span>
      </div>

      {/* Debug Info */}
      <div className="mb-4 p-3 bg-gray-800 rounded text-sm">
        <h4 className="font-bold mb-2">Debug Info:</h4>
        <div>• Tone.js Version: {Tone.version}</div>
        <div>• AudioContext Available: {!!(window.AudioContext || window.webkitAudioContext) ? '✅' : '❌'}</div>
        <div>• AudioWorkletNode Available: {!!window.AudioWorkletNode ? '✅' : '❌'}</div>
        <div>• BaseAudioContext Available: {!!window.BaseAudioContext ? '✅' : '❌'}</div>
        <div>• Current URL: {window.location.href}</div>
      </div>

      {/* Test Results */}
      {Object.keys(testResults).length > 0 && (
        <div className="mb-4 p-4 bg-gray-800 rounded">
          <h3 className="font-bold mb-2">Test Sonuçları:</h3>
          <pre className="text-sm overflow-x-auto">
            {JSON.stringify(testResults, null, 2)}
          </pre>
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div className="p-4 bg-black rounded">
          <h3 className="font-bold mb-2">Test Logs:</h3>
          <div className="text-sm space-y-1 max-h-80 overflow-y-auto">
            {logs.map((log, index) => (
              <div key={index} className={`font-mono ${
                log.type === 'error' ? 'text-red-400' : 
                log.type === 'success' ? 'text-green-400' : 'text-gray-300'}
              `}>
                <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Browser Info */}
      <div className="mt-4 p-3 bg-gray-800 rounded text-xs text-gray-400">
        <div><strong>Browser Info:</strong></div>
        <div>• User Agent: {navigator.userAgent}</div>
        <div>• Platform: {navigator.platform}</div>
        <div>• Language: {navigator.language}</div>
        <div>• Hardware Concurrency: {navigator.hardwareConcurrency}</div>
      </div>
    </div>
  );
};