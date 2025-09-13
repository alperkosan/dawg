const DebugPanel = ({ audioEngine }) => {
  const [healthData, setHealthData] = useState(null);
  
  const updateHealth = () => {
    if (audioEngine) {
      setHealthData(audioEngine.performHealthCheck());
    }
  };
  
  useEffect(() => {
    const interval = setInterval(updateHealth, 5000);
    return () => clearInterval(interval);
  }, [audioEngine]);

  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div className="debug-panel">
      <h3>🔧 Debug Panel</h3>
      {healthData && (
        <div>
          <div>Context: {healthData.toneContext}</div>
          <div>Instruments: {healthData.instrumentCount}</div>
          <div>Queue: {healthData.queueSize}</div>
          <div>Errors: {Object.keys(healthData.errors).length}</div>
        </div>
      )}
    </div>
  );
};