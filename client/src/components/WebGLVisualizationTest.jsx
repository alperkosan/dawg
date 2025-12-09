import React, { useEffect, useRef, useState } from 'react';
import { visualizationEngine } from '@/features/visualization/engine/VisualizationEngine';
import { WebGLSpectrumAnalyzer } from '@/features/visualization/engine/visualizers/WebGLSpectrumAnalyzer';
import { WebGLWaveform } from '@/features/visualization/engine/visualizers/WebGLWaveform';
import { WebGLOscilloscope } from '@/features/visualization/engine/visualizers/WebGLOscilloscope';
import './WebGLVisualizationTest.css';

/**
 * WebGL Visualization Test Component
 * Demonstrates GPU-accelerated visualizers
 */
export const WebGLVisualizationTest = ({ audioContext }) => {
  const [visualizers, setVisualizers] = useState([]);
  const [audioSource, setAudioSource] = useState(null);

  useEffect(() => {
    if (!audioContext) return;

    // Initialize engine
    visualizationEngine.init(audioContext);

    // Create test audio source (oscillator bank)
    const osc1 = audioContext.createOscillator();
    const osc2 = audioContext.createOscillator();
    const osc3 = audioContext.createOscillator();

    osc1.frequency.value = 220; // A3
    osc2.frequency.value = 277; // C#4
    osc3.frequency.value = 330; // E4

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc3.type = 'sine';

    const mixer = audioContext.createGain();
    mixer.gain.value = 0.3;

    osc1.connect(mixer);
    osc2.connect(mixer);
    osc3.connect(mixer);

    osc1.start();
    osc2.start();
    osc3.start();

    setAudioSource(mixer);

    return () => {
      osc1.stop();
      osc2.stop();
      osc3.stop();
      visualizers.forEach(viz => {
        visualizationEngine.unregisterVisualizer(viz.id);
      });
    };
  }, [audioContext]);

  const addVisualizer = (type) => {
    const id = `webgl_${type}_${Date.now()}`;

    setVisualizers(prev => [...prev, {
      id,
      type,
      canvasRef: React.createRef()
    }]);
  };

  const removeVisualizer = (id) => {
    visualizationEngine.unregisterVisualizer(id);
    setVisualizers(prev => prev.filter(v => v.id !== id));
  };

  return (
    <div className="webgl-viz-test">
      <div className="webgl-viz-header">
        <h2>⚡ WebGL GPU-Accelerated Visualizers</h2>
        <div className="webgl-viz-controls">
          <button onClick={() => addVisualizer('spectrum')}>
            + Spectrum Analyzer
          </button>
          <button onClick={() => addVisualizer('waveform')}>
            + Waveform
          </button>
          <button onClick={() => addVisualizer('oscilloscope')}>
            + Oscilloscope (XY)
          </button>
        </div>
      </div>

      <div className="webgl-viz-grid">
        {visualizers.map(viz => (
          <WebGLVisualizerCard
            key={viz.id}
            viz={viz}
            audioContext={audioContext}
            audioSource={audioSource}
            onRemove={() => removeVisualizer(viz.id)}
          />
        ))}
      </div>

      {visualizers.length === 0 && (
        <div className="webgl-viz-empty">
          <p>🎨 No visualizers yet</p>
          <p>Click buttons above to add GPU-accelerated visualizations</p>
        </div>
      )}
    </div>
  );
};

const WebGLVisualizerCard = ({ viz, audioContext, audioSource, onRemove }) => {
  const canvasRef = useRef(null);
  const visualizerInstance = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !audioContext || !audioSource) return;

    // Get analyser from engine
    const analyserType = viz.type === 'spectrum' ? 'spectrum' : 'waveform';
    const analyser = visualizationEngine.getAnalyser(viz.id, audioSource, analyserType);

    // Create appropriate visualizer
    let visualizer;
    switch (viz.type) {
      case 'spectrum':
        visualizer = new WebGLSpectrumAnalyzer(canvasRef.current, analyser, {
          barCount: 64,
          peakHold: true
        });
        break;

      case 'waveform':
        visualizer = new WebGLWaveform(canvasRef.current, analyser, {
          lineWidth: 2,
          glowIntensity: 0.5
        });
        break;

      case 'oscilloscope':
        visualizer = new WebGLOscilloscope(canvasRef.current, analyser, {
          trailLength: 50,
          pointSize: 3,
          persistence: 0.9
        });
        break;

      default:
        return;
    }

    visualizer.start();
    visualizerInstance.current = visualizer;

    // Register with engine (critical priority for smooth 60fps)
    visualizationEngine.registerVisualizer(viz.id, visualizer, 'critical');

    return () => {
      visualizer.destroy();
      visualizationEngine.unregisterVisualizer(viz.id);
    };
  }, [viz.id, viz.type, audioContext, audioSource]);

  const getVisualizerTitle = (type) => {
    switch (type) {
      case 'spectrum': return '📊 Spectrum Analyzer';
      case 'waveform': return '🌊 Waveform';
      case 'oscilloscope': return '⭕ Oscilloscope (XY)';
      default: return type;
    }
  };

  const getVisualizerDescription = (type) => {
    switch (type) {
      case 'spectrum':
        return 'Real-time FFT with peak hold & gradient bars';
      case 'waveform':
        return 'Time-domain display with glow effects';
      case 'oscilloscope':
        return 'Lissajous curves with particle trails';
      default:
        return '';
    }
  };

  return (
    <div className="webgl-viz-card">
      <div className="webgl-viz-card-header">
        <div className="webgl-viz-card-info">
          <h3>{getVisualizerTitle(viz.type)}</h3>
          <p>{getVisualizerDescription(viz.type)}</p>
        </div>
        <button className="webgl-viz-card-remove" onClick={onRemove}>×</button>
      </div>

      <canvas
        ref={canvasRef}
        className="webgl-viz-card-canvas"
        width={600}
        height={300}
      />

      <div className="webgl-viz-card-footer">
        <span className="webgl-badge">⚡ GPU Accelerated</span>
        <span className="webgl-badge">🎯 60 FPS</span>
        <span className="webgl-badge">✨ WebGL 2.0</span>
      </div>
    </div>
  );
};
