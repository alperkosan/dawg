import React, { useEffect, useRef, useState } from 'react';
import { visualizationEngine } from '@/features/visualization/engine/VisualizationEngine';
import { WaveformVisualizer } from '@/features/visualization/engine/visualizers/WaveformVisualizer';
import './VisualizationTest.css';

/**
 * Test component for VisualizationEngine
 * Creates multiple visualizers to stress test the system
 */
export const VisualizationTest = ({ audioContext }) => {
  const [visualizers, setVisualizers] = useState([]);
  const [canAdd, setCanAdd] = useState(true);

  useEffect(() => {
    if (!audioContext) return;

    // Initialize engine
    visualizationEngine.init(audioContext);

    return () => {
      // Cleanup all visualizers on unmount
      visualizers.forEach(viz => {
        visualizationEngine.unregisterVisualizer(viz.id);
      });
    };
  }, [audioContext]);

  const addVisualizer = (priority = 'normal') => {
    if (!audioContext) {
      console.error('AudioContext not available');
      return;
    }

    const id = `viz_${Date.now()}`;
    const canvasRef = React.createRef();

    setVisualizers(prev => [...prev, {
      id,
      priority,
      canvasRef,
      mode: 'line'
    }]);
  };

  const removeVisualizer = (id) => {
    visualizationEngine.unregisterVisualizer(id);
    setVisualizers(prev => prev.filter(v => v.id !== id));
  };

  const changePriority = (id, newPriority) => {
    visualizationEngine.setPriority(id, newPriority);
    setVisualizers(prev => prev.map(v =>
      v.id === id ? { ...v, priority: newPriority } : v
    ));
  };

  const changeMode = (id, mode) => {
    const viz = visualizers.find(v => v.id === id);
    if (viz?.instance) {
      viz.instance.setMode(mode);
      setVisualizers(prev => prev.map(v =>
        v.id === id ? { ...v, mode } : v
      ));
    }
  };

  return (
    <div className="viz-test">
      <div className="viz-test-header">
        <h2>🎨 Visualization Engine Test</h2>
        <div className="viz-test-controls">
          <button onClick={() => addVisualizer('critical')}>
            + Critical (60fps)
          </button>
          <button onClick={() => addVisualizer('normal')}>
            + Normal (30fps)
          </button>
          <button onClick={() => addVisualizer('low')}>
            + Low (15fps)
          </button>
        </div>
      </div>

      <div className="viz-test-grid">
        {visualizers.map(viz => (
          <VisualizerCard
            key={viz.id}
            viz={viz}
            audioContext={audioContext}
            onRemove={() => removeVisualizer(viz.id)}
            onPriorityChange={(p) => changePriority(viz.id, p)}
            onModeChange={(m) => changeMode(viz.id, m)}
          />
        ))}
      </div>

      {visualizers.length === 0 && (
        <div className="viz-test-empty">
          No visualizers. Click buttons above to add some.
        </div>
      )}
    </div>
  );
};

const VisualizerCard = ({ viz, audioContext, onRemove, onPriorityChange, onModeChange }) => {
  const canvasRef = useRef(null);
  const visualizerInstance = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !audioContext) return;

    // Create test oscillator
    const osc = audioContext.createOscillator();
    osc.frequency.value = 440 + Math.random() * 200;
    osc.type = 'sine';

    // Get analyser from engine
    const analyser = visualizationEngine.getAnalyser(viz.id, osc, 'waveform');

    // Create visualizer
    const waveform = new WaveformVisualizer(canvasRef.current, analyser, {
      mode: viz.mode,
      color: getColorForPriority(viz.priority)
    });

    waveform.start();
    visualizerInstance.current = waveform;

    // Store instance in viz object for mode changes
    viz.instance = waveform;

    // Register with engine
    visualizationEngine.registerVisualizer(viz.id, waveform, viz.priority);

    // Start oscillator
    osc.connect(analyser);
    osc.start();

    return () => {
      osc.stop();
      osc.disconnect();
      waveform.destroy();
      visualizationEngine.unregisterVisualizer(viz.id);
    };
  }, [viz.id, audioContext]);

  // Update priority
  useEffect(() => {
    if (visualizerInstance.current) {
      visualizerInstance.current.setPriority(viz.priority);
      visualizerInstance.current.setTheme({
        color: getColorForPriority(viz.priority)
      });
    }
  }, [viz.priority]);

  return (
    <div className="viz-card">
      <div className="viz-card-header">
        <span className="viz-card-id">{viz.id}</span>
        <button className="viz-card-remove" onClick={onRemove}>×</button>
      </div>

      <canvas
        ref={canvasRef}
        className="viz-card-canvas"
        width={300}
        height={150}
      />

      <div className="viz-card-controls">
        <div className="viz-control-group">
          <label>Priority:</label>
          <select
            value={viz.priority}
            onChange={(e) => onPriorityChange(e.target.value)}
          >
            <option value="critical">Critical (60fps)</option>
            <option value="normal">Normal (30fps)</option>
            <option value="low">Low (15fps)</option>
          </select>
        </div>

        <div className="viz-control-group">
          <label>Mode:</label>
          <select
            value={viz.mode}
            onChange={(e) => onModeChange(e.target.value)}
          >
            <option value="line">Line</option>
            <option value="filled">Filled</option>
            <option value="mirror">Mirror</option>
          </select>
        </div>
      </div>
    </div>
  );
};

function getColorForPriority(priority) {
  switch(priority) {
    case 'critical': return '#e74c3c';
    case 'normal': return '#3498db';
    case 'low': return '#95a5a6';
    default: return '#ffffff';
  }
}
