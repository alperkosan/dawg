// App.jsx içinde
import { WorkletHealthChecker } from './lib/audio/WorkletHealthChecker';
import { storePipeline } from './lib/core/StorePipeline';

const App = () => {
  const [engineStatus, setEngineStatus] = useState('initializing');
  const [engineError, setEngineError] = useState(null);
  
  // ⚡ PERFORMANS KRİTİK: Doğru sıra!
  const initializeAudioSystem = async () => {
    try {
      // 1. Worklet sağlık kontrolü
      setEngineStatus('checking-worklets');
      const workletHealth = await WorkletHealthChecker.validateAllWorklets();
      
      const unhealthyWorklets = Object.entries(workletHealth)
        .filter(([_, health]) => !health.healthy);
      
      if (unhealthyWorklets.length > 0) {
        throw new Error(`Unhealthy worklets: ${unhealthyWorklets.map(([name]) => name).join(', ')}`);
      }
      
      // 2. AudioContext oluştur (user gesture gerekebilir)
      setEngineStatus('creating-context');
      const audioContext = await createAudioContextWithUserGesture();
      
      // 3. Engine'i başlat
      setEngineStatus('initializing-engine');
      const engine = new NativeAudioEngine({
        setPlaybackState: usePlaybackStore.getState().setPlaybackState,
        setTransportPosition: usePlaybackStore.getState().setTransportPosition,
        onPatternChange: (data) => {
          // Pattern değişikliklerini handle et
          storePipeline.scheduleUpdate('arrangement', () => {
            // UI güncellemeleri
          }, 'normal');
        }
      });
      
      await engine.initializeWithContext(audioContext);
      
      // 4. Service'e kaydet
      setEngineStatus('registering-service');
      await AudioContextService.setAudioEngine(engine);
      
      // 5. Store pipeline'ı aktifleştir
      setEngineStatus('activating-stores');
      setupOptimizedStoreSubscriptions(engine);
      
      // 6. Default content'i yükle
      setEngineStatus('loading-content');
      await loadInitialContent(engine);
      
      setEngineStatus('ready');
      
    } catch (error) {
      console.error('🚨 Audio system initialization failed:', error);
      setEngineError(error.message);
      setEngineStatus('error');
    }
  };

  useEffect(() => {
    initializeAudioSystem();
  }, []);
};