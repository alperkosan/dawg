// client/src/components/debug/PerformanceMonitor.jsx
import React, { useState, useEffect } from 'react';
import { AudioContextService } from '@/lib/services/AudioContextService';

export const PerformanceMonitor = () => {
  const [metrics, setMetrics] = useState({});
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isVisible) return;

    const updateMetrics = () => {
      const currentMetrics = AudioContextService.getPerformanceMetrics();
      setMetrics(currentMetrics);
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 1000);

    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) {
    return (
      <button 
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-purple-600 text-white px-3 py-2 rounded text-xs"
      >
        Performance
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/90 text-white p-4 rounded-lg text-xs min-w-64">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold">Audio Performance</h3>
        <button onClick={() => setIsVisible(false)}>×</button>
      </div>
      
      <div className="space-y-1">
        <div className="flex justify-between">
          <span>Mode:</span>
          <span className={metrics.hybridMode ? 'text-green-400' : 'text-yellow-400'}>
            {metrics.hybridMode ? 'Hybrid' : 'Tone.js Only'}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>Audio Latency:</span>
          <span>{metrics.audioLatency}</span>
        </div>
        
        <div className="flex justify-between">
          <span>Worklet Instruments:</span>
          <span>{metrics.workletInstruments || 0}</span>
        </div>
        
        <div className="flex justify-between">
          <span>Tone Instruments:</span>
          <span>{metrics.toneInstruments || 0}</span>
        </div>

        {metrics.cpuUsage && (
          <div className="flex justify-between">
            <span>CPU Usage:</span>
            <span className={metrics.cpuUsage > 80 ? 'text-red-400' : 'text-green-400'}>
              {metrics.cpuUsage.toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {metrics.hybridMode && (
        <div className="mt-2 text-green-400 text-[10px]">
          ⚡ Ultra-low latency enabled
        </div>
      )}
    </div>
  );
};