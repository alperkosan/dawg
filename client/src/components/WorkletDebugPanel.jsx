import React, { useState, useEffect } from 'react';

export const WorkletDebugPanel = ({ audioEngineRef }) => {
  const [workletStatus, setWorkletStatus] = useState('Unknown');
  const [parameterCount, setParameterCount] = useState(0);

  useEffect(() => {
    const checkStatus = () => {
      const engine = audioEngineRef?.current;
      if (!engine || !engine.parameterWorklet) {
        setWorkletStatus('Not initialized');
        return;
      }

      const worklet = engine.parameterWorklet;
      if (worklet.isLoaded) {
        setWorkletStatus('Active (Ultra-low latency)');
        setParameterCount(worklet.parameters.size);
      } else if (worklet.isSupported) {
        setWorkletStatus('Supported but not loaded');
      } else {
        setWorkletStatus('Not supported (Fallback mode)');
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 2000);
    return () => clearInterval(interval);
  }, [audioEngineRef]);

  // Development modunda göster
  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div className="worklet-debug-panel bg-gray-800 p-3 rounded text-xs text-white fixed top-4 right-4 z-50">
      <h4 className="font-bold mb-2">🔧 Worklet Status</h4>
      <div>Status: <span className={workletStatus.includes('Active') ? 'text-green-400' : 'text-yellow-400'}>{workletStatus}</span></div>
      <div>Parameters: {parameterCount}</div>
      <div>Browser: {navigator.userAgent.includes('Chrome') ? 'Chrome ✅' : 'Other ⚠️'}</div>
    </div>
  );
};
